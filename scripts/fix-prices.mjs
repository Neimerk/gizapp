#!/usr/bin/env node
// fix-prices.mjs — corrige preços zerados em store products
// Usa preços do catálogo base quando disponível; fallback por categoria.

const API = "http://localhost:5003";
const ADMIN_EMAIL = "seed-admin@gizapp.com";
const ADMIN_PASSWORD = "Admin@seed2026!";

// Preços médios por categoria (fallback quando base product também é 0)
const CATEGORY_PRICE = {
  "restaurantes":          [18, 65],
  "mercearia":             [3,  35],
  "cervejas":              [8,  45],
  "destilados-e-vinhos":   [45, 180],
  "nao-alcoolicos":        [4,  18],
  "farmacia":              [8,  60],
  "lanches":               [12, 45],
  "pizzarias":             [42, 85],
  "acai-sorvetes":         [12, 40],
  "cafeterias":            [7,  22],
  "padaria":               [2,  25],
  "doces":                 [12, 55],
  "conveniencia":          [3,  30],
  "hortifruti":            [3,  18],
  "carnes":                [28, 130],
  "petshop":               [14, 90],
  "beleza":                [12, 150],
  "moda":                  [50, 250],
  "fitness":               [30, 180],
  "bebes":                 [14, 100],
  "casa-cozinha":          [20, 150],
  "utilidades":            [4,  35],
  "ferramentas":           [18, 200],
  "construcao":            [10, 250],
  "eletronicos":           [20, 300],
  "papelaria":             [3,  30],
  "brinquedos":            [12, 160],
  "presentes":             [30, 180],
  "automotivo":            [14, 200],
  "servicos":              [50, 300],
  "cursos-online":         [80, 400],
  "assistencia-tecnica":   [60, 500],
  "outros":                [20, 120],
};

function randPrice(min, max) {
  const raw = min + Math.random() * (max - min);
  // snap to .90 or .99 endings for realism
  const base = Math.floor(raw);
  return parseFloat((base + (Math.random() > 0.5 ? 0.9 : 0.99)).toFixed(2));
}

async function req(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

const get  = (p, t) => req("GET",   p, null, t);
const post = (p, b, t) => req("POST",  p, b, t);
const patch= (p, b, t) => req("PATCH", p, b, t);

async function getToken() {
  const r = await post("/api/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (r.ok) return r.data.token;
  throw new Error("Login falhou");
}

async function getBaseProductPrice(productId, token) {
  const r = await get(`/api/products/${productId}`, token);
  if (r.ok && r.data?.price > 0) return r.data.price;
  return null;
}

async function main() {
  console.log("🔧 Fix-Prices — corrigindo preços zerados\n");
  const token = await getToken();

  // Load all stores
  const storesR = await get("/api/stores?pageSize=300", token);
  const stores = storesR.data?.items ?? storesR.data ?? [];
  console.log(`📦 ${stores.length} lojas encontradas\n`);

  let totalFixed = 0;
  let totalSkipped = 0;
  let totalStores = 0;

  for (const store of stores) {
    const spR = await get(`/api/storeproducts/${store.id}`, token);
    if (!spR.ok) continue;
    const items = spR.data ?? [];

    const broken = items.filter(p => !p.price || p.price === 0);
    if (broken.length === 0) continue;

    totalStores++;
    console.log(`🏪 ${store.name} — ${broken.length}/${items.length} sem preço`);

    const catSlug = (store.category ?? "outros").toLowerCase().replace(/\s+/g, "-");
    const [minP, maxP] = CATEGORY_PRICE[catSlug] ?? [15, 80];

    for (const sp of broken) {
      // Try to use base product price first
      let price = await getBaseProductPrice(sp.productId, token);

      if (!price) {
        // Fallback: random within category range
        price = randPrice(minP, maxP);
      }

      // Add a small per-store variance (+/- 10%)
      price = parseFloat((price * (0.9 + Math.random() * 0.2)).toFixed(2));

      // Occasional promo (20% chance)
      const hasPromo = Math.random() < 0.2;
      const promoPrice = hasPromo
        ? parseFloat((price * (0.75 + Math.random() * 0.15)).toFixed(2))
        : null;

      const r = await patch(`/api/storeproducts/${sp.id}`, {
        price,
        promotionalPrice: promoPrice,
        stock: sp.stock > 0 ? sp.stock : 100,
        available: true,
      }, token);

      if (r.ok) { totalFixed++; process.stdout.write("."); }
      else { totalSkipped++; process.stdout.write("x"); }
    }
    console.log(` ✓`);
  }

  console.log("\n✅ CONCLUÍDO");
  console.log(`   Lojas ajustadas:    ${totalStores}`);
  console.log(`   Produtos corrigidos: ${totalFixed}`);
  console.log(`   Erros:              ${totalSkipped}`);
}

main().catch(err => { console.error("💥 ERRO:", err); process.exit(1); });
