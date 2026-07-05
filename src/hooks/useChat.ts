import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/authStore";

export type ChatMessage = {
  id: string;
  storeId: string;
  text: string;
  from: "customer" | "store";
  senderName: string;
  at: string;
};

type DbRow = {
  id: string;
  store_id: string;
  content: string;
  sender_role: string;
  sender_name: string;
  created_at: string;
};

function mapRow(r: DbRow): ChatMessage {
  return {
    id:         r.id,
    storeId:    r.store_id,
    text:       r.content,
    from:       r.sender_role === "store" ? "store" : "customer",
    senderName: r.sender_name,
    at:         r.created_at,
  };
}

export function useChat(storeId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const auth = useAuthStore((s) => s.user);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!storeId) return;

    // Load last 100 messages
    supabase
      .from("chat_messages")
      .select("id, store_id, content, sender_role, sender_name, created_at")
      .eq("store_id", storeId)
      .eq("conversation_type", "store_customer")
      .order("created_at", { ascending: true })
      .limit(100)
      .then(({ data }) => {
        if (data) setMessages((data as DbRow[]).map(mapRow));
      });

    // Realtime: new messages from any participant
    const channel = supabase
      .channel(`chat:store:${storeId}`)
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "chat_messages",
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          setMessages((prev) => {
            const row = payload.new as DbRow;
            // deduplicate by id (optimistic inserts from own client)
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, mapRow(row)];
          });
        }
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    channelRef.current = channel;
    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
      setConnected(false);
    };
  }, [storeId]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !auth) return;

      await supabase.from("chat_messages").insert({
        store_id:          storeId,
        conversation_type: "store_customer",
        sender_id:         auth.id,
        sender_role:       "customer",
        sender_name:       auth.name ?? "Cliente",
        content:           trimmed,
      });
    },
    [storeId, auth]
  );

  // kept for API compatibility — no longer persists to localStorage
  const clear = useCallback(() => setMessages([]), []);

  return { messages, send, clear, connected };
}
