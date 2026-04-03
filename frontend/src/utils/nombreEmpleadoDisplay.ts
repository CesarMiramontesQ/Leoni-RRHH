/**
 * Presentación de nombres de empleado: reordenar `APELLIDOS, NOMBRES` → `NOMBRES APELLIDOS`.
 * No modifica datos persistidos; solo uso en UI.
 */

/** Reordena si hay coma; si no, devuelve el texto recortado y espacios normalizados. */
export function reordenarNombreComaApellidos(raw: string | null | undefined): string {
  if (raw == null) return "";
  const t = String(raw).trim();
  if (!t) return "";
  const parts = t.split(",");
  if (parts.length < 2) return t.replace(/\s+/g, " ").trim();
  const apellidos = parts[0].trim();
  const nombres = parts.slice(1).join(",").trim();
  return `${nombres} ${apellidos}`.replace(/\s+/g, " ").trim();
}

/** Capitalización tipo título por palabra (solo UI). */
export function capitalizarNombreTituloUi(s: string): string {
  const t = s.trim();
  if (!t) return "";
  return t
    .split(/\s+/)
    .map((w) => {
      if (!w) return w;
      const lower = w.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

export type OpcionesNombreEmpleadoUi = {
  /** Si true, aplica `capitalizarNombreTituloUi` tras el reordenamiento. */
  titulo?: boolean;
};

/**
 * Nombre listo para mostrar. Vacío si no hay texto útil (el llamador puede usar "Sin nombre", etc.).
 */
export function formatNombreEmpleadoUi(
  raw: string | null | undefined,
  options?: OpcionesNombreEmpleadoUi,
): string {
  const reordered = reordenarNombreComaApellidos(raw);
  if (!reordered) return "";
  if (options?.titulo) return capitalizarNombreTituloUi(reordered);
  return reordered;
}

/**
 * Iniciales a partir del nombre ya en formato de pantalla (p. ej. salida de `formatNombreEmpleadoUi`).
 * Primera letra del primer token + primera del último; un solo token usa dos primeras letras.
 */
export function inicialesDesdeNombreDisplay(display: string): string {
  const parts = display.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    const w = parts[0]!;
    const a = (w[0] ?? "").toUpperCase();
    const b = (w[1] ?? "").toUpperCase();
    return (a + b) || a || "?";
  }
  const a = (parts[0]![0] ?? "").toUpperCase();
  const b = (parts[parts.length - 1]![0] ?? "").toUpperCase();
  return (a + b) || "?";
}
