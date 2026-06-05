import { mountAppShell } from "../layouts/appShell.ts";
import { mountGruposCompetenciaSection } from "../components/puestos/ajustes/gruposCompetenciaSection.ts";
import { mountNivelesSection } from "../components/puestos/ajustes/nivelesSection.ts";
import { mountTiposCompetenciaSection } from "../components/puestos/ajustes/tiposCompetenciaSection.ts";
import { RH_LISTADO_PAGE_OUTER } from "../ui/uiTokens.ts";

export function mountPuestosAjustes(container: HTMLElement, signal: AbortSignal): void {
  mountAppShell(container, {
    activeNav: "puestos-ajustes",
    mainHtml: `<div id="puestos-ajustes-root" class="${RH_LISTADO_PAGE_OUTER}">
      <header class="mb-6">
        <h1 class="text-xl font-semibold text-text-primary sm:text-2xl">Ajustes — Perfil de puesto</h1>
        <p class="mt-1 text-sm text-text-muted">Configura catálogos y opciones del módulo de perfiles de puesto.</p>
      </header>
      <div id="puestos-ajustes-sections" class="flex flex-col gap-6">
        <div id="puestos-ajustes-niveles"></div>
        <div id="puestos-ajustes-grupos"></div>
        <div id="puestos-ajustes-tipos"></div>
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
}
