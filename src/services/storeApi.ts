const API_URL = "http://localhost:5003/api";

export async function getStores() {
  const response = await fetch(`${API_URL}/stores`);

  if (!response.ok) {
    throw new Error("Erro ao buscar lojas");
  }

  return response.json();
}

export async function getStoreProducts(storeId: string) {
  const response = await fetch(
    `${API_URL}/storeproducts/${storeId}`
  );

  if (!response.ok) {
    throw new Error("Erro ao buscar produtos");
  }

  return response.json();
}