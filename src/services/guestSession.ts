// Gerencia sessões de convidado para checkout sem login.
// O guest_token persiste em localStorage e é enviado como X-Guest-Token
// nas Edge Functions (create-order, asaas-create-charge, get-pix-qrcode, save-guest-address).

const GUEST_TOKEN_KEY = "brasux-guest-token";
const SUPABASE_URL    = (import.meta.env.VITE_SUPABASE_URL          || import.meta.env.VITE_SHOPPING_SUPABASE_URL)     as string;
const ANON_KEY        = (import.meta.env.VITE_SUPABASE_ANON_KEY     || import.meta.env.VITE_SHOPPING_SUPABASE_ANON_KEY) as string;

export type GuestSession = {
  id:         string;
  guestToken: string;
  name:       string;
  email:      string | null;
  phone:      string | null;
  expiresAt:  string;
};

export type GuestAddress = {
  id:          string;
  label:       string | null;
  zipcode:     string | null;
  street:      string;
  number:      string;
  complement:  string | null;
  district:    string;
  city:        string | null;
  state:       string | null;
  latitude:    number | null;
  longitude:   number | null;
  created_at:  string;
};

// ── Device fingerprint (não-invasivo, sem bibliotecas externas) ──

async function buildDeviceHash(): Promise<string> {
  try {
    const signals = [
      navigator.userAgent,
      navigator.language,
      String(screen.width),
      String(screen.height),
      String(screen.colorDepth),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.hardwareConcurrency ? String(navigator.hardwareConcurrency) : "",
      navigator.platform ?? "",
    ].join("|");
    const data   = new TextEncoder().encode(signals);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  } catch {
    return "";
  }
}

// ── Guest Session API ─────────────────────────────────────────────

export async function createGuestSession(info: {
  name:   string;
  email?: string;
  phone?: string;
}): Promise<GuestSession> {
  const deviceHash = await buildDeviceHash();

  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-guest-session`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ ...info, deviceHash }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Erro ao criar sessão de convidado.");

  const session = data as GuestSession;
  localStorage.setItem(GUEST_TOKEN_KEY, session.guestToken);
  return session;
}

export function getGuestToken(): string | null {
  return localStorage.getItem(GUEST_TOKEN_KEY);
}

export function clearGuestSession(): void {
  localStorage.removeItem(GUEST_TOKEN_KEY);
}

// ── Guest Address API ─────────────────────────────────────────────

function guestHeaders(guestToken: string): Record<string, string> {
  return { "Content-Type": "application/json", "X-Guest-Token": guestToken };
}

export async function listGuestAddresses(guestToken: string): Promise<GuestAddress[]> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/save-guest-address`, {
    method:  "GET",
    headers: guestHeaders(guestToken),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.addresses ?? []) as GuestAddress[];
}

export async function saveGuestAddress(
  guestToken: string,
  addr: Omit<GuestAddress, "id" | "created_at">,
): Promise<GuestAddress> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/save-guest-address`, {
    method:  "POST",
    headers: guestHeaders(guestToken),
    body:    JSON.stringify(addr),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Erro ao salvar endereço.");
  return data.address as GuestAddress;
}

// ── Account Merge API ─────────────────────────────────────────────

export async function mergeGuestToAccount(
  jwtToken: string,
  guestToken: string,
): Promise<{ ordersMerged: number; addressesMerged: number }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/merge-guest`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${jwtToken}`,
    },
    body: JSON.stringify({ guestToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Erro ao migrar dados do convidado.");
  return { ordersMerged: data.ordersMerged ?? 0, addressesMerged: data.addressesMerged ?? 0 };
}

// ── Order Tracking API ────────────────────────────────────────────

export type TrackingResult = {
  trackingCode:  string;
  orderId:       string;
  status:        number;
  statusLabel:   string;
  paymentStatus: string;
  paymentLabel:  string;
  paymentMethod: string;
  total:         number;
  storeName:     string;
  firstNameOnly: string;
  createdAt:     string;
  timeline: Array<{
    step:      number;
    label:     string;
    completed: boolean;
    current:   boolean;
  }>;
};

export async function fetchOrderTracking(code: string): Promise<TrackingResult> {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/track-order?code=${encodeURIComponent(code.toUpperCase())}`,
    { method: "GET" },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Pedido não encontrado.");
  return data as TrackingResult;
}
