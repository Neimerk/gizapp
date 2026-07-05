-- =============================================================================
-- CATÁLOGO: GTIN/EAN/SKU, variantes, peso, tags, atributos
--
-- Objetivo: suportar 100.000 produtos com busca < 100ms.
-- Adiciona colunas essenciais para catálogo profissional sem alterar
-- a estrutura existente (apenas ADD COLUMN IF NOT EXISTS).
--
-- Nota: search_vector já existe como coluna regular atualizada pelo trigger
-- fn_update_search_vector(). Não usar GENERATED ALWAYS AS (to_tsvector(...))
-- porque to_tsvector(text, text) é STABLE, não IMMUTABLE — o PostgreSQL
-- rejeita a expressão de geração. Atualizamos o trigger em vez disso.
-- =============================================================================

-- ── 1. Colunas de identificação e logística ───────────────────────────────────

ALTER TABLE public.store_products
  ADD COLUMN IF NOT EXISTS barcode        text,
  ADD COLUMN IF NOT EXISTS sku            text,
  ADD COLUMN IF NOT EXISTS unit           text NOT NULL DEFAULT 'un',
  ADD COLUMN IF NOT EXISTS weight_g       int,
  ADD COLUMN IF NOT EXISTS dimensions_cm  int[],
  ADD COLUMN IF NOT EXISTS tags           text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS attributes     jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS parent_id      uuid REFERENCES public.store_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sort_order     int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_count    int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_images   text[] DEFAULT '{}';

-- ── 2. Índices para catálogo de 100K produtos ─────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sp_barcode
  ON public.store_products (barcode)
  WHERE barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sp_store_sku
  ON public.store_products (store_id, sku)
  WHERE sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sp_parent_id
  ON public.store_products (parent_id)
  WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sp_store_sort_sales
  ON public.store_products (store_id, sort_order, sales_count DESC)
  WHERE available = true;

CREATE INDEX IF NOT EXISTS idx_sp_tags_gin
  ON public.store_products USING GIN (tags)
  WHERE tags IS NOT NULL AND array_length(tags, 1) > 0;

CREATE INDEX IF NOT EXISTS idx_sp_attributes_gin
  ON public.store_products USING GIN (attributes)
  WHERE attributes IS NOT NULL AND attributes != '{}';

-- ── 3. Atualiza fn_update_search_vector para incluir sku, barcode e tags ──────
-- A função existente usa 'portuguese_unaccent'. Adicionamos sku (B), barcode (B)
-- e tags (C) para enriquecer o FTS sem alterar a coluna search_vector.

CREATE OR REPLACE FUNCTION public.fn_update_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('portuguese_unaccent',
    coalesce(NEW.name,        '') || ' ' ||
    coalesce(NEW.brand,       '') || ' ' ||
    coalesce(NEW.sku,         '') || ' ' ||
    coalesce(NEW.barcode,     '') || ' ' ||
    coalesce(NEW.category,    '') || ' ' ||
    coalesce(NEW.sub_category,'') || ' ' ||
    coalesce(array_to_string(NEW.tags, ' '), '') || ' ' ||
    coalesce(NEW.description, '')
  );
  RETURN NEW;
END;
$$;

-- ── 4. pg_trgm para busca fuzzy ───────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- idx_sp_name_trgm pode já existir da migration anterior; IF NOT EXISTS é seguro
CREATE INDEX IF NOT EXISTS idx_sp_name_trgm
  ON public.store_products USING GIN (name gin_trgm_ops);

-- ── 5. Trigger: incrementa sales_count ao confirmar pagamento ────────────────

CREATE OR REPLACE FUNCTION public.increment_product_sales()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
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

-- ── 6. Grants ─────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.increment_product_sales() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_update_search_vector() TO service_role;
