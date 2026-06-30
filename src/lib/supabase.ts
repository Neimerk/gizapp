import { createClient } from "@supabase/supabase-js";

// Aceita as duas nomenclaturas de env (SHOPPING_ = local, sem prefixo = Vercel)
const url     = (import.meta.env.VITE_SUPABASE_URL          || import.meta.env.VITE_SHOPPING_SUPABASE_URL)     as string;
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY     || import.meta.env.VITE_SHOPPING_SUPABASE_ANON_KEY) as string;

export const supabase = createClient(url, anonKey);
