import { mountAppShell } from "../layouts/appShell.ts";
import { renderLevelUpBackBar } from "../navigation/levelUpBackLink.ts";
import {
  getEmpleadosConPerfil,
  type EmpleadoConPerfil,
} from "../api/evaluaciones.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import { BTN_SECONDARY, FIELD_FOCUS, RH_LISTADO_SURFACE } from "../ui/uiTokens.ts";

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
  error: string | null;
  search: string;
}

export function mountEvaluaciones(container: HTMLElement, signal: AbortSignal): void {
  const state: State = { empleadosConPerfil: [], loading: true, error: null, search: "" };

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

  function filteredEmpleados(): EmpleadoConPerfil[] {
    const q = state.search.trim().toLowerCase();
    if (!q) return state.empleadosConPerfil;
    return state.empleadosConPerfil.filter((e) => {
      const hay = [
        e.empleado_nombre,
        e.puesto_nombre ?? "",
        e.grado_nombre ?? "",
        e.area_nombre ?? "",
        e.departamento ?? "",
        e.no_empleado != null ? String(e.no_empleado) : "",
      ];
      return hay.some((s) => s.toLowerCase().includes(q));
    });
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
          ${options.map((o) => `<li data-action="pick-${name}" data-value="${o.id}" class="cursor-pointer px-3 py-2 text-sm hover:bg-blue-50">${escapeHtml(o.label)}</li>`).join("")}
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
            <p class="text-sm font-semibold text-gray-900 truncate">${escapeHtml(e.empleado_nombre)}</p>
            <p class="text-xs text-gray-500 truncate">${escapeHtml(puestoGrado)}</p>
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

  function renderEmpleadosTable(rows: EmpleadoConPerfil[]): string {
    if (rows.length === 0) {
      return `
        <div class="rounded-lg border border-dashed border-gray-300 px-6 py-10 text-center text-sm text-gray-500">
          ${state.search.trim() ? "Sin resultados para la búsqueda." : "No hay colaboradores con perfil asignado."}
        </div>`;
    }

    const body = rows
      .map((e) => {
        const puestoGrado = [e.puesto_nombre, e.grado_nombre].filter(Boolean).join(" · ") || "—";
        const sev = SEVERIDAD_CONFIG[e.severidad_promedio] ?? SEVERIDAD_CONFIG.alineado;
        const evaluadas = e.competencias_evaluadas ?? 0;
        const total = e.total_competencias ?? 0;
        const evalLabel =
          total > 0
            ? `${evaluadas}/${total}`
            : evaluadas > 0
              ? String(evaluadas)
              : "—";
        return `
        <tr class="border-b border-slate-100 hover:bg-slate-50/80">
          <td class="px-4 py-3">
            <p class="text-sm font-medium text-text-primary">${escapeHtml(e.empleado_nombre)}</p>
            ${e.no_empleado != null ? `<p class="text-xs tabular-nums text-text-muted">No. ${e.no_empleado}</p>` : ""}
          </td>
          <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(puestoGrado)}</td>
          <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(e.area_nombre ?? e.departamento ?? "—")}</td>
          <td class="px-4 py-3 text-sm tabular-nums text-slate-700">${evalLabel}</td>
          <td class="px-4 py-3 text-sm font-semibold tabular-nums">${Math.round(e.readiness_score)}%</td>
          <td class="px-4 py-3">
            <span class="inline-flex items-center gap-1.5 text-xs ${sev.text}">
              <span class="size-1.5 rounded-full ${sev.dot}"></span>${sev.label}
            </span>
          </td>
          <td class="px-4 py-3 text-right">
            <a href="#/evaluaciones/empleado/${e.empleado_id}" class="text-xs font-semibold text-accent hover:underline">Ver evaluación</a>
          </td>
        </tr>`;
      })
      .join("");

    return `
      <div class="overflow-x-auto">
        <table class="min-w-full text-left">
          <thead>
            <tr class="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-text-muted">
              <th class="px-4 py-3">Colaborador</th>
              <th class="px-4 py-3">Puesto · Grado</th>
              <th class="px-4 py-3">Área</th>
              <th class="px-4 py-3">Competencias evaluadas</th>
              <th class="px-4 py-3">Readiness</th>
              <th class="px-4 py-3">Brecha</th>
              <th class="px-4 py-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
  }

  function renderListaEmpleados(): string {
    const rows = filteredEmpleados();
    const conEvaluacion = state.empleadosConPerfil.filter(
      (e) => (e.competencias_evaluadas ?? 0) > 0,
    ).length;

    return `
      <section class="${RH_LISTADO_SURFACE} mt-6 overflow-hidden" aria-labelledby="eval-empleados-title">
        <header class="border-b border-slate-100 px-4 py-4 sm:px-5">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="eval-empleados-title" class="text-sm font-semibold text-text-primary">Colaboradores con perfil asignado</h2>
              <p class="mt-0.5 text-xs text-text-muted">
                ${state.empleadosConPerfil.length} con perfil · ${conEvaluacion} con al menos una competencia evaluada
              </p>
            </div>
            <div class="w-full sm:max-w-xs">
              <label class="mb-1 block text-xs font-medium text-text-muted">Buscar</label>
              <input
                type="search"
                data-input="eval-empleados-search"
                value="${escapeHtml(state.search)}"
                placeholder="Nombre, puesto, área o número…"
                class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm ${FIELD_FOCUS}"
              />
            </div>
          </div>
        </header>
        <div class="p-4 sm:p-5">${renderEmpleadosTable(rows)}</div>
      </section>`;
  }

  function renderTarjetas(): string {
    if (state.loading) {
      return `<div class="text-center py-12 text-gray-500">Cargando...</div>`;
    }
    if (state.error) {
      return `
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center">
          <p class="text-sm font-medium text-red-800">No se pudieron cargar los colaboradores</p>
          <p class="mt-1 text-xs text-red-700">${escapeHtml(state.error)}</p>
        </div>`;
    }
    if (state.empleadosConPerfil.length === 0) {
      return `<div class="text-center py-12 text-gray-500 border border-dashed border-gray-300 rounded-lg">
        <p class="text-sm">No hay empleados ligados a un perfil de puesto.</p>
        <p class="text-xs mt-1">Asigna empleados a un perfil desde el módulo de Puestos y evalúa competencias desde «Ver empleados».</p>
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

        ${state.loading || state.error || state.empleadosConPerfil.length === 0 ? "" : renderSelectorPerfil()}

        ${renderTarjetas()}
        ${!state.loading && !state.error && state.empleadosConPerfil.length > 0 ? renderListaEmpleados() : ""}
      </div>
    `;
  }

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
    if (t.matches("[data-action^='search-']")) {
      handleSearchSelect(e);
      return;
    }
    if (t.matches("[data-input='eval-empleados-search']")) {
      state.search = (t as HTMLInputElement).value;
      const lista = root.querySelector("#eval-empleados-title")?.closest("section");
      if (lista) {
        const tableHost = lista.querySelector(".p-4, .sm\\:p-5");
        if (tableHost) {
          tableHost.innerHTML = renderEmpleadosTable(filteredEmpleados());
        }
        const subtitle = lista.querySelector("header p.text-xs");
        if (subtitle) {
          const conEvaluacion = state.empleadosConPerfil.filter(
            (x) => (x.competencias_evaluadas ?? 0) > 0,
          ).length;
          subtitle.textContent = `${state.empleadosConPerfil.length} con perfil · ${conEvaluacion} con al menos una competencia evaluada`;
        }
      } else {
        render();
      }
    }
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

  (async () => {
    render();
    try {
      state.empleadosConPerfil = await getEmpleadosConPerfil();
      state.error = null;
    } catch (err) {
      state.empleadosConPerfil = [];
      state.error = err instanceof Error ? err.message : "Error al cargar empleados";
    }
    state.loading = false;
    render();
  })();
}
