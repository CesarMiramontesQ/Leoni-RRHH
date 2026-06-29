import { mountAppShell } from "../layouts/appShell.ts";
import { renderLevelUpBackBar } from "../navigation/levelUpBackLink.ts";
import { mountGruposCompetenciaSection } from "../components/puestos/ajustes/gruposCompetenciaSection.ts";
import { mountMetodosCalificacionCompetenciaSection } from "../components/puestos/ajustes/metodosCalificacionCompetenciaSection.ts";
import { mountMetodosCalificacionSection } from "../components/puestos/ajustes/metodosCalificacionSection.ts";
import { mountGradosSection } from "../components/puestos/ajustes/gradosSection.ts";
import { mountNivelesSection } from "../components/puestos/ajustes/nivelesSection.ts";
import { mountTiposCompetenciaSection } from "../components/puestos/ajustes/tiposCompetenciaSection.ts";
import { mountTiposCualificacionSection } from "../components/puestos/ajustes/tiposCualificacionSection.ts";
import { pageHeading, RH_LISTADO_PAGE_OUTER } from "../ui/uiTokens.ts";

function renderSectionGroup(
  eyebrow: string,
  title: string,
  description: string,
  titleId: string,
  contentHtml: string,
): string {
  return `
    <section class="flex flex-col gap-4" aria-labelledby="${titleId}">
      <div class="border-b border-slate-200/80 pb-3">
        <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">${eyebrow}</p>
        <h2 id="${titleId}" class="mt-1 text-lg font-bold tracking-tight text-text-primary sm:text-xl">${title}</h2>
        <p class="mt-1 text-sm text-text-muted">${description}</p>
      </div>
      ${contentHtml}
    </section>`;
}

export function mountPuestosAjustes(container: HTMLElement, signal: AbortSignal): void {
  mountAppShell(container, {
    activeNav: "puestos-ajustes",
    pageTitle: "Ajustes de perfiles de puesto",
    mainClass: "py-5 sm:py-6",
    mainHtml: `<div id="puestos-ajustes-root" class="${RH_LISTADO_PAGE_OUTER}">
      ${renderLevelUpBackBar()}
      ${pageHeading(
        "Ajustes de perfil de puesto",
        "Catálogos que alimentan los perfiles de puesto y la matriz de competencias.",
      )}
      <div id="puestos-ajustes-sections" class="flex flex-col gap-6 sm:gap-8">
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
          ${renderSectionGroup(
            "Estructura",
            "Grados en puestos",
            "Catálogo global de grados de progresión (Grado 1–4). Las competencias requeridas se definen por grado.",
            "puestos-ajustes-grados-title",
            `<div id="puestos-ajustes-grados" class="min-w-0"></div>`,
          )}
          ${renderSectionGroup(
            "Estructura",
            "Niveles en puestos",
            "Catálogo de niveles organizacionales para perfiles de puesto.",
            "puestos-ajustes-niveles-title",
            `<div id="puestos-ajustes-niveles" class="min-w-0"></div>`,
          )}
        </div>
        ${renderSectionGroup(
          "Matriz de competencias",
          "Competencias",
          "Catálogos de grupos, tipos y métodos de calificación para la matriz de multihabilidad.",
          "puestos-ajustes-competencias-title",
          `<div class="flex flex-col gap-6">
            <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div id="puestos-ajustes-grupos" class="min-w-0"></div>
              <div id="puestos-ajustes-tipos" class="min-w-0"></div>
            </div>
            <div id="puestos-ajustes-metodos-calificacion-competencia" class="min-w-0"></div>
          </div>`,
        )}
        ${renderSectionGroup(
          "Evaluación de cumplimiento",
          "Cualificaciones",
          "Tipos de cualificación y métodos para evaluar el cumplimiento en perfiles.",
          "puestos-ajustes-cualificaciones-title",
          `<div class="flex flex-col gap-6">
            <div id="puestos-ajustes-tipos-cualificacion" class="min-w-0"></div>
            <div id="puestos-ajustes-metodos-calificacion" class="min-w-0"></div>
          </div>`,
        )}
      </div>
    </div>`,
  });

  const gradosHost = container.querySelector("#puestos-ajustes-grados");
  if (gradosHost instanceof HTMLElement) {
    mountGradosSection(gradosHost, signal);
  }

  const nivelesHost = container.querySelector("#puestos-ajustes-niveles");
  if (nivelesHost instanceof HTMLElement) {
    mountNivelesSection(nivelesHost, signal);
  }

  const gruposHost = container.querySelector("#puestos-ajustes-grupos");
  if (gruposHost instanceof HTMLElement) {
    mountGruposCompetenciaSection(gruposHost, signal);
  }

  const tiposHost = container.querySelector("#puestos-ajustes-tipos");
  if (tiposHost instanceof HTMLElement) {
    mountTiposCompetenciaSection(tiposHost, signal);
  }

  const metodosCompHost = container.querySelector("#puestos-ajustes-metodos-calificacion-competencia");
  if (metodosCompHost instanceof HTMLElement) {
    mountMetodosCalificacionCompetenciaSection(metodosCompHost, signal);
  }

  const tiposCualHost = container.querySelector("#puestos-ajustes-tipos-cualificacion");
  if (tiposCualHost instanceof HTMLElement) {
    mountTiposCualificacionSection(tiposCualHost, signal);
  }

  const metodosHost = container.querySelector("#puestos-ajustes-metodos-calificacion");
  if (metodosHost instanceof HTMLElement) {
    mountMetodosCalificacionSection(metodosHost, signal);
  }
}
