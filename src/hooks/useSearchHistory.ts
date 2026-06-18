import { useState, useCallback } from "react";

const KEY = "brasux-search-history";
const MAX = 6;

function load(): string[] {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(d) ? d.filter((s: unknown) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>(load);

  const add = useCallback((term: string) => {
    const t = term.trim();
    if (!t) return;
    setHistory((prev) => {
      const next = [t, ...prev.filter((h) => h !== t)].slice(0, MAX);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const remove = useCallback((term: string) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h !== term);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(KEY);
    setHistory([]);
  }, []);

  return { history, add, remove, clear };
}
