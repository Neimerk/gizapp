import { create } from "zustand";
import { persist } from "zustand/middleware";

// gizApi importado de forma lazy para não puxar supabase no bundle inicial
const gizApi = () => import("../services/gizApi");

const RATE = 1; // 1 ponto por R$ 1,00

export type PointsEntry = {
  id: string;
  amount: number;
  description: string;
  date: string;
};

type PointsState = {
  points: number;
  history: PointsEntry[];
  synced: boolean;
  earn: (amountBRL: number, description?: string, orderId?: string) => void;
  spend: (points: number, description?: string, orderId?: string) => boolean;
  loadFromDB: () => Promise<void>;
};

export const usePointsStore = create<PointsState>()(
  persist(
    (set, get) => ({
      points: 0,
      history: [],
      synced: false,

      earn: (amountBRL, description = "Compra concluída", orderId) => {
        const pts = Math.floor(amountBRL * RATE);
        if (pts <= 0) return;
        const entry: PointsEntry = {
          id: crypto.randomUUID(),
          amount: pts,
          description,
          date: new Date().toISOString(),
        };
        set((s) => ({
          points: s.points + pts,
          history: [entry, ...s.history].slice(0, 100),
        }));
        gizApi().then(({ dbEarnPoints }) =>
          dbEarnPoints(amountBRL, description, orderId)
        ).catch(() => null);
      },

      spend: (points, description = "Resgate de pontos", orderId) => {
        if (get().points < points) return false;
        const entry: PointsEntry = {
          id: crypto.randomUUID(),
          amount: -points,
          description,
          date: new Date().toISOString(),
        };
        set((s) => ({
          points: s.points - points,
          history: [entry, ...s.history].slice(0, 100),
        }));
        gizApi().then(({ dbSpendPoints }) =>
          dbSpendPoints(points, description, orderId)
        ).catch(() => null);
        return true;
      },

      loadFromDB: async () => {
        try {
          const { getMyPoints } = await gizApi();
          const { balance, transactions } = await getMyPoints();
          set({
            points: balance,
            history: transactions.map((t) => ({
              id: t.id,
              amount: t.amount,
              description: t.description,
              date: t.createdAt,
            })),
            synced: true,
          });
        } catch {
          set({ synced: true });
        }
      },
    }),
    { name: "brasux-points" }
  )
);
