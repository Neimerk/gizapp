import { Star, Phone, MessageCircle, User } from "lucide-react";
import type { CourierInfo } from "../../services/gizApi";

type Props = { courier: CourierInfo; onChat: () => void };

export default function CourierCard({ courier, onChat }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
      {courier.avatarUrl ? (
        <img src={courier.avatarUrl} alt={courier.name} className="h-12 w-12 rounded-full object-cover ring-2 ring-[#e2e8f0]" />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-subtle ring-2 ring-[#e2e8f0]">
          <User size={20} className="text-faint" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-content">{courier.name}</p>
        <div className="flex items-center gap-1 text-xs font-bold text-muted">
          <Star size={12} className="fill-amber-400 text-amber-400" />
          {courier.avgStars !== null ? (
            <span>{courier.avgStars.toFixed(1)} <span className="text-faint">({courier.ratingsCount})</span></span>
          ) : (
            <span className="text-faint">Novo entregador</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {courier.phone && (
          <a
            href={`https://wa.me/55${courier.phone.replace(/\D/g, "")}`}
            target="_blank" rel="noopener noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#16a34a] text-white"
            aria-label="WhatsApp do entregador"
          >
            <Phone size={16} />
          </a>
        )}
        <button
          onClick={onChat}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2563eb] text-white"
          aria-label="Conversar com o entregador"
        >
          <MessageCircle size={16} />
        </button>
      </div>
    </div>
  );
}
