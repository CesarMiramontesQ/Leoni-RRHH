import { mountAppShell } from "../layouts/appShell.ts";
import { mountGruposCompetenciaSection } from "../components/puestos/ajustes/gruposCompetenciaSection.ts";
import { mountMetodosCalificacionSection } from "../components/puestos/ajustes/metodosCalificacionSection.ts";
import { mountNivelesSection } from "../components/puestos/ajustes/nivelesSection.ts";
import { mountTiposCompetenciaSection } from "../components/puestos/ajustes/tiposCompetenciaSection.ts";
import { mountTiposCualificacionSection } from "../components/puestos/ajustes/tiposCualificacionSection.ts";
import { BTN_SECONDARY, RH_LISTADO_PAGE_OUTER, RH_LISTADO_SURFACE } from "../ui/uiTokens.ts";

function renderPageHeader(): string {
  return `
    <header class="${RH_LISTADO_SURFACE} p-4 sm:p-6">
      <nav class="text-xs text-text-muted" aria-label="Breadcrumb">
        <ol class="flex flex-wrap items-center gap-1">
          <li><a href="#/" class="font-medium transition hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue/40 focus-visible:ring-offset-2">Inicio</a></li>
          <li class="text-slate-300" aria-hidden="true">/</li>
          <li><a href="#/puestos" class="font-medium transition hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue/40 focus-visible:ring-offset-2">Perfiles de Puesto</a></li>
          <li class="text-slate-300" aria-hidden="true">/</li>
          <li class="font-semibold text-text-primary" aria-current="page">Ajustes</li>
        </ol>
      </nav>
      <div class="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <h1 class="text-[clamp(1.35rem,2.5vw,1.75rem)] font-semibold leading-tight tracking-tight text-text-primary">
            Ajustes para perfiles de puesto
          </h1>
          <p class="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">
            Administra catálogos de niveles, competencias y cualificaciones usados al definir y evaluar perfiles de puesto.
          </p>
        </div>
        <a href="#/puestos" class="${BTN_SECONDARY} w-full shrink-0 text-center sm:w-auto">Volver a perfiles</a>
      </div>
    </header>`;
}

function renderSectionGroup(title: string, description: string, titleId: string, contentHtml: string): string {
  return `
    <section class="flex flex-col gap-4" aria-labelledby="${titleId}">
      <div class="space-y-1">
        <h2 id="${titleId}" class="text-base font-semibold tracking-tight text-text-primary sm:text-lg">${title}</h2>
        <p class="text-sm text-text-muted">${description}</p>
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
      ${renderPageHeader()}
      <div id="puestos-ajustes-sections" class="flex flex-col gap-6 sm:gap-8">
        <div id="puestos-ajustes-niveles" class="min-w-0"></div>
        ${renderSectionGroup(
          "Competencias",
          "Catálogos de grupos y tipos para clasificar competencias al crearlas.",
          "puestos-ajustes-competencias-title",
          `<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div id="puestos-ajustes-grupos" class="min-w-0"></div>
            <div id="puestos-ajustes-tipos" class="min-w-0"></div>
          </div>`,
        )}
        ${renderSectionGroup(
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

  const tiposCualHost = container.querySelector("#puestos-ajustes-tipos-cualificacion");
  if (tiposCualHost instanceof HTMLElement) {
    mountTiposCualificacionSection(tiposCualHost, signal);
  }

  const metodosHost = container.querySelector("#puestos-ajustes-metodos-calificacion");
  if (metodosHost instanceof HTMLElement) {
    mountMetodosCalificacionSection(metodosHost, signal);
  }
}
