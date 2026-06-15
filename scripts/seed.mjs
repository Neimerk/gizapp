#!/usr/bin/env node
// seed.mjs — GizApp full marketplace seed
// Usage: node scripts/seed.mjs

const API = process.env.API_URL || "http://localhost:5003";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "seed-admin@gizapp.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@seed2026!";

// ─── API helpers ────────────────────────────────────────────────────────────

async function req(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

const get  = (path, token)       => req("GET",   path, null, token);
const post = (path, body, token) => req("POST",  path, body, token);
const patch= (path, body, token) => req("PATCH", path, body, token);

async function getAdminToken() {
  let r = await post("/api/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (r.ok) { console.log("✅ Login admin OK"); return r.data.token; }
  r = await post("/api/auth/register", { name: "Seed Admin", email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: "Admin" });
  if (r.ok) { console.log("✅ Admin registrado"); return r.data.token; }
  throw new Error("Não foi possível obter token admin: " + JSON.stringify(r.data));
}

async function createStore(store, token) {
  const slugR = await get(`/api/stores/slug/${store.slug}`, token);
  if (slugR.ok) return slugR.data; // já existe

  const r = await post("/api/stores", {
    name: store.name, slug: store.slug, category: store.category,
    description: store.description, address: store.address,
    number: store.number, neighborhood: store.neighborhood,
    city: store.city ?? "São Paulo", state: store.state ?? "SP",
    zipCode: store.zipCode ?? "01000-000",
    deliveryFee: store.deliveryFee, deliveryTimeMin: store.deliveryTimeMin,
    deliveryTimeMax: store.deliveryTimeMax, isOpen: true, active: true,
    featured: store.featured ?? false,
  }, token);
  if (!r.ok) { console.log(`  ⚠️  Loja "${store.name}": ${JSON.stringify(r.data)}`); return null; }
  return r.data;
}

async function createProduct(p, category, token) {
  const r = await post("/api/products", {
    name: p.name, category, description: p.description,
    brand: p.brand ?? null, price: p.price, available: true,
  }, token);
  if (!r.ok) { console.log(`  ⚠️  Produto "${p.name}": ${JSON.stringify(r.data)}`); return null; }
  return r.data;
}

async function linkProduct(storeId, productId, token) {
  const r = await post("/api/storeproducts/add-from-catalog", { storeId, productId }, token);
  return r; // 400 = já existe, ok
}

async function patchStoreProducts(storeId, productMap, priceMult, token) {
  const r = await get(`/api/storeproducts/${storeId}`, token);
  if (!r.ok) return;
  for (const sp of r.data) {
    const base = productMap[sp.productId];
    if (!base) continue;
    const price = parseFloat((base.price * priceMult).toFixed(2));
    const promo = base.promotionalPrice
      ? parseFloat((base.promotionalPrice * priceMult).toFixed(2))
      : null;
    await patch(`/api/storeproducts/${sp.id}`,
      { price, promotionalPrice: promo, stock: 100, available: true }, token);
  }
}

// ─── Seed Data ───────────────────────────────────────────────────────────────

// s(name, slug, category, desc, fee, min, max, hood, featured, mult)
const s = (name, slug, category, desc, fee, min, max, hood, featured = false, mult = 1.0) =>
  ({ name, slug, category, desc, description: desc, address: "Rua das Flores", number: "100",
     neighborhood: hood, deliveryFee: fee, deliveryTimeMin: min, deliveryTimeMax: max,
     featured, priceMultiplier: mult });

// p(name, desc, price, brand?, promo?)
const p = (name, desc, price, brand = null, promotionalPrice = null) =>
  ({ name, description: desc, price, brand, promotionalPrice });

const CATEGORIES = [
  // ─── 1. RESTAURANTES ───────────────────────────────────────────────────────
  {
    slug: "restaurantes",
    stores: [
      s("Restaurante BrasUX",    "brasux-restaurante",    "restaurantes", "Alta gastronomia no delivery. Pratos autorais, ingredientes frescos, apresentação premium.", 7.9, 30, 55, "Itaim Bibi", true, 1.0),
      s("Mesa & Sabor",          "mesa-e-sabor",          "restaurantes", "Culinária caseira, tempero de verdade. Marmitex executivo e pratos à la carte.", 5.9, 25, 45, "Mooca", false, 0.9),
      s("Cozinha da Família",    "cozinha-da-familia",    "restaurantes", "Comida feita com amor, igual à vó fazia. Arroz, feijão e o melhor frango da cidade.", 4.9, 20, 40, "Santana", false, 0.85),
    ],
    products: [
      p("Frango Grelhado com Arroz e Salada", "Peito de frango grelhado temperado na hora, arroz soltinho e mix de folhas.", 38.9),
      p("Filé à Parmegiana",               "Filé mignon empanado, molho de tomate artesanal e queijo mussarela gratinado.",   55.9),
      p("Strogonoff de Carne",             "Carne nobre ao creme de leite com cogumelos, acompanha arroz e batata palha.",      42.9),
      p("Feijoada Completa",               "Feijão preto com carnes nobres, couve, laranja, farofa e torresmo.", 49.9, null, 44.9),
      p("Salmão ao Molho Maracujá",        "Filé de salmão grelhado, molho agridoce de maracujá e purê de batata-baroa.",      69.9),
      p("Macarrão à Bolonhesa",            "Talharim fresco ao molho de carne moída com tomates italianos e manjericão.",       35.9),
      p("Picanha na Brasa",                "Picanha bovina premium grelhada no carvão, acompanha farofa e vinagrete.",          82.9),
      p("Frango ao Curry",                 "Frango em cubos ao molho de curry tailandês, arroz basmati e chutney de manga.",    44.9),
      p("Prato Vegetariano do Dia",        "Combinação nutritiva de legumes salteados, grãos e molho especial da casa.",        32.9),
      p("Sobremesa — Petit Gâteau",        "Bolinho de chocolate com interior cremoso, servido com sorvete de baunilha.",       19.9),
    ],
  },

  // ─── 2. MERCEARIA ──────────────────────────────────────────────────────────
  {
    slug: "mercearia",
    stores: [
      s("Mercearia BrasUX",      "mercearia-brasux",      "mercearia", "Tudo que você precisa no dia a dia, com preços justos e entrega rápida.",        4.9, 20, 40, "Pinheiros", true, 1.0),
      s("Supermercado Bom Preço","supermercado-bom-preco","mercearia", "Economia garantida no estoque completo de produtos básicos para o seu lar.",      3.9, 25, 50, "Penha", false, 0.88),
      s("Mercadinho Vizinho",    "mercadinho-vizinho",    "mercearia", "Seu mercado de bairro de sempre, agora com delivery express.",                    2.9, 15, 35, "Lapa", false, 0.93),
    ],
    products: [
      p("Arroz Branco Tipo 1 — 5kg",      "Grãos selecionados, cozimento perfeito. Ideal para o dia a dia.",        26.9, "Tio João"),
      p("Feijão Carioca — 1kg",           "Feijão sortido, grãos uniformes, cozimento rápido.",                      8.9, "Camil"),
      p("Óleo de Soja — 900ml",           "Óleo vegetal refinado, ideal para frituras e refogados.",                  7.9, "Soya"),
      p("Macarrão Espaguete — 500g",      "Massa de sêmola de trigo, formato espaguete n.8.",                        4.5, "La Molisana"),
      p("Açúcar Cristal — 1kg",           "Açúcar de cana cristalizado, granulação média.",                          5.9, "União"),
      p("Sal Refinado Iodado — 1kg",      "Sal refinado com flúor, embalagem prática.",                              2.9, "Cisne"),
      p("Farinha de Trigo — 1kg",         "Farinha enriquecida com ferro e ácido fólico, ideal para pães e bolos.",  5.5, "Dona Benta"),
      p("Leite Integral — 1L",            "Leite UHT integral, sabor suave, sem lactose removida.",                  6.9, "Piracanjuba"),
      p("Manteiga com Sal — 200g",        "Manteiga de primeira qualidade, cremosa e saborosa.",                    10.9, "Aviação"),
      p("Ovos Brancos — Dúzia",           "Ovos frescos selecionados, categoria A.",                                12.9, "Granja Mantiqueira"),
      p("Café Torrado Moído — 500g",      "Blend premium de arábica e robusta, torra média.",                       19.9, "Melitta", 17.9),
      p("Molho de Tomate — 340g",         "Molho de tomate tradicional temperado com manjericão.",                   4.2, "Pomarola"),
    ],
  },

  // ─── 3. CERVEJAS ───────────────────────────────────────────────────────────
  {
    slug: "cervejas",
    stores: [
      s("Cervejaria BrasUX",     "cervejaria-brasux-2",   "cervejas", "Curadoria premium de cervejas artesanais e importadas. Entregues geladas.",        4.9, 15, 30, "Vila Madalena", true, 1.0),
      s("Beer Point",            "beer-point",            "cervejas", "O melhor ponto de cervejas da cidade. Geladas, variadas e com entrega express.",   5.9, 20, 35, "Moema", false, 1.05),
      s("Empório Hop",           "emporio-hop",           "cervejas", "Cervejas artesanais nacionais e importadas. Mais de 80 rótulos disponíveis.",       6.9, 25, 45, "Perdizes", false, 1.1),
    ],
    products: [
      p("Heineken Garrafa — 600ml",        "Cerveja Lager holandesa, leve e refrescante. Gelada garantida.",              11.9, "Heineken"),
      p("Skol Pilsen — 600ml",             "A cerveja redonda do Brasil. Clássica e refrescante.",                        8.5,  "Skol"),
      p("Brahma Duplo Malte — 600ml",      "Encorpada e com mais sabor, a Brahma Duplo Malte agrada a todos os paladares.",9.9, "Brahma"),
      p("Corona Extra — 330ml",            "Cerveja mexicana com toque tropical. Sirva com gelo e limão.",               10.9, "Corona"),
      p("Stella Artois — 550ml",           "Cerveja belga premiada, corpo médio e leve amargor.",                        10.5, "Stella Artois"),
      p("IPA Artesanal Nacional — 500ml",  "India Pale Ale com notas cítricas de maracujá e pinho. Lúpulo intenso.",    19.9, null, 17.9),
      p("Weiss Artesanal — 500ml",         "Cerveja de trigo não filtrada, notas de banana e cravo, espuma cremosa.",   18.9),
      p("Stout Imperial — 500ml",          "Cerveja escura robusta, notas de chocolate amargo e café torrado.",          22.9),
      p("Pack Heineken — 12 Latas 350ml",  "Pack econômico com 12 latas de Heineken geladas.",                          79.9, "Heineken", 69.9),
      p("Chopp Artesanal — Growler 1L",   "Chopp tirado na hora, acondicionado em growler de vidro. Fresco e encorpado.",39.9),
    ],
  },

  // ─── 4. DESTILADOS E VINHOS ────────────────────────────────────────────────
  {
    slug: "destilados-e-vinhos",
    stores: [
      s("Adega BrasUX",          "adega-brasux-2",        "destilados-e-vinhos", "Adega curada por sommeliers. Vinhos, destilados e espumantes premium.",         8.9, 25, 50, "Jardins", true, 1.0),
      s("Vinho & Arte",          "vinho-e-arte",          "destilados-e-vinhos", "Vinhos nacionais e importados selecionados a dedo. Harmonize sua refeição.",    6.9, 20, 45, "Higienópolis", false, 0.95),
      s("Spirits House",         "spirits-house",         "destilados-e-vinhos", "Whisky, gin, vodka e rum de altíssima qualidade. Para os paladares exigentes.", 9.9, 30, 55, "Brooklin", false, 1.08),
    ],
    products: [
      p("Whisky Jack Daniel's Old No. 7 — 750ml", "Tennesse Whiskey envelhecido em barril de carvalho, suave e caramelo.",   149.9, "Jack Daniel's"),
      p("Vodka Absolut Original — 750ml",          "Vodka sueca destilada em grão, cristalina e de caráter neutro.",         99.9,  "Absolut"),
      p("Gin Gordon's London Dry — 750ml",         "Gin clássico londrino, notas de zimbro, cítrico e especiarias.",          79.9,  "Gordon's"),
      p("Vinho Tinto Seco Cabernet — 750ml",       "Cabernet Sauvignon chileno, notas de ameixa, baunilha e taninos suaves.", 59.9,  "Santa Helena", 52.9),
      p("Vinho Branco Chardonnay — 750ml",         "Chardonnay argentino encorpado, notas tropicais e baunilha.",             54.9,  "Catena"),
      p("Espumante Brut Nacional — 750ml",         "Espumante método Charmat, borbulhas finas, fresco e elegante.",          79.9,  "Chandon"),
      p("Cachaça Artesanal Envelhecida — 700ml",   "Cachaça de alambique envelhecida 3 anos em barril de carvalho.",         99.9,  "Ypióca"),
      p("Rum Bacardí Superior — 750ml",            "Rum branco cubano, leve e versátil. Ideal para drinks clássicos.",        79.9,  "Bacardí"),
      p("Tequila Jose Cuervo Silver — 750ml",      "Tequila 100% agave azul, sabor suave e ligeiramente cítrico.",            99.9,  "Jose Cuervo"),
      p("Kit Degustação — 3 Miniaturas 50ml",      "Três destilados premium para explorar: whisky, gin e vodka.",             89.9,  null, 79.9),
    ],
  },

  // ─── 5. BEBIDAS NÃO ALCOÓLICAS ─────────────────────────────────────────────
  {
    slug: "nao-alcoolicos",
    stores: [
      s("Bebidas BrasUX",        "bebidas-brasux-2",      "nao-alcoolicos", "Do sumo natural ao energético premium. Hidrate-se com estilo.",                4.9, 15, 30, "Consolação", true, 1.0),
      s("Sucos & Cia",           "sucos-e-cia",           "nao-alcoolicos", "Sucos naturais, vitaminas e água de coco prensados na hora.",                  5.9, 20, 35, "Vila Clementino", false, 0.95),
      s("Refresca Fácil",        "refresca-facil",        "nao-alcoolicos", "Refrigerantes, energéticos e isotônicos com delivery ultra rápido.",           3.9, 10, 25, "Butantã", false, 0.88),
    ],
    products: [
      p("Coca-Cola Original — 2L",          "O refrigerante mais famoso do mundo. Gelado e irresistível.",              12.9, "Coca-Cola"),
      p("Guaraná Antarctica — 2L",          "O sabor brasileiro de guaraná que nunca decepciona.",                      9.9,  "Antarctica"),
      p("Suco Del Valle Laranja — 1L",      "Suco de laranja integral, sem adição de açúcar, 100% natural.",            8.9,  "Del Valle"),
      p("Água de Coco — 330ml",             "Água de coco natural, refrescante e rica em eletrólitos.",                 6.9,  "Sococo"),
      p("Red Bull Energy Drink — 250ml",    "Bebida energética com cafeína e taurina. Estimula mente e corpo.",          12.9, "Red Bull"),
      p("Monster Energy Green — 473ml",     "Bebida energética sabor original, com blend de energia completo.",         10.9, "Monster"),
      p("Água Mineral com Gás — 500ml",     "Água mineral efervescente, leveza e frescor natural.",                    5.9,  "Perrier"),
      p("Chá Gelado Ice Tea Pêssego — 1L", "Chá preto gelado com sabor de pêssego, zero gorduras.",                   8.5,  "Lipton"),
      p("Isotônico Gatorade — 500ml",       "Repositor de eletrólitos ideal para atividades físicas.",                  8.9,  "Gatorade"),
      p("Kombucha Original — 300ml",        "Bebida fermentada natural, rica em probióticos e antioxidantes.",          14.9, null, 12.9),
    ],
  },

  // ─── 6. FARMÁCIA ───────────────────────────────────────────────────────────
  {
    slug: "farmacia",
    stores: [
      s("Farmácia BrasUX",       "farmacia-brasux-2",     "farmacia", "Medicamentos, dermocosméticos e suplementos com entrega segura e rápida.",        4.9, 20, 40, "Perdizes", true, 1.0),
      s("Drogaria Popular",      "drogaria-popular",      "farmacia", "Preço baixo em medicamentos essenciais, sem abrir mão da qualidade.",              2.9, 15, 35, "Belém", false, 0.9),
      s("Saúde & Bem-Estar",     "saude-e-bem-estar",     "farmacia", "Farmácia completa com atendimento farmacêutico e delivery expresso.",              3.9, 20, 40, "Vila Mariana", false, 0.95),
    ],
    products: [
      p("Dipirona Sódica 500mg — 20 comprimidos",  "Analgésico e antitérmico de referência. Alívio rápido da dor e febre.",         12.9, "Genérico"),
      p("Vitamina C 1000mg — 30 comprimidos",      "Suplemento de ácido ascórbico. Imunidade reforçada todo dia.",                    24.9, "Cebion"),
      p("Omeprazol 20mg — 28 cápsulas",            "Inibidor de bomba de prótons, protege a mucosa gástrica.",                        18.9, "Genérico"),
      p("Ibuprofeno 600mg — 20 comprimidos",       "Anti-inflamatório e analgésico. Dores musculares e articulares.",                 15.9, "Advil"),
      p("Loratadina 10mg — 12 comprimidos",        "Antialérgico não sedativo. Rinite, urticária e dermatite.",                       14.9, "Claritin"),
      p("Protetor Solar FPS 50+ — 60g",            "Filtro solar facial oil-free, toque seco, sem oleosidade.",                       39.9, "Neutrogena", 34.9),
      p("Pomada Bepantol Derma — 30g",             "Regeneradora de pele, ideal para assaduras, cortes e ressecamento.",              18.9, "Bepantol"),
      p("Vitamina D3 2000UI — 60 cápsulas",        "Suplemento essencial para ossos, imunidade e humor.",                            34.9, "Sunvit"),
      p("Termômetro Digital Infravermelho",         "Medição precisa em 1 segundo, sem contato. Ideal para bebês e adultos.",          59.9),
      p("Máscara Cirúrgica Tripla — 50 unidades",  "Máscara descartável com 3 camadas de proteção, clipe nasal.",                    24.9),
    ],
  },

  // ─── 7. LANCHES ────────────────────────────────────────────────────────────
  {
    slug: "lanches",
    stores: [
      s("Lanchonete BrasUX",     "lanchonete-brasux",     "lanches", "Burgers artesanais, hot dogs gourmet e petiscos premium. Sabor que surpreende.",  5.9, 20, 40, "Vila Olímpia", true, 1.0),
      s("Snack House",           "snack-house",           "lanches", "A melhor seleção de lanches rápidos. Do simples ao especial, tem tudo aqui.",     4.9, 15, 35, "Tatuapé", false, 0.9),
      s("Burguer & Cia",         "burguer-e-cia",         "lanches", "Hambúrgueres artesanais feitos na hora com carne bovina 180g grelhada.",          6.9, 25, 45, "Brooklin", false, 1.05),
    ],
    products: [
      p("X-Burguer Clássico",       "Hambúrguer 180g, queijo cheddar, alface, tomate e molho especial no pão brioche.",  28.9),
      p("X-Tudo Especial",          "Hambúrguer duplo, bacon crocante, ovo, queijo, rúcula e molho barbecue.",           39.9),
      p("Hot Dog Gourmet",          "Salsicha frank grossa, molho de queijo, cebola caramelizada e mostarda dijon.",      22.9),
      p("Batata Frita Crocante — P","Batata julienne crocante frita no óleo vegetal. Temperada na hora.",                14.9),
      p("Batata Frita Crocante — G","Porção grande de batata frita, rende bem para 2.",                                  22.9),
      p("Nuggets de Frango — 10 un","Nuggets de peito de frango empanados, crocantes por fora, suculentos por dentro.",  19.9, null, 17.9),
      p("Onion Rings — 8 unidades", "Anéis de cebola empanados no panko, dourados e crocantes com molho ranch.",        16.9),
      p("Misto Quente Artesanal",   "Pão de forma artesanal, queijo mussarela e presunto cozido. Quente e sequinho.",   12.9),
      p("Coxinha de Frango — 4 un", "Coxinha recheada com frango desfiado temperado, massa crocante.",                  18.9),
      p("Empada de Frango — 4 un",  "Mini empadas recheadas com frango, catupiry e milho. Massa folhada.",              16.9),
    ],
  },

  // ─── 8. PIZZARIAS ──────────────────────────────────────────────────────────
  {
    slug: "pizzarias",
    stores: [
      s("Pizzaria BrasUX",       "pizzaria-brasux",       "pizzarias", "Pizza artesanal em forno a lenha, massa fininha napolitana e ingredientes premium.", 6.9, 30, 60, "Moema", true, 1.0),
      s("Forno a Lenha",         "forno-a-lenha",         "pizzarias", "Tradição italiana desde 1998. Massa fermentada 48h e molho San Marzano.",           5.9, 35, 65, "Bela Vista", false, 0.95),
      s("Pizza Mania",           "pizza-mania",           "pizzarias", "Pizzas gigantes com muito recheio, borda recheada e preços acessíveis.",            4.9, 25, 50, "Santo André", false, 0.88),
    ],
    products: [
      p("Pizza Mussarela — Grande",       "Molho de tomate San Marzano, mussarela fior di latte, manjericão fresco.",  52.9),
      p("Pizza Pepperoni — Grande",       "Pepperoni italiano fatiado, mussarela, azeitona e orégano.",                 62.9),
      p("Pizza Quatro Queijos — Grande",  "Mussarela, parmesão, provolone e gorgonzola com mel de abelha.",            64.9),
      p("Pizza Margherita — Grande",      "A clássica italiana: molho, mussarela fresca, tomate e manjericão.",         55.9),
      p("Pizza Calabresa — Grande",       "Calabresa artesanal fatiada, cebola roxa e azeitona verde.",                 58.9),
      p("Pizza Portuguesa — Grande",      "Presunto, ovo, cebola, mussarela e azeitona. Um clássico.",                  60.9, null, 55.9),
      p("Pizza Frango Catupiry — Grande", "Frango desfiado temperado com catupiry cremoso e milho.",                   62.9),
      p("Pizza Vegetariana — Grande",     "Berinjela, abobrinha, tomate cereja, rúcula e parmesão.",                   58.9),
      p("Pizza Nutella & Morango",        "Doce irresistível: Nutella cremosa, morangos frescos e leite condensado.",   55.9),
      p("Borda Recheada com Catupiry",    "Adicione borda recheada com catupiry cremoso em qualquer pizza.",           10.9),
    ],
  },

  // ─── 9. AÇAÍ E SORVETES ────────────────────────────────────────────────────
  {
    slug: "acai-sorvetes",
    stores: [
      s("Açaí BrasUX",           "acai-brasux",           "acai-sorvetes", "Açaí puro da Amazônia, cremoso, rico e gelado. Topping premium incluído.",       4.9, 15, 30, "Pinheiros", true, 1.0),
      s("Gelato di Roma",        "gelato-di-roma",        "acai-sorvetes", "Sorvetes artesanais no estilo italiano, produzidos diariamente com frutas frescas.",5.9, 20, 40, "Higienópolis", false, 1.1),
      s("Sorveteria Clássica",   "sorveteria-classica",   "acai-sorvetes", "Sorvetes, picolés e milkshakes desde 1985. A memória afetiva em cada colherada.", 3.9, 10, 25, "São Bernardo", false, 0.88),
    ],
    products: [
      p("Açaí Puro — 300ml",           "Açaí 100% da Amazônia, sem açúcar adicionado. Cremoso e nutritivo.",           18.9),
      p("Açaí Puro — 500ml",           "Porção generosa de açaí puro para compartilhar ou matar a fome.",              28.9),
      p("Açaí Power na Tigela",        "Açaí com granola, banana, mel e frutas vermelhas. A combinação perfeita.",      34.9, null, 29.9),
      p("Sorvete 2 Bolas",             "Escolha 2 sabores da nossa vitrine artesanal: chocolate, baunilha, morango...", 14.9),
      p("Sorvete 3 Bolas",             "Três bolas generosas de sorvete artesanal no casquinha ou copa.",               19.9),
      p("Milkshake Chocolate",         "Shake cremoso de sorvete com chocolate belga e leite integral.",                22.9),
      p("Milkshake Morango",           "Shake gelado com sorvete de morango e frutas frescas.",                        22.9),
      p("Picolé Artesanal — 3 un",     "Três picolés artesanais de fruta: maracujá, manga e cupuaçu.",                 18.9),
      p("Sundae Caramelo & Castanha",  "Sorvete de baunilha coberto com calda de caramelo e castanhas crocantes.",     19.9),
      p("Sorvete Pote — 500ml",        "Pote de sorvete artesanal para levar para casa. Escolha o sabor.",             34.9),
    ],
  },

  // ─── 10. CAFETERIAS ────────────────────────────────────────────────────────
  {
    slug: "cafeterias",
    stores: [
      s("Café BrasUX",           "cafe-brasux",           "cafeterias", "Cafés de origem especial, torrados artesanalmente. Experiência sensorial completa.", 5.9, 15, 35, "Vila Madalena", true, 1.0),
      s("Arábica Especial",      "arabica-especial",      "cafeterias", "Specialty coffees com grãos de altitude. Baristas certificados pela SCA.",           6.9, 20, 40, "Itaim Bibi", false, 1.1),
      s("Coffee & Sweet",        "coffee-and-sweet",      "cafeterias", "Cafeteria aconchegante com bolos caseiros, salgados frescos e cafés especiais.",      4.9, 20, 40, "Perdizes", false, 0.92),
    ],
    products: [
      p("Espresso Simples — 50ml",   "Dose de espresso extraído com grãos arábica especiais, crema dourada.",          7.9),
      p("Cappuccino Tradicional",    "Espresso com leite vaporizado e espuma cremosa. Polvilhado com canela.",         14.9),
      p("Latte Macchiato",           "Camadas de leite vaporizado, espresso e espuma. Suave e aveludado.",             15.9),
      p("Café com Leite — 300ml",    "Café coado forte com leite quente. O clássico do café da manhã.",               10.9),
      p("Frappuccino Caramelo",      "Café gelado, leite, gelo e calda de caramelo. Gelado e energizante.",           18.9),
      p("Croissant Amanteigado",     "Croissant folhado com manteiga extra. Assado na hora, quente e crocante.",      12.9, null, 10.9),
      p("Bolo de Cenoura com Cobertura", "Bolo caseiro fofinho com cobertura de brigadeiro de colher.",               14.9),
      p("Cookie Double Chocolate",   "Cookie grande, crocante por fora e cremoso por dentro com gotas de chocolate.",  9.9),
      p("Sanduíche Integral",        "Pão integral, frios nobres, rúcula, tomate e mostarda dijon.",                  18.9),
      p("Brownie Gourmet",           "Brownie denso de chocolate belga, topo crocante e interior fondant.",           12.9),
    ],
  },

  // ─── 11. PADARIA ───────────────────────────────────────────────────────────
  {
    slug: "padaria",
    stores: [
      s("Padaria BrasUX",        "padaria-brasux",        "padaria", "Pães artesanais saídos do forno o dia todo. Fermentação natural e orgânicos.",       3.9, 15, 35, "Perdizes", true, 1.0),
      s("Pão Quente",            "pao-quente",            "padaria", "Padaria tradicional de bairro. Pão fresquinho garantido durante todo o dia.",        2.9, 10, 25, "Ipiranga", false, 0.85),
      s("Forno Dourado",         "forno-dourado",         "padaria", "Padaria completa com pães doces, salgados, bolos e confeitaria artesanal.",           3.9, 20, 40, "Jabaquara", false, 0.9),
    ],
    products: [
      p("Pão Francês — 100g",          "Par de pães franceses crocantes saídos do forno.",                           1.1),
      p("Baguete Tradicional",         "Baguete de fermentação lenta, casca crocante e miolo macio.",                 8.9),
      p("Pão de Forma Integral — 500g","Pão integral com sementes, rico em fibras e sem conservantes.",              11.9, null, 9.9),
      p("Croissant Amanteigado",       "Croissant folhado com manteiga de qualidade, leve e crocante.",               7.9),
      p("Pão Doce Recheado — 2 un",    "Pão doce macio recheado com creme de confeiteiro ou goiabada.",              9.9),
      p("Bolo de Fubá — Fatia",        "Fatia generosa de bolo de fubá caipira, úmido e com gosto de infância.",     6.9),
      p("Cuca de Banana",              "Cuca alemã com bananas carameladas e farofa crocante de açúcar e canela.",   18.9),
      p("Pão Ciabatta — 200g",         "Ciabatta italiana de fermentação natural, casca fina e miolo cheio de alvéolos.",9.9),
      p("Sonho de Creme — 2 un",       "Pão frito recheado com creme de baunilha, polvilhado com açúcar.",           8.9),
      p("Rosca de Coco",               "Rosca trançada com recheio de coco ralado e cobertura de açúcar.",           19.9),
    ],
  },

  // ─── 12. DOCES E CHOCOLATES ────────────────────────────────────────────────
  {
    slug: "doces",
    stores: [
      s("Doceria BrasUX",        "doceria-brasux",        "doces", "Confeitaria de luxo com trufas belgas, macarons e bolos de autor premium.",          6.9, 20, 45, "Jardins", true, 1.0),
      s("Chocolatier",           "chocolatier",           "doces", "Chocolates belgas e trufas artesanais. Presentes e bombons para todas as ocasiões.", 5.9, 25, 50, "Itaim Bibi", false, 1.1),
      s("Confeitaria Real",      "confeitaria-real",      "doces", "Doces tradicionais e gourmet: brigadeiros, beijinhos, bolos e tortas.",              4.9, 15, 35, "Santana", false, 0.92),
    ],
    products: [
      p("Brigadeiro Gourmet — 6 un",   "Brigadeiros de colher no pote, sabores: meio amargo, pistache e maracujá.",  32.9),
      p("Trufa de Chocolate Belga — 6","Trufas com ganache de chocolate 70% cacau e cobertura crocante.",            42.9, null, 36.9),
      p("Macaron Francês — 6 un",      "Macarons nas cores do arco-íris. Sabores: framboesa, pistache, lavanda...", 38.9),
      p("Bolo de Chocolate — Fatia",   "Bolo de chocolate intenso com cobertura ganache e raspas de laranja.",       18.9),
      p("Torta de Limão Siciliano",    "Torta com creme de limão siciliano, base de biscoito e merengue tostado.",  54.9),
      p("Brownie Gourmet — 4 un",      "Brownies densos com chocolate 70%, borda crocante e interior fudgy.",        28.9),
      p("Kit Ferrero Rocher — 16 un",  "Caixa premium com 16 bombons Ferrero Rocher, presente perfeito.",            64.9, "Ferrero"),
      p("Chocolate Lindt Lindor — 100g","Chocolate suíço com recheio cremoso. Ao leite, amargo ou branco.",          24.9, "Lindt"),
      p("Mousse de Maracujá — 200ml",  "Mousse leve e aerada de maracujá com calda azedinha.",                       14.9),
      p("Pave de Chocolate — 300g",    "Pavê clássico com biscoito champagne, creme de chocolate e chantilly.",     22.9),
    ],
  },

  // ─── 13. CONVENIÊNCIA ──────────────────────────────────────────────────────
  {
    slug: "conveniencia",
    stores: [
      s("Conveniência BrasUX",   "conveniencia-brasux",   "conveniencia", "Tudo que você precisa a qualquer hora. Aberto 24h, entrega em 15 minutos.",    4.9, 10, 25, "Paulista", true, 1.0),
      s("24h Fácil",             "vinte-quatro-facil",    "conveniencia", "Conveniência express. Itens essenciais e bebidas geladas no menor tempo.",     4.9, 10, 20, "Consolação", false, 0.95),
      s("Stop & Go",             "stop-and-go",           "conveniencia", "Snacks, bebidas e utilidades para o dia a dia. Rápido, fácil e acessível.",   3.9, 15, 30, "Barra Funda", false, 0.88),
    ],
    products: [
      p("Água Mineral — 500ml",        "Água mineral natural sem gás, fonte controlada.",                             3.5),
      p("Bala Sortida — 100g",         "Mix de balas de goma e duras com sabores variados.",                         4.9),
      p("Biscoito Recheado — 150g",    "Biscoito recheado com creme de chocolate ou baunilha.",                       5.9, "Oreo"),
      p("Barrinha de Cereal — 2 un",   "Barrinhas de cereal com aveia e mel. Energia rápida.",                       6.9, "Nutry"),
      p("Pilha Alcalina AA — 4 un",    "Pilhas alcalinas de alta duração AA, ideais para controles e brinquedos.",   14.9, "Duracell"),
      p("Carregador USB Veicular",     "Carregador veicular dupla USB com proteção contra sobretensão.",              24.9),
      p("Chiclete — 5 un",             "Chicletes refrescantes de menta.",                                           3.9,  "Trident"),
      p("Copo Descartável 200ml — 50", "Copo descartável transparente para água e sucos.",                           8.9),
      p("Fio Dental — 25m",            "Fio dental encerado com flúor e mentol.",                                    4.9),
      p("Creme Dental Viagem — 50g",   "Creme dental em tamanho de viagem, fórmula completa.",                       7.9),
    ],
  },

  // ─── 14. HORTIFRUTI ────────────────────────────────────────────────────────
  {
    slug: "hortifruti",
    stores: [
      s("Hortifruti BrasUX",     "hortifruti-brasux",     "hortifruti", "Frutas, verduras e legumes direto do produtor. Fresquíssimos, colhidos hoje.",  4.9, 20, 45, "Pinheiros", true, 1.0),
      s("Feira do Bairro",       "feira-do-bairro",       "hortifruti", "A feira de sempre, agora no delivery. Produtos orgânicos e convencionais.",     3.9, 25, 50, "Mooca", false, 0.88),
      s("Campo Verde",           "campo-verde",           "hortifruti", "Hortaliças e frutas selecionadas da fazenda para a sua mesa.",                  5.9, 30, 55, "Cotia", false, 0.92),
    ],
    products: [
      p("Maçã Fuji — kg",            "Maçã vermelha importada, doce e crocante. Selecionada e calibrada.",          11.9),
      p("Banana Prata — kg",         "Banana prata madura no ponto certo, doce e saborosa.",                        6.9),
      p("Tomate Salada — kg",        "Tomates maduros e firmes, ideais para saladas e molhos.",                     9.9),
      p("Alface Crespa — maço",      "Alface fresca e crocante, maço com 300g aproximadamente.",                    4.9),
      p("Cenoura — kg",              "Cenoura lisa, laranja viva, rica em betacaroteno.",                           5.9),
      p("Limão Tahiti — kg",         "Limão suculento e ácido, ideal para temperos e sucos.",                       7.9),
      p("Morango — bandeja 300g",    "Morangos selecionados, doces e vermelhos. Maduros no ponto.",                 14.9, null, 12.9),
      p("Espinafre — maço",          "Espinafre fresco, folhas tenras, rico em ferro e vitaminas.",                  4.9),
      p("Abacate — unidade",         "Abacate maduro no ponto, cremoso e rico em gorduras boas.",                   7.9),
      p("Pimentão Tricolor — 3 un",  "Kit com pimentão verde, amarelo e vermelho. Sabor e cor.",                   11.9),
    ],
  },

  // ─── 15. CARNES E CHURRASCO ────────────────────────────────────────────────
  {
    slug: "carnes",
    stores: [
      s("Açougue BrasUX",        "acougue-brasux",        "carnes", "Cortes nobre de carnes premium, maturadas, embaladas a vácuo e entregues geladas.", 6.9, 25, 50, "Vila Leopoldina", true, 1.0),
      s("Churrasco Express",     "churrasco-express",     "carnes", "Tudo para o seu churrasco perfeito. Carnes, linguiças e carvão entregues juntos.", 5.9, 20, 45, "Lapa", false, 0.9),
      s("Açougue Premium",       "acougue-premium",       "carnes", "Carnes angus maturadas 30 dias, fatiadas na hora. Entrega refrigerada.",           7.9, 30, 55, "Morumbi", false, 1.1),
    ],
    products: [
      p("Picanha Bovina — kg",       "Picanha com tampa de gordura, marmoreio perfeito. Raça Angus.",              79.9),
      p("Fraldinha — kg",            "Corte macio e saboroso, ideal para churrasco e bifes na frigideira.",        55.9),
      p("Costelinha Suína — kg",     "Costelinha de porco tenra, ideal para churrasqueira ou forno.",              45.9),
      p("Frango Inteiro Temperado",  "Frango caipira inteiro, temperado na maionese e ervas.",                    29.9),
      p("Linguiça Toscana — kg",     "Linguiça artesanal temperada com ervas finas e alho.",                      36.9),
      p("Alcatra — kg",              "Alcatra bovina macia, ótima para bifes e churrascos.",                      58.9, null, 52.9),
      p("Filé Mignon — kg",          "O corte mais macio da carne bovina. Ideal para medalhões e estrogonofe.",  129.9),
      p("Contrafilé — kg",           "Contrafilé com capa de gordura, sabor e suculência garantidos.",            65.9),
      p("Bacon Defumado — 200g",     "Fatias de bacon defumado e fatiado. Sabor inigualável.",                   16.9),
      p("Carne Moída Patinho — kg",  "Carne moída fresca na hora, patinho selecionado.",                         32.9),
    ],
  },

  // ─── 16. PET SHOP ──────────────────────────────────────────────────────────
  {
    slug: "petshop",
    stores: [
      s("Pet BrasUX",            "pet-brasux",            "petshop", "Alimentação, cuidados e acessórios premium para o seu pet. Amor em cada entrega.", 4.9, 20, 45, "Santana", true, 1.0),
      s("Mundo Animal",          "mundo-animal",          "petshop", "Tudo para cães, gatos, aves e pequenos animais. Variedade e preço justo.",         3.9, 25, 50, "Pirituba", false, 0.9),
      s("Patinhas & Cia",        "patinhas-e-cia",        "petshop", "Petshop especializado com nutricionista animal. Alimentação natural disponível.",  5.9, 30, 55, "Campo Belo", false, 1.05),
    ],
    products: [
      p("Ração Golden Cães Adulto — 3kg",  "Ração premium para cães adultos com frango e arroz.",                 79.9, "Golden"),
      p("Ração Whiskas Gatos — 500g",      "Ração para gatos adultos sabor peixe, embalagem prática.",            18.9, "Whiskas"),
      p("Petisco Ossinho Natural — 6 un",  "Ossinhos naturais defumados para cães. Diversão e higiene dental.",   19.9),
      p("Shampoo Pet Neutro — 500ml",      "Shampoo neutro hipoalergênico, sem parabenos. Pelo brilhante.",       24.9),
      p("Antipulgas Coleira — Porte G",    "Coleira antipulgas e carrapatos, efeito 8 meses.",                    49.9, "Seresto"),
      p("Brinquedo Mordedor Latex",        "Brinquedo de borracha natural resistente, estimula o cão.",           29.9),
      p("Cama Pet Pelúcia — Tamanho M",   "Cama macia com enchimento antialérgico. Seu pet vai adorar.",          79.9, null, 69.9),
      p("Areia Sanitária Gel — 4kg",      "Areia de sílica gel, alta absorção e controle de odor.",              34.9),
      p("Coleira Ajustável Nylon — M",    "Coleira colorida ajustável de nylon, resistente e leve.",              19.9),
      p("Sachê Royal Canin — 85g",        "Sachê úmido para gatos adultos, sabor atum em molho.",                  6.9, "Royal Canin"),
    ],
  },

  // ─── 17. HIGIENE E BELEZA ──────────────────────────────────────────────────
  {
    slug: "beleza",
    stores: [
      s("Beleza BrasUX",         "beleza-brasux",         "beleza", "Dermocosméticos e cosméticos de luxo curados por especialistas. Pele perfeita.",   5.9, 20, 45, "Jardins", true, 1.0),
      s("Beauty Shop",           "beauty-shop",           "beleza", "As melhores marcas de beleza com desconto. Shampoos, cremes e maquiagem.",          4.9, 20, 40, "Tatuapé", false, 0.92),
      s("Cabelo & Corpo",        "cabelo-e-corpo",        "beleza", "Produtos profissionais para cabelo, pele e corpo. Use em casa como nos salões.",    5.9, 25, 50, "Moema", false, 1.05),
    ],
    products: [
      p("Shampoo Hidratação — 400ml",    "Shampoo com keratina e óleo de argan. Cabelos nutridos e sem frizz.",    24.9, "Pantene"),
      p("Condicionador Nutritivo — 325ml","Condicionador profundo para cabelos secos e danificados.",               19.9, "Seda"),
      p("Creme Hidratante Corporal — 400ml","Loção hidratante com shea e vitamina E. Pele macia 48h.",              34.9, "Nivea"),
      p("Protetor Solar FPS 70 — 60ml",  "Protetor facial oil-free, sem cor, toque seco. Para uso diário.",        49.9, "Neutrogena", 42.9),
      p("Batom Matte Cremoso",           "Batom de longa duração com formula hidratante. 12h sem retoques.",       29.9, "MAC"),
      p("Máscara para Cílios — Volumão", "Máscara volumizadora e curvadora. Cílios impactantes.",                  32.9, "Maybelline"),
      p("Desodorante Aerosol — 150ml",   "Desodorante antitranspirante 48h com fórmula sem álcool.",               14.9, "Dove"),
      p("Óleo Capilar de Argan — 30ml",  "Óleo marroquino puro, selante das cutículas. Brilho e suavidade.",      44.9),
      p("Esmalte Gel Perolado",          "Esmalte com efeito gel de longa duração, 10 dias sem lascar.",          14.9, "OPI"),
      p("Perfume Feminino — 50ml EDP",   "Eau de Parfum floral com bergamota, jasmim e sândalo.",                 139.9, null, 119.9),
    ],
  },

  // ─── 18. MODA ──────────────────────────────────────────────────────────────
  {
    slug: "moda",
    stores: [
      s("Moda BrasUX",           "moda-brasux",           "moda", "Moda contemporânea com peças-cápsula atemporais. Qualidade e estilo no delivery.",   6.9, 30, 60, "Pinheiros", true, 1.0),
      s("Boutique Fashion",      "boutique-fashion",      "moda", "Roupas femininas selecionadas, tendências internacionais com preço acessível.",     5.9, 25, 55, "Jardins", false, 1.1),
      s("Estilo Urbano",         "estilo-urbano",         "moda", "Streetwear e casual wear para homens e mulheres. Conforto com atitude.",             4.9, 20, 50, "Vila Madalena", false, 0.9),
    ],
    products: [
      p("Camiseta Básica Premium — M",    "100% algodão pima, corte slim, caimento perfeito. Branco, preto ou cinza.", 59.9),
      p("Camiseta Estampada Exclusiva",   "Estampa artística em serigrafia, edição limitada. 100% algodão.",           79.9, null, 69.9),
      p("Calça Jeans Slim Masculina",     "Calça slim com elastano, confortável e moderna. Índigo escuro.",            139.9),
      p("Short Casual Feminino",          "Short de malha canelada, cintura alta e caimento fluido.",                   69.9),
      p("Vestido Midi Floral",            "Vestido midi estampado, tecido leve, ideal para o verão.",                  129.9),
      p("Moletom com Capuz Unissex",      "Moletom quentinho com bolso canguru. Algodão felpudo premium.",             149.9, null, 129.9),
      p("Meias Cano Curto — Kit 3 pares","Meias de algodão antiderrapante, kit econômico colorido.",                   29.9),
      p("Cinto Couro Legítimo",           "Cinto masculino em couro genuíno com fivela dourada. Vários tamanhos.",     79.9),
      p("Boné Aba Reta Premium",          "Boné snapback com logo bordado. Ajuste snapback universal.",                 59.9),
      p("Carteira Slim Couro",            "Carteira minimalista com porta-cartões e compartimento de notas.",           89.9),
    ],
  },

  // ─── 19. FITNESS E SUPLEMENTOS ─────────────────────────────────────────────
  {
    slug: "fitness",
    stores: [
      s("Fitness BrasUX",        "fitness-brasux",        "fitness", "Suplementação científica, resultados reais. Curadoria de nutricionistas esportivos.",6.9, 25, 50, "Vila Olímpia", true, 1.0),
      s("Suplementos Pro",       "suplementos-pro",       "fitness", "Whey, creatina, BCAA e muito mais. Os maiores laboratórios do mercado.",             5.9, 20, 45, "Moema", false, 0.93),
      s("NutriForce",            "nutriforce",            "fitness", "Suplementos naturais e veganos. Ciência e natureza a favor do seu treino.",          5.9, 25, 50, "Jardins", false, 1.05),
    ],
    products: [
      p("Whey Protein Concentrado — 1kg", "Proteína do soro do leite, 23g de proteína por dose. Sabor chocolate.", 149.9, "Growth Supplements", 129.9),
      p("Creatina Monohidratada — 300g",  "Creatina pura 100%, sem sabor, máxima pureza e absorção.",              69.9, "Integralmedica"),
      p("BCAA 2:1:1 — 200 cápsulas",      "Aminoácidos de cadeia ramificada para recuperação muscular.",            79.9),
      p("Pré-Treino Reign — 473ml",       "Bebida energética sem açúcar com cafeína e BCAAs. 300mg cafeína.",      12.9, "Monster"),
      p("Barra de Proteína — 12 un",      "Barras com 20g de proteína cada. Sabores: chocolate, amendoim, coco.", 109.9, null, 94.9),
      p("Ômega 3 — 120 cápsulas",         "Óleo de peixe purificado, 1g por cápsula, EPA+DHA.",                    49.9, "Max Titanium"),
      p("Colágeno Hidrolisado — 300g",    "Colágeno tipo I e II, auxilia articulações e pele.",                    54.9),
      p("Vitamina B12 Sublingual — 60un", "B12 1000mcg, absorção sublingual superior. Para veganos.",              34.9),
      p("Luva de Academia — Par",         "Luvas com palm pad para musculação. Grip máximo.",                       49.9),
      p("Coqueteleira 600ml — BrasUX",    "Shaker com mola misturadora, tampa com trava, livre de BPA.",           34.9),
    ],
  },

  // ─── 20. BEBÊS ─────────────────────────────────────────────────────────────
  {
    slug: "bebes",
    stores: [
      s("Bebê BrasUX",           "bebe-brasux",           "bebes", "Tudo para o seu bebê com segurança e qualidade premium. Entrega cuidadosa.",         4.9, 20, 45, "Higienópolis", true, 1.0),
      s("Mundo Baby",            "mundo-baby",            "bebes", "A maior seleção de produtos para bebês. Do enxoval ao brinquedo educativo.",          3.9, 25, 55, "Santana", false, 0.9),
      s("Crescendo Feliz",       "crescendo-feliz",       "bebes", "Produtos sustentáveis e seguros para bebês e crianças. Sem BPA, sem parabenos.",     5.9, 30, 60, "Brooklin", false, 1.05),
    ],
    products: [
      p("Fralda Pampers Premium — M 50un", "Fraldas ultra macias com indicador de umidade e barreira antivazamento.",  69.9, "Pampers"),
      p("Lenços Umedecidos — 100 un",      "Lenços sem álcool, hipoalergênicos, com aloe vera.",                       22.9, "Huggies"),
      p("Creme Antifralda — 45g",          "Proteção e alívio de assaduras. Fórmula suave com óxido de zinco.",        18.9, "Hipoglós"),
      p("Shampoo Baby Suave — 200ml",      "Shampoo suave sem lágrimas, pH neutro, aroma delicado.",                   19.9, "Johnson's"),
      p("Chupeta Ortodôntica — 2 un",      "Chupeta em silicone fisiológico, BPA free, esterilizável.",                24.9, "NUK"),
      p("Mamadeira Anti-Cólica — 270ml",   "Mamadeira com sistema anti-cólica e bico em silicone natural.",            49.9, "Dr. Brown's"),
      p("Manta de Microfibra 80x80cm",     "Manta macia, lavável, anti-alérgica com estampa ursinho.",                 39.9),
      p("Pomada Calmante de Ervas — 30g",  "Pomada natural com calêndula e camomila para pele sensível.",              14.9),
      p("Brinquedo Chocalho — 3 peças",    "Kit chocalhos coloridos de borracha natural, estimulo sensorial.",         34.9),
      p("Fantoche de Pelúcia — Ursinho",   "Fantoche de mão em pelúcia, seguro para maiores de 0+.",                   39.9, null, 34.9),
    ],
  },

  // ─── 21. CASA E COZINHA ────────────────────────────────────────────────────
  {
    slug: "casa-cozinha",
    stores: [
      s("Casa BrasUX",           "casa-brasux",           "casa-cozinha", "Utensílios de design, organização e decoração. Sua casa ainda mais bonita.",   6.9, 30, 60, "Pinheiros", true, 1.0),
      s("Lar & Decor",           "lar-e-decor",           "casa-cozinha", "Decoração contemporânea e utensílios de cozinha profissional para sua casa.",  5.9, 25, 55, "Jardins", false, 1.08),
      s("Cozinha Essencial",     "cozinha-essencial",     "casa-cozinha", "Produtos práticos para o dia a dia na cozinha e no lar.",                      4.9, 20, 45, "Santo André", false, 0.88),
    ],
    products: [
      p("Panela Antiaderente 24cm",        "Revestimento antiaderente de alta durabilidade, cabo ergonômico.",          89.9, "Tramontina"),
      p("Jogo de Pratos — 6 peças",        "Pratos de porcelana branca com acabamento matte. Atemporais.",            119.9, null, 99.9),
      p("Tábua de Corte Bambu — G",        "Tábua antibacteriana em bambu sustentável. 40x30cm.",                      49.9),
      p("Jogo de Facas — 5 peças",         "Set profissional de facas em aço inox com suporte de madeira.",           129.9, "Tramontina"),
      p("Pano de Prato — Kit 3 un",        "Panos de cozinha em algodão de alta absorção, 100% natural.",              24.9),
      p("Abridor de Vinho Elétrico",       "Abridor elétrico recarregável via USB, sem esforço.",                      79.9, null, 64.9),
      p("Espátula Silicone Alta Temperatura","Espátula resistente até 250°C, antiaderente, sem BPA.",                 24.9),
      p("Jarra Filtrante — 2.4L",          "Jarra com filtro de carvão ativado que remove cloro e impurezas.",         89.9, "Brita"),
      p("Porta-Temperos Giratório — 8 un", "Organizador giratório com 8 potes de vidro para temperos.",               69.9),
      p("Vela Aromática — Madeira & Baunilha","Vela de cera de soja com perfume amadeirado e baunilha. 40h de queima.", 49.9),
    ],
  },

  // ─── 22. UTILIDADES ────────────────────────────────────────────────────────
  {
    slug: "utilidades",
    stores: [
      s("Utilidades BrasUX",     "utilidades-brasux",     "utilidades", "Limpeza e organização do lar com produtos de alta performance.",                 4.9, 20, 45, "Penha", true, 1.0),
      s("Todo Dia",              "todo-dia",              "utilidades", "Tudo para a limpeza do seu lar com ótimo custo-benefício.",                     3.9, 15, 35, "Itaquera", false, 0.85),
      s("Casa Prática",          "casa-pratica",          "utilidades", "Utilidades domésticas e produtos de limpeza com entrega ágil.",                 3.9, 20, 40, "Osasco", false, 0.9),
    ],
    products: [
      p("Detergente Neutro — 500ml",       "Detergente concentrado, remove gordura com facilidade.",                   4.9, "Ypê"),
      p("Sabão em Pó — 1kg",              "Sabão em pó com enzimas, remove manchas difíceis.",                        12.9, "OMO"),
      p("Amaciante de Roupas — 2L",        "Amaciante concentrado com fragrância duradoura.",                          14.9, "Comfort"),
      p("Desinfetante Lavanda — 750ml",    "Desinfetante bactericida com perfume lavanda francesa.",                    8.9,  "Pinho Sol"),
      p("Esponja de Aço — 8 un",          "Esponjas de aço inoxidável sem resíduos.",                                 5.9,  "Bombril"),
      p("Rodo Mágico com Cabo — 120cm",   "Rodo com cabo telescópico e cabo ergonômico.",                            29.9),
      p("Luva Doméstica — Par M",          "Luva de borracha grossa, cano longo, antiderrapante.",                     8.9),
      p("Saco de Lixo 30L — 50 un",       "Sacos de lixo reforçados com fechamento fácil.",                          14.9),
      p("Pano Multiuso — 3 un",            "Panos de microfibra para diversas superfícies.",                          16.9, "Scotch-Brite"),
      p("Álcool 70% Gel — 500ml",         "Álcool gel sanitizante para mãos e superfícies.",                          9.9),
    ],
  },

  // ─── 23. FERRAMENTAS ───────────────────────────────────────────────────────
  {
    slug: "ferramentas",
    stores: [
      s("Ferramentas BrasUX",    "ferramentas-brasux",    "ferramentas", "Ferramentas profissionais para reformas e manutenção. Durabilidade garantida.", 6.9, 25, 55, "Lapa", true, 1.0),
      s("Obra & Cia",            "obra-e-cia",            "ferramentas", "Ferramentas manuais e elétricas, marcas líderes de mercado com entrega rápida.", 5.9, 20, 50, "Santo André", false, 0.9),
      s("Mestre Obras",          "mestre-obras",          "ferramentas", "Profissional ou amador, temos as ferramentas certas para o seu projeto.",        5.9, 25, 55, "Guarulhos", false, 0.93),
    ],
    products: [
      p("Furadeira de Impacto 550W",       "Furadeira com mandril de 3/8\", 2 velocidades, bivolt.",                  179.9, "Bosch", 159.9),
      p("Kit Chaves Combinadas — 8 peças", "Conjunto de chaves combinadas aço cromo-vanádio 8 a 17mm.",               79.9, "Tramontina"),
      p("Martelo Cabo Borracha — 20mm",    "Martelo de pena com cabo emborrachado antiderrapante.",                   39.9),
      p("Trena Profissional — 5m",         "Trena com trava automática e lâmina de aço nylon.",                       29.9, "Stanley"),
      p("Alicate Universal — 8 polegadas", "Alicate multifuncional com cabo isolado 1000V.",                          34.9, "Tramontina"),
      p("Nível a Bolha — 60cm",            "Nível de alumínio com 3 ampolas, alta precisão.",                         39.9),
      p("Serra Manual — 24 dentes",        "Serra tico-tico manual, cabo ergonômico, corte suave.",                   29.9),
      p("Fita Isolante Antichama — 10m",   "Fita isolante elétrica preta, resistente a calor até 80°C.",               5.9, "3M"),
      p("Parafusos Surtidos — 200 un",     "Caixa com parafusos sortidos auto-atarrachantes e para madeira.",         24.9),
      p("Chave de Fenda/Philips — Kit",    "Kit com 6 chaves de fenda e philips de tamanhos variados.",              19.9),
    ],
  },

  // ─── 24. CONSTRUÇÃO ────────────────────────────────────────────────────────
  {
    slug: "construcao",
    stores: [
      s("Construção BrasUX",     "construcao-brasux",     "construcao", "Material de construção com entrega em obra. Qualidade de construtora.",          9.9, 60, 120, "São Bernardo", true, 1.0),
      s("Depósito Central",      "deposito-central",      "construcao", "Material para reforma e construção. Entrega de 60kg a 1 tonelada.",              8.9, 45, 90,  "Guarulhos", false, 0.88),
      s("Material Forte",        "material-forte",        "construcao", "Tudo para sua obra do início ao fim. Cimento, tijolos, tinta e muito mais.",     7.9, 50, 100, "Mauá", false, 0.9),
    ],
    products: [
      p("Cimento CP-II 32 — 50kg",         "Cimento Portland composto, ideal para obras em geral.",                    45.9, "Votorantim"),
      p("Tinta Acrílica Branca — 3.6L",    "Tinta látex premium para interiores, cobertura em 2 demãos.",             79.9, "Suvinil"),
      p("Rejunte Cinza — 1kg",             "Argamassa de rejuntamento flexível, resistente a manchas.",                12.9, "Quartzolit"),
      p("Cola para Azulejo — 20kg",        "Argamassa colante AC-II para porcelanato e azulejo.",                     39.9, "Anjo"),
      p("Impermeabilizante — 18L",         "Manta asfáltica líquida para lajes e terraços.",                         149.9, "Vedacit"),
      p("Rolo de Pintura — Kit Completo",  "Kit com rolo de lã, bandeja e extensor para pintura perfeita.",           29.9),
      p("Lixa Para Massa — 220",           "Lixa de papel grão 220 para acabamento fino em massa corrida.",            3.9),
      p("Fita Crepe — 48mm x 50m",        "Fita crepe automotiva de alta qualidade para pintura.",                    8.9, "Scotch"),
      p("Manta Asfáltica — rolo 10m",      "Manta asfáltica aluminizada 4mm para impermeabilização.",                219.9, null, 199.9),
      p("Silicone Neutro — 280ml",         "Selante de silicone neutro transparente para boxes e janelas.",            14.9),
    ],
  },

  // ─── 25. ELETRÔNICOS ───────────────────────────────────────────────────────
  {
    slug: "eletronicos",
    stores: [
      s("Eletrônicos BrasUX",    "eletronicos-brasux",    "eletronicos", "Gadgets, acessórios e eletrônicos premium com garantia e entrega segura.",       6.9, 30, 60, "Paulista", true, 1.0),
      s("TechZone",              "techzone",              "eletronicos", "O melhor da tecnologia com preços competitivos e atendimento especializado.",     5.9, 25, 55, "Pinheiros", false, 0.95),
      s("Gadget Store",          "gadget-store",          "eletronicos", "Gadgets, wearables e acessórios inovadores. Sempre atualizado com as tendências.",7.9, 30, 60, "Vila Olímpia", false, 1.05),
    ],
    products: [
      p("Fone JBL Tune 510BT Bluetooth", "Fone over-ear com até 40h de bateria e Pure Bass.",                       199.9, "JBL", 179.9),
      p("Carregador Turbo 65W GaN",       "Carregador USB-C + USB-A, carregamento por indução GaN.",               99.9),
      p("Cabo USB-C para USB-C — 2m",     "Cabo de carga rápida 100W com nylon trançado.",                         29.9),
      p("Mouse Sem Fio Ergonômico",       "Mouse wireless de alta precisão DPI ajustável, receptor nano USB.",      79.9, "Logitech"),
      p("Hub USB-C — 7 em 1",             "Hub com HDMI 4K, 3x USB-A, USB-C, SD e microSD.",                       99.9, null, 84.9),
      p("Película de Vidro 9H — iPhone", "Película temperada 0.3mm, HD, resistente a arranhões.",                  19.9),
      p("Power Bank 10.000mAh",           "Carregador portátil com entrada USB-C e 2 saídas USB-A.",               89.9),
      p("Suporte Articulado para Monitor","Suporte de mesa articulado para monitores de 17\" a 32\".",             149.9, null, 129.9),
      p("Webcam HD 1080p",               "Webcam com microfone integrado, plug-and-play, ideal para calls.",       129.9),
      p("SSD Externo 500GB Portátil",     "SSD externo ultra compacto, até 540MB/s, USB 3.2.",                     249.9),
    ],
  },

  // ─── 26. PAPELARIA ─────────────────────────────────────────────────────────
  {
    slug: "papelaria",
    stores: [
      s("Papelaria BrasUX",      "papelaria-brasux",      "papelaria", "Material escolar e de escritório premium. Tinta e criatividade entregues.",        3.9, 15, 35, "Bela Vista", true, 1.0),
      s("Escrita & Arte",        "escrita-e-arte",        "papelaria", "Cadernos, canetas e materiais artísticos para quem leva a criação a sério.",       4.9, 20, 40, "Liberdade", false, 1.05),
      s("Material Certo",        "material-certo",        "papelaria", "Kit escolar completo, material de escritório e suprimentos com ótimo preço.",      2.9, 15, 30, "Jabaquara", false, 0.85),
    ],
    products: [
      p("Caderno Universitário 96 fls",   "Caderno espiral capa dura, divisórias coloridas, papel off-white.",         19.9, "Tilibra"),
      p("Caneta BIC 0.7 — Caixa 50 un",  "Canetas esferográficas azuis cristal, escrita suave.",                      29.9, "BIC"),
      p("Lápis Preto HB — 12 un",        "Lápis de grafite HB, caixa com 12 unidades, mina resistente.",               9.9,  "Faber-Castell"),
      p("Marca-texto 4 Cores",            "Kit de marca-texto pastel, cores: amarelo, rosa, azul e verde.",            12.9, "BIC"),
      p("Bloco de Notas A5 — 100 fls",   "Bloco espiral com papel pautado de alta gramatura.",                         9.9),
      p("Tesoura Escolar 17cm",           "Tesoura com lâminas de aço inox e cabo em polipropileno.",                  11.9),
      p("Cola Branca 90g",                "Cola escolar PVA branca de alta aderência.",                                 4.9, "Cascorez"),
      p("Post-It Original — 100 fls",     "Notas auto-adesivas removíveis. Cores variadas.",                          19.9, "3M"),
      p("Grampeador de Mesa",             "Grampeador médio para até 20 folhas, com grampos inclusos.",                 24.9),
      p("Pasta Catálogo A4 — 40 fls",    "Pasta plástica transparente com 40 folhas A4.",                             16.9),
    ],
  },

  // ─── 27. BRINQUEDOS ────────────────────────────────────────────────────────
  {
    slug: "brinquedos",
    stores: [
      s("Brinquedos BrasUX",     "brinquedos-brasux",     "brinquedos", "Brinquedos educativos e lúdicos com design premium. Segurança e diversão.",      5.9, 25, 55, "Higienópolis", true, 1.0),
      s("Toy Box",               "toy-box",               "brinquedos", "A maior variedade de brinquedos para todas as idades. Do bebê ao adolescente.",   4.9, 20, 50, "Santana", false, 0.92),
      s("Mundo Kids",            "mundo-kids",            "brinquedos", "Brinquedos nacionais e importados. Estimulo cognitivo em cada peça.",              5.9, 25, 55, "Tatuapé", false, 1.05),
    ],
    products: [
      p("LEGO Classic — 300 peças",       "Conjunto de blocos coloridos para construção livre. 4+ anos.",             149.9, "LEGO", 129.9),
      p("Boneca Articulada — 30cm",       "Boneca com 10 pontos de articulação, trajes variados incluídos.",           79.9),
      p("Carrinho Die-Cast Colecionável", "Miniatura metálica em escala 1:64, pintura original.",                     14.9, "Hot Wheels"),
      p("Jogo Uno Classic",               "Baralho original com 108 cartas coloridas. 2-10 jogadores.",               29.9, "Mattel"),
      p("Quebra-Cabeça 500 peças",        "Paisagem urbana detalhada, peças encaixadas perfeitas.",                   39.9),
      p("Kit Massinha 6 Potes",           "Massinha atóxica colorida com moldes de animais incluídos.",               29.9, "Play-Doh"),
      p("Bola de Futebol Campo — N5",     "Bola oficial costurada à mão, câmara de borracha premium.",               59.9),
      p("Pelúcia Ursinho Teddy — 30cm",   "Urso de pelúcia ultra-macio, lavável, certificado Inmetro.",               49.9),
      p("Slime Kit Glitter — 3 potes",    "Slime brilhante com glitter, atóxico e reutilizável.",                    24.9),
      p("Dominó Infantil — 28 peças",     "Dominó colorido em madeira com figuras de animais.",                       19.9, null, 16.9),
    ],
  },

  // ─── 28. PRESENTES ─────────────────────────────────────────────────────────
  {
    slug: "presentes",
    stores: [
      s("Presentes BrasUX",      "presentes-brasux",      "presentes", "Presentes únicos com embalagem premium. Entrega com cartão personalizado grátis.", 7.9, 30, 60, "Jardins", true, 1.0),
      s("Gift Shop",             "gift-shop",             "presentes", "Loja de presentes criativos. Do econômico ao luxuoso, tem para todos.",            5.9, 25, 55, "Moema", false, 0.95),
      s("Ideias & Afeto",        "ideias-e-afeto",        "presentes", "Presentes artesanais com significado. Personalizados sob encomenda.",              6.9, 30, 65, "Vila Madalena", false, 1.08),
    ],
    products: [
      p("Cesta Café da Manhã Premium",    "Cesta com café especial, mel, cookies, geleia e mimo.",                   129.9, null, 109.9),
      p("Kit Vinho & Taças",              "Garrafa de vinho premium com 2 taças de cristal em caixa presenteável.", 149.9),
      p("Caneca Personalizada 350ml",     "Caneca de porcelana com impressão de foto ou mensagem.",                   39.9),
      p("Quadro Decorativo 30x40cm",      "Impressão em moldura de madeira, framboesa ou branca. Arte exclusiva.",   79.9),
      p("Kit Skincare Presente",          "Set de hidratante, tônico e sérum em necessaire elegante.",               159.9, null, 139.9),
      p("Vela Aromática Presente",        "Vela de soja premium em pote de vidro com fita e cartão.",                59.9),
      p("Agenda Moleskine 2026",          "Agenda diária em capa de couro sintético, papel de alta gramatura.",       89.9),
      p("Kit Chá & Relax",                "Caixa com 6 tipos de chá, mel orgânico e xícara de porcelana.",           69.9),
      p("Porta-Retrato Madeira — 3 em 1","Porta-retratos em moldura de madeira rústica para 3 fotos.",               49.9),
      p("Almofada Personalizada — 40x40","Almofada com impressão de foto ou frase. Enchimento incluso.",             54.9),
    ],
  },

  // ─── 29. AUTOMOTIVO ────────────────────────────────────────────────────────
  {
    slug: "automotivo",
    stores: [
      s("Auto BrasUX",           "auto-brasux",           "automotivo", "Peças, acessórios e cuidados premium para o seu veículo. Entrega na garagem.",   6.9, 25, 55, "Osasco", true, 1.0),
      s("Peças & Car",           "pecas-e-car",           "automotivo", "Maior variedade de peças e acessórios automotivos da região.",                   5.9, 20, 50, "Santo André", false, 0.9),
      s("Loja do Carro",         "loja-do-carro",         "automotivo", "Do óleo à acessório: tudo para manter seu carro em perfeita forma.",             4.9, 25, 55, "Guarulhos", false, 0.87),
    ],
    products: [
      p("Óleo Motor 5W30 Sintético — 1L", "Óleo sintético de alta performance para motores modernos.",               49.9, "Mobil"),
      p("Filtro de Óleo Universal",        "Filtro de óleo de alta capacidade, encaixe padrão.",                      24.9, "Tecfil"),
      p("Palheta Limpador Para-brisa",    "Par de palhetas de borracha natural, encaixe universal.",                  39.9, "Bosch"),
      p("Lâmpada H7 Super White — Par",   "Par de lâmpadas halógenas de alta luminosidade 4200K.",                   29.9, "Osram"),
      p("Cera Líquida Premium — 500ml",   "Cera líquida de carnaúba para brilho espelhado.",                         29.9, "Wurth"),
      p("Suporte Veicular para Celular",  "Suporte de ventosa com articulação 360° para dashboard.",                  29.9),
      p("Aspirador Veicular 12V",         "Aspirador portátil para carro, 120W, sucção potente.",                    79.9, null, 64.9),
      p("Câmara de Borracha Aro 14",      "Câmara reforçada para pneus aro 14, válvula TR4.",                        24.9),
      p("Perfume Automotivo — Novo Carro","Fragrância de carro novo com difusor de ventilação.",                     14.9),
      p("Extintor Veicular 1kg ABC",      "Extintor de pó ABC recarregável, obrigatório por lei.",                   79.9, null, 69.9),
    ],
  },

  // ─── 30. SERVIÇOS ──────────────────────────────────────────────────────────
  {
    slug: "servicos",
    stores: [
      s("Serviços BrasUX",       "servicos-brasux",       "servicos", "Profissionais verificados para toda necessidade do seu lar ou empresa.",            0, 30, 90, "Centro", true, 1.0),
      s("Hub de Serviços",       "hub-de-servicos",       "servicos", "A plataforma de serviços com avaliação e garantia. Qualidade assegurada.",         0, 30, 120, "Paulista", false, 0.9),
      s("Resolve Fácil",         "resolve-facil",         "servicos", "Serviços expressos para pequenos reparos e manutenção doméstica.",                 0, 20, 60, "Pinheiros", false, 0.85),
    ],
    products: [
      p("Serviço de Encanamento — 1h",    "Encanador especializado para reparos de vazamentos e instalações.",       150.0),
      p("Serviço Elétrico — 1h",          "Eletricista certificado NR10 para instalações e manutenções.",            180.0),
      p("Pintura de Parede — m²",         "Pintura com rolo, tinta inclusa, até 2 demãos. Acabamento premium.",      35.0),
      p("Faxina Completa — até 80m²",     "Limpeza completa do imóvel com produtos profissionais.",                   250.0, null, 220.0),
      p("Montagem de Móveis",             "Montagem de armário, cama, mesa ou rack. Por peça.",                      120.0),
      p("Instalação de Suporte de TV",    "Instalação de suporte articulado em parede de drywall ou concreto.",       80.0),
      p("Jardinagem — 1h",                "Poda, plantio e manutenção de jardim. Ferramentas incluídas.",             90.0),
      p("Limpeza de Ar-condicionado",     "Higienização e limpeza completa de split até 12.000 BTUs.",              180.0, null, 149.0),
      p("Motoboy Express — por corrida",  "Entrega ou coleta de documentos e itens leves na cidade.",                20.0),
      p("Consultoria em TI — 1h",         "Suporte e consultoria em tecnologia da informação para empresas.",        200.0),
    ],
  },

  // ─── 31. CURSOS ON-LINE ────────────────────────────────────────────────────
  {
    slug: "cursos-online",
    stores: [
      s("Cursos BrasUX",         "cursos-brasux",         "cursos-online", "Educação de ponta com certificado. Aprenda com os melhores profissionais.", 0, 5, 15, "Digital", true, 1.0),
      s("EduTech Platform",      "edutech-platform",      "cursos-online", "Plataforma EAD completa. Trilhas de aprendizado personalizadas por IA.",   0, 5, 15, "Digital", false, 0.92),
      s("Aprenda Já",            "aprenda-ja",            "cursos-online", "Cursos práticos e diretos ao ponto. Sem enrolação, aprenda de verdade.",   0, 5, 15, "Digital", false, 0.85),
    ],
    products: [
      p("Programação Python do Zero",     "Do básico ao avançado: variáveis, funções, POO e projetos reais.",        199.9, null, 149.9),
      p("UX Design Completo",             "Design de interfaces com Figma, pesquisa com usuário e prototipação.",    249.9, null, 199.9),
      p("Inglês Conversação — 12 aulas",  "Conversação com nativos, 12 aulas ao vivo + gravações.",                  299.9),
      p("Excel Avançado & Power BI",      "Fórmulas avançadas, tabelas dinâmicas e visualização de dados.",          149.9, null, 119.9),
      p("Marketing Digital Completo",     "SEO, tráfego pago, redes sociais e e-mail marketing. Certificado.",       199.9),
      p("Programação Web Full-Stack",     "HTML, CSS, JavaScript, React e Node.js. Projeto completo incluído.",      399.9, null, 329.9),
      p("Gestão de Projetos — PMI",       "Fundamentos do PMBOK. Preparatório para certificação PMP.",               299.9),
      p("Curso de Violão do Zero",        "Da afinação ao repertório. Videoaulas HD + partituras digitais.",         129.9),
      p("Copywriting para Vendas",        "Técnicas de escrita persuasiva para landing pages e redes sociais.",      179.9, null, 149.9),
      p("Design Gráfico com Photoshop",   "Ferramentas, composição e retoque profissional. Projetos práticos.",      179.9),
    ],
  },

  // ─── 32. ASSISTÊNCIA TÉCNICA ───────────────────────────────────────────────
  {
    slug: "assistencia-tecnica",
    stores: [
      s("TechRepair BrasUX",     "techrepair-brasux",     "assistencia-tecnica", "Assistência técnica certificada para todos os dispositivos. Garantia de 90 dias.", 0, 60, 180, "Paulista", true, 1.0),
      s("Concerta Tudo",         "concerta-tudo",         "assistencia-tecnica", "Reparos rápidos de celulares, notebooks e tablets. Coleta e entrega inclusa.",   0, 60, 240, "Lapa", false, 0.88),
      s("Fix & Go",              "fix-and-go",            "assistencia-tecnica", "Assistência em domicílio. Nosso técnico vai até você para reparos urgentes.",    0, 30, 120, "Moema", false, 1.05),
    ],
    products: [
      p("Troca de Tela iPhone 13/14",     "Substituição de display OLED original com cola. Garantia 90 dias.",       499.9, null, 449.9),
      p("Troca de Bateria Samsung",       "Bateria original Samsung. Testes completos de ciclo pós-instalação.",     199.9),
      p("Formatação Notebook",            "Formatação completa com reinstalação de Windows e drivers.",               150.0),
      p("Manutenção Preventiva PC",       "Limpeza interna, troca de pasta térmica, atualização de drivers.",        120.0),
      p("Troca de Tela Notebook",         "Substituição de display para notebooks 14\" e 15.6\".",                   349.9),
      p("Reparo de Conector de Carga",    "Troca do conector USB-C ou Lightning com solda SMD.",                     149.9),
      p("Desbloqueio de Celular",         "Desbloqueio por IMEI oficial de todas as operadoras.",                    79.9),
      p("Remoção de Vírus e Malware",     "Varredura completa, remoção de ameaças e proteção instalada.",            89.9),
      p("Instalação de SSD em Notebook",  "Substituição do HD por SSD, 3x mais rápido. Migração de dados.",         199.9, null, 179.9),
      p("Suporte Remoto — 1h",            "Assistência técnica via acesso remoto. Resolução imediata.",               80.0),
    ],
  },

  // ─── 33. OUTROS ────────────────────────────────────────────────────────────
  {
    slug: "outros",
    stores: [
      s("Mix BrasUX",            "mix-brasux",            "outros", "O store de tudo. Produtos únicos, edição limitada e itens que você não acha em lugar.",  4.9, 20, 50, "Centro", true, 1.0),
      s("Multiprodutos",         "multiprodutos",         "outros", "Grande variedade de produtos em categorias distintas. Sempre algo novo.",                3.9, 15, 40, "Brás", false, 0.88),
      s("Loja Surpresa",         "loja-surpresa",         "outros", "Itens selecionados, promoções relâmpago e caixas misteriosas incríveis.",                4.9, 20, 45, "Liberdade", false, 0.92),
    ],
    products: [
      p("Caixa Surpresa Premium",         "Itens selecionados com curadoria. Você nunca sabe o que vai chegar!",    69.9, null, 59.9),
      p("Kit Eco Sustentável",            "Canudo de inox, sacola reutilizável e copo dobrável de silicone.",        39.9),
      p("Mini-kit de Viagem",             "Necessaire com 8 itens essenciais em embalagem de viagem.",              49.9),
      p("Pack Bem-Estar",                 "Vela aromática, cristal de shungita, incenso e diário de gratidão.",     79.9),
      p("Cesta Econômica Surtida",        "Variedade de produtos essenciais em oferta especial.",                   89.9, null, 74.9),
      p("Kit Office em Casa",             "Mouse pad, caneta premium, bloco e organizador de mesa.",               59.9),
      p("Voucher Presente — R$ 50",       "Crédito de R$ 50 para gastar em qualquer loja do GizApp.",              50.0),
      p("Voucher Presente — R$ 100",      "Crédito de R$ 100 para gastar em qualquer loja do GizApp.",            100.0),
      p("Kit Fika & Relaxa",              "Cobertor macio, caneca, chá e popcorn para uma noite perfeita.",         59.9),
      p("Produto Especial Edição Limitada","Item único de edição limitada. Disponível enquanto durar o estoque.",   99.9, null, 79.9),
    ],
  },
];

// ─── Main ────────────────────────────────────────────────────────────────────

const stats = { stores: 0, storesFailed: 0, products: 0, links: 0, patches: 0 };

async function main() {
  console.log("🚀 GizApp Seed — iniciando\n");
  const token = await getAdminToken();

  for (const cat of CATEGORIES) {
    console.log(`\n📁 ${cat.slug.toUpperCase()} (${cat.products.length} produtos, ${cat.stores.length} lojas)`);

    // 1. Create base products in global catalog
    const createdProducts = [];
    for (const prod of cat.products) {
      const r = await createProduct(prod, cat.slug, token);
      if (r) {
        createdProducts.push({ ...prod, id: r.id });
        stats.products++;
        process.stdout.write(".");
      }
    }
    console.log(` ${createdProducts.length} produtos criados`);

    // 2. Create stores + link products
    for (const storeSeed of cat.stores) {
      const store = await createStore(storeSeed, token);
      if (!store) { stats.storesFailed++; continue; }
      stats.stores++;
      console.log(`  🏪 ${store.name} (${store.id.slice(0, 8)}...)`);

      // product → storeProductId map built after linking
      const productMap = {}; // productId → { price, promotionalPrice }
      for (const prod of createdProducts) {
        await linkProduct(store.id, prod.id, token);
        stats.links++;
        productMap[prod.id] = { price: prod.price, promotionalPrice: prod.promotionalPrice };
      }

      // Patch all store products: set stock + store-specific price
      await patchStoreProducts(store.id, productMap, storeSeed.priceMultiplier, token);
      stats.patches += createdProducts.length;
    }
  }

  console.log("\n\n✅ SEED CONCLUÍDO");
  console.log(`   Lojas criadas:    ${stats.stores}`);
  console.log(`   Lojas com erro:   ${stats.storesFailed}`);
  console.log(`   Produtos criados: ${stats.products}`);
  console.log(`   Links produto↔loja: ${stats.links}`);
  console.log(`   Patches de preço/estoque: ${stats.patches}`);
}

main().catch((err) => { console.error("\n💥 ERRO FATAL:", err); process.exit(1); });
