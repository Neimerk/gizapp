import { useState } from "react";
import { CheckCircle, ChevronRight, Loader2, MapPin, Navigation, X } from "lucide-react";
import { useCepLookup, type CepResult } from "../../hooks/useCepLookup";
import { geocodeAddress, getBrowserPosition } from "../../utils/geo";
import { useDeliveryAddressStore } from "../../stores/deliveryAddressStore";

type Props = {
  onClose: () => void;
};

function formatCep(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export default function AddressPickerModal({ onClose }: Props) {
  const setAddress = useDeliveryAddressStore((s) => s.setAddress);
  const { lookup, loading: cepLoading, error: cepError } = useCepLookup();

  const [cep, setCep] = useState("");
  const [numero, setNumero] = useState("");
  const [cepData, setCepData] = useState<CepResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  async function handleCepChange(raw: string) {
    const formatted = formatCep(raw);
    setCep(formatted);
    setCepData(null);
    setGeoError(null);
    const digits = formatted.replace(/\D/g, "");
    if (digits.length === 8) {
      const data = await lookup(digits);
      if (data) setCepData(data);
    }
  }

  async function handleConfirm() {
    if (!cepData || confirming) return;
    setConfirming(true);
    setGeoError(null);

    const label =
      [
        cepData.logradouro &&
          `${cepData.logradouro}${numero ? `, ${numero}` : ""}`,
        cepData.bairro,
      ]
        .filter(Boolean)
        .join(" - ") || `${cepData.localidade}/${cepData.uf}`;

    // 1ª opção: coordenadas direto do BrasilAPI (sem Nominatim)
    if (cepData.lat !== null && cepData.lng !== null) {
      setAddress({ label, lat: cepData.lat, lng: cepData.lng });
      setConfirming(false);
      onClose();
      return;
    }

    // 2ª opção: geocoding por endereço completo via Nominatim
    const addressStr = cepData.logradouro
      ? `${cepData.logradouro}${numero ? `, ${numero}` : ""}`
      : "";

    let coords = await geocodeAddress({
      address: addressStr || undefined,
      neighborhood: cepData.bairro || undefined,
      city: cepData.localidade,
      state: cepData.uf,
    });

    // 3ª opção: só cidade + estado
    if (!coords) {
      coords = await geocodeAddress({
        city: cepData.localidade,
        state: cepData.uf,
      });
    }

    setConfirming(false);

    if (coords) {
      setAddress({ label, lat: coords.lat, lng: coords.lng });
      onClose();
    } else {
      setGeoError(
        "Não conseguimos localizar esse endereço. Use o GPS ou tente um CEP diferente.",
      );
    }
  }

  async function handleGps() {
    setGpsLoading(true);
    setGpsError(null);
    try {
      const coords = await getBrowserPosition();
      setAddress({ label: "Localização atual", lat: coords.lat, lng: coords.lng });
      onClose();
    } catch {
      setGpsError("Localização não autorizada. Verifique as permissões do navegador.");
    } finally {
      setGpsLoading(false);
    }
  }

  const digits = cep.replace(/\D/g, "");
  const canConfirm = !!cepData && !confirming;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md rounded-t-3xl bg-surface p-6 shadow-2xl sm:rounded-3xl">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-black text-content">
              Onde você quer receber?
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              Mostramos lojas próximas ao seu endereço
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-line text-muted transition-colors hover:text-content"
          >
            <X size={16} />
          </button>
        </div>

        {/* GPS button */}
        <button
          onClick={handleGps}
          disabled={gpsLoading}
          className="flex w-full items-center gap-3 rounded-2xl border border-line bg-subtle px-4 py-3.5 text-left transition-colors hover:border-[#16a34a]/40 hover:bg-surface disabled:opacity-60"
        >
          {gpsLoading ? (
            <Loader2 size={20} className="shrink-0 animate-spin text-[#16a34a]" />
          ) : (
            <Navigation size={20} className="shrink-0 text-[#16a34a]" />
          )}
          <div className="flex-1">
            <p className="text-sm font-bold text-content">
              {gpsLoading ? "Obtendo localização…" : "Usar minha localização"}
            </p>
            <p className="text-xs text-muted">GPS do dispositivo</p>
          </div>
          {!gpsLoading && <ChevronRight size={16} className="shrink-0 text-faint" />}
        </button>

        {gpsError && (
          <p className="mt-2 text-xs text-red-500">{gpsError}</p>
        )}

        {/* Divider */}
        <div className="relative my-5 flex items-center">
          <div className="h-px flex-1 bg-line" />
          <span className="mx-3 text-xs font-bold text-faint">ou</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        {/* CEP input */}
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[11px] font-black uppercase tracking-widest text-faint">
              CEP
            </label>
            <div className="flex items-center rounded-2xl border border-line bg-subtle px-4 py-3 transition-all focus-within:border-[#16a34a]/50 focus-within:bg-surface">
              <MapPin size={16} className="mr-2 shrink-0 text-faint" />
              <input
                type="text"
                inputMode="numeric"
                placeholder="00000-000"
                value={cep}
                onChange={(e) => handleCepChange(e.target.value)}
                className="flex-1 bg-transparent text-sm font-bold text-content outline-none placeholder:text-faint"
                maxLength={9}
                autoFocus
              />
              {cepLoading && (
                <Loader2 size={15} className="shrink-0 animate-spin text-[#16a34a]" />
              )}
              {cepData && !cepLoading && (
                <CheckCircle size={15} className="shrink-0 text-[#16a34a]" />
              )}
            </div>
            {cepError && digits.length === 8 && (
              <p className="mt-1 text-xs text-red-500">{cepError}</p>
            )}
          </div>

          {/* Address preview */}
          {cepData && (
            <>
              <div className="rounded-2xl border border-[#16a34a]/20 bg-[#16a34a]/5 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#16a34a]">
                  Endereço encontrado
                </p>
                <p className="mt-1 text-sm font-bold text-content">
                  {cepData.logradouro || "Logradouro não informado"}
                  {cepData.bairro ? ` — ${cepData.bairro}` : ""}
                </p>
                <p className="text-xs text-muted">
                  {cepData.localidade} / {cepData.uf}
                </p>
              </div>

              {cepData.logradouro && (
                <div>
                  <label className="mb-1.5 block text-[11px] font-black uppercase tracking-widest text-faint">
                    Número{" "}
                    <span className="font-normal normal-case tracking-normal text-faint">
                      (opcional)
                    </span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Ex: 42"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
                    className="w-full rounded-2xl border border-line bg-subtle px-4 py-3 text-sm font-bold text-content outline-none transition-all placeholder:text-faint focus:border-[#16a34a]/50 focus:bg-surface"
                  />
                </div>
              )}

              <button
                onClick={handleConfirm}
                disabled={!canConfirm}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white transition-all disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                  boxShadow: canConfirm ? "0 4px 16px rgba(22,163,74,0.4)" : "none",
                }}
              >
                {confirming ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Localizando…
                  </>
                ) : (
                  <>
                    <MapPin size={16} />
                    Confirmar endereço
                  </>
                )}
              </button>

              {geoError && (
                <p className="text-center text-xs text-red-500">{geoError}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
