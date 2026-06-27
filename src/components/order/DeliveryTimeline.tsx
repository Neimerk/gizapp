import { Check, ChefHat, Bike, MapPin, PackageCheck, XCircle } from "lucide-react";

type Props = { status: number; etaMinutes: number | null };

type Step = { key: string; label: string; icon: typeof Check; reached: boolean; current: boolean };

export default function DeliveryTimeline({ status, etaMinutes }: Props) {
  if (status === 5) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4">
        <XCircle size={22} className="text-red-500" />
        <p className="text-sm font-bold text-red-600">Pedido cancelado</p>
      </div>
    );
  }

  const arriving = status === 3 && etaMinutes !== null && etaMinutes <= 3;
  const steps: Step[] = [
    { key: "confirmed", label: "Confirmado",        icon: Check,        reached: status >= 0, current: status < 2 },
    { key: "preparing", label: "Preparando",        icon: ChefHat,      reached: status >= 2, current: status === 2 },
    { key: "intransit", label: "Saiu para entrega", icon: Bike,         reached: status >= 3, current: status === 3 && !arriving },
    { key: "arriving",  label: "Chegando",          icon: MapPin,       reached: arriving || status >= 4, current: arriving },
    { key: "delivered", label: "Entregue",          icon: PackageCheck, reached: status >= 4, current: status === 4 },
  ];

  return (
    <ol className="space-y-0">
      {steps.map((s, i) => {
        const Icon = s.icon;
        const last = i === steps.length - 1;
        return (
          <li key={s.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ring-2 transition-colors ${
                  s.reached ? "bg-[#16a34a] ring-[#16a34a]/20" : "bg-subtle ring-[#e2e8f0]"
                }`}
              >
                <Icon size={15} className={s.reached ? "text-white" : "text-faint"} />
              </div>
              {!last && <div className={`my-0.5 w-0.5 flex-1 ${s.reached ? "bg-[#16a34a]" : "bg-[#e2e8f0]"}`} style={{ minHeight: 22 }} />}
            </div>
            <div className={`pb-5 pt-1 ${last ? "" : ""}`}>
              <p className={`text-sm font-black ${s.current ? "text-[#16a34a]" : s.reached ? "text-content" : "text-faint"}`}>
                {s.label}
              </p>
              {s.key === "intransit" && s.current && etaMinutes !== null && (
                <p className="text-xs font-bold text-muted">Chega em ~{etaMinutes} min</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
