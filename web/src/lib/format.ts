/** Formato numerico consistente (es-PE): miles con punto, decimales con coma. */
const NF = new Intl.NumberFormat('es-PE');
const NF1 = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 });

export const n = (v: number): string => NF.format(v);
export const n1 = (v: number): string => NF1.format(v);
export const pct = (v: number): string => `${NF1.format(v)}%`;

/** Compacta numeros grandes: 1269879 -> "1,27 M". Para titulares. */
export function compact(v: number): string {
  if (v >= 1_000_000) return `${NF1.format(v / 1_000_000)} M`;
  if (v >= 10_000) return `${NF1.format(v / 1_000)} k`;
  return NF.format(v);
}
