import { useState, useCallback } from "react";

export type ProductReview = {
  productId: string;
  stars: number;
  comment?: string;
  date: string;
};

const KEY = "brasux-product-reviews";

function loadAll(): Record<string, ProductReview> {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return typeof d === "object" && d !== null ? d : {};
  } catch {
    return {};
  }
}

function persistAll(data: Record<string, ProductReview>) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function getProductReview(productId: string): ProductReview | null {
  return loadAll()[productId] ?? null;
}

export function useProductReviews(productId: string) {
  const [review, setReview] = useState<ProductReview | null>(() => getProductReview(productId));

  const submit = useCallback(
    (stars: number, comment?: string) => {
      const newReview: ProductReview = {
        productId,
        stars,
        comment: comment?.trim() || undefined,
        date: new Date().toISOString(),
      };
      setReview(newReview);
      const all = loadAll();
      all[productId] = newReview;
      persistAll(all);
    },
    [productId]
  );

  const remove = useCallback(() => {
    setReview(null);
    const all = loadAll();
    delete all[productId];
    persistAll(all);
  }, [productId]);

  return { review, submit, remove };
}
