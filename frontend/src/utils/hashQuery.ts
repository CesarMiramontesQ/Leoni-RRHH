/**
 * Lectura del query string de un hash de la SPA (`#/ruta?clave=valor`).
 *
 * Lo usan los deep-links entre módulos — p. ej. los enlaces cruzados del
 * Dashboard de Talento a `#/operaciones?area_id=3` — para que la página destino
 * llegue con el filtro ya aplicado.
 */

/** El hash sin su query string. `#/operaciones?area_id=3` -> `#/operaciones`. */
export function hashSinQuery(hash: string): string {
  const i = hash.indexOf("?");
  return i < 0 ? hash : hash.slice(0, i);
}

/**
 * Parámetro numérico del hash, o `null` si falta o no es un entero positivo.
 * Los ids de este sistema son positivos, así que `0` y negativos se descartan
 * como basura en vez de propagarse a una consulta.
 */
export function hashParamNumero(
  nombre: string,
  hash: string = typeof window !== "undefined" ? window.location.hash : "",
): number | null {
  const i = hash.indexOf("?");
  if (i < 0) return null;
  const crudo = new URLSearchParams(hash.slice(i + 1)).get(nombre);
  if (crudo === null || crudo.trim() === "") return null;
  const n = Number(crudo);
  return Number.isInteger(n) && n > 0 ? n : null;
}
