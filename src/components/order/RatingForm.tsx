import { useEffect, useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { submitCourierRating, getMyRatingForOrder } from "../../services/gizApi";

type Props = { orderId: string; onDone?: () => void };

export default function RatingForm({ orderId, onDone }: Props) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    getMyRatingForOrder(orderId).then((s) => { if (s) setDone(s); });
  }, [orderId]);

  async function submit() {
    if (stars < 1) return;
    setSaving(true);
    try {
      await submitCourierRating(orderId, stars, comment.trim());
      setDone(stars);
      onDone?.();
    } finally {
      setSaving(false);
    }
  }

  if (done !== null) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-3 text-center">
        <div className="mb-1 flex justify-center gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} size={16} className={n <= done ? "fill-amber-400 text-amber-400" : "text-faint"} />
          ))}
        </div>
        <p className="text-xs font-bold text-muted">Obrigado por avaliar seu entregador!</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <p className="mb-2 text-sm font-black text-content">Como foi a entrega?</p>
      <div className="mb-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setStars(n)}
            aria-label={`${n} estrelas`}
          >
            <Star size={26} className={n <= (hover || stars) ? "fill-amber-400 text-amber-400" : "text-faint"} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comentário (opcional)"
        rows={2}
        className="mb-2 w-full resize-none rounded-xl border border-line bg-subtle px-3 py-2 text-sm text-content outline-none focus:ring-2 focus:ring-[#16a34a]/30"
      />
      <button
        onClick={submit}
        disabled={stars < 1 || saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black text-white disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : "Enviar avaliação"}
      </button>
    </div>
  );
}
