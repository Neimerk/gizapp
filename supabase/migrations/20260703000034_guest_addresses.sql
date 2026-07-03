-- =====================================================================
-- Guest Addresses
-- Endereços de convidados persistidos server-side (via Edge Function).
-- Permite recuperação cross-device e histórico pós-conversão.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.guest_addresses (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_session_id uuid        NOT NULL REFERENCES public.guest_sessions(id) ON DELETE CASCADE,
  label            text,
  zipcode          text,
  street           text        NOT NULL,
  number           text        NOT NULL,
  complement       text,
  district         text        NOT NULL,
  city             text,
  state            text,
  latitude         numeric(10, 7),
  longitude        numeric(10, 7),
  created_at       timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE  public.guest_addresses IS 'Endereços de entrega de convidados. Persistidos via Edge Function com X-Guest-Token. Migrados para customer_addresses no account merge.';
COMMENT ON COLUMN public.guest_addresses.guest_session_id IS 'FK para guest_sessions — cascata em delete.';

ALTER TABLE public.guest_addresses ENABLE ROW LEVEL SECURITY;

-- Apenas service_role tem acesso direto — convidados interagem via Edge Functions
CREATE POLICY "guest_addresses_service_only"
  ON public.guest_addresses FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS guest_addresses_session_idx ON public.guest_addresses (guest_session_id);
