-- =====================================================================
-- Guest Checkout Enterprise
-- Remove dependência de signInAnonymously(); substitui por identidade
-- própria de convidado via guest_sessions + token em localStorage.
-- =====================================================================

-- ── 1. Tabela de sessões de convidado ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.guest_sessions (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_token       text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  name              text        NOT NULL,
  email             text,
  phone             text,
  cpf               text,
  asaas_customer_id text,
  ip_hash           text,
  device_hash       text,
  order_count       int         NOT NULL DEFAULT 0,
  created_at        timestamptz DEFAULT now() NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL,
  last_seen_at      timestamptz DEFAULT now() NOT NULL,
  expires_at        timestamptz DEFAULT (now() + interval '30 days') NOT NULL
);

COMMENT ON TABLE  public.guest_sessions IS 'Sessões de convidado para checkout sem login. Token persiste em localStorage do cliente (brasux-guest-token).';
COMMENT ON COLUMN public.guest_sessions.guest_token IS 'Token de 64 hex chars (32 bytes aleatórios). Prova de posse do convidado.';
COMMENT ON COLUMN public.guest_sessions.asaas_customer_id IS 'ID do cliente Asaas — persistido na primeira cobrança bem-sucedida para reutilização.';

-- RLS: apenas service_role tem acesso direto (convidados interagem via Edge Functions)
ALTER TABLE public.guest_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guest_sessions_service_only"
  ON public.guest_sessions FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS guest_sessions_token_idx   ON public.guest_sessions (guest_token);
CREATE INDEX IF NOT EXISTS guest_sessions_email_idx   ON public.guest_sessions (email)      WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS guest_sessions_expires_idx ON public.guest_sessions (expires_at);

-- updated_at automático
CREATE OR REPLACE FUNCTION public.guest_sessions_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guest_sessions_updated_at ON public.guest_sessions;
CREATE TRIGGER guest_sessions_updated_at
  BEFORE UPDATE ON public.guest_sessions
  FOR EACH ROW EXECUTE FUNCTION public.guest_sessions_set_updated_at();

-- ── 2. Expande tabela orders ──────────────────────────────────────────

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS guest_session_id               uuid        REFERENCES public.guest_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_email                 text,
  ADD COLUMN IF NOT EXISTS is_guest_checkout              boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS account_created_after_purchase boolean     NOT NULL DEFAULT false;

COMMENT ON COLUMN public.orders.guest_session_id IS 'Sessão de convidado — mutuamente exclusivo com customer_id.';
COMMENT ON COLUMN public.orders.customer_email   IS 'Email do comprador para notificações (guest ou usuário registrado).';
COMMENT ON COLUMN public.orders.is_guest_checkout IS 'True se o pedido foi finalizado sem login.';

CREATE INDEX IF NOT EXISTS orders_guest_session_idx  ON public.orders (guest_session_id) WHERE guest_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_customer_email_idx ON public.orders (customer_email)   WHERE customer_email  IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_is_guest_idx       ON public.orders (is_guest_checkout) WHERE is_guest_checkout = true;

-- Constraint de identidade: todo pedido deve ter customer_id OU guest_session_id.
-- NOT VALID = não valida linhas históricas (podem ter customer_id=null de sessões anônimas antigas).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'orders_identity_check'
      AND table_name = 'orders'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_identity_check
        CHECK (customer_id IS NOT NULL OR guest_session_id IS NOT NULL)
        NOT VALID;
  END IF;
END;
$$;

-- Trigger: atualiza last_seen_at + order_count na guest_session ao criar pedido
CREATE OR REPLACE FUNCTION public.guest_session_on_order_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.guest_session_id IS NOT NULL THEN
    UPDATE public.guest_sessions
       SET last_seen_at = now(),
           order_count  = order_count + 1,
           updated_at   = now()
     WHERE id = NEW.guest_session_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_update_guest_session ON public.orders;
CREATE TRIGGER orders_update_guest_session
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guest_session_on_order_insert();

-- ── 3. Função de limpeza de sessões expiradas (pg_cron) ──────────────

CREATE OR REPLACE FUNCTION public.cleanup_expired_guest_sessions()
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.guest_sessions
  WHERE expires_at < now() - interval '7 days';
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_guest_sessions() TO service_role;
COMMENT ON FUNCTION public.cleanup_expired_guest_sessions() IS 'Remove sessões de convidado expiradas há mais de 7 dias. Agendar via pg_cron: 0 3 * * *';
