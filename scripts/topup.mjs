#!/usr/bin/env node
// topup.mjs — adiciona 10 produtos extras por categoria (chegando a 20 por loja)
// Usage: node scripts/topup.mjs

const API = process.env.API_URL || "http://localhost:5003";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "seed-admin@gizapp.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@seed2026!";

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

const get   = (path, token)        => req("GET",   path, null, token);
const post  = (path, body, token)  => req("POST",  path, body, token);
const patch = (path, body, token)  => req("PATCH", path, body, token);

const p = (name, desc, price, brand = null, promotionalPrice = null) =>
  ({ name, description: desc, price, brand, promotionalPrice });

async function getToken() {
  const r = await post("/api/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (r.ok) return r.data.token;
  throw new Error("Login falhou: " + JSON.stringify(r.data));
}

// ─── 10 produtos extras por categoria ────────────────────────────────────────

const EXTRA = {
  "restaurantes": [
    p("Risoto de Camarão",              "Risoto cremoso com camarões ao alho, vinho branco e parmesão.",           58.9),
    p("Moqueca Baiana de Peixe",        "Peixe branco no leite de coco, azeite de dendê e coentro fresco.",       65.9),
    p("Frango à Passarinho — 6 un",     "Pedaços de frango fritos crocantes, temperados com alho e limão.",        39.9),
    p("Sopa Creme de Abóbora",          "Creme de abóbora japonesa com gengibre e nata. Reconfortante.",           28.9),
    p("Escondidinho de Carne Seca",     "Purê de macaxeira com carne seca desfiada e queijo coalho gratinado.",    48.9, null, 42.9),
    p("Tapioca Recheada — 2 un",        "Tapioca com queijo coalho, frango desfiado ou banana com mel.",           22.9),
    p("Wrap Integral Frango Grelhado",  "Wrap de farinha integral, frango grelhado, rúcula e cream cheese.",       29.9),
    p("Tiramisu Caseiro",               "Sobremesa italiana com mascarpone, café e biscoito champagne.",            24.9),
    p("Bruschetta Italiana — 4 un",     "Pão rústico tostado, tomate, manjericão e fio de azeite extravirgem.",   18.9),
    p("Ceviche de Salmão",              "Salmão marinado em limão, cebola roxa, coentro e pimenta biquinho.",     52.9),
  ],

  "mercearia": [
    p("Biscoito Maizena — 400g",        "Biscoito de amido de milho clássico, levinho e crocante.",                 5.9, "Vitarella"),
    p("Achocolatado em Pó — 400g",      "Achocolatado para misturar ao leite. Vitaminas e cacau.",                 11.9, "Nescau"),
    p("Extrato de Tomate — 340g",       "Extrato concentrado de tomates maduros, sem conservantes.",                4.2, "Elefante"),
    p("Creme de Leite — 200g",          "Creme de leite UHT, 20% de gordura, para receitas e sobremesas.",         4.5, "Nestlé"),
    p("Azeite Extravirgem — 500ml",     "Azeite de primeira extração a frio, acidez máx 0.5%.",                   29.9, "Galo"),
    p("Milho Verde em Lata — 200g",     "Milho verde cozido, macio e adocicado. Pronto para usar.",                 4.9, "Bonduelle"),
    p("Ervilha em Lata — 200g",         "Ervilha extra fina em conserva, sem sal adicionado.",                      4.9, "Bonduelle"),
    p("Vinagre de Maçã — 750ml",        "Vinagre de maçã orgânico com a mãe, não filtrado.",                       9.9),
    p("Maionese — 500g",                "Maionese cremosa original, sem conservantes artificiais.",                  8.9, "Hellmann's"),
    p("Proteína de Soja Texturizada — 500g","PTS granulada, fonte de proteína vegetal. Sem glúten.",               9.9),
  ],

  "cervejas": [
    p("Budweiser — 600ml",              "A cerveja do rei do esporte. Lager americana refrescante.",                10.5, "Budweiser"),
    p("Bohemia Puro Malte — 600ml",     "Premium Lager com 100% malte, sabor encorpado e equilibrado.",            11.9, "Bohemia"),
    p("Colorado Appia — 600ml",         "Cerveja nacional com mel de abelha e cana-de-açúcar. Única.",             17.9, "Colorado"),
    p("Eisenbahn Dunkel — 355ml",       "Cerveja escura de estilo alemão, notas de caramelo e chocolate.",         12.9, "Eisenbahn"),
    p("Devassa Tropical — 600ml",       "Lager refrescante com toque tropical. Sabor do Brasil.",                   8.9, "Devassa"),
    p("Six Pack Heineken Lata — 350ml", "Pack com 6 latas de Heineken geladas. Para o churrasco perfeito.",        45.9, "Heineken", 39.9),
    p("Heineken Zero Álcool — 330ml",   "Mesma Heineken, zero álcool. Sabor original sem abrir mão do estilo.",    9.9, "Heineken"),
    p("Session IPA Artesanal — 473ml",  "IPA de baixo teor alcoólico, amargor lúpulado e aroma floral.",          16.9),
    p("Pilsen Artesanal — 600ml",       "Pilsen nacional encorpada, produção local em pequenos lotes.",            15.9),
    p("Baden Baden Cristal — 600ml",    "Lager premium cristalina com malte de cevada selecionado.",               13.9, "Baden Baden"),
  ],

  "destilados-e-vinhos": [
    p("Whisky Johnnie Walker Red — 750ml","Blend escocês suave com notas de mel, baunilha e especiarias.",        129.9, "Johnnie Walker"),
    p("Licor Baileys Original — 750ml",  "Creme de uísque irlandês com cacau e chocolate. Irresistível.",         109.9, "Baileys"),
    p("Prosecco Italiano — 750ml",       "Espumante DOC do Vêneto, borbulhas finas e frescor frutal.",             89.9, "La Marca"),
    p("Vinho Rosé Seco — 750ml",         "Rosé provençal com notas de morango, framboesa e floral.",               69.9),
    p("Gin Tanqueray London Dry — 750ml","Gin icônico com zimbro e 4 botânicos naturais. Clássico.",             119.9, "Tanqueray"),
    p("Aperol — 1L",                     "Licor italiano de laranja amarga. Base do Aperol Spritz.",               89.9, "Aperol"),
    p("Conhaque Hennessy VS — 700ml",    "Cognac francês jovem, notas de fruta madura e carvalho.",              279.9, "Hennessy"),
    p("Licor Amarula — 750ml",           "Licor cremoso sul-africano de fruta marula. Exótico e irresistível.",    89.9, "Amarula"),
    p("Vinho do Porto Tawny — 750ml",    "Vinho licoroso envelhecido, notas de caramelo, ameixa seca e noz.",     79.9, "Sandeman"),
    p("Espumante Rosé Nacional — 750ml", "Espumante rosé método Charmat, frutas vermelhas e elegância.",          89.9, null, 79.9),
  ],

  "nao-alcoolicos": [
    p("Coca-Cola Zero — 2L",             "O sabor de sempre, sem açúcar. Zero calorias.",                          12.9, "Coca-Cola"),
    p("Suco Maguary Maracujá — 1L",      "Concentrado de maracujá 100% natural, produz até 4L.",                   9.9, "Maguary"),
    p("Achocolatado Italac — 700ml",     "Bebida láctea achocolatada pronta para beber, caixinha.",                 7.9, "Italac"),
    p("Schweppes Tônica — 350ml",        "Água tônica premium com quinino natural. Ideal para gin tônica.",          6.9, "Schweppes"),
    p("Pepsi Cola — 2L",                 "Refrigerante de cola adocicado com sabor característico.",               10.9, "Pepsi"),
    p("Suco de Uva Integral — 1L",       "Uva bordo 100% natural, sem adição de água ou açúcar.",                 14.9, "Aurora"),
    p("Fanta Laranja — 2L",              "Refrigerante sabor laranja, gelado e refrescante.",                       9.9, "Fanta"),
    p("Água de Coco — 1L",               "Água de coco natural em caixa, sem adição de açúcar.",                  12.9, "Kero Coco"),
    p("Leite de Coco — 200ml",           "Leite de coco cremoso para receitas doces e salgadas.",                   5.9, "Sococo"),
    p("Chá Verde Gelado — 350ml",        "Chá verde sem açúcar, antioxidantes naturais e sabor suave.",             7.9, "Lipton"),
  ],

  "farmacia": [
    p("Paracetamol 750mg — 20 cp",       "Analgésico e antitérmico de ação rápida, sem cafeína.",                   8.9, "Genérico"),
    p("Cetoconazol Shampoo — 200ml",     "Shampoo anticaspa antifúngico, uso semanal.",                            22.9, "Nizoral"),
    p("Buscopan Composto — 20 cp",       "Alívio de cólicas intestinais e dores abdominais.",                      22.9, "Buscopan"),
    p("Melatonina 5mg — 60 cápsulas",    "Suplemento natural para regular o sono. Sem dependência.",               29.9),
    p("Vitamina E 400UI — 45 cápsulas",  "Antioxidante natural, protege células do envelhecimento.",               19.9),
    p("Repelente Corporal — 133ml",      "Repelente de mosquitos e insetos, proteção 6h.",                         19.9, "Exposis"),
    p("Colírio Alívio Visual — 15ml",    "Colírio lubrificante para olhos secos e irritados.",                     18.9, "Visine"),
    p("Esparadrapo — 10mx2.5cm",         "Esparadrapo de tecido impermeável, hipoalergênico.",                      8.9),
    p("Soro Fisiológico 0.9% — 250ml",  "Solução isotônica para limpeza nasal e feridas.",                         4.9),
    p("Curativos Sortidos — 30 un",      "Curativos adesivos de diferentes tamanhos para uso diário.",               9.9, "Nexcare"),
  ],

  "lanches": [
    p("Wrap de Atum com Cream Cheese",   "Wrap crocante de atum, cream cheese, rúcula e tomate.",                  26.9),
    p("Sanduíche Natural Integral",      "Pão integral, peito de peru, ricota, alface e tomate fresco.",           22.9),
    p("Hot Dog Americano",               "Salsicha jumbo, mostarda amarela, ketchup e relish de pepino.",          19.9),
    p("X-Frango Crispy",                 "Frango empanado crocante, queijo cheddar, alface e mayo.",               29.9, null, 26.9),
    p("Batata Rústica Temperada — P",    "Batata em gomos com tempero especial da casa, assada no forno.",         16.9),
    p("Porção de Asas de Frango — 8 un","Asas grelhadas e temperadas com molho barbecue defumado.",               38.9),
    p("Palito de Queijo — 10 un",        "Palitos de queijo mussarela empanados no panko, com molho marinara.",    22.9),
    p("Crepioca Recheada",               "Crepe de tapioca recheada com frango, queijo ou banana.",                19.9),
    p("Milho na Manteiga — Caneco",      "Milho verde cozido com manteiga e sal. Clássico reconfortante.",         12.9),
    p("Nachos com Guacamole",            "Tortilhas crocantes com guacamole fresco e pico de gallo.",              24.9),
  ],

  "pizzarias": [
    p("Pizza Atum — Grande",             "Atum, cebola, azeitona, mussarela e orégano.",                           60.9),
    p("Pizza Frango com Bacon — Grande", "Frango desfiado, bacon crocante, mussarela e catupiry.",                 65.9, null, 59.9),
    p("Pizza Branca com Rúcula — Grande","Mussarela, rúcula fresca, parmesão e tomate seco.",                     62.9),
    p("Pizza Palmito Gratinado — Grande","Palmito pupunha, mussarela e molho branco artesanal.",                   60.9),
    p("Calzone de Presunto e Queijo",    "Calzone recheado com presunto cozido, mussarela e molho de tomate.",     48.9),
    p("Pizza Napolitana — Grande",       "Molho San Marzano, mussarela búfala, anchova e alcaparra.",              67.9),
    p("Pizza Salmão Cremosa — Grande",   "Salmão defumado, cream cheese, alcaparras e cebola roxa.",              78.9),
    p("Pizza Brigadeiro Gourmet — Média","Pizza doce com brigadeiro de colher, granulado e coco.",                 48.9),
    p("Combo Pizza + Refrigerante",      "Pizza de sua escolha (G) + Coca-Cola 2L. Pede junto e economiza.",       74.9, null, 65.9),
    p("Tábua de Frios Italiana",         "Antepasto com salame, presunto cru, azeitonas e queijos. 200g.",         44.9),
  ],

  "acai-sorvetes": [
    p("Açaí na Tigela — 400ml",          "Açaí com granola artesanal, leite em pó e mel de abelha.",              32.9),
    p("Sorvete de Pistache — 2 Bolas",   "Sorvete artesanal de pistache com lascas de pistache crocante.",        22.9),
    p("Tapioca com Açaí",                "Tapioca crocante com açaí puro, banana e leite condensado.",            19.9),
    p("Milkshake Baunilha",              "Shake cremoso de sorvete de baunilha com leite integral.",              21.9),
    p("Sundae Oreo",                     "Sorvete de baunilha com calda de chocolate e biscoito Oreo triturado.",  18.9),
    p("Gelato Limão Siciliano — 2 Bolas","Gelato refrescante de limão siciliano, azedinho e cremoso.",             19.9),
    p("Picolé de Coco Cremoso — 2 un",  "Picolé artesanal de coco queimado, cremoso por dentro.",                 14.9),
    p("Açaí Fit sem Adicionais — 400ml","Açaí puro sem calda nem complemento. Saudável e natural.",              24.9),
    p("Bowl Tropical com Granola",       "Açaí com manga, abacaxi, granola tostada e mel de abelha.",             36.9),
    p("Açaí Creme — 1L",                 "Pote de 1 litro de açaí cremoso para levar e compartilhar.",            59.9, null, 52.9),
  ],

  "cafeterias": [
    p("Americano Grande — 300ml",        "Espresso diluído em água quente, encorpado e equilibrado.",              10.9),
    p("Cold Brew — 300ml",               "Café coado lento a frio por 12h. Suave, concentrado e gelado.",         16.9),
    p("Flat White",                      "Duplo espresso com leite microvaporizado sedoso. Cremoso.",              14.9),
    p("Matcha Latte — 300ml",            "Chá matcha premium com leite vaporizado. Verde e revigorante.",          18.9),
    p("Torrada com Requeijão — 2 fatias","Fatias de pão artesanal tostado com requeijão cremoso.",                10.9),
    p("Pão de Queijo Gigante — 100g",    "Pão de queijo mineiro assado na hora, sequinho e crocante.",             8.9),
    p("Muffin Blueberry",               "Muffin americano com blueberries frescas e cobertura streusel.",         11.9),
    p("Brownie Vegano",                  "Brownie sem ovos e sem leite, massa de cacau puro com nozes.",           13.9),
    p("Quiche Lorraine — Fatia",         "Torta salgada com creme, bacon e queijo gruyère.",                      19.9),
    p("Vitamina de Frutas — 400ml",      "Banana, morango, mamão e granola batidos com leite. Nutritivo.",        16.9),
  ],

  "padaria": [
    p("Pão de Queijo Mineiro — 6 un",    "Pão de queijo tradicional de Minas, cremoso e quentinho.",              14.9),
    p("Pão de Batata Recheado",          "Pão de batata macio recheado com presunto e queijo.",                   11.9),
    p("Mini Pão de Mel com Chocolate",   "Pão de mel artesanal coberto com chocolate ao leite.",                   6.9),
    p("Torta de Frango — Fatia",         "Torta assada de frango desfiado com catupiry e milho.",                 12.9),
    p("Empada de Palmito — 4 un",        "Empadas assadas recheadas com palmito pupunha e molho bechamel.",       18.9),
    p("Pão Italiano Rústico — 400g",     "Pão de fermentação natural, casca espessa e miolo aerado.",             14.9),
    p("Bolo de Fubá com Coco — Fatia",   "Bolo caipira com fubá e coco ralado, úmido e aromático.",               7.9),
    p("Fatia de Cuca de Frutas",         "Cuca alemã com recheio de frutas da estação e farofa crocante.",        10.9),
    p("Pão de Queijo Recheado — 2 un",  "Pão de queijo com recheio de requeijão ou goiabada.",                  12.9),
    p("Brioche Amanteigado",             "Pão brioche francês com manteiga extra, macio e dourado.",              13.9),
  ],

  "doces": [
    p("Bolo de Red Velvet — Fatia",      "Bolo vermelho aveludado com cobertura de cream cheese.",                 21.9),
    p("Cheesecake New York — Fatia",     "Cheesecake cremoso com base de biscoito e calda de frutas vermelhas.",  24.9),
    p("Caixa Bombons Sortidos — 200g",   "Bombons sortidos de chocolate ao leite, branco e meio amargo.",         39.9),
    p("Cocada Crocante Premium",         "Cocada artesanal com coco queimado e leite condensado. Crocante.",      16.9),
    p("Pudim de Leite Condensado",       "Pudim clássico cremoso com calda de caramelo.",                         19.9),
    p("Torta de Chocolate Belga",        "Torta com ganache de chocolate 72%, base de brownie e pralinê.",        48.9),
    p("Beijinho de Coco Gourmet — 6 un","Beijinho de colher com coco jamaicano e calda de leite condensado.",    28.9),
    p("Doce de Leite Artesanal — 350g", "Doce de leite de panela em textura firme, sem conservantes.",           22.9),
    p("Sorvete Frito Japonês",           "Sorvete de baunilha empanado e frito na hora. Quente por fora.",       26.9),
    p("Palha Italiana — 6 un",           "Doce de chocolate meio amargo com biscoito maisena e achocolatado.",    24.9, null, 21.9),
  ],

  "conveniencia": [
    p("Amendoim Salgado — 150g",         "Amendoim torrado e salgado. Crocante e nutritivo.",                      5.9),
    p("Chips de Batata Ondulada — 100g", "Batata chips ondulada, crocante e temperada.",                           6.9, "Ruffles"),
    p("Chocolate ao Leite — 80g",        "Tabletede chocolate ao leite clássico.",                                  5.9, "Lacta"),
    p("Isqueiro Descartável",            "Isqueiro de bolso à gás, chama ajustável.",                              3.9),
    p("Adaptador de Tomada 3x1",         "Adaptador para tomada padrão ABNT 2P+T, 10A.",                          12.9),
    p("Lenços de Papel — 50 un",         "Lenços faciais de folha dupla, suaves e resistentes.",                    4.9, "Kleenex"),
    p("Absorvente com Abas — 8 un",      "Absorvente noturno com abas e superfície suave.",                        7.9, "Always"),
    p("Creme para Mãos — 60g",           "Hidratante para mãos e cutículas, absorção rápida.",                     8.9, "Neutrogena"),
    p("Pastilhas para Hálito — 2 un",    "Pastilhas de menta refrescantes para hálito fresco.",                    3.9, "Tic Tac"),
    p("Caneta Esferográfica Azul",       "Caneta de escrita suave, tinta de qualidade.",                            2.9, "BIC"),
  ],

  "hortifruti": [
    p("Uva Itália — 500g",               "Uva verde sem semente, doce e crocante, selecionada.",                  15.9),
    p("Manga Tommy — kg",                "Manga grande e polpuda, sabor tropical intenso.",                        10.9),
    p("Beterraba — kg",                  "Beterraba firme e intensa em cor. Rica em antioxidantes.",               6.9),
    p("Brócolis — maço",                 "Brócolis fresco e firme, florets compactos, rico em vitaminas.",          6.9),
    p("Pepino Japonês — un",             "Pepino fino e crocante, baixa acidez e sem sementes.",                    3.9),
    p("Ervilha Torta — 200g",            "Ervilha torta fresca, crocante e adocicada. Ideal para wok.",            9.9),
    p("Coentro — maço",                  "Maço de coentro fresco, aroma intenso para temperos.",                    2.9),
    p("Kit Legumes para Sopa",           "Mix de cenoura, abobrinha, chuchu e batata. Pronto para cozinhar.",      19.9),
    p("Abóbora Cabotiá — kg",            "Abóbora japonesa cremosa, ideal para sopas e purês.",                     6.9),
    p("Cebola Roxa — kg",                "Cebola roxa média, sabor suave e levemente adocicado.",                   7.9),
  ],

  "carnes": [
    p("Coxa e Sobrecoxa de Frango — kg","Peça inteira com osso, ideal para assar ou grelhar.",                    19.9),
    p("Peito de Frango Filé — kg",       "Filé de peito sem pele e sem osso, magro e versátil.",                  24.9),
    p("Paleta Suína — kg",               "Paleta com osso, macia e suculenta, ideal para cozidos.",               28.9),
    p("Cupim Bovino — kg",               "Corte nobre cheio de sabor, ideal para churrasqueira.",                  48.9),
    p("Carne Seca Desfiada — 200g",      "Carne seca de qualidade, dessalgada e desfiada. Pronta para uso.",       29.9),
    p("Lombo Suíno — kg",                "Lombo inteiro de porco, macio e de sabor suave.",                        32.9),
    p("Medalhão de Filé Mignon — 200g", "Medalhão premium de 200g, macio e suculento.",                           34.9),
    p("Frango Caipira Inteiro — kg",     "Frango criado solto, sabor mais pronunciado e carne firme.",             22.9),
    p("Steak Angus — 300g",              "Steak 300g de novilho angus, perfeito para grelha.",                     49.9, null, 44.9),
    p("Coração de Frango — 500g",        "Corações de frango fresco, ideal para espetinho e churrasco.",           14.9),
  ],

  "petshop": [
    p("Ração Hill's Cão Adulto — 2kg",  "Ração premium ciências com nutrição balanceada.",                        89.9, "Hill's"),
    p("Petisco Dental Stick — 7 un",    "Palitos mastigáveis que ajudam na higiene dental do cão.",               19.9, "Pedigree"),
    p("Tapete Higiênico — 30 un",       "Tapetes absorventes com camada antiderrapante. 60x60cm.",                39.9),
    p("Transportadora Pet Soft — M",    "Bolsa de transporte soft em tecido. Leve e confortável.",                99.9, null, 84.9),
    p("Bebedouro Automático para Gato", "Fonte de água circulante com filtro de carvão ativo.",                   89.9),
    p("Spray Antipulgas Ambiente — 300ml","Spray para ambiente contra pulgas e carrapatos.",                      24.9),
    p("Escova de Borracha para Pet",    "Escova de massagem que remove pelos soltos com facilidade.",              19.9),
    p("Roupinha para Cão Porte P",      "Roupa de malha confortável para cão de pequeno porte.",                  29.9),
    p("Arranhador para Gato — Torre",   "Torre de sisal com plataformas para descanso e afiação das unhas.",      69.9),
    p("Sachê Whiskas Mix — 6 un",       "Sachês variados de atum, carne e frango para gatos adultos.",            24.9, "Whiskas"),
  ],

  "beleza": [
    p("Sérum Vitamina C — 30ml",         "Vitamina C 15% para iluminação e uniformização do tom de pele.",         69.9, "Dermage"),
    p("Base Líquida FPS 35 — 30ml",      "Base de longa duração, cobertura média, 30 tons.",                      79.9, "Maybelline"),
    p("Removedor Bifásico — 200ml",      "Remove maquiagem à prova d'água com delicadeza.",                       34.9, "Simple"),
    p("Primer Facial Matte",             "Primer que controla a oleosidade e prolonga a maquiagem.",               44.9, "Urban Decay"),
    p("Paleta de Sombras — 12 Cores",    "Paleta versátil com cores nude, terra e vibrantes.",                    79.9, "NYX"),
    p("Batom Gloss Hidratante",          "Gloss com vitamina E e extrato de rosa. Brilho natural.",               19.9, "Ruby Rose"),
    p("Delineador Líquido Preto — 2ml", "Delineador à prova d'água, ponta fina para traços precisos.",           24.9, "Dailus"),
    p("Máscara Facial Argila — 80g",     "Argila verde purificante que fecha poros e controla oleosidade.",        24.9),
    p("Kit Manicure 6 Peças",            "Estojo completo com alicate, empurrador, lixa e palito.",               34.9),
    p("Creme para Área dos Olhos — 15g","Creme antiidade para olheiras e pés de galinha.",                        49.9, "Bioderma"),
  ],

  "moda": [
    p("Camiseta Polo Masculina",         "Polo de piquet com botões, corte clássico. Azul, branco ou preto.",     89.9),
    p("Legging Esportiva Feminina",      "Legging de alta compressão com cintura alta. Diversas cores.",           69.9, null, 59.9),
    p("Bermuda Cargo Masculina",         "Bermuda cargo com bolsos laterais, tecido sarja resistente.",            89.9),
    p("Vestido Casual Verão",            "Vestido leve em viscose estampada, alças ajustáveis.",                   99.9),
    p("Jaqueta Jeans Feminina",          "Jaqueta de denim lavado com detalhes em botões de metal.",             149.9, null, 129.9),
    p("Camisa Social Linho Masculina",   "Camisa de linho italiano manga longa. Elegante e fresca.",             139.9),
    p("Macaquinho Feminino Canelado",    "Macaquinho de malha canelada com decote V e botões.",                   89.9),
    p("Pijama Casal Combinando — Kit",  "Kit com 2 pijamas de algodão combinando. Confortável.",                149.9),
    p("Tênis Casual Unissex",            "Tênis slip-on de lona, solado EVA e design minimalista.",              139.9, null, 119.9),
    p("Bolsa Tote de Lona — Feminina",  "Bolsa tote espaçosa de lona canvas com alça de couro.",                 99.9),
  ],

  "fitness": [
    p("Glutamina Pura — 300g",           "L-Glutamina 100% pura, recuperação muscular e imunidade.",              59.9, "Max Titanium"),
    p("ZMA — 90 Cápsulas",               "Zinco, Magnésio e B6. Hormônios, sono e recuperação.",                  49.9, "Integralmedica"),
    p("Albumina Clara de Ovo — 500g",    "Proteína de clara de ovo em pó, altíssima absorção.",                   69.9),
    p("Termogênico — 120 Cápsulas",      "Termogênico com cafeína, pimenta e extrato verde para foco e queima.", 79.9, null, 69.9),
    p("Barra Proteica Vegana — 12 un",   "Proteína vegetal de ervilha, 15g por barra. Sem lactose.",             99.9),
    p("Multivitamínico — 60 Cápsulas",   "Vitaminas A-Z para homens, fórmula completa com zinco e ferro.",       49.9),
    p("Elástico de Resistência — Kit 3", "Kit com 3 faixas de resistência leve, média e forte.",                 39.9),
    p("Corda de Pular Profissional",     "Corda de pular com cabo de aço e rolamento duplo. Ajustável.",          29.9),
    p("Tapete de Yoga — 6mm",            "Tapete antiderrapante de PVC, 183x61cm, superfície texturizada.",       79.9, null, 64.9),
    p("Garrafa Squeeze 900ml BPA Free", "Garrafa esportiva de tritan transparente, trava de segurança.",          29.9),
  ],

  "bebes": [
    p("Fralda Huggies Supreme RN — 40un","Fralda especial para recém-nascido, ultra macia e absorvente.",         54.9, "Huggies"),
    p("Macacão para Bebê — 0-3m",        "Macacão de malha suave com zíper e capuz bordado.",                    39.9),
    p("Almofada de Amamentação",         "Almofada em C para amamentação e apoio do bebê. Lavável.",             89.9),
    p("Banheira Dobrável Portátil",      "Banheira dobrável com suporte e indicador de temperatura.",            79.9, null, 69.9),
    p("Kit Escovinha Dental Bebê — 3 pc","Kit higiene bucal com dedeira, escova e pasta com flúor.",             24.9),
    p("Mordedor Refrigerante BPA Free", "Mordedor de silicone sem BPA que vai à geladeira. Alívio dentição.",    19.9),
    p("Cadeira de Alimentação Portátil","Assento de alimentação portátil com bandeja e cinto de segurança.",    149.9),
    p("Monitor de Bebê com Áudio",       "Babá eletrônica com alcance 300m e luz noturna.",                      129.9),
    p("Body Manga Curta — Kit 3 un",     "Pack 3 bodies de algodão suave em cores neutras. 3-6 meses.",          59.9),
    p("Bola de Atividades Bebê",         "Bola sensorial com texturas e sons. Estimula coordenação.",             34.9),
  ],

  "casa-cozinha": [
    p("Escorredor de Macarrão — 4L",    "Escorredor de inox com base, grande capacidade.",                       39.9),
    p("Forma para Bolo com Furo — 24cm","Forma de alumínio antiaderente para bolo inglês e bundth.",             29.9),
    p("Potes Herméticos — Kit 5 pc",    "Potes de vidro com tampa hermética. Do maior ao menor.",                59.9, null, 49.9),
    p("Organizador de Gaveta — 8 pc",   "Kit divisórias ajustáveis para gaveta de talheres.",                    34.9),
    p("Descanso de Panela Silicone — 3","Descansos coloridos em silicone resistente ao calor.",                  19.9),
    p("Cesta de Organização — Média",   "Cesta rígida para organização de prateleiras e armários.",              39.9),
    p("Difusor de Aromas Elétrico",     "Difusor ultrassônico com nebulização fria e luz noturna.",              69.9),
    p("Toalha de Mesa 140x200cm",       "Toalha de linho lavável com bordado. Para 6 lugares.",                  59.9, null, 49.9),
    p("Medidor de Líquidos — 1L",       "Copo medidor de vidro com escalas em ml e xícaras.",                    24.9),
    p("Rolo de Massa em Madeira",        "Rolo de madeira para massas, superfície lisa e resistente.",             19.9),
  ],

  "utilidades": [
    p("Limpa Vidros — 500ml",            "Limpador de vidros e espelhos, sem riscos e sem manchas.",               9.9, "Windex"),
    p("Desengordurante Spray — 500ml",   "Remove gordura de fogão, panelas e superfícies.",                       10.9, "Veja"),
    p("Palha de Aço — 8 un",             "Palha de aço para limpeza pesada sem arranhar.",                         5.9, "Bombril"),
    p("Escova WC com Suporte",           "Escova sanitária com porta em plástico resistente.",                    19.9),
    p("Perfumador de Tecidos — 220ml",   "Perfumador de roupas e ambientes. Fragrância lavanda.",                 12.9),
    p("Antimofo Spray — 400ml",          "Spray preventivo contra mofo em juntas e paredes.",                     14.9),
    p("Limpador Multiuso — 500ml",       "Limpeza geral de superfícies duras. Sem perfume.",                       8.9, "Veja"),
    p("Saco de Lixo 50L — 30 un",       "Sacos de lixo pretos extra-resistentes com fechamento fácil.",          14.9),
    p("Lustra Móveis — 200ml",           "Nutre e protege móveis de madeira com cera natural.",                    8.9),
    p("Escova de Lavar Roupa",           "Escova de cerdas firmes para lavagem de peças delicadas.",               9.9),
  ],

  "ferramentas": [
    p("Esmerilhadeira 4.5pol 900W",      "Grinder angular com disco de 4.5\", 900W, bivolt. Ideal para corte.",  199.9, "Bosch", 179.9),
    p("Kit Brocas Concreto — 6 pc",     "Conjunto de brocas para concreto e alvenaria de 4 a 12mm.",             29.9),
    p("Grampo Sargento — 6 pol",         "Grampo de aço para fixação de madeiras durante colagem.",               24.9),
    p("Mangueira de Jardim — 15m",       "Mangueira trançada resistente com esguicho ajustável.",                 39.9),
    p("Lanterna LED Profissional — 5W", "Lanterna de cabeça com feixe regulável e bateria recarregável.",         34.9),
    p("Pistola de Silicone Manual",      "Pistola para cartucho de silicone, ação contínua e sem respingo.",      19.9),
    p("Plaina Manual — 7 pol",           "Plaina de madeira com lâmina de aço, regulagem precisa.",               49.9),
    p("Desempenadeira de Aço — 30cm",   "Desempenadeira lisa para massa corrida e reboco.",                      24.9),
    p("Fita Métrica — 3m",              "Fita de tecido para medições de costura e decoração.",                    9.9),
    p("Chave Allen Jogo — 9 peças",      "Jogo de chaves allen em aço cromo-vanádio 1.5 a 10mm.",                19.9),
  ],

  "construcao": [
    p("Porcelanato 60x60 — m²",          "Porcelanato acetinado cinza, PEI 4, apto para ambientes molhados.",    79.9),
    p("Tubo PVC Esgoto — 100mm 3m",      "Tubo soldável para esgoto sanitário.",                                  49.9),
    p("Joelho PVC 90° — 100mm",          "Conexão PVC roscável para curvas de 90°.",                              8.9),
    p("Areia Média — 30kg",              "Areia lavada de rio, granulometria média para argamassa.",              19.9),
    p("Cal Virgem — 7kg",                "Cal virgem em pó para massa, reboco e caiação.",                        15.9),
    p("Gesso Liso — 1kg",                "Gesso em pó para acabamento de teto e paredes.",                         4.9),
    p("Dobradiça Inox 3.5pol — Par",     "Par de dobradiças em aço inoxidável para portas.",                      9.9),
    p("Torneira de Parede Cromada",      "Torneira simples cromada para tanque e área de serviço.",               39.9),
    p("Rolo de Lã 23cm + Bandeja",       "Kit rolo de lã 23cm com cabo e bandeja plástica. Pintura fácil.",      19.9),
    p("Bucha Fischer + Parafuso — 50 un","Kit bucha de nylon S8 com parafuso 5x40mm para parede.",               12.9),
  ],

  "eletronicos": [
    p("Teclado Mecânico Gamer",          "Teclado com switches Blue, iluminação RGB e layout ABNT2.",            219.9, null, 189.9),
    p("Smartwatch Fitness — Básico",     "Smartwatch com monitor cardíaco, GPS básico e até 7 dias de bateria.", 249.9, null, 219.9),
    p("Caixinha Bluetooth Portátil",     "Speaker portátil à prova d'água, 12W, bateria 12h.",                  119.9, null, 99.9),
    p("Adaptador Wi-Fi USB AC1200",      "Receptor Wi-Fi dual band 2.4 e 5GHz, velocidade AC1200.",              79.9),
    p("Leitor de Cartão USB-C",          "Leitor compacto SD/microSD para notebooks e tablets.",                  24.9),
    p("Cabo HDMI 2.0 — 2m",              "Cabo HDMI 4K@60Hz com malha trançada resistente.",                     29.9),
    p("Mousepad XL — 80x30cm",           "Mousepad de tecido extended, base antiderrapante de borracha.",         39.9),
    p("Suporte para Notebook",           "Suporte ergonômico ajustável em alumínio para notebooks.",              79.9),
    p("Fritadeira Air Fryer Digital 4L", "Air fryer digital 1400W com 8 funções, temporizador e timer.",        299.9, null, 269.9),
    p("Aspirador Robô Wi-Fi",            "Robô aspirador com mapeamento Wi-Fi e controle pelo app.",             699.9, null, 599.9),
  ],

  "papelaria": [
    p("Estojo Escolar Grande — 3 em 1", "Estojo triplo em neoprene resistente. Capacidade para +40 itens.",      29.9),
    p("Régua 30cm Acrílico",             "Régua transparente com escala em mm, flexível e durável.",               4.9),
    p("Compasso Escolar de Metal",       "Compasso de precisão com ponteira e lapiseira inclusa.",                 14.9, "Faber-Castell"),
    p("Borracha Plástica BIG",           "Borracha macia sem PVC, deixa sem resíduo e não borra.",                 3.9, "Faber-Castell"),
    p("Apontador com Depósito",          "Apontador duplo com recipiente para aparas, sem sujeira.",               4.9),
    p("Fichário A4 — 2 Argolas",         "Fichário resistente em polipropileno, 50mm, 200 folhas.",               24.9),
    p("Papel Sulfite A4 — 500 folhas",   "Resma de papel branco 75g/m², ideal para impressões.",                  29.9),
    p("Canetas Brush Aquarelável — 12",  "Canetas ponta de pincel para lettering e aquarela.",                    39.9),
    p("Caderno Moleskine Clássico A5",   "Caderno de capa rígida, pautado, 208 páginas, elástico.",              79.9),
    p("Corretivo Líquido — 7ml",         "Corretor líquido de secagem rápida, cobertura total.",                   4.9, "BIC"),
  ],

  "brinquedos": [
    p("Pião Beyblade — Estágio 1",       "Pião de batalha com lançador, compatível com arena.",                   39.9, "Hasbro"),
    p("Boneco Articulado Herói — 30cm", "Boneco com 12 pontos de articulação e acessórios.",                     59.9),
    p("Kit de Pintura Aquarela — 24 cor","Aquarela em pastilhas com 2 pincéis, papel incluso.",                   34.9),
    p("Banco Imobiliário Junior",        "Versão infantil do clássico jogo de imóveis. 2-4 jogadores, 4+.",       49.9, "Hasbro"),
    p("Cubo Mágico 3x3 Profissional",   "Cubo de velocidade com rodamentos internos e adesivo anti-desbotamento.",24.9),
    p("Nerf N-Strike Rival Mini",        "Lançador de dardos mini, kit com 6 dardos. 8+ anos.",                   49.9, "Nerf"),
    p("Pista de Fricção Hot Wheels",     "Pista loop duplo com 2 carrinhos e lançador. Adrenalina garantida.",    79.9, "Hot Wheels"),
    p("Jogo da Memória — 36 Pares",      "Jogo de memória com 72 peças ilustradas e resistentes.",               24.9),
    p("Bicicleta de Equilíbrio — 2-5a", "Bike sem pedal de alumínio leve, ajuste de altura e selim.",           299.9, null, 269.9),
    p("Kit Slime Científico",            "Experimento para criar slime com borato, cola e glitter. 5+ anos.",     29.9),
  ],

  "presentes": [
    p("Cesta Gourmet Premium",           "Cesta com azeite, geleias, biscoitos, chocolates e vinho.",            189.9, null, 169.9),
    p("Kit Aromaterapia com Difusor",    "Difusor ultrassônico + 5 óleos essenciais 10ml cada.",                 99.9),
    p("Porta-Chaves Couro Personalizado","Chaveiro de couro legítimo com iniciais gravadas.",                     34.9),
    p("Livro Fotográfico 20x20cm",       "Livro com capa dura, 24 páginas. Envie as fotos e receba pronto.",    129.9),
    p("Caixinha Musical de Madeira",     "Caixinha com melodia ao abrir. Presente encantador.",                   49.9),
    p("Kit Fondue de Chocolate",         "Conjunto com rechaud, garfinhos e 200g de chocolate belga.",            79.9),
    p("Copo Térmico 500ml Personalizado","Copo Stanley personalizado com nome ou mensagem gravada.",              89.9),
    p("Sabonetes Artesanais — Kit 3 un","Sabonetes naturais de açaí, lavanda e mel. Embalagem premium.",         44.9),
    p("Album de Fotos — 100 Fotos",      "Álbum de tecido com bolsos e folha de anotações.",                     39.9),
    p("Puzzle Personalizado — 500 pc",  "Quebra-cabeça com foto sua. Caixa metálica personalizada.",            99.9, null, 84.9),
  ],

  "automotivo": [
    p("Fluido de Freio DOT 4 — 500ml",  "Fluido de freio sintético de alta performance e ponto de ebulição.",    19.9),
    p("Anti-ferrugem Spray — 300ml",     "Protetor anticorrosivo para chassis, parafusos e metal exposto.",       24.9, "Wurth"),
    p("Limpador de Para-brisa — 400ml", "Fluido para reservatório do para-brisa, antiembaçante.",                 9.9),
    p("Capa de Banco Universal — Par",  "Par de capas impermeáveis para banco dianteiro. Lavável.",              49.9),
    p("Kit Primeiros Socorros Veicular","Estojo com gaze, esparadrapo, antisséptico e luvas.",                   34.9),
    p("Tapete Borracha Dianteiro — Par","Par de tapetes de borracha universal para bancos dianteiros.",           39.9),
    p("Desentravador de Trava — 150ml", "Spray lubrificante para travas, fechaduras e dobradiças.",              14.9, "WD-40"),
    p("Câmera de Ré Universal",          "Câmera de ré com visão noturna, conector universal.",                   79.9, null, 64.9),
    p("Suporte Magnético para Celular", "Suporte de ventosa magnético para dashboard com rotação 360°.",          19.9),
    p("Cabo de Bateria — 150A",          "Par de cabos para dar partida com grampos resistentes. 3m.",            49.9),
  ],

  "servicos": [
    p("Serviço de Lavanderia — kg",      "Lavagem, secagem e dobra de roupas. Por quilo.",                        12.0),
    p("Passeio de Pet — 1h",             "Passeador profissional, seguro, via GPS rastreado.",                    50.0),
    p("Personal Trainer — 1 Sessão",     "Treino personalizado com avaliação física. In-home ou academia.",       90.0),
    p("Serviço de Pedreiro — 4h",        "Pedreiro para pequenos reparos: rejunte, massa e aplicação de azulejo.",200.0),
    p("Babysitter — 4h Noturno",         "Babá experiente para cuidados noturnos. Referências verificadas.",      160.0),
    p("Aula Particular — Matemática 1h","Professor particular de matemática para ensino fundamental e médio.",    80.0),
    p("Fotógrafo Profissional — 2h",     "Ensaio fotográfico externo ou interno. Entrega em 48h.",               280.0, null, 249.0),
    p("Tradução de Documento — Página", "Tradução técnica ou juramentada por página A4.",                         50.0),
    p("Dedetização Residencial",         "Controle de pragas em imóvel até 100m². Garantia 30 dias.",            350.0, null, 299.0),
    p("Mudança Residencial Local",       "Serviço de mudança com caminhão e equipe. Por hora+km.",               200.0),
  ],

  "cursos-online": [
    p("Culinária Avançada Online",       "Técnicas profissionais de confeitaria e cozinha quente. 30 aulas.",     199.9, null, 169.9),
    p("Java do Zero ao Avançado",        "POO, Spring Boot, APIs REST e banco de dados. Certificado.",            299.9, null, 249.9),
    p("Inglês para Viagens — 8 Aulas",  "Inglês focado em situações reais: aeroporto, hotel e compras.",         149.9),
    p("Edição de Vídeo com Premiere",    "Adobe Premiere do básico ao avançado. Exports e efeitos.",             199.9),
    p("AutoCAD 2D e 3D",                 "Desenho técnico profissional. Do básico ao projeto arquitetônico.",     249.9, null, 199.9),
    p("Social Media Profissional",       "Criação de conteúdo, algoritmos, métricas e estratégias de marca.",    179.9),
    p("Finanças Pessoais — Planilha",   "Orçamento pessoal, investimentos e independência financeira.",          129.9),
    p("Libras Básico — 20 Aulas",        "Aprendizado da língua brasileira de sinais, comunicação inicial.",      149.9),
    p("Power BI Avançado",               "DAX, modelagem de dados, relatórios interativos e publicação.",        199.9, null, 169.9),
    p("Liderança e Gestão de Equipes",   "Habilidades de gestão, comunicação e tomada de decisão.",              249.9),
  ],

  "assistencia-tecnica": [
    p("Troca de Tela Samsung Galaxy S23","Display AMOLED original com cola UV e testes completos.",              449.9, null, 399.9),
    p("Troca de Câmera Traseira iPhone","Câmera original Apple com calibração e teste óptico.",                  299.9),
    p("Manutenção Console PS5",          "Limpeza interna, troca de pasta e atualização de firmware.",            199.9),
    p("Recuperação de Dados — HD",       "Recuperação de arquivos de HD, SSD ou pendrive danificados.",           299.9),
    p("Troca de Teclado Notebook",       "Substituição de teclado para notebooks 14\" e 15.6\".",               199.9),
    p("Instalação de Placa de Vídeo",    "Instalação e configuração de GPU. Teste de stress incluso.",            99.9),
    p("Limpeza Completa MacBook",        "Limpeza interna, troca de pasta térmica e polimento externo.",         199.9),
    p("Troca de Fonte PC — ATX",         "Substituição de fonte ATX com teste de voltagem e carga.",             149.9),
    p("Config. de Rede e Roteador",      "Configuração de roteador, Wi-Fi 5/6 e rede mesh.",                     89.9),
    p("Reparo iPhone Molhado",           "Desmontagem, limpeza ultrassônica e secagem de placa.",               249.9, null, 219.9),
  ],

  "outros": [
    p("Calendário de Parede 2027",       "Calendário ilustrado 12 meses, papel couché. 30x42cm.",                19.9),
    p("Cartão-Presente Digital — R$150", "Vale-presente digital de R$150 para qualquer loja do GizApp.",        150.0),
    p("Kit Sobrevivência Urbano",        "Canivete, lanterna, apito, corda e manual. Para emergências.",          59.9),
    p("Conjunto Dominó + Baralho",       "Kit com dominó clássico de osso e 2 baralhos plastificados.",          29.9),
    p("Kit Meditação Iniciante",         "Tapete, bloco de espuma, incenso e guia de práticas.",                 69.9),
    p("Organizador de Cabos — 10 pc",   "Clips de organização de cabos em silicone colorido.",                    9.9),
    p("Almofada de Pescoço — Viagem",   "Almofada inflável em U para viagens longas de avião.",                  24.9),
    p("Caderno de Esboços A4 — 80 fls","Caderno sem pauta para desenhos e ilustrações. Papel 120g.",            22.9),
    p("Puzzlebox Enigma — Nível 3",      "Caixa-enigma de madeira para abrir com sequência lógica. Desafio.",   44.9),
    p("Produto Misterioso — Semana",     "Surpresa semanal com produto curado especialmente para você.",          34.9, null, 29.9),
  ],
};

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Topup — adicionando 10 produtos extras por categoria\n");
  const token = await getToken();

  // Load all stores (with category field)
  const storesR = await get("/api/stores?pageSize=500", token);
  const allStores = storesR.data?.items ?? storesR.data ?? [];
  console.log(`📦 ${allStores.length} lojas encontradas\n`);

  const stats = { cats: 0, products: 0, links: 0, patches: 0, errors: 0 };

  for (const [catSlug, extraProds] of Object.entries(EXTRA)) {
    const stores = allStores.filter(s =>
      (s.category ?? "").toLowerCase().replace(/\s+/g, "-") === catSlug
    );
    if (stores.length === 0) {
      console.log(`⚠️  Categoria "${catSlug}" sem lojas, pulando.`);
      continue;
    }

    console.log(`\n📁 ${catSlug.toUpperCase()} — ${stores.length} lojas, ${extraProds.length} produtos extras`);

    // Create products in global catalog
    const created = [];
    for (const prod of extraProds) {
      const r = await post("/api/products", {
        name: prod.name, description: prod.description,
        category: catSlug, price: prod.price,
        brand: prod.brand ?? null, available: true,
      }, token);
      if (r.ok && r.data?.id) {
        created.push({ ...prod, id: r.data.id });
        stats.products++;
        process.stdout.write(".");
      } else {
        stats.errors++;
        process.stdout.write("x");
      }
    }
    console.log(` (${created.length} criados)`);

    // Link & patch for each store
    for (const store of stores) {
      const catStr = (store.category ?? "outros").toLowerCase().replace(/\s+/g, "-");
      const [, maxP] = { "restaurantes":[18,65],"mercearia":[3,35],"cervejas":[8,45],"destilados-e-vinhos":[45,180],"nao-alcoolicos":[4,18],"farmacia":[8,60],"lanches":[12,45],"pizzarias":[42,85],"acai-sorvetes":[12,40],"cafeterias":[7,22],"padaria":[2,25],"doces":[12,55],"conveniencia":[3,30],"hortifruti":[3,18],"carnes":[28,130],"petshop":[14,90],"beleza":[12,150],"moda":[50,250],"fitness":[30,180],"bebes":[14,100],"casa-cozinha":[20,150],"utilidades":[4,35],"ferramentas":[18,200],"construcao":[10,250],"eletronicos":[20,300],"papelaria":[3,30],"brinquedos":[12,160],"presentes":[30,180],"automotivo":[14,200],"servicos":[50,300],"cursos-online":[80,400],"assistencia-tecnica":[60,500],"outros":[20,120] }[catStr] ?? [15, 80];
      void maxP;

      for (const prod of created) {
        // Link
        const lr = await post("/api/storeproducts/add-from-catalog",
          { storeId: store.id, productId: prod.id }, token);
        if (lr.ok || lr.status === 400) stats.links++;

        // Find the storeProduct and patch price
        const spR = await get(`/api/storeproducts/${store.id}`, token);
        if (!spR.ok) continue;
        const sp = spR.data.find(x => x.productId === prod.id);
        if (!sp) continue;

        const mult = 0.9 + Math.random() * 0.2;
        const price = parseFloat((prod.price * mult).toFixed(2));
        const promoPrice = prod.promotionalPrice
          ? parseFloat((prod.promotionalPrice * mult).toFixed(2))
          : null;

        const pr = await patch(`/api/storeproducts/${sp.id}`, {
          price, promotionalPrice: promoPrice, stock: 100, available: true,
        }, token);
        if (pr.ok) { stats.patches++; process.stdout.write("+"); }
        else { stats.errors++; process.stdout.write("!"); }
      }
    }

    stats.cats++;
    console.log(" ✓");
  }

  console.log("\n\n✅ TOPUP CONCLUÍDO");
  console.log(`   Categorias:         ${stats.cats}`);
  console.log(`   Produtos criados:   ${stats.products}`);
  console.log(`   Links criados:      ${stats.links}`);
  console.log(`   Patches de preço:   ${stats.patches}`);
  console.log(`   Erros:              ${stats.errors}`);
}

main().catch(err => { console.error("\n💥 ERRO:", err); process.exit(1); });
