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
      // 1ª tentativa: BrasilAPI v2 (retorna coordenadas)
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`);
        if (res.ok) {
          const d = await res.json();
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
      } catch {
        // BrasilAPI indisponível — segue para ViaCEP
      }

      // 2ª tentativa: ViaCEP (sem coordenadas)
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!res.ok) throw new Error("Erro ao consultar CEP");
      const d = await res.json();
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
