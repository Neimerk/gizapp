-- ============================================================
-- BrasUX — Migração 005: Full-Text Search
-- Execute no Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Extensões ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS unaccent;    -- "cafe" encontra "Café"
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- "celul" encontra "Celular" (fuzzy)

-- ── 2. Configuração FTS com suporte a acentos ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_ts_config WHERE cfgname = 'portuguese_unaccent'
  ) THEN
    CREATE TEXT SEARCH CONFIGURATION portuguese_unaccent (COPY = pg_catalog.portuguese);
    ALTER TEXT SEARCH CONFIGURATION portuguese_unaccent
      ALTER MAPPING FOR hword, hword_part, word WITH unaccent, portuguese_stem;
  END IF;
END;
$$;

-- ── 3. Coluna search_vector ───────────────────────────────────
ALTER TABLE store_products ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Popula o vetor para todos os produtos existentes
UPDATE store_products
SET search_vector = to_tsvector('portuguese_unaccent',
  coalesce(name,        '') || ' ' ||
  coalesce(brand,       '') || ' ' ||
  coalesce(category,    '') || ' ' ||
  coalesce(sub_category,'') || ' ' ||
  coalesce(description, '')
);

-- ── 4. Índices ────────────────────────────────────────────────
-- GIN para full-text search (rápido)
CREATE INDEX IF NOT EXISTS idx_sp_search_vector
  ON store_products USING gin(search_vector);

-- Trigram para fuzzy (tolera typos e buscas parciais)
CREATE INDEX IF NOT EXISTS idx_sp_name_trgm
  ON store_products USING gin(name gin_trgm_ops);

-- ── 5. Trigger: mantém search_vector atualizado ───────────────
CREATE OR REPLACE FUNCTION fn_update_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('portuguese_unaccent',
    coalesce(NEW.name,        '') || ' ' ||
    coalesce(NEW.brand,       '') || ' ' ||
    coalesce(NEW.category,    '') || ' ' ||
    coalesce(NEW.sub_category,'') || ' ' ||
    coalesce(NEW.description, '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trig_sp_search_vector ON store_products;
CREATE TRIGGER trig_sp_search_vector
  BEFORE INSERT OR UPDATE OF name, brand, category, sub_category, description
  ON store_products
  FOR EACH ROW EXECUTE FUNCTION fn_update_search_vector();

-- ── 6. Função de autocomplete (sugestões em tempo real) ───────
CREATE OR REPLACE FUNCTION get_search_suggestions(
  p_query text,
  p_limit int DEFAULT 6
)
RETURNS TABLE(label text, category text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (unaccent(lower(name)))
    name  AS label,
    category
  FROM store_products
  WHERE
    available = true
    AND (
      unaccent(name) ILIKE unaccent(p_query) || '%'
      OR unaccent(name) ILIKE '% ' || unaccent(p_query) || '%'
      OR similarity(unaccent(name), unaccent(p_query)) > 0.25
    )
  ORDER BY unaccent(lower(name)), name
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_search_suggestions TO anon, authenticated;

-- ── 7. Tabela de analytics de busca ───────────────────────────
CREATE TABLE IF NOT EXISTS search_queries (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  query      text NOT NULL,
  results    int  NOT NULL DEFAULT 0,
  user_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_search_queries_query
  ON search_queries(query);
