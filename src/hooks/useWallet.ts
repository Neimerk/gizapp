import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../stores/authStore";
import {
  getMyWallet,
  getWalletStatement,
  getMySubscription,
  paymentQueryKeys,
} from "../services/paymentApi";

/** Hook principal da carteira do usuário logado. */
export function useMyWallet() {
  const user = useAuthStore((s) => s.user);

  const walletQuery = useQuery({
    queryKey: paymentQueryKeys.myWallet(),
    queryFn:  getMyWallet,
    enabled:  !!user && (user.role === "Seller" || user.role === "Courier"),
    staleTime: 30_000,
    refetchInterval: 60_000,  // polling leve — saldo pode mudar por delivery
  });

  const statementQuery = useQuery({
    queryKey: paymentQueryKeys.walletStatement(walletQuery.data?.id ?? ""),
    queryFn:  () => getWalletStatement(walletQuery.data!.id),
    enabled:  !!walletQuery.data?.id,
    staleTime: 30_000,
  });

  return {
    wallet:       walletQuery.data ?? null,
    statement:    statementQuery.data ?? [],
    isLoading:    walletQuery.isPending || statementQuery.isPending,
    isError:      walletQuery.isError,
    refetch:      walletQuery.refetch,
  };
}

/** Hook para o plano de assinatura do vendedor. */
export function useMySubscription() {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: paymentQueryKeys.mySubscription(),
    queryFn:  getMySubscription,
    enabled:  !!user && user.role === "Seller",
    staleTime: 5 * 60_000,
  });
}
