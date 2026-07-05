-- =============================================================================
-- DELIVERY TRACKING: delivery_drivers + delivery_orders
--
-- Evidência de gap: useOrderTracking.ts queries delivery_orders e
-- delivery_drivers diretamente via RLS (auth) e via RPCs SECURITY DEFINER
-- (guest). A migration 20260705100000 diz "já existem" mas não há nenhuma
-- migration anterior que as defina — as tabelas estão faltando para novos
-- deploys.
--
-- get_delivery_tracking_public e get_driver_position_public também são
-- definidos aqui (IDEMPOTENTE — CREATE OR REPLACE).
-- =============================================================================

-- ── 1. delivery_drivers ───────────────────────────────────────────────────────
-- Uma linha por entregador registrado na plataforma.
-- O app do entregador atualiza current_lat/lng/heading a cada ~3s via RPC.

CREATE TABLE IF NOT EXISTS public.delivery_drivers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_lat double precision,
  current_lng double precision,
  heading     double precision,
  is_online   boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (courier_id)
);

ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;

-- Entregador lê e atualiza sua própria linha; admin lê todas
DROP POLICY IF EXISTS "dd_courier_own" ON public.delivery_drivers;
CREATE POLICY "dd_courier_own" ON public.delivery_drivers
  FOR ALL USING (courier_id = auth.uid())
  WITH CHECK (courier_id = auth.uid());

DROP POLICY IF EXISTS "dd_authenticated_read" ON public.delivery_drivers;
CREATE POLICY "dd_authenticated_read" ON public.delivery_drivers
  FOR SELECT USING (is_online = true);

DROP POLICY IF EXISTS "dd_admin_all" ON public.delivery_drivers;
CREATE POLICY "dd_admin_all" ON public.delivery_drivers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_dd_courier_id ON public.delivery_drivers (courier_id);
CREATE INDEX IF NOT EXISTS idx_dd_online     ON public.delivery_drivers (is_online) WHERE is_online = true;

GRANT ALL    ON public.delivery_drivers TO service_role;
GRANT SELECT ON public.delivery_drivers TO authenticated;
GRANT UPDATE (current_lat, current_lng, heading, is_online, updated_at)
  ON public.delivery_drivers TO authenticated;

-- ── 2. delivery_orders ────────────────────────────────────────────────────────
-- Uma linha por entrega — lifecycle do pedido da loja até o cliente.
-- Alimenta o mapa ao vivo (useOrderTracking.ts + LiveTrackingMap.tsx).

CREATE TABLE IF NOT EXISTS public.delivery_orders (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id         uuid        REFERENCES public.delivery_drivers(id) ON DELETE SET NULL,
  lifecycle         text        NOT NULL DEFAULT 'waiting_courier'
    CHECK (lifecycle IN (
      'waiting_courier', 'courier_assigned', 'courier_arriving',
      'picked_up', 'in_transit', 'arrived', 'delivered', 'cancelled', 'failed'
    )),
  pickup_lat        double precision,
  pickup_lng        double precision,
  dropoff_lat       double precision,
  dropoff_lng       double precision,
  route_geometry    jsonb,               -- GeoJSON LineString | null
  estimated_minutes int,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);

ALTER TABLE public.delivery_orders ENABLE ROW LEVEL SECURITY;

-- Comprador vê o rastreamento do próprio pedido
DROP POLICY IF EXISTS "do_customer_read" ON public.delivery_orders;
CREATE POLICY "do_customer_read" ON public.delivery_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = delivery_orders.order_id AND o.customer_id = auth.uid()
    )
  );

-- Lojista vê entregas dos seus pedidos
DROP POLICY IF EXISTS "do_vendor_read" ON public.delivery_orders;
CREATE POLICY "do_vendor_read" ON public.delivery_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN   public.stores s ON s.id = o.store_id
      WHERE  o.id = delivery_orders.order_id AND s.owner_id = auth.uid()
    )
  );

-- Entregador lê e atualiza suas próprias entregas
DROP POLICY IF EXISTS "do_courier_own" ON public.delivery_orders;
CREATE POLICY "do_courier_own" ON public.delivery_orders
  FOR ALL USING (
    driver_id IN (
      SELECT id FROM public.delivery_drivers WHERE courier_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "do_admin_all" ON public.delivery_orders;
CREATE POLICY "do_admin_all" ON public.delivery_orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_do_order_id  ON public.delivery_orders (order_id);
CREATE INDEX IF NOT EXISTS idx_do_driver_id ON public.delivery_orders (driver_id) WHERE driver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_do_lifecycle ON public.delivery_orders (lifecycle);

GRANT ALL    ON public.delivery_orders TO service_role;
GRANT SELECT ON public.delivery_orders TO authenticated;

-- updated_at automático
CREATE OR REPLACE FUNCTION public.set_delivery_orders_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS delivery_orders_updated_at ON public.delivery_orders;
CREATE TRIGGER delivery_orders_updated_at
  BEFORE UPDATE ON public.delivery_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_delivery_orders_updated_at();

-- ── 3. Supabase Realtime: habilita para ambas as tabelas ─────────────────────
-- Necessary para que postgres_changes no frontend receba eventos de UPDATE.
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_drivers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_orders;

-- ── 4. get_delivery_tracking_public ──────────────────────────────────────────
-- SECURITY DEFINER: acessível por anon/guest sem RLS.
-- Retorna apenas dados não-sensíveis (sem endereço completo, sem dados de pagamento).

CREATE OR REPLACE FUNCTION public.get_delivery_tracking_public(p_order_id uuid)
RETURNS TABLE (
  id                uuid,
  lifecycle         text,
  driver_id         uuid,
  pickup_lat        double precision,
  pickup_lng        double precision,
  dropoff_lat       double precision,
  dropoff_lng       double precision,
  route_geometry    jsonb,
  estimated_minutes int
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id, lifecycle, driver_id,
    pickup_lat, pickup_lng,
    dropoff_lat, dropoff_lng,
    route_geometry, estimated_minutes
  FROM public.delivery_orders
  WHERE order_id = p_order_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_delivery_tracking_public(uuid)
  TO anon, authenticated, service_role;

-- ── 5. get_driver_position_public ────────────────────────────────────────────
-- SECURITY DEFINER: expõe posição atual do entregador (lat/lng/heading) sem JWT.
-- Não expõe courier_id nem dados pessoais.

CREATE OR REPLACE FUNCTION public.get_driver_position_public(p_driver_id uuid)
RETURNS TABLE (
  current_lat double precision,
  current_lng double precision,
  heading     double precision
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_lat, current_lng, heading
  FROM public.delivery_drivers
  WHERE id = p_driver_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_driver_position_public(uuid)
  TO anon, authenticated, service_role;

-- ── 6. update_driver_position ─────────────────────────────────────────────────
-- RPC chamada pelo app do entregador a cada ~3s para atualizar posição.
-- SECURITY DEFINER com check de autenticação (entregador só atualiza a própria linha).

CREATE OR REPLACE FUNCTION public.update_driver_position(
  p_lat     double precision,
  p_lng     double precision,
  p_heading double precision DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  INSERT INTO public.delivery_drivers (courier_id, current_lat, current_lng, heading, is_online, updated_at)
  VALUES (auth.uid(), p_lat, p_lng, p_heading, true, now())
  ON CONFLICT (courier_id) DO UPDATE SET
    current_lat = EXCLUDED.current_lat,
    current_lng = EXCLUDED.current_lng,
    heading     = EXCLUDED.heading,
    is_online   = true,
    updated_at  = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_driver_position(double precision, double precision, double precision)
  TO authenticated;

-- ── 7. assign_delivery_order ──────────────────────────────────────────────────
-- Cria/atualiza entrada em delivery_orders ao aceitar uma entrega.

CREATE OR REPLACE FUNCTION public.assign_delivery_order(
  p_order_id  uuid,
  p_pickup_lat  double precision DEFAULT NULL,
  p_pickup_lng  double precision DEFAULT NULL,
  p_dropoff_lat double precision DEFAULT NULL,
  p_dropoff_lng double precision DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id uuid;
  v_do_id     uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  -- Obtém ou cria delivery_driver para este courier
  INSERT INTO public.delivery_drivers (courier_id, is_online)
  VALUES (auth.uid(), true)
  ON CONFLICT (courier_id) DO UPDATE SET is_online = true
  RETURNING id INTO v_driver_id;

  IF v_driver_id IS NULL THEN
    SELECT id INTO v_driver_id FROM public.delivery_drivers WHERE courier_id = auth.uid();
  END IF;

  -- Cria ou atualiza delivery_order
  INSERT INTO public.delivery_orders (
    order_id, driver_id, lifecycle,
    pickup_lat, pickup_lng, dropoff_lat, dropoff_lng
  )
  VALUES (
    p_order_id, v_driver_id, 'courier_assigned',
    p_pickup_lat, p_pickup_lng, p_dropoff_lat, p_dropoff_lng
  )
  ON CONFLICT (order_id) DO UPDATE SET
    driver_id  = EXCLUDED.driver_id,
    lifecycle  = CASE
      WHEN delivery_orders.lifecycle IN ('delivered','cancelled','failed')
      THEN delivery_orders.lifecycle  -- não regride estados finais
      ELSE 'courier_assigned'
    END,
    updated_at = now()
  RETURNING id INTO v_do_id;

  RETURN v_do_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_delivery_order(uuid, double precision, double precision, double precision, double precision)
  TO authenticated, service_role;

-- ── 8. update_delivery_lifecycle ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_delivery_lifecycle(
  p_order_id uuid,
  p_lifecycle text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed_states CONSTANT text[] := ARRAY[
    'waiting_courier', 'courier_assigned', 'courier_arriving',
    'picked_up', 'in_transit', 'arrived', 'delivered', 'cancelled', 'failed'
  ];
  v_driver_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT (p_lifecycle = ANY(v_allowed_states)) THEN
    RAISE EXCEPTION 'INVALID_LIFECYCLE: %', p_lifecycle;
  END IF;

  SELECT id INTO v_driver_id FROM public.delivery_drivers WHERE courier_id = auth.uid();

  UPDATE public.delivery_orders
  SET    lifecycle  = p_lifecycle,
         updated_at = now()
  WHERE  order_id  = p_order_id
    AND  driver_id = v_driver_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DELIVERY_NOT_FOUND_OR_NOT_AUTHORIZED';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_delivery_lifecycle(uuid, text)
  TO authenticated, service_role;
