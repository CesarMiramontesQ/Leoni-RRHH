import {
  buildNivelMetodoOptions,
  buildNivelMetodoLabelsMap,
  ensureMetodosCalificacionCompetenciaLoaded,
  getMetodosCalificacionCompetenciaSync,
  maxNivelActivoValor,
  nivelMetodoLabel,
  renderNivelMetodoSelectHtml,
} from "./metodosCalificacionCompetencia.ts";

export {
  buildNivelMetodoOptions,
  buildNivelMetodoLabelsMap,
  ensureMetodosCalificacionCompetenciaLoaded,
  getMetodosCalificacionCompetenciaSync,
  maxNivelActivoValor,
};

export const nivelRequeridoLabel = nivelMetodoLabel;
export const renderNivelRequeridoSelectHtml = renderNivelMetodoSelectHtml;

/** Opciones de nivel requerido. Invocar tras cargar el catálogo. */
export function getNivelRequeridoOptions(): { value: number; label: string }[] {
  return buildNivelMetodoOptions(false);
}
