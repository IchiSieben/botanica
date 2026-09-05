/**
 * Paleta de clados "por pigmentos", continuando el sistema visual del
 * prototipo mapa-filogenetico.html. El color por ORDEN (APG) lo fija el ETL
 * en dim_clade -> mart_clade_by_department, asi el color es consistente entre
 * los dashboards (F1) y el futuro mapa filogenetico (F2).
 */
import { getAllClades } from './data';

/** Pigmentos base del prototipo (grado ANA … astéridas). Para leyendas/fallback. */
export const PIGMENTS = [
  '#b9a06a', '#c97f3e', '#e0b53a', '#9bbf6a',
  '#d8567f', '#59ad63', '#9b6fc4', '#76B7B2',
  '#B07AA1', '#9C755F', '#86BCB6', '#D37295',
];

/** Mapa orden_APG -> color, derivado del mart (mismo color que usara F2). */
export function orderColorMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of getAllClades()) {
    if (row.clade && !map[row.clade]) map[row.clade] = row.color;
  }
  return map;
}

/** Color para un orden; cae a un pigmento estable por hash si no esta en el mapa. */
export function colorForOrder(order: string | null, map: Record<string, string>): string {
  if (order && map[order]) return map[order];
  if (!order) return '#566b61';
  let h = 0;
  for (let i = 0; i < order.length; i++) h = (h * 31 + order.charCodeAt(i)) >>> 0;
  return PIGMENTS[h % PIGMENTS.length];
}
