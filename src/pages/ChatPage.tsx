import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MessageCircle, Send, Trash2, Wifi, WifiOff } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getStoreById, queryKeys } from "../services/gizApi";
import { useChat } from "../hooks/useChat";
import { getAuth } from "../services/auth";

export default function ChatPage() {
  const { storeId = "" } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const auth = getAuth();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: store } = useQuery({
    queryKey: queryKeys.store(storeId),
    queryFn: () => getStoreById(storeId),
    enabled: !!storeId,
  });

  const { messages, send, clear, connected } = useChat(storeId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim()) return;
    await send(input);
    setInput("");
  }

  if (!auth) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <MessageCircle size={48} className="text-faint" />
        <h2 className="mt-4 text-xl font-black text-content">Faça login para conversar</h2>
        <p className="mt-2 text-sm text-muted">Você precisa estar logado para usar o chat.</p>
        <Link
          to={`/login`}
          state={{ from: `/lojas/${storeId}/chat` }}
          className="mt-6 rounded-2xl bg-[#16a34a] px-6 py-3 text-sm font-black text-white"
        >
          Entrar
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f172a]"
        >
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#16a34a]">Chat</p>
          <h1 className="truncate text-lg font-black text-content">
            {store?.name ?? "Loja"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <div className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[10px] font-black text-green-700">
              <Wifi size={10} /> Online
            </div>
          ) : (
            <div className="flex items-center gap-1 rounded-full bg-subtle-2 px-2.5 py-1 text-[10px] font-black text-faint">
              <WifiOff size={10} /> Local
            </div>
          )}
          {messages.length > 0 && (
            <button
              onClick={clear}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-faint hover:text-red-500"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto rounded-3xl border border-line-subtle bg-subtle p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-surface shadow-sm">
              <MessageCircle size={28} className="text-[#16a34a]" />
            </div>
            <p className="mt-4 text-sm font-black text-content">
              Inicie uma conversa com {store?.name ?? "a loja"}
            </p>
            <p className="mt-1 text-xs text-muted">
              Tire dúvidas sobre produtos, disponibilidade e entregas.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.from === "customer";
            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    isMe
                      ? "rounded-br-sm bg-[#0f172a] text-white"
                      : "rounded-bl-sm border border-line bg-surface text-content"
                  }`}
                >
                  {!isMe && (
                    <p className="mb-0.5 text-[10px] font-black text-[#16a34a]">
                      {msg.senderName}
                    </p>
                  )}
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                  <p
                    className={`mt-0.5 text-[10px] ${
                      isMe ? "text-white/40" : "text-faint"
                    }`}
                  >
                    {new Date(msg.at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 pt-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Digite uma mensagem…"
          className="flex-1 rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-medium text-content outline-none focus:ring-2 focus:ring-[#16a34a]/30 placeholder:text-faint"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#16a34a] text-white disabled:opacity-40 transition-opacity"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
