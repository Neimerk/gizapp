import { Minus, Plus } from "lucide-react";

import { useCartStore } from "../../stores/cartStore";
import {
  getProductImageUrl,
  type StoreProduct,
} from "../../services/gizApi";

type AddToCartButtonProps = {
  product: StoreProduct;
};

export default function AddToCartButton({ product }: AddToCartButtonProps) {
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const increaseItem = useCartStore((state) => state.increaseItem);
  const decreaseItem = useCartStore((state) => state.decreaseItem);

  const cartItem = items.find((item) => item.id === product.id);

  const finalPrice = Number(product.promotionalPrice ?? product.price ?? 0);

  function handleAdd() {
    addItem({
      id: product.id,
      storeProductId: product.id,
      productId: product.productId,
      storeId: product.storeId,
      name: product.name,
      description: product.description ?? "",
      price: finalPrice,
      promotionalPrice: product.promotionalPrice,
      image: getProductImageUrl(product.imageUrl),
      stock: product.stock,
    });
  }

  if (product.stock <= 0) {
    return (
      <button
        disabled
        className="mt-3 flex w-full items-center justify-center rounded-2xl bg-[#10172a] px-3 py-2 text-xs font-black text-white opacity-50"
      >
        Sem estoque
      </button>
    );
  }

  if (!cartItem) {
    return (
      <button
        onClick={handleAdd}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#10172a] px-3 py-2 text-xs font-black text-white transition-all hover:scale-[1.02]"
      >
        <Plus size={15} />
        Adicionar
      </button>
    );
  }

  return (
    <div className="mt-3 flex w-full items-center justify-between rounded-2xl bg-[#10172a] px-3 py-2 text-white">
      <button
        onClick={() => decreaseItem(product.id)}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10"
      >
        <Minus size={15} />
      </button>

      <span className="text-sm font-black">
        {cartItem.quantity}
      </span>

      <button
        onClick={() => increaseItem(product.id)}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10"
      >
        <Plus size={15} />
      </button>
    </div>
  );
}