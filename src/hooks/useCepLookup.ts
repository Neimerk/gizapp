import { useState } from "react";

type CepData = { logradouro: string; bairro: string; localidade: string; uf: string };

const num = (v: string) => v.replace(/\D/g, "");

export function useCepLookup() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup(cep: string): Promise<CepData | null> {
    const digits = num(cep);
    setError(null);
    if (digits.length !== 8) return null;

    setLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!res.ok) throw new Error("Erro ao consultar CEP");
      const data = await res.json();
      if (data.erro) throw new Error("CEP não encontrado");
      return { logradouro: data.logradouro ?? "", bairro: data.bairro ?? "", localidade: data.localidade ?? "", uf: data.uf ?? "" };
    } catch (e) {
      setError(e instanceof Error ? e.message : "CEP não encontrado");
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { lookup, loading, error };
}
