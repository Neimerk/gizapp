export const ALLOWED_ORIGINS = [
  "https://shopping.brasux.com.br",
  "https://brasux.com.br",
  "https://brasux.store",
  "https://brasux.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

export function corsHeaders(req: Request): Record<string, string> {
  const origin  = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin":  allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Vary": "Origin",
  };
}

export function json(data: unknown, status = 200, req?: Request): Response {
  const cors = req ? corsHeaders(req) : { "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0] };
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export function optionsResponse(req: Request): Response {
  return new Response("ok", { headers: corsHeaders(req) });
}
