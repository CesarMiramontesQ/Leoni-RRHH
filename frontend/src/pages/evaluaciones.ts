import { mountAppShell } from "../layouts/appShell.ts";
import { renderLevelUpBackBar } from "../navigation/levelUpBackLink.ts";
import {
  getEmpleadosConPerfil,
  type EmpleadoConPerfil,
} from "../api/evaluaciones.ts";
import { BTN_SECONDARY, FIELD_FOCUS } from "../ui/uiTokens.ts";

interface SeveridadCfg {
  dot: string;
  text: string;
  label: string;
}

const SEVERIDAD_CONFIG: Record<string, SeveridadCfg> = {
  alineado: { dot: "bg-green-500", text: "text-green-700", label: "Alineado" },
  media: { dot: "bg-yellow-500", text: "text-yellow-700", label: "Media" },
  alta: { dot: "bg-orange-500", text: "text-orange-700", label: "Alta" },
  critica: { dot: "bg-red-500", text: "text-red-700", label: "Crítica" },
};

const MAX_TARJETAS = 10;

interface State {
  empleadosConPerfil: EmpleadoConPerfil[];
  loading: boolean;
}

export function mountEvaluaciones(container: HTMLElement, signal: AbortSignal): void {
  const state: State = { empleadosConPerfil: [], loading: true };

  mountAppShell(container, {
    activeNav: "evaluaciones",
    mainHtml: `<div id="evaluaciones-page"></div>`,
    mainClass: "py-0",
  });

  const root = container.querySelector<HTMLElement>("#evaluaciones-page")!;

  function empleadoPerfilLabel(e: EmpleadoConPerfil): string {
    const partes = [e.puesto_nombre, e.grado_nombre].filter(Boolean);
    return partes.length > 0 ? `${e.empleado_nombre} — ${partes.join(" · ")}` : e.empleado_nombre;
  }

  function readinessColor(score: number): string {
    if (score >= 70) return "bg-green-500";
    if (score >= 40) return "bg-yellow-500";
    return "bg-red-500";
  }

  function renderSearchSelect(name: string, placeholder: string, options: { id: number; label: string }[]): string {
    return `
      <div class="relative" data-searchselect="${name}">
        <input type="text" data-action="search-${name}" placeholder="${placeholder}" autocomplete="off"
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm ${FIELD_FOCUS}" />
        <input type="hidden" name="${name}" />
        <ul data-dropdown="${name}" class="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg hidden">
          ${options.map((o) => `<li data-action="pick-${name}" data-value="${o.id}" class="cursor-pointer px-3 py-2 text-sm hover:bg-blue-50">${o.label}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  function renderSelectorPerfil(): string {
    const opts = state.empleadosConPerfil.map((e) => ({ id: e.empleado_id, label: empleadoPerfilLabel(e) }));
    return `
      <div class="rounded-lg border border-gray-200 bg-white p-5 mb-6">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div class="border-l-4 border-green-500 pl-3">
            <h2 class="text-sm font-semibold text-gray-900">Evaluación Individual vs Perfil Ideal</h2>
            <p class="text-xs text-gray-500 mt-0.5">Selecciona un empleado ligado a un perfil de puesto para ver el análisis de competencias y brechas.</p>
          </div>
          <div class="w-full sm:w-80 shrink-0">
            ${renderSearchSelect("empleado_perfil", "Buscar empleado con perfil...", opts)}
          </div>
        </div>
      </div>`;
  }

  function renderCard(e: EmpleadoConPerfil, rank: number): string {
    const puestoGrado = [e.puesto_nombre, e.grado_nombre].filter(Boolean).join(" · ") || "Sin puesto";
    const sev = SEVERIDAD_CONFIG[e.severidad_promedio] ?? SEVERIDAD_CONFIG.alineado;
    const score = Math.round(e.readiness_score);
    const brechasTxt = `${e.brechas_identificadas} brecha${e.brechas_identificadas === 1 ? "" : "s"}`;
    return `
      <div class="rounded-lg border border-gray-200 bg-white p-4 flex flex-col gap-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-gray-900 truncate">${e.empleado_nombre}</p>
            <p class="text-xs text-gray-500 truncate">${puestoGrado}</p>
          </div>
          <span class="shrink-0 flex size-6 items-center justify-center rounded bg-gray-100 text-xs font-bold text-gray-500">#${rank}</span>
        </div>
        <div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-gray-500 uppercase">Readiness</span>
            <span class="font-semibold text-gray-900">${score}%</span>
          </div>
          <div class="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div class="h-full rounded-full ${readinessColor(score)}" style="width:${Math.min(100, score)}%"></div>
          </div>
        </div>
        <div class="flex items-center justify-between pt-1">
          <span class="inline-flex items-center gap-1.5 text-xs ${sev.text}">
            <span class="size-1.5 rounded-full ${sev.dot}"></span>${brechasTxt}
          </span>
          <a href="#/evaluaciones/empleado/${e.empleado_id}" class="${BTN_SECONDARY} text-xs px-3 py-1.5">Ver</a>
        </div>
      </div>`;
  }

  function renderTarjetas(): string {
    if (state.loading) {
      return `<div class="text-center py-12 text-gray-500">Cargando...</div>`;
    }
    if (state.empleadosConPerfil.length === 0) {
      return `<div class="text-center py-12 text-gray-500 border border-dashed border-gray-300 rounded-lg">
        <p class="text-sm">No hay empleados ligados a un perfil de puesto.</p>
        <p class="text-xs mt-1">Asigna empleados a un perfil desde el módulo de Puestos.</p>
      </div>`;
    }

    const top = state.empleadosConPerfil.slice(0, MAX_TARJETAS);
    return `
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold text-gray-900">Mejores empleados</h2>
        <span class="text-xs text-gray-500">Top ${top.length} por Readiness Score</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${top.map((e, i) => renderCard(e, i + 1)).join("")}
      </div>`;
  }

  function render() {
    root.innerHTML = `
      <div class="px-6 py-6 max-w-7xl mx-auto">
        ${renderLevelUpBackBar()}
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-xl font-semibold text-gray-900">Evaluaciones de Competencias</h1>
        </div>

        ${renderSelectorPerfil()}

        ${renderTarjetas()}
      </div>
    `;
  }

  // ── Search-select handlers ──────────────────────────────────────────────
  function handleSearchSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const name = input.dataset.action?.replace("search-", "");
    if (!name) return;
    const wrap = input.closest(`[data-searchselect="${name}"]`);
    if (!wrap) return;
    const dropdown = wrap.querySelector<HTMLUListElement>(`[data-dropdown="${name}"]`);
    if (!dropdown) return;

    const query = input.value.toLowerCase();
    let visible = 0;
    dropdown.querySelectorAll("li").forEach((li) => {
      const match = li.textContent!.toLowerCase().includes(query);
      li.classList.toggle("hidden", !match);
      if (match) visible++;
    });
    dropdown.classList.toggle("hidden", visible === 0 && query === "");
    if (query.length > 0) dropdown.classList.remove("hidden");
  }

  function handlePickOption(e: Event) {
    const li = (e.target as HTMLElement).closest<HTMLLIElement>("[data-action^='pick-']");
    if (!li) return;
    const value = li.dataset.value!;
    if (value) {
      window.location.hash = `#/evaluaciones/empleado/${value}`;
    }
  }

  root.addEventListener("click", handlePickOption, { signal });
  root.addEventListener("input", (e) => {
    const t = e.target as HTMLElement;
    if (t.matches("[data-action^='search-']")) handleSearchSelect(e);
  }, { signal });
  root.addEventListener("focusin", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.matches("[data-action^='search-']")) {
      const name = t.dataset.action!.replace("search-", "");
      const dropdown = t.closest(`[data-searchselect="${name}"]`)?.querySelector<HTMLUListElement>(`[data-dropdown="${name}"]`);
      if (dropdown) dropdown.classList.remove("hidden");
    }
  }, { signal });
  root.addEventListener("focusout", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.matches("[data-action^='search-']")) {
      setTimeout(() => {
        const name = t.dataset.action!.replace("search-", "");
        const dropdown = t.closest(`[data-searchselect="${name}"]`)?.querySelector<HTMLUListElement>(`[data-dropdown="${name}"]`);
        if (dropdown) dropdown.classList.add("hidden");
      }, 200);
    }
  }, { signal });

  // Initial load
  (async () => {
    render();
    state.empleadosConPerfil = await getEmpleadosConPerfil();
    state.loading = false;
    render();
  })();
}
