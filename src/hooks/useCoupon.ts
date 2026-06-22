import { useState, useCallback } from "react";
import { validateCoupon, type CouponDB } from "../services/gizApi";

export type { CouponDB as Coupon };

export function useCoupon() {
  const [coupon, setCoupon] = useState<CouponDB | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const apply = useCallback(async (code: string): Promise<boolean> => {
    if (!code.trim()) { setError("Informe um código de cupom."); return false; }
    setApplying(true);
    setError(null);
    try {
      const found = await validateCoupon(code);
      setCoupon(found);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cupom inválido.");
      return false;
    } finally {
      setApplying(false);
    }
  }, []);

  const remove = useCallback(() => {
    setCoupon(null);
    setError(null);
  }, []);

  function discount(subtotal: number, deliveryFee: number): number {
    if (!coupon) return 0;
    if (coupon.type === "percent") return (subtotal * coupon.value) / 100;
    if (coupon.type === "fixed") return Math.min(coupon.value, subtotal);
    if (coupon.type === "free_delivery") return deliveryFee;
    return 0;
  }

  return { coupon, error, applying, apply, remove, discount };
}
