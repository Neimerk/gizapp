-- =============================================================================
-- DELIVERY TRACKING: RPCs de escrita que faltavam
--
-- As tabelas delivery_drivers e delivery_orders, políticas RLS, realtime e
-- get_delivery_tracking_public / get_driver_position_public já existem no DB.
-- Esta migration adiciona apenas os 3 RPCs de escrita que estavam ausentes:
--   - update_driver_position  (nova)
--   - assign_delivery_order   (nova — busca vendor_id/customer_id do pedido)
--   - update_delivery_lifecycle (nova)
-- =============================================================================

-- ── 1. update_driver_position ────────────────────────────────────────────────
-- Chamada pelo app do entregador a cada ~3s para atualizar posição ao vivo.
-- Usa is_available (nome real no DB) em vez de is_online.

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

  UPDATE public.delivery_drivers SET
    current_lat  = p_lat,
    current_lng  = p_lng,
    heading      = COALESCE(p_heading::smallint, heading),
    is_available = true,
    last_seen    = now(),
    updated_at   = now()
  WHERE courier_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DRIVER_NOT_REGISTERED';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_driver_position(double precision, double precision, double precision)
  TO authenticated;

-- ── 4. assign_delivery_order ─────────────────────────────────────────────────
-- Cria ou atualiza entrada em delivery_orders ao aceitar uma entrega.
-- Obtém vendor_id e customer_id do pedido (NOT NULL no schema do DB).

CREATE OR REPLACE FUNCTION public.assign_delivery_order(
  p_order_id    uuid,
  p_pickup_lat  double precision DEFAULT NULL,
  p_pickup_lng  double precision DEFAULT NULL,
  p_dropoff_lat double precision DEFAULT NULL,
  p_dropoff_lng double precision DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id   uuid;
  v_vendor_id   uuid;
  v_customer_id uuid;
  v_do_id       uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT id INTO v_driver_id
  FROM public.delivery_drivers
  WHERE courier_id = auth.uid();

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'DRIVER_NOT_REGISTERED';
  END IF;

  SELECT store_id, customer_id
  INTO   v_vendor_id, v_customer_id
  FROM   public.orders
  WHERE  id = p_order_id;

  IF v_vendor_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  INSERT INTO public.delivery_orders (
    order_id, driver_id, vendor_id, customer_id, lifecycle,
    pickup_lat, pickup_lng, dropoff_lat, dropoff_lng
  )
  VALUES (
    p_order_id, v_driver_id, v_vendor_id, v_customer_id,
    'courier_assigned',
    p_pickup_lat, p_pickup_lng, p_dropoff_lat, p_dropoff_lng
  )
  ON CONFLICT (order_id) DO UPDATE SET
    driver_id  = EXCLUDED.driver_id,
    lifecycle  = CASE
      WHEN delivery_orders.lifecycle IN ('delivered','cancelled','failed')
      THEN delivery_orders.lifecycle
      ELSE 'courier_assigned'
    END,
    updated_at = now()
  RETURNING id INTO v_do_id;

  RETURN v_do_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_delivery_order(uuid, double precision, double precision, double precision, double precision)
  TO authenticated, service_role;

-- ── 5. update_delivery_lifecycle ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_delivery_lifecycle(
  p_order_id  uuid,
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

  SELECT id INTO v_driver_id
  FROM public.delivery_drivers
  WHERE courier_id = auth.uid();

  UPDATE public.delivery_orders SET
    lifecycle  = p_lifecycle,
    updated_at = now()
  WHERE order_id  = p_order_id
    AND driver_id = v_driver_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DELIVERY_NOT_FOUND_OR_NOT_AUTHORIZED';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_delivery_lifecycle(uuid, text)
  TO authenticated, service_role;
