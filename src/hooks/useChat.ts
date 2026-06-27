import { useState, useCallback, useEffect } from "react";
import * as signalR from "@microsoft/signalr";
import { getAuth } from "../services/auth";
import { supabase } from "../lib/supabase";

const API_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_IMAGE_API_URL ||
  "http://localhost:5003";

export type ChatMessage = {
  id: string;
  storeId: string;
  text: string;
  from: "customer" | "store";
  senderName: string;
  at: string;
};

function storageKey(storeId: string) {
  return `brasux-chat-${storeId}`;
}

function loadMessages(storeId: string): ChatMessage[] {
  try {
    const d = JSON.parse(localStorage.getItem(storageKey(storeId)) ?? "[]");
    return Array.isArray(d) ? d : [];
  } catch {
    return [];
  }
}

function persistMessages(storeId: string, msgs: ChatMessage[]) {
  localStorage.setItem(storageKey(storeId), JSON.stringify(msgs.slice(-200)));
}

let chatConnection: signalR.HubConnection | null = null;

function getChatConnection() {
  if (!chatConnection) {
    chatConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/chat`, {
        accessTokenFactory: async () => {
          const { data } = await supabase.auth.getSession();
          return data.session?.access_token ?? "";
        },
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.None)
      .build();
  }
  return chatConnection;
}

export function useChat(storeId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages(storeId));
  const [connected, setConnected] = useState(false);
  const auth = getAuth();

  useEffect(() => {
    const conn = getChatConnection();

    async function connect() {
      try {
        if (conn.state === signalR.HubConnectionState.Disconnected) {
          await conn.start();
        }
        setConnected(true);

        conn.on("MessageReceived", (msg: ChatMessage) => {
          if (msg.storeId !== storeId) return;
          setMessages((prev) => {
            const next = [...prev, msg];
            persistMessages(storeId, next);
            return next;
          });
        });
      } catch {
        // Hub not available — chat works offline (localStorage only)
        setConnected(false);
      }
    }

    connect();

    return () => {
      conn.off("MessageReceived");
    };
  }, [storeId]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        storeId,
        text: text.trim(),
        from: "customer",
        senderName: auth?.name ?? "Você",
        at: new Date().toISOString(),
      };

      setMessages((prev) => {
        const next = [...prev, msg];
        persistMessages(storeId, next);
        return next;
      });

      // Try to send via SignalR hub
      try {
        const conn = getChatConnection();
        if (conn.state === signalR.HubConnectionState.Connected) {
          await conn.invoke("SendMessage", { storeId, text: text.trim() });
        }
      } catch {
        // Offline mode — message saved locally
      }
    },
    [storeId, auth]
  );

  const clear = useCallback(() => {
    localStorage.removeItem(storageKey(storeId));
    setMessages([]);
  }, [storeId]);

  return { messages, send, clear, connected };
}
