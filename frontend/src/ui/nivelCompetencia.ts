import {
  buildNivelMetodoOptions,
  buildNivelMetodoLabelsMap,
  ensureMetodosCalificacionCompetenciaLoaded,
  getMetodosCalificacionCompetenciaSync,
  nivelMetodoLabel,
  renderNivelMetodoSelectHtml,
} from "./metodosCalificacionCompetencia.ts";

export {
  buildNivelMetodoOptions,
  buildNivelMetodoLabelsMap,
  ensureMetodosCalificacionCompetenciaLoaded,
  getMetodosCalificacionCompetenciaSync,
};

export const nivelRequeridoLabel = nivelMetodoLabel;
export const renderNivelRequeridoSelectHtml = renderNivelMetodoSelectHtml;

/** Opciones de nivel requerido (1–4). Invocar tras cargar el catálogo. */
export function getNivelRequeridoOptions(): { value: number; label: string }[] {
  return buildNivelMetodoOptions(false);
}

/** @deprecated Usar getNivelRequeridoOptions() tras cargar el catálogo. */
export const NIVEL_REQUERIDO_OPTIONS = [
  { value: 1, label: "1 — Planeado" },
  { value: 2, label: "2 — En entrenamiento" },
  { value: 3, label: "3 — Certificado" },
  { value: 4, label: "4 — Experto" },
] as const;
