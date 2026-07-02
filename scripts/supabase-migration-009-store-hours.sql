-- Migration 009: Horários de funcionamento por loja
-- Cada loja tem 7 linhas (0=Domingo … 6=Sábado)

CREATE TABLE IF NOT EXISTS store_hours (
  store_id      uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  day_of_week   smallint    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_open       boolean     NOT NULL DEFAULT true,
  open_time     time        NOT NULL DEFAULT '08:00',
  close_time    time        NOT NULL DEFAULT '22:00',
  PRIMARY KEY (store_id, day_of_week)
);

ALTER TABLE store_hours ENABLE ROW LEVEL SECURITY;

-- Leitura pública (vitrine do cliente)
CREATE POLICY "store_hours_public_read" ON store_hours
  FOR SELECT USING (true);

-- Escrita apenas via service role (API gerencia)
CREATE POLICY "store_hours_service_write" ON store_hours
  FOR ALL USING (true) WITH CHECK (true);

-- Popula horários padrão para lojas existentes (Seg–Sex 08–22h, Sáb 08–18h, Dom fechado)
INSERT INTO store_hours (store_id, day_of_week, is_open, open_time, close_time)
SELECT
  s.id,
  d.day,
  CASE d.day
    WHEN 0 THEN false   -- Domingo
    WHEN 6 THEN true    -- Sábado
    ELSE true           -- Seg–Sex
  END,
  '08:00'::time,
  CASE d.day
    WHEN 6 THEN '18:00'::time
    ELSE '22:00'::time
  END
FROM stores s
CROSS JOIN (
  SELECT generate_series(0, 6) AS day
) d
ON CONFLICT (store_id, day_of_week) DO NOTHING;
