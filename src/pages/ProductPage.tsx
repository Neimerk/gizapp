import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRight, Bike, Clock3, Minus, Plus, ShoppingCart, Star, Tag,
} from "lucide-react";

import {
  getStoreById,
  getStoreProducts,
  getProductImageUrl,
  queryKeys,
  type StoreProduct,
} from "../services/gizApi";
import { useCartStore } from "../stores/cartStore";
import { formatBRL } from "../utils/format";
import ProductImage from "../components/ui/ProductImage";
import StoreLogo from "../components/ui/StoreLogo";

export default function ProductPage() {
  const { storeId = "", productId = "" } = useParams<{ storeId: string; productId: string }>();

  const { data: store } = useQuery({
    queryKey: queryKeys.store(storeId),
    queryFn: () => getStoreById(storeId),
    enabled: !!storeId,
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: queryKeys.storeProducts(storeId),
    queryFn: () => getStoreProducts({ storeId }),
    enabled: !!storeId,
  });

  const product = useMemo(() => products.find((p) => p.id === productId), [products, productId]);

  const related = useMemo(
    () => products.filter((p) => p.id !== productId && p.category === product?.category).slice(0, 4),
    [products, productId, product]
  );

  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const increaseItem = useCartStore((s) => s.increaseItem);
  const decreaseItem = useCartStore((s) => s.decreaseItem);

  const cartItem = items.find((i) => i.id === productId);

  function handleAdd() {
    if (!product) return;
    addItem({
      id: product.id,
      storeProductId: product.id,
      productId: product.productId,
      storeId: product.storeId,
      name: product.name,
      description: product.description ?? "",
      price: Number(product.price),
      promotionalPrice: product.promotionalPrice,
      image: getProductImageUrl(product.imageUrl),
      stock: product.stock,
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-10 animate-pulse rounded-xl bg-white" />
        <div className="h-80 animate-pulse rounded-3xl bg-white shadow-sm" />
        <div className="h-48 animate-pulse rounded-3xl bg-white shadow-sm" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
        <p className="font-black text-red-500">Produto não encontrado.</p>
        <Link
          to={`/lojas/${storeId}`}
          className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#16a34a]"
        >
          <ArrowLeft size={15} /> Voltar para a loja
        </Link>
      </div>
    );
  }

  const deliveryFeeText =
    store && Number(store.deliveryFee) === 0
      ? "Grátis"
      : store
      ? formatBRL(Number(store.deliveryFee))
      : "—";

  const discountPct =
    product.promotionalPrice
      ? Math.round((1 - Number(product.promotionalPrice) / Number(product.price)) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        to={`/lojas/${storeId}`}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white text-[#64748b] transition-colors hover:border-[#16a34a]/40 hover:text-[#16a34a]"
      >
        <ArrowLeft size={17} />
      </Link>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Image */}
        <div
          className="flex min-h-[280px] items-center justify-center rounded-3xl bg-white p-8 shadow-sm"
          style={{ background: "linear-gradient(135deg, #f8fafc, #f1f5f9)" }}
        >
          <ProductImage
            imageUrl={product.imageUrl}
            alt={product.imageAlt || product.name}
            category={product.category}
            containerClassName="h-64 w-full"
            className="h-64 w-full object-contain"
          />
        </div>

        {/* Info */}
        <div className="flex flex-col gap-4">
          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-[#f1f5f9] px-3 py-1 text-[11px] font-bold text-[#475569]">
              {product.category}
            </span>
            {product.brand && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#e2e8f0] bg-white px-3 py-1 text-[11px] font-bold text-[#64748b]">
                <Tag size={10} /> {product.brand}
              </span>
            )}
            {product.subCategory && (
              <span className="rounded-full bg-[#f1f5f9] px-3 py-1 text-[11px] font-bold text-[#475569]">
                {product.subCategory}
              </span>
            )}
          </div>

          {/* Name */}
          <h1 className="text-3xl font-black leading-tight text-[#0f172a]">{product.name}</h1>

          {/* Price */}
          <div className="rounded-2xl border border-[#e8eaf0] bg-white p-4">
            {product.promotionalPrice ? (
              <div className="flex flex-wrap items-end gap-3">
                <span className="text-4xl font-black text-[#16a34a]">
                  {formatBRL(Number(product.promotionalPrice))}
                </span>
                <span className="mb-1 text-base font-bold text-[#94a3b8] line-through">
                  {formatBRL(Number(product.price))}
                </span>
                <span className="mb-1 rounded-full bg-[#16a34a]/10 px-2.5 py-0.5 text-xs font-black text-[#16a34a]">
                  {discountPct}% off
                </span>
              </div>
            ) : (
              <span className="text-4xl font-black text-[#16a34a]">
                {formatBRL(Number(product.price))}
              </span>
            )}
          </div>

          {/* Stock badge */}
          <div>
            {product.stock <= 0 ? (
              <span className="rounded-full bg-[#fef2f2] px-3 py-1.5 text-xs font-black text-red-500">
                Sem estoque
              </span>
            ) : product.stock <= 5 ? (
              <span className="rounded-full bg-[#fffbeb] px-3 py-1.5 text-xs font-black text-[#b45309]">
                Últimas {product.stock} unidades
              </span>
            ) : (
              <span className="rounded-full bg-[#f0fdf4] px-3 py-1.5 text-xs font-black text-[#16a34a]">
                Em estoque
              </span>
            )}
          </div>

          {/* Add to cart */}
          {product.stock > 0 &&
            (!cartItem ? (
              <button
                onClick={handleAdd}
                className="flex items-center justify-center gap-2 rounded-2xl py-4 text-base font-black text-white transition-all hover:opacity-90 active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #16a34a, #15803d)",
                  boxShadow: "0 8px 24px rgba(22,163,74,0.35)",
                }}
              >
                <ShoppingCart size={18} /> Adicionar ao carrinho
              </button>
            ) : (
              <div className="flex items-center justify-between rounded-2xl bg-[#0f172a] px-5 py-3">
                <button
                  onClick={() => decreaseItem(productId)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20"
                >
                  <Minus size={16} />
                </button>
                <span className="text-base font-black text-white">
                  {cartItem.quantity} no carrinho
                </span>
                <button
                  onClick={() => increaseItem(productId)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-white hover:bg-white/30"
                >
                  <Plus size={16} />
                </button>
              </div>
            ))}

          {/* Description */}
          {product.description && (
            <div className="rounded-2xl border border-[#e8eaf0] bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Descrição</p>
              <p className="mt-2 text-sm leading-relaxed text-[#475569]">{product.description}</p>
            </div>
          )}

          {/* Store card */}
          {store && (
            <Link
              to={`/lojas/${storeId}`}
              className="flex items-center gap-4 rounded-2xl border border-[#e8eaf0] bg-white p-4 transition-all hover:border-[#16a34a]/30 hover:shadow-sm"
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-sm font-black text-white"
                style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
              >
                <StoreLogo logoUrl={store.logoUrl} name={store.name} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Vendido por</p>
                <p className="truncate font-black text-[#0f172a]">{store.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-[#64748b]">
                  <span className="flex items-center gap-1">
                    <Clock3 size={10} /> {store.deliveryTimeMin}–{store.deliveryTimeMax}min
                  </span>
                  <span className="flex items-center gap-1">
                    <Bike size={10} /> {deliveryFeeText}
                  </span>
                  <span className="flex items-center gap-1">
                    <Star size={10} /> {Number(store.rating).toFixed(1)}
                  </span>
                </div>
              </div>
              <ArrowRight size={16} className="shrink-0 text-[#94a3b8]" />
            </Link>
          )}
        </div>
      </div>

      {/* Related products */}
      {related.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-black text-[#0f172a]">Mais desta categoria</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <RelatedCard key={p.id} product={p} storeId={storeId} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RelatedCard({ product, storeId }: { product: StoreProduct; storeId: string }) {
  return (
    <Link
      to={`/lojas/${storeId}/produto/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-3xl border border-[#e8eaf0] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex h-36 items-center justify-center overflow-hidden bg-[#f8fafc] p-4">
        <ProductImage
          imageUrl={product.imageUrl}
          alt={product.imageAlt || product.name}
          category={product.category}
          containerClassName="h-28 w-full rounded-xl"
          className="h-28 w-full object-contain transition-transform group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h3 className="flex-1 text-xs font-black leading-tight text-[#0f172a] line-clamp-2">
          {product.name}
        </h3>
        <p className="mt-2 text-sm font-black text-[#16a34a]">
          {formatBRL(Number(product.promotionalPrice ?? product.price))}
        </p>
      </div>
    </Link>
  );
}
