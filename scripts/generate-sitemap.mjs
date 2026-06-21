/**
 * BrasUX Sitemap Generator
 * Run: node scripts/generate-sitemap.mjs
 * Called automatically via `npm run build` (see package.json postbuild)
 *
 * Generates:
 *   dist/sitemap-index.xml
 *   dist/sitemap.xml          (static pages)
 *   dist/sitemap-categories.xml
 *   dist/sitemap-stores.xml   (fetched from Supabase)
 *   dist/robots.txt           (copy from public/)
 */

import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

const DOMAIN = process.env.SITE_URL || "https://shopping.brasux.com.br";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const OUT_DIR = path.resolve("dist");
const NOW = new Date().toISOString().split("T")[0];

// ── CATEGORY SLUGS ────────────────────────────────────────────────────────────
const CATEGORY_SLUGS = [
  "restaurantes","mercearia","cervejas","destilados-e-vinhos","nao-alcoolicos",
  "farmacia","lanches","pizzarias","acai-sorvetes","cafeterias","padaria",
  "doces","conveniencia","hortifruti","carnes","petshop","beleza","moda",
  "fitness","bebes","casa-cozinha","utilidades","ferramentas","construcao",
  "eletronicos","papelaria","brinquedos","presentes","automotivo",
  "servicos","cursos-online","assistencia-tecnica","outros",
];

// ── STATIC PAGES ─────────────────────────────────────────────────────────────
const STATIC_PAGES = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/lojas", priority: "0.9", changefreq: "daily" },
  { path: "/categorias", priority: "0.9", changefreq: "weekly" },
  { path: "/servicos", priority: "0.8", changefreq: "weekly" },
];

function url(loc, priority = "0.5", changefreq = "weekly") {
  return `  <url>
    <loc>${DOMAIN}${loc}</loc>
    <lastmod>${NOW}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function wrapSitemap(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join("\n")}
</urlset>`;
}

function fetch(urlStr) {
  return new Promise((resolve, reject) => {
    const lib = urlStr.startsWith("https") ? https : http;
    lib.get(urlStr, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Parse error: ${data.slice(0, 200)}`)); }
      });
    }).on("error", reject);
  });
}

async function getActiveStores() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("[sitemap] Supabase env not set — skipping dynamic stores");
    return [];
  }
  try {
    const data = await fetch(`${SUPABASE_URL}/rest/v1/stores?select=id,name,updated_at&active=eq.true&limit=1000`);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn("[sitemap] Could not fetch stores:", e.message);
    return [];
  }
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // 1. Static sitemap
  const staticUrls = STATIC_PAGES.map((p) => url(p.path, p.priority, p.changefreq));
  fs.writeFileSync(path.join(OUT_DIR, "sitemap.xml"), wrapSitemap(staticUrls), "utf8");
  console.log(`[sitemap] ✓ sitemap.xml — ${staticUrls.length} URLs`);

  // 2. Categories sitemap
  const catUrls = CATEGORY_SLUGS.map((slug) => url(`/categorias/${slug}`, "0.8", "weekly"));
  fs.writeFileSync(path.join(OUT_DIR, "sitemap-categories.xml"), wrapSitemap(catUrls), "utf8");
  console.log(`[sitemap] ✓ sitemap-categories.xml — ${catUrls.length} URLs`);

  // 3. Stores sitemap (dynamic)
  const stores = await getActiveStores();
  const storeUrls = stores.map((s) => {
    const lastmod = s.updated_at ? s.updated_at.split("T")[0] : NOW;
    return `  <url>
    <loc>${DOMAIN}/lojas/${s.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`;
  });
  fs.writeFileSync(path.join(OUT_DIR, "sitemap-stores.xml"), wrapSitemap(storeUrls), "utf8");
  console.log(`[sitemap] ✓ sitemap-stores.xml — ${storeUrls.length} URLs`);

  // 4. Sitemap Index
  const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${DOMAIN}/sitemap.xml</loc>
    <lastmod>${NOW}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${DOMAIN}/sitemap-categories.xml</loc>
    <lastmod>${NOW}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${DOMAIN}/sitemap-stores.xml</loc>
    <lastmod>${NOW}</lastmod>
  </sitemap>
</sitemapindex>`;
  fs.writeFileSync(path.join(OUT_DIR, "sitemap-index.xml"), sitemapIndex, "utf8");
  console.log(`[sitemap] ✓ sitemap-index.xml`);

  console.log("[sitemap] ✅ All sitemaps generated.");
}

main().catch((e) => {
  console.error("[sitemap] ❌ Error:", e);
  process.exit(1);
});
