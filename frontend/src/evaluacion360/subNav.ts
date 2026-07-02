import { escapeHtml } from "../ui/uiUtils.ts";
import type { Eval360ViewId } from "./types.ts";

export const EVAL360_BASE_HASH = "#/level-up/evaluacion-360";

export const EVAL360_VIEWS: ReadonlyArray<{ id: Eval360ViewId; label: string; hash: string }> = [
  { id: "dashboard", label: "Dashboard", hash: EVAL360_BASE_HASH },
  { id: "empleados", label: "Empleados", hash: `${EVAL360_BASE_HASH}/empleados` },
  { id: "campanas", label: "Campañas", hash: `${EVAL360_BASE_HASH}/campanas` },
  { id: "evaluaciones", label: "Evaluaciones", hash: `${EVAL360_BASE_HASH}/evaluaciones` },
  { id: "resultados", label: "Resultados", hash: `${EVAL360_BASE_HASH}/resultados` },
  { id: "reportes", label: "Reportes", hash: `${EVAL360_BASE_HASH}/reportes` },
  { id: "preguntas", label: "Banco de preguntas", hash: `${EVAL360_BASE_HASH}/preguntas` },
  { id: "configuracion", label: "Configuración", hash: `${EVAL360_BASE_HASH}/configuracion` },
];

export function parseEval360ViewFromHash(hash: string): Eval360ViewId {
  const h = (hash || EVAL360_BASE_HASH).trim();
  if (h === EVAL360_BASE_HASH || h === `${EVAL360_BASE_HASH}/`) return "dashboard";
  if (h.startsWith(`${EVAL360_BASE_HASH}/empleados`)) return "empleados";
  if (h.startsWith(`${EVAL360_BASE_HASH}/campanas`)) return "campanas";
  if (h.startsWith(`${EVAL360_BASE_HASH}/evaluaciones`)) return "evaluaciones";
  if (h.startsWith(`${EVAL360_BASE_HASH}/resultados`)) return "resultados";
  if (h.startsWith(`${EVAL360_BASE_HASH}/reportes`)) return "reportes";
  if (h.startsWith(`${EVAL360_BASE_HASH}/preguntas`)) return "preguntas";
  if (h.startsWith(`${EVAL360_BASE_HASH}/configuracion`)) return "configuracion";
  return "dashboard";
}

export function renderEval360SubNav(active: Eval360ViewId): string {
  return `
    <nav class="e360-page-tabs" role="tablist" aria-label="Secciones Evaluación 360°">
      ${EVAL360_VIEWS.map((v) => {
        const isActive = v.id === active;
        return `<a href="${escapeHtml(v.hash)}" role="tab" aria-selected="${isActive}" ${isActive ? 'aria-current="page"' : ""} class="e360-page-tab ${isActive ? "e360-page-tab--active" : ""}">${escapeHtml(v.label)}</a>`;
      }).join("")}
    </nav>`;
}
