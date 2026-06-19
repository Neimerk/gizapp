import { Link } from "react-router-dom";

import { type StoreProduct } from "../../services/gizApi";
import { formatBRL } from "../../utils/format";
import ProductImage from "../ui/ProductImage";

interface Props {
  product: StoreProduct;
}

export default function ProductCard({ product }: Props) {
  return (
    <Link
      to={`/lojas/${product.storeId}/produto/${product.id}`}
      className="card-hover group flex flex-col overflow-hidden rounded-3xl bg-white"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <div className="product-img-bg flex h-40 items-center justify-center p-3">
        <ProductImage
          imageUrl={product.imageUrl}
          alt={product.imageAlt || product.name}
          category={product.category}
          containerClassName="h-32 w-full rounded-2xl"
          className="h-32 w-full object-contain transition-transform group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">
          {product.category}
        </p>
        <h3 className="mt-1 flex-1 text-sm font-black leading-tight text-[#0f172a] line-clamp-2">
          {product.name}
        </h3>
        <div className="mt-3">
          {product.promotionalPrice ? (
            <>
              <p className="text-[10px] font-bold text-[#94a3b8] line-through">
                {formatBRL(Number(product.price))}
              </p>
              <p className="text-base font-black text-[#16a34a]">
                {formatBRL(Number(product.promotionalPrice))}
              </p>
            </>
          ) : (
            <p className="text-base font-black text-[#16a34a]">
              {formatBRL(Number(product.price))}
            </p>
          )}
        </div>
        <div
          className="mt-3 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black text-white transition-all group-hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)" }}
        >
          Ver produto
        </div>
      </div>
    </Link>
  );
}
