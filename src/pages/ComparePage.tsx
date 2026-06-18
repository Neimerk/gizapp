import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, GitCompareArrows, ShoppingCart } from "lucide-react";
import { useCompareStore, type CompareProduct } from "../stores/compareStore";
import { getProductImageUrl } from "../services/gizApi";
import { useCartStore } from "../stores/cartStore";
import { formatBRL } from "../utils/format";

type Row = { label: string; key: keyof CompareProduct | "finalPrice" | "actions" };

const ROWS: Row[] = [
  { label: "Imagem", key: "imageUrl" },
  { label: "Preço", key: "finalPrice" },
  { label: "Estoque", key: "stock" },
  { label: "Categoria", key: "category" },
  { label: "Marca", key: "brand" },
  { label: "Descrição", key: "description" },
  { label: "", key: "actions" },
];

export default function ComparePage() {
  const navigate = useNavigate();
  const products = useCompareStore((s) => s.products);
  const remove = useCompareStore((s) => s.remove);
  const addItem = useCartStore((s) => s.addItem);

  if (products.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-[#f1f5f9]">
          <GitCompareArrows size={40} className="text-[#94a3b8]" />
        </div>
        <h2 className="mt-6 text-xl font-black text-[#0f172a]">Selecione produtos para comparar</h2>
        <p className="mt-2 text-sm text-[#64748b]">
          Toque em "Comparar" nos cards de produto para adicionar.
        </p>
        <Link
          to="/buscar"
          className="mt-6 rounded-2xl bg-[#16a34a] px-6 py-3 text-sm font-black text-white"
        >
          Explorar produtos
        </Link>
      </div>
    );
  }

  function handleAddToCart(p: CompareProduct) {
    addItem({
      id: p.id,
      storeProductId: p.id,
      storeId: p.storeId,
      name: p.name,
      price: p.price,
      promotionalPrice: p.promotionalPrice,
      image: getProductImageUrl(p.imageUrl),
      stock: p.stock,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f172a]"
        >
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#16a34a]">BrasUX</p>
          <h1 className="text-xl font-black text-[#0f172a]">Comparar produtos</h1>
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-[#e8eaf0] bg-white shadow-sm">
        <table className="w-full min-w-[480px]">
          <thead>
            <tr className="border-b border-[#f1f5f9]">
              <th className="w-28 py-4 pl-4 text-left text-[10px] font-black uppercase tracking-widest text-[#94a3b8]" />
              {products.map((p) => (
                <th key={p.id} className="px-4 py-4 text-left">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/lojas/${p.storeId}/produto/${p.id}`}
                      className="text-sm font-black leading-tight text-[#0f172a] hover:text-[#16a34a] line-clamp-2"
                    >
                      {p.name}
                    </Link>
                    <button
                      onClick={() => remove(p.id)}
                      className="shrink-0 text-[#cbd5e1] hover:text-red-500 text-lg leading-none"
                    >
                      ×
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.key} className="border-b border-[#f8fafc] last:border-0">
                {row.key !== "actions" && row.key !== "imageUrl" && (
                  <td className="py-3 pl-4 pr-2 text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
                    {row.label}
                  </td>
                )}
                {row.key === "imageUrl" && <td className="py-3 pl-4 pr-2" />}
                {row.key === "actions" && <td className="py-3 pl-4 pr-2" />}

                {products.map((p) => {
                  if (row.key === "imageUrl") {
                    return (
                      <td key={p.id} className="px-4 py-3">
                        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-[#f8fafc]">
                          {p.imageUrl ? (
                            <img
                              src={getProductImageUrl(p.imageUrl)}
                              alt={p.name}
                              className="h-20 w-20 object-contain"
                            />
                          ) : (
                            <span className="text-3xl">🛍️</span>
                          )}
                        </div>
                      </td>
                    );
                  }

                  if (row.key === "finalPrice") {
                    const final = p.promotionalPrice ?? p.price;
                    const prices = products.map((x) => Number(x.promotionalPrice ?? x.price));
                    const isCheapest = Number(final) === Math.min(...prices);
                    return (
                      <td key={p.id} className="px-4 py-3">
                        {p.promotionalPrice && (
                          <p className="text-[10px] text-[#94a3b8] line-through">
                            {formatBRL(Number(p.price))}
                          </p>
                        )}
                        <p
                          className={`text-base font-black ${
                            isCheapest ? "text-[#16a34a]" : "text-[#0f172a]"
                          }`}
                        >
                          {formatBRL(Number(final))}
                          {isCheapest && products.length > 1 && (
                            <span className="ml-1 text-[10px] font-black text-[#16a34a]">✓ melhor</span>
                          )}
                        </p>
                      </td>
                    );
                  }

                  if (row.key === "stock") {
                    return (
                      <td key={p.id} className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                            p.stock <= 0
                              ? "bg-red-100 text-red-600"
                              : p.stock <= 5
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {p.stock <= 0 ? "Sem estoque" : `${p.stock} un.`}
                        </span>
                      </td>
                    );
                  }

                  if (row.key === "actions") {
                    return (
                      <td key={p.id} className="px-4 py-4">
                        <button
                          onClick={() => handleAddToCart(p)}
                          disabled={p.stock <= 0}
                          className="flex items-center gap-1.5 rounded-xl bg-[#16a34a] px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                        >
                          <ShoppingCart size={13} /> Adicionar
                        </button>
                      </td>
                    );
                  }

                  const value = p[row.key as keyof CompareProduct];
                  return (
                    <td key={p.id} className="px-4 py-3 text-sm text-[#475569]">
                      {value != null && value !== "" ? String(value) : (
                        <span className="text-[#cbd5e1]">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
