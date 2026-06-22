// Central SEO configuration and schema builders for BrasUX Shopping
// All structured data follows schema.org specifications

export const SEO = {
  site: {
    name: "BrasUX Shopping",
    shortName: "BrasUX",
    domain: "https://shopping.brasux.com.br",
    description:
      "O Shopping Brasileiro de Soluções Tecnológicas. Restaurantes, mercado, farmácia, eletrônicos e muito mais com entrega rápida.",
    logo: "https://shopping.brasux.com.br/logo-brasux.webp",
    ogImage: "https://shopping.brasux.com.br/og-image.png",
    twitterHandle: "@brasux",
    locale: "pt_BR",
    language: "pt-BR",
  },

  organization: {
    name: "BrasUX",
    legalName: "BrasUX Tecnologia Ltda.",
    url: "https://brasux.com.br",
    logo: "https://shopping.brasux.com.br/logo-brasux.webp",
    sameAs: [
      "https://instagram.com/brasux",
      "https://linkedin.com/company/brasux",
      "https://facebook.com/brasux",
    ],
    contactPoint: {
      email: "contato@brasux.com.br",
      contactType: "customer service",
      availableLanguage: "Portuguese",
    },
  },
} as const;

export function canonicalUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SEO.site.domain}${clean}`;
}

export function pageTitle(title: string): string {
  return `${title} — ${SEO.site.name}`;
}

// ── SCHEMA BUILDERS ─────────────────────────────────────────────────────────

export function buildOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SEO.organization.url}/#organization`,
    name: SEO.organization.name,
    legalName: SEO.organization.legalName,
    url: SEO.organization.url,
    logo: {
      "@type": "ImageObject",
      url: SEO.organization.logo,
      width: 512,
      height: 512,
    },
    sameAs: SEO.organization.sameAs,
    contactPoint: {
      "@type": "ContactPoint",
      email: SEO.organization.contactPoint.email,
      contactType: SEO.organization.contactPoint.contactType,
      availableLanguage: SEO.organization.contactPoint.availableLanguage,
    },
  };
}

export function buildWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SEO.site.domain}/#website`,
    name: SEO.site.name,
    description: SEO.site.description,
    url: SEO.site.domain,
    inLanguage: SEO.site.language,
    publisher: { "@id": `${SEO.organization.url}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SEO.site.domain}/buscar?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function buildWebPageSchema(opts: {
  path: string;
  name: string;
  description: string;
  type?: string;
  datePublished?: string;
  dateModified?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": opts.type ?? "WebPage",
    "@id": `${canonicalUrl(opts.path)}#webpage`,
    url: canonicalUrl(opts.path),
    name: opts.name,
    description: opts.description,
    inLanguage: SEO.site.language,
    isPartOf: { "@id": `${SEO.site.domain}/#website` },
    ...(opts.datePublished ? { datePublished: opts.datePublished } : {}),
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
  };
}

export function buildBreadcrumbSchema(
  crumbs: { name: string; path: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: canonicalUrl(c.path),
    })),
  };
}

export function buildProductSchema(product: {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price: number;
  promotionalPrice?: number | null;
  brand?: string;
  category?: string;
  stock: number;
  storeId: string;
  storeName: string;
  storeRating?: number;
  reviewCount?: number;
  averageRating?: number;
}) {
  const url = canonicalUrl(`/lojas/${product.storeId}/produto/${product.id}`);
  const price = product.promotionalPrice ?? product.price;
  const availability =
    product.stock > 0
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock";

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.name,
    url,
    ...(product.description ? { description: product.description } : {}),
    ...(product.brand
      ? { brand: { "@type": "Brand", name: product.brand } }
      : {}),
    ...(product.category ? { category: product.category } : {}),
    ...(product.imageUrl
      ? {
          image: {
            "@type": "ImageObject",
            url: product.imageUrl,
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      url,
      price: price.toFixed(2),
      priceCurrency: "BRL",
      priceValidUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      availability,
      seller: {
        "@type": "Organization",
        name: product.storeName,
      },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: { "@type": "MonetaryAmount", currency: "BRL" },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
          transitTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
        },
      },
    },
  };

  if (product.averageRating && product.reviewCount && product.reviewCount > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.averageRating.toFixed(1),
      reviewCount: product.reviewCount,
      bestRating: "5",
      worstRating: "1",
    };
  }

  return schema;
}

export function buildLocalBusinessSchema(store: {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  category: string;
  rating: number;
  deliveryTimeMin: number;
  deliveryTimeMax: number;
  deliveryFee: number;
  isOpen: boolean;
}) {
  const url = canonicalUrl(`/lojas/${store.id}`);
  return {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "Store"],
    "@id": `${url}#localbusiness`,
    name: store.name,
    url,
    ...(store.description ? { description: store.description } : {}),
    ...(store.logoUrl
      ? { image: { "@type": "ImageObject", url: store.logoUrl } }
      : {}),
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: store.rating.toFixed(1),
      bestRating: "5",
      worstRating: "1",
      ratingCount: "1",
    },
    priceRange: store.deliveryFee === 0 ? "R$" : "R$-R$$",
    currenciesAccepted: "BRL",
    openingHoursSpecification: store.isOpen
      ? {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: [
            "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday",
          ],
          opens: "08:00",
          closes: "23:00",
        }
      : undefined,
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: `Catálogo de ${store.name}`,
      url,
    },
  };
}

export function buildItemListSchema(opts: {
  name: string;
  description: string;
  path: string;
  items: { name: string; url: string; imageUrl?: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: opts.name,
    description: opts.description,
    url: canonicalUrl(opts.path),
    numberOfItems: opts.items.length,
    itemListElement: opts.items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: item.url,
      ...(item.imageUrl
        ? { image: { "@type": "ImageObject", url: item.imageUrl } }
        : {}),
    })),
  };
}

export function buildFaqSchema(
  faqs: { question: string; answer: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  };
}

export function buildSoftwareAppSchema(app: {
  name: string;
  description: string;
  url: string;
  operatingSystem?: string;
  applicationCategory?: string;
  price?: number;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: app.name,
    description: app.description,
    url: app.url,
    operatingSystem: app.operatingSystem ?? "Android, iOS, Web",
    applicationCategory: app.applicationCategory ?? "BusinessApplication",
    offers: {
      "@type": "Offer",
      price: (app.price ?? 0).toFixed(2),
      priceCurrency: "BRL",
    },
  };
}

// HOME FAQ content for GEO/AEO
export const HOME_FAQS = [
  {
    question: "O que é o BrasUX Shopping?",
    answer:
      "O BrasUX Shopping é um shopping brasileiro de soluções tecnológicas que reúne restaurantes, mercados, farmácias, eletrônicos, serviços digitais e muito mais em uma única plataforma com entrega rápida.",
  },
  {
    question: "Como funciona a entrega no BrasUX?",
    answer:
      "Após realizar seu pedido, o BrasUX Entregas conecta você ao entregador mais próximo. O tempo médio de entrega varia de 20 a 60 minutos dependendo da loja e região.",
  },
  {
    question: "Como vender pelo BrasUX?",
    answer:
      "Você pode cadastrar sua loja acessando lojas.brasux.com.br. O processo leva menos de 5 minutos e permite começar a vender imediatamente. O BrasUX cobra uma pequena comissão por pedido.",
  },
  {
    question: "O BrasUX atende minha cidade?",
    answer:
      "O BrasUX Shopping está em expansão por todo o Brasil. Consulte as lojas disponíveis na sua região acessando a plataforma e permitindo sua localização.",
  },
  {
    question: "Quais formas de pagamento o BrasUX aceita?",
    answer:
      "O BrasUX aceita Pix, cartão de crédito, cartão de débito e dinheiro na entrega (dependendo da loja). Todos os pagamentos online são processados com segurança.",
  },
  {
    question: "O que é o BrasUX Loja?",
    answer:
      "O BrasUX Loja é a plataforma white-label do BrasUX que permite a qualquer negócio ter sua própria loja online com gerenciamento de pedidos, estoque e entregas.",
  },
] as const;
