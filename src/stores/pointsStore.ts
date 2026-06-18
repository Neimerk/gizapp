import { create } from "zustand";
import { persist } from "zustand/middleware";

const RATE = 1; // 1 ponto por R$ 1,00 gasto

export type PointsEntry = {
  id: string;
  amount: number;
  description: string;
  date: string;
};

type PointsState = {
  points: number;
  history: PointsEntry[];
  earn: (amountBRL: number, description?: string) => void;
  spend: (points: number, description?: string) => boolean;
};

export const usePointsStore = create<PointsState>()(
  persist(
    (set, get) => ({
      points: 0,
      history: [],

      earn: (amountBRL, description = "Compra concluída") => {
        const pts = Math.floor(amountBRL * RATE);
        if (pts <= 0) return;
        set((s) => ({
          points: s.points + pts,
          history: [
            {
              id: crypto.randomUUID(),
              amount: pts,
              description,
              date: new Date().toISOString(),
            },
            ...s.history,
          ].slice(0, 100),
        }));
      },

      spend: (points, description = "Resgate de pontos") => {
        if (get().points < points) return false;
        set((s) => ({
          points: s.points - points,
          history: [
            {
              id: crypto.randomUUID(),
              amount: -points,
              description,
              date: new Date().toISOString(),
            },
            ...s.history,
          ].slice(0, 100),
        }));
        return true;
      },
    }),
    { name: "brasux-points" }
  )
);
