import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getProductReviews,
  getMyReview,
  upsertReview,
  deleteReview,
  queryKeys,
  type Review,
} from "../services/gizApi";
import { useAuthStore } from "../stores/authStore";

export type { Review };

export type ReviewStats = {
  total: number;
  average: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

function calcStats(reviews: Review[]): ReviewStats {
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach((r) => dist[r.stars]++);
  const total = reviews.length;
  const average = total > 0 ? reviews.reduce((s, r) => s + r.stars, 0) / total : 0;
  return { total, average, distribution: dist as ReviewStats["distribution"] };
}

export function useProductReviews(storeProductId: string) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [editStars, setEditStars] = useState(0);
  const [editComment, setEditComment] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const { data: allReviews = [] } = useQuery({
    queryKey: queryKeys.productReviews(storeProductId),
    queryFn: () => getProductReviews(storeProductId),
    staleTime: 60_000,
  });

  const { data: myReview = null } = useQuery({
    queryKey: queryKeys.myReview(storeProductId),
    queryFn: () => getMyReview(storeProductId),
    enabled: !!user,
    staleTime: 60_000,
  });

  const stats = calcStats(allReviews);

  const submitMutation = useMutation({
    mutationFn: ({ stars, comment }: { stars: number; comment?: string }) =>
      upsertReview(storeProductId, stars, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.productReviews(storeProductId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myReview(storeProductId) });
      setIsEditing(false);
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => deleteReview(storeProductId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.productReviews(storeProductId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myReview(storeProductId) });
      setEditStars(0);
      setEditComment("");
    },
  });

  const startEdit = useCallback(() => {
    setEditStars(myReview?.stars ?? 0);
    setEditComment(myReview?.comment ?? "");
    setIsEditing(true);
  }, [myReview]);

  const cancelEdit = useCallback(() => setIsEditing(false), []);

  const submit = useCallback(
    (stars: number, comment?: string) => submitMutation.mutate({ stars, comment }),
    [submitMutation]
  );

  const remove = useCallback(() => removeMutation.mutate(), [removeMutation]);

  return {
    allReviews,
    myReview,
    stats,
    isEditing,
    editStars,
    editComment,
    setEditStars,
    setEditComment,
    startEdit,
    cancelEdit,
    submit,
    remove,
    submitting: submitMutation.isPending,
    removing: removeMutation.isPending,
    error: submitMutation.error?.message ?? removeMutation.error?.message ?? null,
  };
}
