import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../stores/authStore";
import {
  getMyWithdrawals,
  requestWithdrawal,
  paymentQueryKeys,
} from "../services/paymentApi";
import type { PixKeyType } from "../types/payment";

/** Hook para histórico e solicitação de saques. */
export function useWithdrawals() {
  const user        = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: paymentQueryKeys.myWithdrawals(),
    queryFn:  getMyWithdrawals,
    enabled:  !!user && (user.role === "Seller" || user.role === "Courier"),
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: (params: { amount: number; pixKey: string; pixKeyType: PixKeyType }) =>
      requestWithdrawal({
        walletId:   "",   // resolvido internamente pela edge function via owner
        amount:     params.amount,
        pixKey:     params.pixKey,
        pixKeyType: params.pixKeyType,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentQueryKeys.myWithdrawals() });
      queryClient.invalidateQueries({ queryKey: paymentQueryKeys.myWallet() });
    },
  });

  const pendingTotal = (query.data ?? [])
    .filter((w) => w.status === "pending")
    .reduce((s, w) => s + w.amountGross, 0);

  const paidTotal = (query.data ?? [])
    .filter((w) => w.status === "paid")
    .reduce((s, w) => s + w.amountNet, 0);

  return {
    withdrawals:    query.data ?? [],
    isLoading:      query.isPending,
    isError:        query.isError,
    pendingTotal,
    paidTotal,
    request:        mutation.mutateAsync,
    isRequesting:   mutation.isPending,
    requestError:   mutation.error instanceof Error ? mutation.error.message : null,
  };
}
