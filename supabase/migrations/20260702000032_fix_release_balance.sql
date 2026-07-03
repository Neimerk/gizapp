-- =====================================================================
-- Corrige release_balance_after_delivery:
-- 1. Status case: 'delivered'/'cancelled' → 'DELIVERED'/'CANCELLED'
--    (o CHECK da tabela deliveries só aceita maiúsculas)
-- 2. Adiciona liberação do saldo HELD do vendor após entrega
--    (o split credita vendor como 'held'; a entrega libera para 'available')
-- =====================================================================

CREATE OR REPLACE FUNCTION public.release_balance_after_delivery(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_courier_id  uuid;
  v_earnings    numeric;
  v_courier_wid uuid;
  v_vendor_id   uuid;
  v_vendor_wid  uuid;
BEGIN
  SELECT courier_id, earnings
    INTO v_courier_id, v_earnings
    FROM public.deliveries
   WHERE order_id = p_order_id AND status != 'CANCELLED';

  IF v_courier_id IS NULL THEN
    RAISE EXCEPTION 'Delivery not found for order %', p_order_id;
  END IF;

  -- Permite chamada pelo próprio entregador (app) ou via service_role (internal)
  IF auth.uid() IS NOT NULL AND v_courier_id != auth.uid() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  -- Marca entrega como concluída
  UPDATE public.deliveries
     SET status = 'DELIVERED', delivered_at = now(), updated_at = now()
   WHERE order_id = p_order_id AND courier_id = v_courier_id;

  -- Avança pedido para status 4 (entregue)
  UPDATE public.orders
     SET status = 4, updated_at = now()
   WHERE id = p_order_id;

  -- Libera saldo HELD do vendor → available
  SELECT sr.vendor_id, sr.vendor_wallet_id
    INTO v_vendor_id, v_vendor_wid
    FROM public.split_rules sr
   WHERE sr.order_id = p_order_id AND sr.executed_at IS NOT NULL
   LIMIT 1;

  IF v_vendor_wid IS NOT NULL THEN
    UPDATE public.wallet_transactions
       SET status = 'available'
     WHERE wallet_id = v_vendor_wid
       AND order_id  = p_order_id
       AND status    = 'held'
       AND direction = 'in';
  END IF;

  -- Credita ganho do entregador
  v_courier_wid := public.get_or_create_wallet(v_courier_id, 'courier');

  INSERT INTO public.wallet_transactions
    (wallet_id, order_id, type, amount, direction, status, description)
  VALUES
    (v_courier_wid, p_order_id, 'delivery_credit',
     COALESCE(v_earnings, 0), 'in', 'available',
     'Ganho de entrega — Pedido #' || UPPER(LEFT(p_order_id::text, 8)));

  PERFORM public.log_financial_event(
    'system', v_courier_id, 'balance_released', 'orders', p_order_id,
    COALESCE(v_earnings, 0),
    'Saldo liberado após entrega',
    jsonb_build_object('courier_id', v_courier_id, 'vendor_id', v_vendor_id)
  );
END;
$function$;
