import { useState, useRef, useCallback } from "react";
import { Search, Upload, Link as LinkIcon, X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { searchImageCatalog, uploadProductImage, GIZ_API_URL, type CatalogImage } from "../../services/gizApi";
import { useDebounce } from "../../hooks/useDebounce";

type Mode = "catalog" | "upload" | "url";

interface Props {
  storeId: string;
  value: string;
  onChange: (url: string, alt?: string) => void;
  onClose: () => void;
}

export default function ImagePicker({ storeId, value, onChange, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("catalog");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<CatalogImage[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState(value || "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selected, setSelected] = useState(value);
  const fileRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebounce(search, 400);

  const fetchCatalog = useCallback(async (q: string, p: number) => {
    if (!GIZ_API_URL) {
      setCatalogError("VITE_API_URL não configurada. Configure o endereço da api-gizapp.");
      setResults([]);
      return;
    }
    setLoading(true);
    setCatalogError(null);
    try {
      const data = await searchImageCatalog({ search: q || undefined, page: p, pageSize: 24 });
      setResults(data.products);
      setTotalPages(data.totalPages);
    } catch {
      setCatalogError("Banco de imagens indisponível. Verifique se a ImageAPI está rodando.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Dispara busca quando debounce ou página mudam
  useState(() => { fetchCatalog(debouncedSearch, page); });
  const prevSearch = useRef(debouncedSearch);
  const prevPage = useRef(page);
  if (prevSearch.current !== debouncedSearch) { prevSearch.current = debouncedSearch; fetchCatalog(debouncedSearch, 1); setPage(1); }
  if (prevPage.current !== page && prevSearch.current === debouncedSearch) { prevPage.current = page; fetchCatalog(debouncedSearch, page); }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadProductImage(file, storeId);
      setSelected(url);
      onChange(url, file.name.replace(/\.[^.]+$/, ""));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  function confirmUrl() {
    const url = urlInput.trim();
    if (!url) return;
    setSelected(url);
    onChange(url);
  }

  function selectCatalogImage(img: CatalogImage) {
    setSelected(img.imageUrl);
    onChange(img.imageUrl, img.name);
  }

  const tabCls = (m: Mode) =>
    `flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition-colors ${
      mode === m ? "bg-[#0f172a] text-white" : "text-[#64748b] hover:bg-[#f1f5f9]"
    }`;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative z-10 flex w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#f1f5f9] p-5">
          <h2 className="text-lg font-black text-[#0f172a]">Escolher imagem</h2>
          <button onClick={onClose} className="rounded-xl bg-[#f1f5f9] p-2 text-[#64748b] hover:bg-[#e2e8f0]">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-[#f1f5f9] px-5 pb-3 pt-3">
          <button className={tabCls("catalog")} onClick={() => setMode("catalog")}>
            <Search size={14} /> Banco BrasUX
          </button>
          <button className={tabCls("upload")} onClick={() => setMode("upload")}>
            <Upload size={14} /> Minha imagem
          </button>
          <button className={tabCls("url")} onClick={() => setMode("url")}>
            <LinkIcon size={14} /> URL
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── CATALOG ── */}
          {mode === "catalog" && (
            <div className="space-y-4">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto, marca, categoria…"
                className="w-full rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#16a34a]/30"
              />
              {catalogError ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  {catalogError}
                </div>
              ) : loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={28} className="animate-spin text-[#16a34a]" />
                </div>
              ) : results.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#94a3b8]">Nenhuma imagem encontrada.</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                    {results.map((img) => (
                      <button
                        key={img.id}
                        onClick={() => selectCatalogImage(img)}
                        className={`group relative overflow-hidden rounded-2xl border-2 transition-all ${
                          selected === img.imageUrl
                            ? "border-[#16a34a] ring-2 ring-[#16a34a]/30"
                            : "border-[#e2e8f0] hover:border-[#16a34a]/50"
                        }`}
                      >
                        <div
                          className="flex aspect-square items-center justify-center p-2"
                          style={{ background: img.thumbHue ? `${img.thumbHue}22` : "#f8fafc" }}
                        >
                          <img
                            src={img.imageUrl}
                            alt={img.name}
                            className="h-full w-full object-contain"
                            loading="lazy"
                          />
                        </div>
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <p className="line-clamp-2 text-[9px] font-bold leading-tight text-white">{img.name}</p>
                        </div>
                        {selected === img.imageUrl && (
                          <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#16a34a]">
                            <span className="text-[10px] text-white">✓</span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 pt-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="rounded-xl border border-[#e2e8f0] p-2 disabled:opacity-40"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-sm font-bold text-[#64748b]">
                        {page} / {totalPages}
                      </span>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="rounded-xl border border-[#e2e8f0] p-2 disabled:opacity-40"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── UPLOAD ── */}
          {mode === "upload" && (
            <div className="space-y-4">
              <div
                className="flex cursor-pointer flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-[#e2e8f0] bg-[#f8fafc] p-12 transition-colors hover:border-[#16a34a]/50 hover:bg-[#f0fdf4]"
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 size={40} className="animate-spin text-[#16a34a]" />
                ) : (
                  <Upload size={40} className="text-[#94a3b8]" />
                )}
                <div className="text-center">
                  <p className="font-black text-[#0f172a]">{uploading ? "Enviando…" : "Clique para selecionar"}</p>
                  <p className="mt-1 text-sm text-[#94a3b8]">JPG, PNG, WebP ou GIF • até 5 MB</p>
                </div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              {uploadError && (
                <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                  {uploadError}
                </p>
              )}
              {selected && mode === "upload" && (
                <div className="flex items-center gap-3 rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] p-3">
                  <img src={selected} alt="preview" className="h-14 w-14 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#16a34a]">Upload concluído!</p>
                    <p className="truncate text-[10px] text-[#64748b]">{selected}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── URL ── */}
          {mode === "url" && (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-wide text-[#64748b]">
                  URL da imagem
                </label>
                <input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://exemplo.com/imagem.jpg"
                  className="w-full rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#16a34a]/30"
                />
              </div>
              {urlInput && (
                <div className="flex items-center gap-4 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
                  <img
                    src={urlInput}
                    alt="preview"
                    className="h-20 w-20 rounded-xl object-contain bg-white"
                    onError={(e) => { e.currentTarget.src = "/placeholder.png"; }}
                  />
                  <p className="truncate text-xs text-[#64748b]">{urlInput}</p>
                </div>
              )}
              <button
                onClick={confirmUrl}
                disabled={!urlInput.trim()}
                className="w-full rounded-2xl py-3 text-sm font-black text-white disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
              >
                Usar esta URL
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {selected && mode !== "url" && (
          <div className="flex items-center gap-3 border-t border-[#f1f5f9] p-4">
            <img src={selected} alt="selecionada" className="h-12 w-12 rounded-xl object-contain bg-[#f8fafc]" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#16a34a]">Imagem selecionada</p>
              <p className="truncate text-[10px] text-[#94a3b8]">{selected}</p>
            </div>
            <button
              onClick={() => { onChange(selected); onClose(); }}
              className="rounded-2xl px-6 py-2.5 text-sm font-black text-white"
              style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
            >
              Confirmar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
