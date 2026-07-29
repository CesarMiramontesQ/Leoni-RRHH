/**
 * Rampa secuencial para ejes **ordinales**.
 *
 * Cuando las columnas de un eje están ordenadas y la posición significa algo
 * —a la derecha pesa más—, el color tiene que ser una rampa. Una paleta de
 * colores sueltos por columna diría que son alternativas equivalentes, que es
 * justo lo contrario.
 *
 * No se inventan valores: se interpola con `color-mix` entre dos tokens que ya
 * están en el sistema (`--color-primary` sobre blanco), así que la rampa se
 * mueve sola si la marca cambia. Es la misma familia navy que la escala de
 * heatmap de capacidades (design.md §12.1), en versión continua.
 *
 * Único uso hoy: el eje de global grades del mapa WTW.
 */

/** Posición normalizada [0, 1]. Con una sola columna, el extremo alto. */
export function progresoOrdinal(indice: number, total: number): number {
  if (total <= 1) return 1;
  const acotado = Math.min(Math.max(indice, 0), total - 1);
  return acotado / (total - 1);
}

/**
 * Tinte de fondo de una columna: sutil, para que sea **fondo** y no figura.
 *
 * Va del 5% al 27% de tinta. Por encima compite con el contenido que se apoya
 * encima; por debajo deja de distinguirse una columna de la siguiente.
 */
export function tinteOrdinalFondo(indice: number, total: number): string {
  const pct = (5 + progresoOrdinal(indice, total) * 22).toFixed(1);
  return `color-mix(in oklab, var(--color-primary) ${pct}%, white)`;
}

/** Umbral de tinta a partir del cual el texto encima tiene que invertirse. */
export const UMBRAL_TEXTO_INVERTIDO = 55;

/**
 * Chip del encabezado: el mismo recorrido saturado, del 14% al 100%.
 *
 * Es donde el color se lee de verdad, así que recorre la rampa completa. El
 * texto se invierte pasado el umbral para que el contraste no dependa de dónde
 * caiga la columna.
 */
export function tinteOrdinalChip(
  indice: number,
  total: number,
): { fondo: string; texto: string } {
  const pct = 14 + progresoOrdinal(indice, total) * 86;
  return {
    fondo: `color-mix(in oklab, var(--color-primary) ${pct.toFixed(1)}%, white)`,
    texto:
      pct >= UMBRAL_TEXTO_INVERTIDO
        ? "#FFFFFF"
        : "var(--color-text-primary, #0A1628)",
  };
}
