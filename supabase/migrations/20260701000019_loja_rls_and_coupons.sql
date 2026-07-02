-- ============================================================
-- Migration 019 — RLS para operações do lojista + vendor_id em coupons
-- ============================================================

-- ── 1. coupons: adiciona vendor_id e colunas que faltam ──────
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS vendor_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS store_id     uuid REFERENCES public.stores(id)   ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS description  text,
  ADD COLUMN IF NOT EXISTS valid_from   timestamptz;

-- Índice para busca por vendor
CREATE INDEX IF NOT EXISTS coupons_vendor_id_idx ON public.coupons (vendor_id);

-- RLS para cupons: lojista gerencia apenas os seus
DROP POLICY IF EXISTS coupons_vendor ON public.coupons;
CREATE POLICY coupons_vendor ON public.coupons
  FOR ALL TO authenticated
  USING  (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

-- ── 2. orders: lojista pode atualizar status dos seus pedidos ─
DROP POLICY IF EXISTS orders_vendor_update ON public.orders;
CREATE POLICY orders_vendor_update ON public.orders
  FOR UPDATE TO authenticated
  USING     (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

-- ── 3. store_products: garante UPDATE para o dono da loja ────
-- (policy "products_write" cobre ALL mas só se store.owner_id = auth.uid())
DROP POLICY IF EXISTS products_owner_write ON public.store_products;
CREATE POLICY products_owner_write ON public.store_products
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = store_products.store_id
      AND stores.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = store_products.store_id
      AND stores.owner_id = auth.uid()
  ));
