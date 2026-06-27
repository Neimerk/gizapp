import * as signalR from "@microsoft/signalr";
import { supabase } from "../lib/supabase";

// Lê VITE_API_URL (host .NET/SignalR). Cai para VITE_IMAGE_API_URL e, por
// último, localhost. Para nunca apontar para localhost em produção, basta
// definir VITE_API_URL no ambiente de deploy.
const API_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_IMAGE_API_URL ||
  "http://localhost:5003";

// Token real da sessão Supabase (assíncrono). Antes lia uma chave de
// localStorage que nunca era escrita, então o hub nunca autenticava.
async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export const ordersConnection = new signalR.HubConnectionBuilder()
  .withUrl(`${API_URL}/hubs/orders`, {
    accessTokenFactory: getToken,
  })
  .withAutomaticReconnect()
  .build();

export async function startOrdersConnection() {
  if (ordersConnection.state === signalR.HubConnectionState.Disconnected) {
    await ordersConnection.start();
  }
}
