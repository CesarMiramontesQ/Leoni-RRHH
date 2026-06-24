/**
 * Utilidades de presentación puras compartidas por todos los módulos.
 * No importa nada del dominio ni de la app — solo strings.
 */

/** Escapa caracteres HTML. Reemplaza todas las copias locales de escapeHtml/escapeIncHtml/escapeComedorHtml.
 * Coacciona valores no-string (p. ej. `no_empleado` numérico de Bono) a texto para no romper el render. */
export function escapeHtml(s: string | number | null | undefined): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
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
 * Fecha ISO `YYYY-MM-DD` o prefijo de datetime, texto largo en español (ej. "12 de mayo de 2026").
 * Devuelve "—" si vacío o inválido.
 */
export function fmtFechaLargaEsMx(iso: string | null | undefined): string {
  if (iso == null) return "—";
  const s = String(iso).trim();
  if (!s) return "—";
  const datePart = s.length >= 10 ? s.slice(0, 10) : s;
  const p = datePart.split("-");
  if (p.length !== 3) return "—";
  const y = Number(p[0]);
  const m = Number(p[1]);
  const d = Number(p[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return "—";
  if (!y || !m || !d) return "—";
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return "—";
  return dt.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

/** Fecha-hora ISO (UTC o con offset) para tablas; devuelve "—" si vacío o inválido. */
export function fmtDateTimeIso(iso: string | null | undefined): string {
  if (iso == null || !String(iso).trim()) return "—";
  const d = new Date(String(iso).trim());
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

/** Celda de tabla: texto seguro; nulos y vacíos como "—". */
export function fmtTablaCelda(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "number" && !Number.isFinite(val)) return "—";
  const s = String(val).trim();
  return s.length ? s : "—";
}

/**
 * Genera array de páginas con "ellipsis" para controles de paginación.
 * Ej: paginationRange(10, 5) → [1, "ellipsis", 4, 5, 6, "ellipsis", 10]
 */
export function paginationRange(totalPages: number, currentPage: number): (number | "ellipsis")[] {
  if (totalPages <= 0) return [];
  const p = Math.max(1, Math.min(totalPages, currentPage));
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const out: (number | "ellipsis")[] = [];
  const push = (x: number | "ellipsis"): void => {
    if (out[out.length - 1] !== x) out.push(x);
  };
  push(1);
  if (p > 3) push("ellipsis");
  const start = Math.max(2, p - 1);
  const end = Math.min(totalPages - 1, p + 1);
  for (let i = start; i <= end; i++) push(i);
  if (p < totalPages - 2) push("ellipsis");
  push(totalPages);
  return out;
}
