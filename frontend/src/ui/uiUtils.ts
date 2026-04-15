/**
 * Utilidades de presentación puras compartidas por todos los módulos.
 * No importa nada del dominio ni de la app — solo strings.
 */

/** Escapa caracteres HTML. Reemplaza todas las copias locales de escapeHtml/escapeIncHtml/escapeComedorHtml. */
export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Formatea fecha ISO 'YYYY-MM-DD' a string localizado en es-MX (ej: "15 ene. 2025"). */
export function fmtFechaCorta(iso: string): string {
  const p = iso.trim().split("-");
  if (p.length !== 3) return iso;
  const y = Number(p[0]);
  const m = Number(p[1]);
  const d = Number(p[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return iso;
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return iso;
  return dt.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Genera array de páginas con "ellipsis" para controles de paginación.
 * Ej: paginationRange(10, 5) → [1, "ellipsis", 4, 5, 6, "ellipsis", 10]
 */
export function paginationRange(totalPages: number, currentPage: number): (number | "ellipsis")[] {
  if (totalPages <= 0) return [];
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const out: (number | "ellipsis")[] = [];
  const push = (x: number | "ellipsis"): void => {
    if (out[out.length - 1] !== x) out.push(x);
  };
  push(1);
  if (currentPage > 3) push("ellipsis");
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  for (let i = start; i <= end; i++) push(i);
  if (currentPage < totalPages - 2) push("ellipsis");
  push(totalPages);
  return out;
}
