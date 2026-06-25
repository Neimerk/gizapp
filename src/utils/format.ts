export function formatBRL(value: number): string {
  return `R$ ${Number(value).toFixed(2).replace(".", ",")}`;
}

const digits = (v: string) => v.replace(/\D/g, "");

export function fmtCPF(v: string): string {
  return digits(v).slice(0, 11)
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

export function fmtCNPJ(v: string): string {
  return digits(v).slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

export function validateCPF(cpf: string): boolean {
  const n = digits(cpf);
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  const calc = (len: number) => {
    const sum = Array.from({ length: len }, (_, i) => Number(n[i]) * (len + 1 - i)).reduce((a, b) => a + b, 0);
    const rem = (sum * 10) % 11;
    return rem === 10 ? 0 : rem;
  };
  return calc(9) === Number(n[9]) && calc(10) === Number(n[10]);
}

export function validateCNPJ(cnpj: string): boolean {
  const n = digits(cnpj);
  if (n.length !== 14 || /^(\d)\1{13}$/.test(n)) return false;
  const calc = (len: number, weights: number[]) => {
    const sum = Array.from({ length: len }, (_, i) => Number(n[i]) * weights[i]).reduce((a, b) => a + b, 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return calc(12, w1) === Number(n[12]) && calc(13, w2) === Number(n[13]);
}
