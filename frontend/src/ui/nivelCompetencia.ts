/** Niveles de dominio / requerido (0 = N/A en datos legados). */
export const NIVEL_REQUERIDO_OPTIONS = [
  { value: 1, label: "1 — Planeado" },
  { value: 2, label: "2 — En entrenamiento" },
  { value: 3, label: "3 — Certificado" },
  { value: 4, label: "4 — Experto" },
] as const;

export function nivelRequeridoLabel(nivel: number): string {
  if (nivel <= 0) return "Sin definir";
  return NIVEL_REQUERIDO_OPTIONS.find((o) => o.value === nivel)?.label ?? `Nivel ${nivel}`;
}

export function renderNivelRequeridoSelectHtml(
  selected: number,
  attrs: string,
  includePlaceholder = false,
): string {
  const opts = (includePlaceholder
    ? [{ value: 0, label: "— Seleccionar nivel —" }]
    : []
  )
    .concat([...NIVEL_REQUERIDO_OPTIONS])
    .map(
      (o) =>
        `<option value="${o.value}" ${o.value === selected ? "selected" : ""}>${o.label}</option>`,
    )
    .join("");
  return `<select ${attrs}>${opts}</select>`;
}
