import {
  getProductImageUrl,
  type StoreProduct,
} from "../../services/gizApi";

import AddToCartButton from "./AddToCartButton";

interface Props {
  product: StoreProduct;
}

export default function ProductCard({ product }: Props) {
  return (
    <div className="overflow-hidden rounded-[28px] bg-white shadow-lg shadow-[#dbe2ef]">
      <div className="flex h-40 items-center justify-center bg-[#f8fafc]">
        <img
          src={getProductImageUrl(product.imageUrl)}
          alt={product.imageAlt || product.name}
          className="h-32 w-full object-contain"
        />
      </div>

      <div className="p-4">
        <h3 className="line-clamp-2 text-base font-black text-[#111827]">
          {product.name}
        </h3>

        <p className="mt-1 line-clamp-2 text-sm text-[#64748b]">
          {product.description}
        </p>

        <div className="mt-4">
          {product.promotionalPrice ? (
            <>
              <p className="text-xs font-bold text-[#94a3b8] line-through">
                R$ {Number(product.price).toFixed(2).replace(".", ",")}
              </p>

              <p className="text-lg font-black text-[#16a34a]">
                R$ {Number(product.promotionalPrice).toFixed(2).replace(".", ",")}
              </p>
            </>
          ) : (
            <p className="text-lg font-black text-[#16a34a]">
              R$ {Number(product.price).toFixed(2).replace(".", ",")}
            </p>
          )}
        </div>

        <AddToCartButton product={product} />
      </div>
    </div>
  );
}