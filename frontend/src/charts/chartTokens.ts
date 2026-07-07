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

/** Slots nombrados para mapas por dominio (una familia de color por slot). */
export function chartColorSlots(): {
  accent: string;
  green: string;
  amber: string;
  red: string;
  violet: string;
  teal: string;
  orange: string;
  navy: string;
  slate: string;
} {
  const c = chartSemanticColors();
  return {
    accent: c.accent,
    green: c.leoniGreen,
    amber: c.warning,
    red: c.danger,
    violet: "#9333EA",
    teal: "#0891B2",
    orange: "#EA580C",
    navy: c.leoniBlue,
    slate: c.textSecondary,
  };
}

/**
 * Paleta categórica de alto contraste para series múltiples.
 * Evita tonos vecinos del mismo matiz (p. ej. dos azules o dos verdes).
 */
export function chartCategoricalPalette(): readonly string[] {
  const s = chartColorSlots();
  return [s.accent, s.green, s.violet, s.amber, s.teal, s.red, s.navy, s.orange, s.slate] as const;
}

/** Acceso estable por índice a la paleta categórica. */
export function chartColorAt(index: number): string {
  const palette = chartCategoricalPalette();
  return palette[((index % palette.length) + palette.length) % palette.length]!;
}

/** Paleta por defecto para datasets (barras, líneas, dona). */
export function chartPalette(): readonly string[] {
  return chartCategoricalPalette();
}
