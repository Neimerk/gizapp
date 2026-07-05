-- =============================================================================
-- PAGINAÇÃO CURSOR-BASED + MATERIALIZED VIEWS
--
-- Objetivo: busca < 100ms com 100K produtos; dashboards sem seq scan.
--
-- Por que cursor-based?
--   OFFSET 90000 LIMIT 20 em 100K produtos = PostgreSQL lê 90020 rows.
--   Cursor-based (WHERE id > $cursor) = scan mínimo usando índice.
-- =============================================================================

-- ── 1. search_products_cursor ─────────────────────────────────────────────────
-- RPC para busca paginada por cursor (keyset pagination).
-- Suporta filtros por store_id, category, tag, FTS query e faixa de preço.
-- Retorna no máximo p_limit+1 linhas — se COUNT > p_limit, há próxima página.

CREATE OR REPLACE FUNCTION public.search_products_cursor(
  p_query       text    DEFAULT NULL,
  p_store_id    uuid    DEFAULT NULL,
  p_category    text    DEFAULT NULL,
  p_tag         text    DEFAULT NULL,
  p_min_price   numeric DEFAULT NULL,
  p_max_price   numeric DEFAULT NULL,
  p_cursor_id   uuid    DEFAULT NULL,   -- ID do último item da página anterior
  p_limit       int     DEFAULT 20,
  p_sort        text    DEFAULT 'relevance'  -- relevance | price_asc | price_desc | newest | sales
)
RETURNS TABLE (
  id                uuid,
  store_id          uuid,
  store_name        text,
  name              text,
  brand             text,
  category          text,
  description       text,
  price             numeric,
  promotional_price numeric,
  image_url         text,
  extra_images      text[],
  available         boolean,
  featured          boolean,
  stock             int,
  sku               text,
  barcode           text,
  tags              text[],
  attributes        jsonb,
  sales_count       int,
  sort_order        int,
  rank              real
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_cursor_row public.store_products%ROWTYPE;
  v_tsquery    tsquery;
BEGIN
  -- Resolve cursor (posição de continuação)
  IF p_cursor_id IS NOT NULL THEN
    SELECT * INTO v_cursor_row FROM public.store_products WHERE id = p_cursor_id;
  END IF;

  -- Compila tsquery uma única vez
  IF p_query IS NOT NULL AND p_query != '' THEN
    BEGIN
      v_tsquery := websearch_to_tsquery('portuguese', p_query);
    EXCEPTION WHEN OTHERS THEN
      v_tsquery := NULL;
    END;
  END IF;

  RETURN QUERY
  SELECT
    sp.id,
    sp.store_id,
    s.name        AS store_name,
    sp.name,
    sp.brand,
    sp.category,
    sp.description,
    sp.price,
    sp.promotional_price,
    sp.image_url,
    COALESCE(sp.extra_images, '{}') AS extra_images,
    sp.available,
    sp.featured,
    COALESCE(sp.stock, 0)           AS stock,
    sp.sku,
    sp.barcode,
    COALESCE(sp.tags, '{}')         AS tags,
    COALESCE(sp.attributes, '{}')   AS attributes,
    COALESCE(sp.sales_count, 0)     AS sales_count,
    COALESCE(sp.sort_order, 0)      AS sort_order,
    -- Rank de relevância (0 quando não há query)
    CASE
      WHEN v_tsquery IS NOT NULL
      THEN ts_rank_cd(sp.search_vector, v_tsquery)
      ELSE 0::real
    END AS rank
  FROM  public.store_products sp
  JOIN  public.stores          s ON s.id = sp.store_id
  WHERE sp.available = true
    -- Filtros opcionais
    AND (p_store_id IS NULL OR sp.store_id = p_store_id)
    AND (p_category IS NULL OR sp.category = p_category)
    AND (p_tag IS NULL OR p_tag = ANY(sp.tags))
    AND (p_min_price IS NULL OR COALESCE(sp.promotional_price, sp.price) >= p_min_price)
    AND (p_max_price IS NULL OR COALESCE(sp.promotional_price, sp.price) <= p_max_price)
    -- FTS ou trigram fallback
    AND (
      v_tsquery IS NULL
      OR sp.search_vector @@ v_tsquery
      OR sp.name ILIKE '%' || p_query || '%'
    )
    -- Cursor keyset: paginação sem offset
    AND (
      p_cursor_id IS NULL OR (
        CASE p_sort
          WHEN 'price_asc'  THEN (COALESCE(sp.promotional_price, sp.price),  sp.id::text)
            > (COALESCE(v_cursor_row.promotional_price, v_cursor_row.price), v_cursor_row.id::text)
          WHEN 'price_desc' THEN (COALESCE(sp.promotional_price, sp.price),  sp.id::text)
            < (COALESCE(v_cursor_row.promotional_price, v_cursor_row.price), v_cursor_row.id::text)
          WHEN 'newest'     THEN (sp.created_at, sp.id::text)
            < (v_cursor_row.created_at, v_cursor_row.id::text)
          WHEN 'sales'      THEN (sp.sales_count, sp.id::text)
            < (v_cursor_row.sales_count, v_cursor_row.id::text)
          ELSE sp.id > p_cursor_id  -- relevance / default
        END
      )
    )
  ORDER BY
    CASE p_sort
      WHEN 'price_asc'  THEN COALESCE(sp.promotional_price, sp.price)
      WHEN 'price_desc' THEN -COALESCE(sp.promotional_price, sp.price)
      WHEN 'newest'     THEN EXTRACT(EPOCH FROM sp.created_at) * -1
      WHEN 'sales'      THEN sp.sales_count::float * -1
      ELSE
        CASE WHEN v_tsquery IS NOT NULL
          THEN ts_rank_cd(sp.search_vector, v_tsquery) * -1
          ELSE 0::float
        END
    END,
    sp.id
  LIMIT (p_limit + 1);  -- +1 detecta se há próxima página
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_products_cursor(text, uuid, text, text, numeric, numeric, uuid, int, text)
  TO anon, authenticated, service_role;

-- ── 2. get_search_suggestions (atualizada) ────────────────────────────────────
-- Versão melhorada: usa FTS + trigram, retorna count de produtos.

CREATE OR REPLACE FUNCTION public.get_search_suggestions(
  p_query text,
  p_limit int DEFAULT 6
)
RETURNS TABLE (label text, category text, match_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    sp.name    AS label,
    sp.category,
    COUNT(*)   AS match_count
  FROM public.store_products sp
  WHERE sp.available = true
    AND (
      sp.search_vector @@ websearch_to_tsquery('portuguese', p_query)
      OR sp.name ILIKE p_query || '%'
      OR similarity(sp.name, p_query) > 0.3
    )
  GROUP BY sp.name, sp.category
  ORDER BY MAX(ts_rank_cd(sp.search_vector, websearch_to_tsquery('portuguese', p_query))) DESC, sp.name
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_search_suggestions(text, int) TO anon, authenticated;

-- ── 3. MATERIALIZED VIEWS ─────────────────────────────────────────────────────

-- 3a. mv_featured_stores: lojas em destaque com score de atividade
--     Usada na HomePage e FeaturedStoresPage (evita JOIN pesado a cada request).
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_featured_stores AS
SELECT
  s.id,
  s.name,
  s.slug,
  s.description,
  s.category,
  s.logo_url,
  s.cover_url,
  s.lat,
  s.lng,
  s.delivery_fee,
  s.min_order,
  s.delivery_time_min,
  s.delivery_time_max,
  s.featured,
  s.active,
  COUNT(DISTINCT sp.id)   AS product_count,
  COUNT(DISTINCT o.id)    AS order_count_30d,
  COALESCE(AVG(o.total), 0) AS avg_ticket
FROM  public.stores s
LEFT  JOIN public.store_products sp ON sp.store_id = s.id AND sp.available = true
LEFT  JOIN public.orders o
  ON  o.store_id = s.id
  AND o.created_at > now() - interval '30 days'
  AND o.payment_status = 'CONFIRMED'
WHERE s.active = true
GROUP BY s.id
ORDER BY s.featured DESC, order_count_30d DESC, s.name;

CREATE UNIQUE INDEX IF NOT EXISTS mv_featured_stores_id_idx ON public.mv_featured_stores (id);
CREATE INDEX IF NOT EXISTS mv_featured_stores_featured_idx ON public.mv_featured_stores (featured DESC);
CREATE INDEX IF NOT EXISTS mv_featured_stores_category_idx ON public.mv_featured_stores (category);

-- 3b. mv_category_product_counts: total de produtos disponíveis por categoria
--     Usada em CategoriesPage e CategoryPage para exibir contagem sem query.
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_category_product_counts AS
SELECT
  category,
  COUNT(*) AS product_count
FROM  public.store_products
WHERE available = true
GROUP BY category;

CREATE UNIQUE INDEX IF NOT EXISTS mv_cat_count_cat_idx ON public.mv_category_product_counts (category);

-- 3c. mv_top_products: top 200 produtos por vendas (para homepage e destaques)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_top_products AS
SELECT
  sp.id,
  sp.store_id,
  s.name AS store_name,
  sp.name,
  sp.brand,
  sp.category,
  sp.price,
  sp.promotional_price,
  sp.image_url,
  sp.featured,
  COALESCE(sp.sales_count, 0) AS sales_count
FROM  public.store_products sp
JOIN  public.stores s ON s.id = sp.store_id AND s.active = true
WHERE sp.available = true
ORDER BY sp.sales_count DESC, sp.created_at DESC
LIMIT 200;

CREATE UNIQUE INDEX IF NOT EXISTS mv_top_products_id_idx ON public.mv_top_products (id);
CREATE INDEX IF NOT EXISTS mv_top_products_category_idx ON public.mv_top_products (category);

-- ── 4. refresh_materialized_views ─────────────────────────────────────────────
-- Função chamada pelo cron a cada 15 minutos (CONCURRENTLY = sem lock de leitura).

CREATE OR REPLACE FUNCTION public.refresh_materialized_views()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_featured_stores;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_category_product_counts;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_top_products;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_materialized_views() TO service_role;

-- Agenda refresh a cada 15 minutos via pg_cron
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-materialized-views') THEN
      PERFORM cron.unschedule('refresh-materialized-views');
    END IF;
    PERFORM cron.schedule(
      'refresh-materialized-views',
      '*/15 * * * *',
      $job$
        SELECT net.http_post(
          url     := public._get_cron_cfg('supabase_url') || '/functions/v1/cron-runner',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-key',   public._get_cron_cfg('cron_key')
          ),
          body    := '{"job":"refresh-materialized-views"}'::jsonb
        ) AS request_id;
      $job$
    );
  END IF;
END;
$$;

-- ── 5. Grants nas materialized views ──────────────────────────────────────────

GRANT SELECT ON public.mv_featured_stores          TO anon, authenticated;
GRANT SELECT ON public.mv_category_product_counts  TO anon, authenticated;
GRANT SELECT ON public.mv_top_products             TO anon, authenticated;
