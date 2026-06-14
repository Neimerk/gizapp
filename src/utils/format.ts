export function formatBRL(value: number): string {
  return `R$ ${Number(value).toFixed(2).replace(".", ",")}`;
}
