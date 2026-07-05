-- =============================================================================
-- ESCALABILIDADE: FTS, ÍNDICES COMPOSTOS, GEOCODE CACHE, SEARCH SUGGESTIONS
-- Alvo: 5K pedidos/dia, 500 lojas, 100K produtos, 50K usuários
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. FULL-TEXT SEARCH em store_products
--    Código referencia search_vector + config 'portuguese' — esta migração cria ambos.
-- ---------------------------------------------------------------------------

-- Coluna gerada: atualizada automaticamente no INSERT/UPDATE, sem trigger
ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('portuguese', coalesce(name,        '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(brand,       '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(category,    '')), 'C') ||
    setweight(to_tsvector('portuguese', coalesce(description, '')), 'D')
  ) STORED;

-- GIN para @@ (textSearch) — essencial para FTS eficiente em 100K produtos
CREATE INDEX IF NOT EXISTS idx_store_products_fts
  ON store_products USING GIN (search_vector);

-- ---------------------------------------------------------------------------
-- 2. ÍNDICES COMPOSTOS em store_products
--    Padrões de query identificados em gizApi.ts: getStoreProducts, getProducts,
--    getFeaturedProducts, getStoreProductsByCategory
-- ---------------------------------------------------------------------------

-- getStoreProducts: WHERE store_id=$1 AND available=true ORDER BY name
CREATE INDEX IF NOT EXISTS idx_sp_store_available_name
  ON store_products (store_id, available, name)
  WHERE available = true;

-- getProducts + getStoreProductsByCategory: WHERE category=$1 AND available=true
CREATE INDEX IF NOT EXISTS idx_sp_category_available
  ON store_products (category, available)
  WHERE available = true;

-- getFeaturedProducts: WHERE featured=true AND available=true
CREATE INDEX IF NOT EXISTS idx_sp_featured_available
  ON store_products (featured, available)
  WHERE featured = true AND available = true;

-- getProducts ORDER BY price (ASC e DESC compartilham o mesmo índice via BACKWARD scan)
CREATE INDEX IF NOT EXISTS idx_sp_available_price
  ON store_products (available, price)
  WHERE available = true;

-- getProducts ORDER BY created_at DESC (newest)
CREATE INDEX IF NOT EXISTS idx_sp_available_created
  ON store_products (available, created_at DESC)
  WHERE available = true;

-- ---------------------------------------------------------------------------
-- 3. ÍNDICES COMPOSTOS em stores
--    getStores: ORDER BY featured DESC, name — sem filtro explícito de active
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_stores_featured_name
  ON stores (featured DESC, name);

-- Filtro por categoria (navegação de departamentos)
CREATE INDEX IF NOT EXISTS idx_stores_category_active
  ON stores (category, active)
  WHERE active = true;

-- ---------------------------------------------------------------------------
-- 4. ÍNDICES COMPOSTOS em orders
--    Padrões: getMyOrders (customer_id + created_at), seller queries (store_id + status)
-- ---------------------------------------------------------------------------

-- Histórico do comprador: WHERE customer_id=$1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_orders_customer_created
  ON orders (customer_id, created_at DESC);

-- Pedidos da loja: WHERE store_id=$1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_orders_store_created
  ON orders (store_id, created_at DESC);

-- Pedidos da loja com filtro de status (painel do lojista)
CREATE INDEX IF NOT EXISTS idx_orders_store_status_created
  ON orders (store_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5. GEOCODING CACHE
--    Resolve o gargalo do Nominatim (1 req/s global).
--    Chave: hash SHA-256 da string de endereço.
--    RPCs SECURITY DEFINER para acesso anon/authenticated.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.geocode_cache (
  query_hash  text PRIMARY KEY,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  cached_at   timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE geocode_cache ENABLE ROW LEVEL SECURITY;

-- Leitura pública (cache é dado público — coordenadas de bairros)
CREATE POLICY "geocode_cache_read_all"
  ON geocode_cache FOR SELECT USING (true);

-- Escrita apenas via função SECURITY DEFINER (nenhum usuário escreve diretamente)
CREATE POLICY "geocode_cache_no_direct_write"
  ON geocode_cache FOR INSERT WITH CHECK (false);

-- Expira entradas com mais de 90 dias (Supabase pg_cron pode chamar isso)
CREATE INDEX IF NOT EXISTS idx_geocode_cache_age
  ON geocode_cache (cached_at);

-- Busca cache por hash de endereço
CREATE OR REPLACE FUNCTION public.get_geocode_cached(p_hash text)
RETURNS TABLE (lat double precision, lng double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lat, lng FROM geocode_cache WHERE query_hash = p_hash LIMIT 1;
$$;

-- Persiste resultado do geocoding (upsert idempotente)
CREATE OR REPLACE FUNCTION public.upsert_geocode_cache(
  p_hash text,
  p_lat  double precision,
  p_lng  double precision
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO geocode_cache (query_hash, lat, lng)
  VALUES (p_hash, p_lat, p_lng)
  ON CONFLICT (query_hash) DO NOTHING;
$$;

GRANT EXECUTE ON FUNCTION public.get_geocode_cached(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_geocode_cache(text, double precision, double precision) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. get_search_suggestions RPC
--    Referenciado em gizApi.ts:570 — sem definição prévia nas migrations.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_search_suggestions(
  p_query text,
  p_limit int DEFAULT 6
)
RETURNS TABLE (label text, category text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (name)
    name    AS label,
    category
  FROM store_products
  WHERE available = true
    AND (
      search_vector @@ websearch_to_tsquery('portuguese', p_query)
      OR name ILIKE p_query || '%'
    )
  ORDER BY name
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_search_suggestions(text, int) TO anon, authenticated;

-- NOTE: get_delivery_tracking_public e get_driver_position_public já existem
-- com assinatura correta em migration anterior. Não redefinir aqui.
