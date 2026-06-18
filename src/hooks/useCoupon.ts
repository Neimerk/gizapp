import { useState, useCallback } from "react";

export type CouponType = "percent" | "fixed" | "free_delivery";

export type Coupon = {
  code: string;
  type: CouponType;
  value: number;
  label: string;
};

const COUPONS: Record<string, Coupon> = {
  BRASUX10: { code: "BRASUX10", type: "percent", value: 10, label: "10% de desconto" },
  BRASUX20: { code: "BRASUX20", type: "percent", value: 20, label: "20% de desconto" },
  FRETE0: { code: "FRETE0", type: "free_delivery", value: 100, label: "Frete grátis" },
  WELCOME: { code: "WELCOME", type: "fixed", value: 15, label: "R$ 15,00 de desconto" },
};

const KEY = "brasux-coupon";

function loadCoupon(): Coupon | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}

export function useCoupon() {
  const [coupon, setCoupon] = useState<Coupon | null>(loadCoupon);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((code: string): boolean => {
    const found = COUPONS[code.toUpperCase().trim()];
    if (!found) {
      setError("Cupom inválido ou expirado.");
      return false;
    }
    setCoupon(found);
    setError(null);
    localStorage.setItem(KEY, JSON.stringify(found));
    return true;
  }, []);

  const remove = useCallback(() => {
    setCoupon(null);
    setError(null);
    localStorage.removeItem(KEY);
  }, []);

  function discount(subtotal: number, deliveryFee: number): number {
    if (!coupon) return 0;
    if (coupon.type === "percent") return (subtotal * coupon.value) / 100;
    if (coupon.type === "fixed") return Math.min(coupon.value, subtotal);
    if (coupon.type === "free_delivery") return deliveryFee;
    return 0;
  }

  return { coupon, error, apply, remove, discount };
}
