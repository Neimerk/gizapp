import { ArrowRight, Bike, Clock3, MapPin, Star } from "lucide-react";
import { Link } from "react-router-dom";

import { type Store } from "../../services/gizApi";
import { formatBRL } from "../../utils/format";
import { formatDistance } from "../../utils/geo";
import StoreLogo from "../ui/StoreLogo";
import { categories as allCategories } from "../../data/categories";

function parseCategoryNames(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((slug) => {
      const match = allCategories.find((c) => c.slug === slug);
      return match?.name ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    });
}

const CARD_THEMES = [
  {
    banner:
      "radial-gradient(circle at 80% 30%, rgba(37,99,235,0.55), transparent 55%), linear-gradient(135deg, #0a1628 0%, #1e3a8a 100%)",
    button: "linear-gradient(135deg, #1e3a8a, #1e40af)",
  },
  {
    banner:
      "radial-gradient(circle at 80% 30%, rgba(6,182,212,0.45), transparent 55%), linear-gradient(135deg, #0c1a2e 0%, #0c4a6e 100%)",
    button: "linear-gradient(135deg, #0c4a6e, #0369a1)",
  },
  {
    banner:
      "radial-gradient(circle at 80% 30%, rgba(22,163,74,0.55), transparent 55%), linear-gradient(135deg, #052e16 0%, #14532d 100%)",
    button: "linear-gradient(135deg, #14532d, #166534)",
  },
] as const;

interface Props {
  store: Store;
  distanceKm?: number;
  index?: number;
}

export default function StoreCard({ store, distanceKm, index = 0 }: Props) {
  const theme = CARD_THEMES[index % CARD_THEMES.length];
  const deliveryFeeText =
    Number(store.deliveryFee) === 0 ? "Grátis" : formatBRL(Number(store.deliveryFee));

  return (
    <Link
      to={`/lojas/${store.id}`}
      className="card-hover group flex flex-col overflow-hidden rounded-3xl bg-surface"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <div
        className="relative h-28"
        style={{ background: theme.banner }}
      >
        {/* Status aberto/fechado */}
        <span
          className={`absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
            store.isOpen
              ? "border-green-700/40 bg-green-900/30 text-green-400"
              : "border-white/15 bg-white/10 text-faint"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${store.isOpen ? "bg-green-400" : "bg-faint"}`} />
          {store.isOpen ? "Aberto" : "Fechado"}
        </span>

        {/* Badge de distância */}
        {distanceKm !== undefined && (
          <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
            <MapPin size={10} />
            {formatDistance(distanceKm)}
          </span>
        )}

        {/* Logo */}
        <span
          className="absolute -bottom-6 left-5 flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl text-base font-black text-white"
          style={{
            background: "linear-gradient(135deg, #16a34a, #166534)",
            boxShadow: "0 4px 16px rgba(22,163,74,0.45)",
          }}
        >
          <StoreLogo logoUrl={store.logoUrl} name={store.name} />
        </span>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-10">
        <div className="flex flex-wrap gap-1">
          {parseCategoryNames(store.category).map((name) => (
            <span
              key={name}
              className="rounded-full bg-subtle-2 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted"
            >
              {name}
            </span>
          ))}
        </div>
        <h3 className="mt-0.5 text-lg font-black text-content">{store.name}</h3>
        {store.description && (
          <p className="mt-1 text-xs leading-relaxed text-muted line-clamp-2">
            {store.description}
          </p>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatBadge icon={<Clock3 size={12} />} label="Entrega" value={`${store.deliveryTimeMin}-${store.deliveryTimeMax}min`} />
          <StatBadge icon={<Bike size={12} />}   label="Taxa"    value={deliveryFeeText} />
          <StatBadge icon={<Star size={12} />}   label="Nota"    value={Number(store.rating).toFixed(1)} />
        </div>

        <div
          className="mt-4 flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-black text-white transition-opacity group-hover:opacity-90"
          style={{ background: theme.button }}
        >
          Ver catálogo
          <ArrowRight size={16} />
        </div>
      </div>
    </Link>
  );
}

function StatBadge({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-subtle-2 bg-subtle px-2 py-2">
      <div className="flex items-center gap-1 text-faint">
        {icon}
        <span className="text-[9px] font-bold uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-0.5 text-xs font-black text-content">{value}</div>
    </div>
  );
}
