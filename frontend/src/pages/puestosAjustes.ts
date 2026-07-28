import { mountAppShell } from "../layouts/appShell.ts";
import { renderLevelUpBackBar } from "../navigation/levelUpBackLink.ts";
import { mountGruposCompetenciaSection } from "../components/puestos/ajustes/gruposCompetenciaSection.ts";
import { mountMetodosCalificacionCompetenciaSection } from "../components/puestos/ajustes/metodosCalificacionCompetenciaSection.ts";
import { mountMetodosCalificacionSection } from "../components/puestos/ajustes/metodosCalificacionSection.ts";
import { mountGradosSection } from "../components/puestos/ajustes/gradosSection.ts";
import { mountTiposCompetenciaSection } from "../components/puestos/ajustes/tiposCompetenciaSection.ts";
import { mountTiposCualificacionSection } from "../components/puestos/ajustes/tiposCualificacionSection.ts";
import {
  mountCareerPathsSection,
  mountDisciplinasSection,
  mountFuncionesSection,
} from "../components/puestos/ajustes/clasificacionSections.ts";
import { mountCategoriasTareaSection } from "../components/puestos/ajustes/categoriasTareaSection.ts";
import {
  mountEquivalenciasSection,
  mountGlobalGradesSection,
} from "../components/puestos/ajustes/globalGradeSections.ts";
import {
  AJUSTES_ICON_COMPETENCY,
  AJUSTES_ICON_GRADES,
  AJUSTES_ICON_QUAL,
  AJUSTES_ICON_TYPE,
} from "../components/puestos/ajustes/ajustesSectionUi.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import { pageHeading, RH_LISTADO_PAGE_OUTER_GRADIENT, RH_LISTADO_SURFACE } from "../ui/uiTokens.ts";
import { talentoEyebrow } from "../talento/pageKit.ts";

type TabId = "clasificacion" | "competencias" | "tareas" | "cualificaciones";

const TABS: {
  id: TabId;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
}[] = [
  {
    id: "clasificacion",
    label: "Clasificación",
    eyebrow: "Towers Watson",
    title: "Clasificación del puesto",
    description:
      "Career path, función, disciplina, global levels y global grades. Es la identidad oficial del puesto y la base de competencias, tareas y planes de carrera.",
    icon: AJUSTES_ICON_GRADES,
  },
  {
    id: "competencias",
    label: "Competencias",
    eyebrow: "Matriz",
    title: "Catálogos de competencias",
    description:
      "Grupos, tipos y escala de dominio que alimentan la matriz de multihabilidad y los perfiles.",
    icon: AJUSTES_ICON_COMPETENCY,
  },
  {
    id: "tareas",
    label: "Tareas",
    eyebrow: "Responsabilidades",
    title: "Catálogos de tareas",
    description:
      "Categorías con las que se clasifican las responsabilidades de cada puesto.",
    icon: AJUSTES_ICON_TYPE,
  },
  {
    id: "cualificaciones",
    label: "Cualificaciones",
    eyebrow: "Cumplimiento",
    title: "Catálogos de cualificaciones",
    description:
      "Tipos y métodos de evaluación para requisitos de perfil (escolaridad, experiencia, etc.).",
    icon: AJUSTES_ICON_QUAL,
  },
];

function tabButtonClass(isActive: boolean): string {
  const base =
    "inline-flex min-h-9 items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
  if (isActive) {
    return `${base} border-accent/20 bg-accent text-white shadow-sm shadow-accent/20`;
  }
  return `${base} border-transparent bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-text-primary`;
}

function renderTabs(activeTab: TabId): string {
  const buttons = TABS.map(
    (t) =>
      `<button type="button" role="tab" aria-selected="${t.id === activeTab}" aria-controls="puestos-ajustes-panel-${t.id}" id="puestos-ajustes-tab-${t.id}" data-ajustes-tab="${t.id}" class="${tabButtonClass(t.id === activeTab)}">${escapeHtml(t.label)}</button>`,
  ).join("");
  return `<div role="tablist" aria-label="Secciones de ajustes" class="overflow-x-auto pb-1">
    <div class="inline-flex min-w-full items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-1.5">${buttons}</div>
  </div>`;
}

function renderTabIntro(tab: (typeof TABS)[number]): string {
  return `
    <div class="${RH_LISTADO_SURFACE} overflow-hidden">
      <div class="flex items-start gap-4 px-4 py-4 sm:px-5">
        <span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent [&_svg]:size-5" aria-hidden="true">${tab.icon}</span>
        <div class="min-w-0">
          <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">${escapeHtml(tab.eyebrow)}</p>
          <h2 class="mt-1 text-lg font-bold tracking-tight text-text-primary">${escapeHtml(tab.title)}</h2>
          <p class="mt-1 max-w-2xl text-sm leading-relaxed text-text-muted">${escapeHtml(tab.description)}</p>
        </div>
      </div>
    </div>`;
}

/**
 * Encabezado de una columna de catálogos.
 *
 * No es una card: es una etiqueta de agrupación, así que se mantiene ligera
 * (sin superficie ni borde) para no competir con las cards que ordena.
 */
function renderColumnaTitulo(titulo: string, descripcion: string): string {
  return `<div class="px-1">
    <h3 class="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">${escapeHtml(titulo)}</h3>
    <p class="mt-0.5 text-xs text-text-muted">${escapeHtml(descripcion)}</p>
  </div>`;
}

function renderPanel(tabId: TabId, activeTab: TabId): string {
  const tab = TABS.find((t) => t.id === tabId)!;
  let body = "";
  if (tabId === "clasificacion") {
    // Los seis catálogos son dos cadenas independientes, y la pantalla lo dice:
    //   qué es el puesto   → Función → Disciplina
    //   cuánto pesa        → Career Path → Global Level → Global Grade → equivalencia
    // Cada columna se lee de arriba abajo en el orden en que se captura, y en
    // pantallas anchas dejan de apilarse seis cards a lo largo.
    body = `<div class="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
      <div class="flex min-w-0 flex-col gap-5">
        ${renderColumnaTitulo("Qué es el puesto", "Familia de puesto y su especialidad.")}
        <div id="puestos-ajustes-funciones" class="min-w-0"></div>
        <div id="puestos-ajustes-disciplinas" class="min-w-0"></div>
      </div>
      <div class="flex min-w-0 flex-col gap-5">
        ${renderColumnaTitulo("Cuánto pesa el puesto", "Trayectoria, nivel y su grado organizacional.")}
        <div id="puestos-ajustes-career-paths" class="min-w-0"></div>
        <div id="puestos-ajustes-grados" class="min-w-0"></div>
        <div id="puestos-ajustes-global-grades" class="min-w-0"></div>
        <div id="puestos-ajustes-equivalencias" class="min-w-0"></div>
      </div>
    </div>`;
  } else if (tabId === "tareas") {
    body = `<div id="puestos-ajustes-categorias-tarea" class="min-w-0"></div>`;
  } else if (tabId === "competencias") {
    body = `<div class="flex flex-col gap-5">
      <div class="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div id="puestos-ajustes-grupos" class="min-w-0"></div>
        <div id="puestos-ajustes-tipos" class="min-w-0"></div>
      </div>
      <div id="puestos-ajustes-metodos-calificacion-competencia" class="min-w-0"></div>
    </div>`;
  } else {
    body = `<div class="flex flex-col gap-5">
      <div id="puestos-ajustes-tipos-cualificacion" class="min-w-0"></div>
      <div id="puestos-ajustes-metodos-calificacion" class="min-w-0"></div>
    </div>`;
  }
  const isActive = tabId === activeTab;
  return `
    <div id="puestos-ajustes-panel-${tabId}" role="tabpanel" aria-labelledby="puestos-ajustes-tab-${tabId}" class="flex flex-col gap-5${isActive ? "" : " hidden"}"${isActive ? "" : " hidden"}>
      ${renderTabIntro(tab)}
      ${body}
    </div>`;
}

export function mountPuestosAjustes(container: HTMLElement, signal: AbortSignal): void {
  let activeTab: TabId = "clasificacion";
  const mounted = new Set<TabId>();

  function mountTabSections(tabId: TabId): void {
    if (mounted.has(tabId)) return;
    mounted.add(tabId);

    if (tabId === "clasificacion") {
      const careerPathsHost = container.querySelector("#puestos-ajustes-career-paths");
      if (careerPathsHost instanceof HTMLElement) {
        mountCareerPathsSection(careerPathsHost, signal);
      }
      const funcionesHost = container.querySelector("#puestos-ajustes-funciones");
      if (funcionesHost instanceof HTMLElement) mountFuncionesSection(funcionesHost, signal);
      const disciplinasHost = container.querySelector("#puestos-ajustes-disciplinas");
      if (disciplinasHost instanceof HTMLElement) {
        mountDisciplinasSection(disciplinasHost, signal);
      }
      const gradosHost = container.querySelector("#puestos-ajustes-grados");
      if (gradosHost instanceof HTMLElement) mountGradosSection(gradosHost, signal);
      const globalGradesHost = container.querySelector("#puestos-ajustes-global-grades");
      if (globalGradesHost instanceof HTMLElement) {
        mountGlobalGradesSection(globalGradesHost, signal);
      }
      const equivalenciasHost = container.querySelector("#puestos-ajustes-equivalencias");
      if (equivalenciasHost instanceof HTMLElement) {
        mountEquivalenciasSection(equivalenciasHost, signal);
      }
      return;
    }

    if (tabId === "tareas") {
      const categoriasHost = container.querySelector("#puestos-ajustes-categorias-tarea");
      if (categoriasHost instanceof HTMLElement) {
        mountCategoriasTareaSection(categoriasHost, signal);
      }
      return;
    }

    if (tabId === "competencias") {
      const gruposHost = container.querySelector("#puestos-ajustes-grupos");
      if (gruposHost instanceof HTMLElement) mountGruposCompetenciaSection(gruposHost, signal);
      const tiposHost = container.querySelector("#puestos-ajustes-tipos");
      if (tiposHost instanceof HTMLElement) mountTiposCompetenciaSection(tiposHost, signal);
      const metodosCompHost = container.querySelector(
        "#puestos-ajustes-metodos-calificacion-competencia",
      );
      if (metodosCompHost instanceof HTMLElement) {
        mountMetodosCalificacionCompetenciaSection(metodosCompHost, signal);
      }
      return;
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

  function paintShell(): void {
    mountAppShell(container, {
      activeNav: "puestos-ajustes",
      pageTitle: "Ajustes de perfiles de puesto",
      mainClass: "py-5 sm:py-6",
      mainHtml: `<div id="puestos-ajustes-root" class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">
        ${renderLevelUpBackBar()}
        ${talentoEyebrow()}
        ${pageHeading(
          "Ajustes de perfil de puesto",
          "Catálogos maestros que alimentan perfiles, matriz de competencias y evaluaciones.",
        )}
        <div class="sticky top-0 z-20 -mx-1 bg-surface/95 px-1 py-2 backdrop-blur-sm supports-[backdrop-filter]:bg-surface/80">
          ${renderTabs(activeTab)}
        </div>
        <div id="puestos-ajustes-panels" class="flex flex-col gap-5">
          ${renderPanel("clasificacion", activeTab)}
          ${renderPanel("competencias", activeTab)}
          ${renderPanel("tareas", activeTab)}
          ${renderPanel("cualificaciones", activeTab)}
        </div>
      </div>`,
    });

    // El shell reescribió el DOM: hay que volver a montar las secciones.
    mounted.clear();
    mountTabSections(activeTab);
  }

  function setActiveTab(next: TabId): void {
    if (next === activeTab) return;
    activeTab = next;
    // Solo actualizar tabs/paneles sin remount completo del shell.
    const root = container.querySelector("#puestos-ajustes-root");
    if (!(root instanceof HTMLElement)) {
      paintShell();
      return;
    }

    root.querySelectorAll<HTMLElement>("[data-ajustes-tab]").forEach((btn) => {
      const id = btn.dataset.ajustesTab as TabId;
      const isActive = id === activeTab;
      btn.setAttribute("aria-selected", String(isActive));
      btn.className = tabButtonClass(isActive);
    });

    for (const tab of TABS) {
      const panel = root.querySelector(`#puestos-ajustes-panel-${tab.id}`);
      if (!(panel instanceof HTMLElement)) continue;
      if (tab.id === activeTab) {
        panel.classList.remove("hidden");
        panel.removeAttribute("hidden");
      } else {
        panel.classList.add("hidden");
        panel.setAttribute("hidden", "");
      }
    }

    mountTabSections(activeTab);
  }

  paintShell();

  container.addEventListener(
    "click",
    (ev) => {
      const btn = (ev.target as HTMLElement).closest<HTMLElement>("[data-ajustes-tab]");
      if (!btn) return;
      const id = btn.dataset.ajustesTab as TabId | undefined;
      if (!id || !TABS.some((t) => t.id === id)) return;
      setActiveTab(id);
    },
    { signal },
  );
}
