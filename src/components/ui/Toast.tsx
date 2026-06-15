import { AlertCircle, CheckCircle2, X, AlertTriangle } from "lucide-react";
import { useToastStore } from "../../stores/toastStore";

const styles = {
  error: {
    bar: "bg-red-500",
    icon: <AlertCircle size={18} className="shrink-0 text-red-500" />,
    border: "border-red-100",
  },
  warning: {
    bar: "bg-amber-400",
    icon: <AlertTriangle size={18} className="shrink-0 text-amber-500" />,
    border: "border-amber-100",
  },
  success: {
    bar: "bg-green-500",
    icon: <CheckCircle2 size={18} className="shrink-0 text-green-500" />,
    border: "border-green-100",
  },
};

export default function Toast() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed left-1/2 top-20 z-[200] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
      {toasts.map((toast) => {
        const s = styles[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 overflow-hidden rounded-2xl border ${s.border} bg-white shadow-xl shadow-black/10`}
          >
            <div className={`w-1 shrink-0 self-stretch ${s.bar}`} />
            <div className="flex flex-1 items-start gap-2 py-3 pr-2">
              {s.icon}
              <p className="flex-1 text-sm font-semibold leading-snug text-[#0f172a]">
                {toast.message}
              </p>
              <button
                onClick={() => dismiss(toast.id)}
                className="mt-0.5 shrink-0 text-[#94a3b8] hover:text-[#0f172a]"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
