/** Lee un custom property de `:root` (tokens en `style.css` / design.md). */
export function cssVar(name: `--${string}`, fallback = ""): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export type ChartSemanticColors = {
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  leoniBlue: string;
  leoniGreen: string;
};

/** Colores semánticos alineados con design.md (fallbacks si el token no está en @theme). */
export function chartSemanticColors(): ChartSemanticColors {
  return {
    textPrimary: cssVar("--color-text-primary", "#002147"),
    textSecondary: cssVar("--color-text-secondary", "#64748B"),
    textMuted: cssVar("--color-text-muted", "#5A6880"),
    border: cssVar("--color-border", "#D1DCE8"),
    accent: cssVar("--color-accent", "#2563EB"),
    success: cssVar("--color-success", "#22C55E"),
    warning: cssVar("--color-warning", "#F59E0B"),
    danger: cssVar("--color-danger", "#EF4444"),
    leoniBlue: cssVar("--color-leoni-blue", "#002147"),
    leoniGreen: cssVar("--color-leoni-green", "#00C853"),
  };
}

/** Paleta por defecto para datasets (barras, líneas, dona). */
export function chartPalette(): readonly string[] {
  const c = chartSemanticColors();
  return [
    c.accent,
    c.leoniGreen,
    c.leoniBlue,
    cssVar("--color-leoni-blue-light", "#0D3D66"),
    c.warning,
    c.danger,
    cssVar("--color-kpi-metric-total-icon", "#1d4ed8"),
    cssVar("--color-kpi-metric-inactivo-icon", "#f87171"),
  ] as const;
}
