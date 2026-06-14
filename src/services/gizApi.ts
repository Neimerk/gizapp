import { getAuthToken } from "./auth";

export const GIZ_API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5003";

export const DEFAULT_STORE_ID =
  "b5c148b0-a07b-4532-aca3-e66c12f389af";

function authHeaders() {
  const token = getAuthToken();

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/* AUTH */

export type AuthResponse = {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Customer" | "Seller" | "Courier";
  storeId?: string | null;
  token: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  role?: "Customer";
  storeId?: null;
};

export async function loginCustomer(
  payload: LoginPayload
): Promise<AuthResponse> {
  const response = await fetch(`${GIZ_API_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Email ou senha inválidos.");
  }

  return response.json();
}

export async function registerCustomer(
  payload: RegisterPayload
): Promise<AuthResponse> {
  const response = await fetch(`${GIZ_API_URL}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      role: "Customer",
      storeId: null,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(error?.message || "Erro ao cadastrar cliente.");
  }

  return response.json();
}

/* STORES */

export type Store = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  deliveryFee: number;
  deliveryTimeMin: number;
  deliveryTimeMax: number;
  rating: number;
  isOpen: boolean;
  active: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
};

/* PRODUCT BASE */

export type Product = {
  id: string;
  storeId?: string;
  name: string;
  slug: string;
  category: string;
  subCategory?: string;
  brand?: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  keywords?: string;
  imageUrl?: string;
  imageAlt?: string;
  price?: number;
  available: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PagedProducts = {
  items: Product[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type ProductQuery = {
  category?: string;
  search?: string;
  available?: boolean;
  page?: number;
  pageSize?: number;
};

/* STORE PRODUCTS */

export type StoreProduct = {
  id: string;
  storeId: string;
  productId: string;
  name: string;
  slug: string;
  category: string;
  subCategory?: string;
  brand?: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  keywords?: string;
  imageUrl?: string;
  imageAlt?: string;
  price: number;
  promotionalPrice?: number | null;
  stock: number;
  available: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StoreProductsQuery = {
  storeId?: string;
  category?: string;
  search?: string;
  available?: boolean;
};

/* ORDERS */

export type CreateOrderItem = {
  storeProductId: string;
  quantity: number;
};

export type CreateOrderPayload = {
  storeId: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryNumber: string;
  deliveryComplement: string;
  deliveryNeighborhood: string;
  paymentMethod: string;
  items: CreateOrderItem[];
};

export type OrderItem = {
  id: string;
  orderId: string;
  storeProductId: string;
  productName: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
};

export type Order = {
  id: string;
  storeId: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryNumber: string;
  deliveryComplement: string;
  deliveryNeighborhood: string;
  paymentMethod: string;
  deliveryFee: number;
  subtotal: number;
  total: number;
  status: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

/* STORES API */

export async function getStores(): Promise<Store[]> {
  const response = await fetch(`${GIZ_API_URL}/api/stores`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Erro ao buscar lojas");
  }

  return response.json();
}

export async function getStoreById(storeId: string): Promise<Store> {
  const response = await fetch(`${GIZ_API_URL}/api/stores/${storeId}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Erro ao buscar loja");
  }

  return response.json();
}

/* PRODUCTS API */

export async function getProducts(params?: ProductQuery): Promise<PagedProducts> {
  const query = new URLSearchParams();

  if (params?.category) query.append("category", params.category);
  if (params?.search) query.append("search", params.search);
  if (params?.available !== undefined) {
    query.append("available", String(params.available));
  }
  if (params?.page) query.append("page", String(params.page));
  if (params?.pageSize) query.append("pageSize", String(params.pageSize));

  const url = `${GIZ_API_URL}/api/products${
    query.toString() ? `?${query.toString()}` : ""
  }`;

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Erro ao buscar produtos da API");
  }

  return response.json();
}

export async function getProductBySlug(slug: string): Promise<Product> {
  const response = await fetch(`${GIZ_API_URL}/api/products/slug/${slug}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Erro ao buscar produto da API");
  }

  return response.json();
}

/* STORE PRODUCTS API */

export async function getStoreProducts(
  params?: StoreProductsQuery
): Promise<StoreProduct[]> {
  const storeId = params?.storeId || DEFAULT_STORE_ID;

  const response = await fetch(`${GIZ_API_URL}/api/storeproducts/${storeId}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Erro ao buscar produtos da loja");
  }

  let data: StoreProduct[] = await response.json();

  if (params?.category) {
    data = data.filter((product) => product.category === params.category);
  }

  if (params?.search) {
    const search = params.search.toLowerCase();

    data = data.filter((product) => {
      return (
        product.name.toLowerCase().includes(search) ||
        product.category.toLowerCase().includes(search) ||
        product.brand?.toLowerCase().includes(search) ||
        product.description?.toLowerCase().includes(search)
      );
    });
  }

  if (params?.available !== false) {
    data = data.filter((product) => product.available);
  }

  return data;
}

export async function getStoreProductsByCategory(
  category: string,
  storeId: string = DEFAULT_STORE_ID
): Promise<StoreProduct[]> {
  const response = await fetch(
    `${GIZ_API_URL}/api/storeproducts/${storeId}/category/${category}`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("Erro ao buscar categoria da loja");
  }

  return response.json();
}

/* ORDERS API */

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const response = await fetch(`${GIZ_API_URL}/api/orders`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(error?.message || "Erro ao criar pedido");
  }

  return response.json();
}

export async function getOrderById(id: string): Promise<Order> {
  const response = await fetch(`${GIZ_API_URL}/api/orders/${id}`, {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Erro ao buscar pedido");
  }

  return response.json();
}

/* IMAGES */

export function getProductImageUrl(imageUrl?: string) {
  if (!imageUrl) {
    return "/placeholder.png";
  }

  if (imageUrl.startsWith("http")) {
    return imageUrl;
  }

  return `${GIZ_API_URL}${imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}`;
}