-- =============================================================================
-- INTEGRAÇÃO BRASUX-CAIXA → banco unificado
--
-- O brasux-caixa até hoje usava um projeto Supabase separado
-- (mpwuqfqcxjryhrhczzst). Esta migration cria as tabelas POS neste banco
-- compartilhado (cbyufprmiuwvhsxsxttn) para que pedidos do marketplace,
-- do PDV e do app de entregas compartilhem fonte única de dados.
--
-- Tabelas criadas:
--   companies          → empresa/loja do caixa (ligada a stores.id)
--   products           → catálogo POS (barcode, custo, estoque mínimo)
--   sales              → vendas do caixa
--   sale_items         → itens da venda
--   cash_sessions      → sessões de abertura/fechamento de caixa
--   cash_movements     → entradas/saídas/sangrias
--
-- Funções criadas:
--   auth_company_id()
--   current_cash_session()
--   open_cash_session()
--   close_cash_session()
--   create_sale()
--   dashboard_stats()
--   sales_chart_data()
--   create_pdv_delivery()        ← cria pedido + delivery_order via PDV
--   caixa_handle_new_store()     ← trigger: nova store → cria company
-- =============================================================================

-- ── 1. COMPANIES ─────────────────────────────────────────────────────────────
-- Uma company ↔ uma store. O link é store_id (UNIQUE).
-- Backfill automático de stores existentes via trigger + INSERT abaixo.

CREATE TABLE IF NOT EXISTS public.companies (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          uuid        UNIQUE REFERENCES public.stores (id) ON DELETE CASCADE,
  name              text        NOT NULL DEFAULT '',
  trade_name        text,
  document          text,
  logo_url          text,
  primary_color     text        NOT NULL DEFAULT '#0f766e',
  secondary_color   text        NOT NULL DEFAULT '#111827',
  receipt_footer    text,
  delivery_store_id text,   -- store_id em texto (compat. com legacy caixa)
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_store ON public.companies (store_id);

-- ── 2. auth_company_id() ─────────────────────────────────────────────────────
-- Retorna o UUID de companies do usuário autenticado, via profiles.store_id.

CREATE OR REPLACE FUNCTION public.auth_company_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM   public.companies c
  JOIN   public.profiles   p ON p.store_id = c.store_id
  WHERE  p.id = auth.uid()
  LIMIT  1;
$$;

GRANT EXECUTE ON FUNCTION public.auth_company_id() TO authenticated;

-- ── 3. RLS — companies ───────────────────────────────────────────────────────

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY companies_select ON public.companies
  FOR SELECT TO authenticated
  USING (
    store_id = (SELECT store_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY companies_update ON public.companies
  FOR UPDATE TO authenticated
  USING  (store_id = (SELECT store_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (store_id = (SELECT store_id FROM public.profiles WHERE id = auth.uid()));

-- ── 4. PRODUCTS (catálogo POS) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.products (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid          NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  barcode      text,
  name         text          NOT NULL,
  category     text,
  cost_price   numeric(12,2) NOT NULL DEFAULT 0,
  sale_price   numeric(12,2) NOT NULL,
  stock        integer       NOT NULL DEFAULT 0,
  min_stock    integer       NOT NULL DEFAULT 5,
  is_active    boolean       NOT NULL DEFAULT true,
  created_at   timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_company ON public.products (company_id) WHERE is_active = true;

ALTER TABLE public.products ALTER COLUMN company_id SET DEFAULT auth_company_id();

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_tenant ON public.products
  FOR ALL TO authenticated
  USING      (company_id = auth_company_id())
  WITH CHECK (company_id = auth_company_id());

-- ── 5. SALES ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sales (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid          NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  total          numeric(12,2) NOT NULL,
  discount       numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text          NOT NULL,
  status         text          NOT NULL DEFAULT 'paid',
  created_at     timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_company_date ON public.sales (company_id, created_at DESC);

ALTER TABLE public.sales ALTER COLUMN company_id SET DEFAULT auth_company_id();

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_tenant ON public.sales
  FOR ALL TO authenticated
  USING      (company_id = auth_company_id())
  WITH CHECK (company_id = auth_company_id());

-- ── 6. SALE_ITEMS ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sale_items (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id       uuid          NOT NULL REFERENCES public.sales (id) ON DELETE CASCADE,
  product_id    uuid          REFERENCES public.products (id) ON DELETE SET NULL,
  product_name  text          NOT NULL,
  quantity      integer       NOT NULL CHECK (quantity > 0),
  unit_price    numeric(12,2) NOT NULL,
  unit_cost     numeric(12,2) NOT NULL DEFAULT 0,
  total         numeric(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items (sale_id);

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY sale_items_tenant ON public.sale_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_id AND s.company_id = auth_company_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_id AND s.company_id = auth_company_id()
    )
  );

-- ── 7. CASH_SESSIONS ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid          NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  opened_by        uuid          REFERENCES auth.users (id) ON DELETE SET NULL,
  opened_at        timestamptz   NOT NULL DEFAULT now(),
  closed_at        timestamptz,
  opening_amount   numeric(12,2) NOT NULL DEFAULT 0,
  closing_amount   numeric(12,2),
  expected_amount  numeric(12,2),
  difference       numeric(12,2),
  status           text          NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed'))
);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_company ON public.cash_sessions (company_id, status);

ALTER TABLE public.cash_sessions ALTER COLUMN company_id SET DEFAULT auth_company_id();

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY cash_sessions_tenant ON public.cash_sessions
  FOR ALL TO authenticated
  USING      (company_id = auth_company_id())
  WITH CHECK (company_id = auth_company_id());

-- ── 8. CASH_MOVEMENTS ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cash_movements (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid          NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  session_id   uuid          REFERENCES public.cash_sessions (id) ON DELETE SET NULL,
  type         text          NOT NULL CHECK (type IN ('entrada', 'saida', 'sangria', 'reforco')),
  description  text          NOT NULL,
  amount       numeric(12,2) NOT NULL CHECK (amount > 0),
  created_at   timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_company ON public.cash_movements (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_movements_session ON public.cash_movements (session_id);

ALTER TABLE public.cash_movements ALTER COLUMN company_id SET DEFAULT auth_company_id();

ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY cash_movements_tenant ON public.cash_movements
  FOR ALL TO authenticated
  USING      (company_id = auth_company_id())
  WITH CHECK (company_id = auth_company_id());

-- ── 9. current_cash_session() ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_cash_session()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.cash_sessions
  WHERE  company_id = auth_company_id() AND status = 'open'
  ORDER  BY opened_at DESC
  LIMIT  1;
$$;

GRANT EXECUTE ON FUNCTION public.current_cash_session() TO authenticated;

ALTER TABLE public.cash_movements
  ALTER COLUMN session_id SET DEFAULT current_cash_session();

-- ── 10. open_cash_session() ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.open_cash_session(p_opening numeric DEFAULT 0)
RETURNS public.cash_sessions
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := auth_company_id();
  v_session public.cash_sessions;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.cash_sessions
    WHERE  company_id = v_company AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'Já existe um caixa aberto.';
  END IF;

  IF COALESCE(p_opening, 0) < 0 THEN
    RAISE EXCEPTION 'Fundo de troco não pode ser negativo.';
  END IF;

  INSERT INTO public.cash_sessions (company_id, opened_by, opening_amount)
  VALUES (v_company, auth.uid(), COALESCE(p_opening, 0))
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_cash_session(numeric) TO authenticated;

-- ── 11. close_cash_session() ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.close_cash_session(p_counted numeric DEFAULT 0)
RETURNS public.cash_sessions
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company  uuid := auth_company_id();
  v_session  public.cash_sessions;
  v_expected numeric(12,2);
BEGIN
  SELECT * INTO v_session
  FROM   public.cash_sessions
  WHERE  company_id = v_company AND status = 'open'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhum caixa aberto.';
  END IF;

  SELECT v_session.opening_amount + COALESCE(SUM(
    CASE WHEN type IN ('entrada', 'reforco') THEN amount ELSE -amount END
  ), 0)
  INTO v_expected
  FROM public.cash_movements
  WHERE session_id = v_session.id;

  UPDATE public.cash_sessions
  SET    status          = 'closed',
         closed_at       = now(),
         closing_amount  = COALESCE(p_counted, 0),
         expected_amount = v_expected,
         difference      = COALESCE(p_counted, 0) - v_expected
  WHERE  id = v_session.id
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_cash_session(numeric) TO authenticated;

-- ── 12. create_sale() ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_sale(
  p_payment_method text,
  p_items          jsonb,
  p_discount       numeric DEFAULT 0
)
RETURNS public.sales
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company  uuid          := auth_company_id();
  v_sale     public.sales;
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := COALESCE(p_discount, 0);
  v_total    numeric(12,2);
  v_item     jsonb;
  v_product  public.products;
  v_qty      integer;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.cash_sessions
    WHERE  company_id = v_company AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'Caixa fechado. Abra o caixa antes de registrar uma venda.';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Carrinho vazio.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item ->> 'quantity')::int;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida.';
    END IF;

    SELECT * INTO v_product
    FROM   public.products
    WHERE  id         = (v_item ->> 'product_id')::uuid
      AND  company_id = v_company
      AND  is_active  = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto % indisponível.', v_item ->> 'product_id';
    END IF;

    IF v_product.stock < v_qty THEN
      RAISE EXCEPTION 'Estoque insuficiente para "%": % disponível(is).', v_product.name, v_product.stock;
    END IF;

    v_subtotal := v_subtotal + v_product.sale_price * v_qty;
  END LOOP;

  IF v_discount < 0 THEN
    RAISE EXCEPTION 'Desconto não pode ser negativo.';
  END IF;

  IF v_discount > v_subtotal THEN
    RAISE EXCEPTION 'Desconto maior que o total da venda.';
  END IF;

  v_total := v_subtotal - v_discount;

  INSERT INTO public.sales (company_id, total, discount, payment_method, status)
  VALUES (v_company, v_total, v_discount, p_payment_method, 'paid')
  RETURNING * INTO v_sale;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item ->> 'quantity')::int;
    SELECT * INTO v_product FROM public.products WHERE id = (v_item ->> 'product_id')::uuid;

    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price, unit_cost, total)
    VALUES (v_sale.id, v_product.id, v_product.name, v_qty,
            v_product.sale_price, v_product.cost_price, v_product.sale_price * v_qty);

    UPDATE public.products SET stock = stock - v_qty WHERE id = v_product.id;
  END LOOP;

  INSERT INTO public.cash_movements (company_id, type, description, amount)
  VALUES (v_company, 'entrada', 'Venda ' || v_sale.id, v_total);

  RETURN v_sale;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_sale(text, jsonb, numeric) TO authenticated;

-- ── 13. dashboard_stats() ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.dashboard_stats()
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH co AS (SELECT auth_company_id() AS cid),
  day_start AS (
    SELECT date_trunc('day', timezone('America/Sao_Paulo', now()))
             AT TIME ZONE 'America/Sao_Paulo' AS ts
  ),
  today_sales AS (
    SELECT s.* FROM public.sales s, co, day_start d
    WHERE  s.company_id = co.cid AND s.created_at >= d.ts
  ),
  today_items AS (
    SELECT si.* FROM public.sale_items si JOIN today_sales ts ON ts.id = si.sale_id
  ),
  prod AS (
    SELECT p.* FROM public.products p, co
    WHERE  p.company_id = co.cid AND p.is_active = true
  )
  SELECT json_build_object(
    'salesToday',      (SELECT count(*) FROM today_sales),
    'revenueToday',    COALESCE((SELECT sum(total) FROM today_sales), 0),
    'averageTicket',   CASE WHEN (SELECT count(*) FROM today_sales) > 0
                            THEN (SELECT sum(total) FROM today_sales)
                                 / (SELECT count(*) FROM today_sales)
                            ELSE 0 END,
    'estimatedProfit', COALESCE((SELECT sum((unit_price - unit_cost) * quantity) FROM today_items), 0),
    'lowStockCount',   (SELECT count(*) FROM prod WHERE stock <= min_stock),
    'productsCount',   (SELECT count(*) FROM prod)
  );
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_stats() TO authenticated;

-- ── 14. sales_chart_data() ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sales_chart_data(p_days int DEFAULT 7)
RETURNS TABLE (sale_date date, revenue numeric, sales_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH tz_today AS (
    SELECT (timezone('America/Sao_Paulo', now()))::date AS today
  ),
  series AS (
    SELECT generate_series(
      (SELECT today - (p_days - 1) * interval '1 day' FROM tz_today),
      (SELECT today::timestamp FROM tz_today),
      interval '1 day'
    )::date AS sale_date
  ),
  daily AS (
    SELECT timezone('America/Sao_Paulo', created_at)::date AS sale_date,
           sum(total)  AS revenue,
           count(*)    AS sales_count
    FROM   public.sales
    WHERE  company_id = auth_company_id()
      AND  timezone('America/Sao_Paulo', created_at)::date
             >= (SELECT today - (p_days - 1) * interval '1 day' FROM tz_today)
    GROUP  BY 1
  )
  SELECT s.sale_date,
         COALESCE(d.revenue,     0)::numeric AS revenue,
         COALESCE(d.sales_count, 0)::bigint  AS sales_count
  FROM   series s
  LEFT   JOIN daily d USING (sale_date)
  ORDER  BY s.sale_date;
$$;

GRANT EXECUTE ON FUNCTION public.sales_chart_data(int) TO authenticated;

-- ── 15. create_pdv_delivery() ────────────────────────────────────────────────
-- Cria um pedido + delivery_order originado pelo caixa PDV.
-- Retorna { order_id, delivery_id }.

CREATE OR REPLACE FUNCTION public.create_pdv_delivery(
  p_vendor_id       uuid,
  p_customer_name   text    DEFAULT 'Cliente PDV',
  p_customer_phone  text    DEFAULT '',
  p_dropoff_address text    DEFAULT '',
  p_dropoff_lat     float8  DEFAULT NULL,
  p_dropoff_lng     float8  DEFAULT NULL,
  p_total           numeric DEFAULT 0,
  p_delivery_fee    numeric DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id    uuid;
  v_delivery_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  INSERT INTO public.orders (
    store_id, customer_name, customer_phone,
    delivery_address, delivery_number, delivery_complement, delivery_neighborhood,
    payment_method, payment_status, subtotal, delivery_fee, total, status
  )
  VALUES (
    p_vendor_id, p_customer_name, p_customer_phone,
    p_dropoff_address, '', '', '',
    'dinheiro', 'paid', p_total, p_delivery_fee, p_total + p_delivery_fee, 1
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.delivery_orders (
    order_id, vendor_id,
    dropoff_address, dropoff_lat, dropoff_lng,
    delivery_fee, lifecycle
  )
  VALUES (
    v_order_id, p_vendor_id,
    p_dropoff_address, p_dropoff_lat, p_dropoff_lng,
    p_delivery_fee, 'waiting_courier'
  )
  RETURNING id INTO v_delivery_id;

  RETURN json_build_object('order_id', v_order_id, 'delivery_id', v_delivery_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_pdv_delivery(uuid, text, text, text, float8, float8, numeric, numeric)
  TO authenticated;

-- ── 16. Trigger: nova store → cria company automaticamente ───────────────────

CREATE OR REPLACE FUNCTION public.caixa_handle_new_store()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.companies (store_id, name, logo_url, delivery_store_id)
  VALUES (NEW.id, NEW.name, NEW.logo_url, NEW.id::text)
  ON CONFLICT (store_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_store_created_caixa ON public.stores;
CREATE TRIGGER on_store_created_caixa
  AFTER INSERT ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.caixa_handle_new_store();

-- ── 17. Backfill: cria company para stores existentes ────────────────────────

INSERT INTO public.companies (store_id, name, logo_url, delivery_store_id)
SELECT id, name, logo_url, id::text
FROM   public.stores
ON CONFLICT (store_id) DO NOTHING;
