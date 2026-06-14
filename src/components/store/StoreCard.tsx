import { Star } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  store: {
    id: number;
    name: string;
    category: string;
    banner: string;
    deliveryTime: string;
    deliveryFee: string;
    rating: number;
    color: string;
  };
}

export default function StoreCard({ store }: Props) {
  return (
    <Link
      to={`/lojas/${store.id}`}
      onClick={() => console.log("Loja clicada:", store.name)}
      className="block overflow-hidden rounded-4xl bg-white shadow-xl shadow-[#dbe2ef]"
    >
      <div className="relative h-40 overflow-hidden">
        <img
          src={store.banner}
          alt={store.name}
          className="h-full w-full object-cover"
        />

        <div
          className={`absolute inset-0 bg-linear-to-t ${store.color} opacity-40`}
        />

        <div className="absolute bottom-4 left-4 rounded-full bg-white px-3 py-1 text-xs font-black text-[#111827]">
          {store.deliveryTime}
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-black text-[#111827]">
              {store.name}
            </h3>

            <p className="mt-1 text-sm text-[#64748b]">
              {store.category}
            </p>
          </div>

          <div className="rounded-full bg-[#ecfdf5] px-3 py-1 text-xs font-black text-[#16a34a]">
            {store.deliveryFee}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-[#fff7ed] px-3 py-1">
            <Star
              size={14}
              className="fill-[#f59e0b] text-[#f59e0b]"
            />

            <span className="text-xs font-black text-[#111827]">
              {store.rating}
            </span>
          </div>

          <div className="rounded-full bg-[#f1f5f9] px-3 py-1 text-xs font-bold text-[#475569]">
            entrega rápida
          </div>
        </div>
      </div>
    </Link>
  );
}