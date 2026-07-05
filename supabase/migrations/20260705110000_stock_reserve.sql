-- =============================================================================
-- STOCK RESERVE: rastreamento e reserva atômica de estoque por pedido
-- Modelo: stock = 0 → ilimitado (sem rastreamento); stock > 0 → finito
-- =============================================================================

-- 1. Coluna stock_reserved em order_items
--    Registra quantas unidades foram efetivamente debitadas do estoque.
--    Necessário para restauração idempotente na expiração/estorno.
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS stock_reserved INT NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 2. reserve_stock_for_order
--    Chamada pelo create-order após inserir os itens do pedido.
--    Bloqueia cada produto (FOR UPDATE) para evitar race conditions,
--    decrementa stock e registra o valor em order_items.stock_reserved.
--    Retorna: NULL = sucesso; texto = mensagem de erro (sem throw).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_stock_for_order(p_order_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_prod record;
BEGIN
  FOR v_item IN
    SELECT store_product_id, quantity
    FROM   order_items
    WHERE  order_id = p_order_id
    ORDER  BY store_product_id   -- ordem determinística evita deadlocks entre pedidos paralelos
  LOOP
    -- Bloqueia a linha do produto até o fim da transação
    SELECT id, name, stock, available
    INTO   v_prod
    FROM   store_products
    WHERE  id = v_item.store_product_id
    FOR    UPDATE;

    IF NOT FOUND OR NOT v_prod.available THEN
      RETURN 'Produto "' || COALESCE(v_prod.name, 'desconhecido') || '" não está mais disponível.';
    END IF;

    -- stock = 0 → produto ilimitado; sem decremento, sem rastreamento
    IF v_prod.stock = 0 THEN
      CONTINUE;
    END IF;

    IF v_prod.stock < v_item.quantity THEN
      RETURN 'Estoque insuficiente para "' || v_prod.name
             || '". Disponível: ' || v_prod.stock::text
             || ', solicitado: '  || v_item.quantity::text || '.';
    END IF;

    -- Decrementa e desativa o produto se zerar
    UPDATE store_products
    SET    stock     = stock - v_item.quantity,
           available = CASE
             WHEN (stock - v_item.quantity) <= 0 THEN false
             ELSE available
           END
    WHERE  id = v_prod.id;

    -- Registra a reserva para restauração futura
    UPDATE order_items
    SET    stock_reserved = v_item.quantity
    WHERE  order_id         = p_order_id
      AND  store_product_id = v_item.store_product_id;
  END LOOP;

  RETURN NULL;  -- sucesso
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. release_stock_for_order
--    Restaura o estoque reservado quando o pedido expira, é estornado
--    ou cancelado. Idempotente: zera stock_reserved após restaurar.
--    Só reativa o produto (available=true) se ele foi desativado por
--    esgotamento de estoque (available=false E stock=0 antes da restauração).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_stock_for_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE store_products sp
  SET    stock     = sp.stock + oi.stock_reserved,
         available = CASE
           WHEN NOT sp.available AND sp.stock = 0
           THEN true   -- foi desativado por esgotamento → reativa
           ELSE sp.available  -- toggle manual do lojista → preserva
         END
  FROM   order_items oi
  WHERE  oi.order_id         = p_order_id
    AND  oi.store_product_id = sp.id
    AND  oi.stock_reserved   > 0;

  -- Zera para garantir idempotência: segunda chamada não duplica estoque
  UPDATE order_items
  SET    stock_reserved = 0
  WHERE  order_id       = p_order_id
    AND  stock_reserved > 0;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. expire_stale_orders — atualizado para incluir release_stock_for_order
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_stale_orders()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order  record;
  v_count  integer := 0;
BEGIN
  FOR v_order IN
    SELECT id, coupon_id
    FROM   public.orders
    WHERE  status = 0
      AND  payment_status IN ('pending', 'PENDING')
      AND  (
        (payment_method = 'pix'          AND created_at < now() - interval '35 minutes')
        OR (payment_method = 'boleto'    AND created_at < now() - interval '4 days')
        OR (payment_method = 'credit_card' AND created_at < now() - interval '30 minutes')
      )
  LOOP
    -- Libera cupom (idempotente)
    IF v_order.coupon_id IS NOT NULL THEN
      PERFORM public.release_coupon_for_order(v_order.id);
    END IF;

    -- Restaura estoque reservado (idempotente)
    PERFORM public.release_stock_for_order(v_order.id);

    UPDATE public.orders
    SET    status         = 5,
           payment_status = 'EXPIRED',
           updated_at     = now()
    WHERE  id = v_order.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Grants: apenas service_role pode executar (Edge Functions usam service key)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.reserve_stock_for_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_stock_for_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_stock_for_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_stock_for_order(uuid) TO service_role;
