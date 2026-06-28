import { useState } from "react";

export type CepResult = {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  lat: number | null;
  lng: number | null;
};

const num = (v: string) => v.replace(/\D/g, "");

export function useCepLookup() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup(cep: string): Promise<CepResult | null> {
    const digits = num(cep);
    setError(null);
    if (digits.length !== 8) return null;

    setLoading(true);
    try {
      // BrasilAPI v2 — retorna coordenadas diretamente
      const brasilRes = await fetch(
        `https://brasilapi.com.br/api/cep/v2/${digits}`,
      );
      if (brasilRes.ok) {
        const d = await brasilRes.json();
        if (!d.errors && d.city) {
          const coords = d.location?.coordinates;
          return {
            logradouro: d.street ?? "",
            bairro: d.neighborhood ?? "",
            localidade: d.city ?? "",
            uf: d.state ?? "",
            lat: coords?.latitude ? parseFloat(coords.latitude) : null,
            lng: coords?.longitude ? parseFloat(coords.longitude) : null,
          };
        }
      }

      // Fallback: ViaCEP (sem coordenadas)
      const viaRes = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!viaRes.ok) throw new Error("Erro ao consultar CEP");
      const d = await viaRes.json();
      if (d.erro) throw new Error("CEP não encontrado");
      return {
        logradouro: d.logradouro ?? "",
        bairro: d.bairro ?? "",
        localidade: d.localidade ?? "",
        uf: d.uf ?? "",
        lat: null,
        lng: null,
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : "CEP não encontrado");
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { lookup, loading, error };
}
