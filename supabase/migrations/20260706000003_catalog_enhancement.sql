-- =============================================================================
-- CATÁLOGO: GTIN/EAN/SKU, variantes, peso, tags, atributos
--
-- Objetivo: suportar 100.000 produtos com busca < 100ms.
-- Adiciona colunas essenciais para catálogo profissional sem alterar
-- a estrutura existente (apenas ADD COLUMN IF NOT EXISTS).
-- =============================================================================

-- ── 1. Colunas de identificação e logística ───────────────────────────────────

ALTER TABLE public.store_products
  -- Código de barras (EAN-13, UPC, QR, etc.)
  ADD COLUMN IF NOT EXISTS barcode        text,
  -- Código interno do lojista (SKU)
  ADD COLUMN IF NOT EXISTS sku            text,
  -- Unidade de medida (un, kg, l, m, cx…)
  ADD COLUMN IF NOT EXISTS unit           text NOT NULL DEFAULT 'un',
  -- Peso em gramas (para cálculo de frete)
  ADD COLUMN IF NOT EXISTS weight_g       int,
  -- Dimensões em cm: [comprimento, largura, altura]
  ADD COLUMN IF NOT EXISTS dimensions_cm  int[],
  -- Tags para busca adicional (ex: ['promoção', 'orgânico'])
  ADD COLUMN IF NOT EXISTS tags           text[] DEFAULT '{}',
  -- Atributos dinâmicos para variantes (cor, tamanho, sabor…)
  -- Ex: {"cor": "Azul", "tamanho": "M"}
  ADD COLUMN IF NOT EXISTS attributes     jsonb DEFAULT '{}',
  -- ID do produto pai (para variantes do mesmo produto base)
  ADD COLUMN IF NOT EXISTS parent_id      uuid REFERENCES public.store_products(id) ON DELETE SET NULL,
  -- Posição de exibição dentro da loja (menor = mais destacado)
  ADD COLUMN IF NOT EXISTS sort_order     int NOT NULL DEFAULT 0,
  -- Número de vendas (atualizado por trigger no confirm do pedido)
  ADD COLUMN IF NOT EXISTS sales_count    int NOT NULL DEFAULT 0,
  -- Imagens adicionais (segunda, terceira foto, etc.)
  ADD COLUMN IF NOT EXISTS extra_images   text[] DEFAULT '{}';

-- ── 2. Índices para catálogo de 100K produtos ─────────────────────────────────

-- Busca por código de barras (scanner, importação)
CREATE INDEX IF NOT EXISTS idx_sp_barcode
  ON public.store_products (barcode)
  WHERE barcode IS NOT NULL;

-- Busca por SKU dentro de uma loja
CREATE INDEX IF NOT EXISTS idx_sp_store_sku
  ON public.store_products (store_id, sku)
  WHERE sku IS NOT NULL;

-- Variantes: busca filho por pai
CREATE INDEX IF NOT EXISTS idx_sp_parent_id
  ON public.store_products (parent_id)
  WHERE parent_id IS NOT NULL;

-- Ordenação por relevância: mais vendidos, ordenação customizada
CREATE INDEX IF NOT EXISTS idx_sp_store_sort_sales
  ON public.store_products (store_id, sort_order, sales_count DESC)
  WHERE available = true;

-- Tags: GIN para busca por tag individual (ANY/&&)
CREATE INDEX IF NOT EXISTS idx_sp_tags_gin
  ON public.store_products USING GIN (tags)
  WHERE tags IS NOT NULL AND array_length(tags, 1) > 0;

-- Atributos: GIN para busca por atributo (jsonb @>)
CREATE INDEX IF NOT EXISTS idx_sp_attributes_gin
  ON public.store_products USING GIN (attributes)
  WHERE attributes IS NOT NULL AND attributes != '{}';

-- ── 3. Recria search_vector incluindo tags ────────────────────────────────────
-- A coluna search_vector foi criada em 20260705100000 sem tags.
-- Aqui redefinimos com tags (peso C) para enriquecer o FTS.
-- Supabase suporta ALTER COLUMN para colunas GENERATED ALWAYS.

ALTER TABLE public.store_products
  DROP COLUMN IF EXISTS search_vector;

ALTER TABLE public.store_products
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('portuguese', coalesce(name,        '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(brand,       '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(category,    '')), 'C') ||
    setweight(to_tsvector('portuguese', coalesce(sku,         '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(barcode,     '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(description, '')), 'D') ||
    setweight(to_tsvector('portuguese', coalesce(array_to_string(tags, ' '), '')), 'C')
  ) STORED;

-- Recria o GIN index
CREATE INDEX IF NOT EXISTS idx_store_products_fts
  ON public.store_products USING GIN (search_vector);

-- ── 4. Trigger: incrementa sales_count ao confirmar pagamento ────────────────

CREATE OR REPLACE FUNCTION public.increment_product_sales()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- Dispara quando o status do pedido passa para 1 (confirmado)
  IF NEW.status = 1 AND (OLD.status IS NULL OR OLD.status != 1) THEN
    UPDATE public.store_products sp
    SET    sales_count = sales_count + oi.quantity
    FROM   public.order_items oi
    WHERE  oi.order_id         = NEW.id
      AND  oi.store_product_id = sp.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_increment_sales ON public.orders;
CREATE TRIGGER orders_increment_sales
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.increment_product_sales();

-- ── 5. pg_trgm para busca fuzzy (digita errado mas acha certo) ───────────────

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- Trigram index no nome para similarity search e ILIKE eficiente
CREATE INDEX IF NOT EXISTS idx_sp_name_trgm
  ON public.store_products USING GIN (name gin_trgm_ops);

-- ── 6. Grants ─────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.increment_product_sales() TO service_role;
