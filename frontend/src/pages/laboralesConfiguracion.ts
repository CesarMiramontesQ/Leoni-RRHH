/**
 * Configuración laborales (`#/laborales/configuracion`): parámetros de negocio que
 * antes vivían hardcodeados. Hoy tiene una sola sección, «Home office»: la regla
 * «N días cada M semanas» por área. La estructura queda lista para más secciones.
 *
 * Se listan TODAS las áreas activas de Bono (con o sin regla) para que RH vea de un
 * vistazo quién tiene y quién no. Al guardar una fila se actualiza solo esa fila en el
 * DOM: un repintado descartaría lo que el usuario ya escribió en las demás.
 */

import {
  getHomeOfficeReglasArea,
  guardarHomeOfficeReglaArea,
  laboralesConfigErrorMessage,
  type HomeOfficeReglaAreaItem,
} from "../api/laboralesConfig.ts";
import { canAccessLaboralesConfiguracionPage } from "../auth/jwt.ts";
import { showEmpleadosToast } from "../components/empleados/toast.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { renderLaboralesBackBar } from "../navigation/laboralesBackLink.ts";
import {
  BTN_SECONDARY,
  FIELD_FOCUS,
  RH_DASHBOARD_PAGE_SHELL,
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_LISTADO_SURFACE,
  RH_TABLE_HEAD,
  htmlAccessDenied,
} from "../ui/uiTokens.ts";
import { escapeHtml } from "../ui/uiUtils.ts";

const ROOT_ID = "laborales-config-root";
const DIAS_MAX = 5;
const PERIODO_MAX = 4;

const SHELL_OPTS = {
  pageTitle: "Configuración laborales",
  activeNav: "laborales-configuracion" as const,
  mainClass: "pt-0 pb-5 sm:pb-6",
};

type PanelState = "loading" | "ready" | "error";

type State = {
  panelState: PanelState;
  items: HomeOfficeReglaAreaItem[];
  busqueda: string;
  guardandoAreaId: number | null;
  errorMessage: string | null;
};

const TD = "px-3 py-2.5 align-middle";
const NUM_INPUT =
  `w-20 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm tabular-nums text-slate-900 shadow-sm ${FIELD_FOCUS}`;
const SELECT =
  `w-full appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pr-8 pl-2.5 text-sm text-slate-900 shadow-sm ${FIELD_FOCUS}`;

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "2-digit" });
}

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function estadoBadge(item: HomeOfficeReglaAreaItem): string {
  if (item.dias_permitidos == null) {
    return `<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Sin regla</span>`;
  }
  return item.activo
    ? `<span class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Activa</span>`
    : `<span class="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Apagada</span>`;
}

function periodoOptions(seleccionado: number): string {
  return Array.from({ length: PERIODO_MAX }, (_, i) => i + 1)
    .map((n) => {
      const label = n === 1 ? "cada semana" : `cada ${n} semanas`;
      return `<option value="${n}" ${n === seleccionado ? "selected" : ""}>${label}</option>`;
    })
    .join("");
}

function renderRow(item: HomeOfficeReglaAreaItem, guardando: boolean): string {
  const dias = item.dias_permitidos ?? 1;
  const periodo = item.periodo_semanas ?? 1;
  const activo = item.dias_permitidos == null ? true : item.activo;
  const areaId = item.area_id;
  return `
    <tr data-area-row="${areaId}">
      <td class="${TD}">
        <div class="flex flex-col gap-0.5">
          <span class="text-sm font-semibold text-text-primary">${escapeHtml(item.area_descripcion)}</span>
          <span class="text-xs tabular-nums text-text-muted">Área #${areaId}</span>
        </div>
      </td>
      <td class="${TD}" data-area-estado>${estadoBadge(item)}</td>
      <td class="${TD}">
        <input type="number" min="1" max="${DIAS_MAX}" step="1" value="${dias}" data-area-dias
          aria-label="Días permitidos del área ${escapeHtml(item.area_descripcion)}" class="${NUM_INPUT}" />
      </td>
      <td class="${TD}">
        <div class="relative w-40">
          <select data-area-periodo aria-label="Periodo del área ${escapeHtml(item.area_descripcion)}" class="${SELECT}">
            ${periodoOptions(periodo)}
          </select>
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-gray-500">
            <path fill-rule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
          </svg>
        </div>
      </td>
      <td class="${TD}">
        <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" data-area-activo ${activo ? "checked" : ""}
            class="size-4 rounded border-slate-300 text-leoni-blue focus:ring-leoni-blue" />
          <span>Activa</span>
        </label>
      </td>
      <td class="${TD}" data-area-actualizado>
        <div class="flex flex-col gap-0.5 text-xs text-text-muted">
          <span>${escapeHtml(formatFecha(item.actualizado_en))}</span>
          ${item.actualizado_por ? `<span class="truncate">${escapeHtml(item.actualizado_por)}</span>` : ""}
        </div>
      </td>
      <td class="${TD} text-right">
        <button type="button" data-area-guardar="${areaId}" ${guardando ? "disabled" : ""}
          class="${BTN_SECONDARY} !px-3 !py-1.5 disabled:cursor-not-allowed disabled:opacity-60">
          ${guardando ? "Guardando…" : "Guardar"}
        </button>
      </td>
    </tr>`;
}

function renderTabla(state: State): string {
  const q = normalizar(state.busqueda);
  const visibles = q
    ? state.items.filter((i) => normalizar(i.area_descripcion).includes(q))
    : state.items;
  const head = [
    "Área",
    "Estado",
    "Días",
    "Periodo",
    "",
    "Actualizado",
    "",
  ]
    .map((h) => `<th scope="col" class="px-3 py-2.5 font-semibold">${h}</th>`)
    .join("");
  const body =
    visibles.length === 0
      ? `<tr><td colspan="7" class="px-3 py-10 text-center text-sm text-slate-500">${
          state.items.length === 0 ? "No hay áreas activas en el catálogo." : "Ninguna área coincide con la búsqueda."
        }</td></tr>`
      : visibles.map((i) => renderRow(i, state.guardandoAreaId === i.area_id)).join("");
  return `<div class="max-h-[62vh] overflow-auto">
      <table class="min-w-[880px] w-full text-left">
        <thead class="${RH_TABLE_HEAD}"><tr>${head}</tr></thead>
        <tbody class="divide-y divide-slate-100/90">${body}</tbody>
      </table>
    </div>`;
}

function renderPanel(state: State): string {
  const conRegla = state.items.filter((i) => i.dias_permitidos != null && i.activo).length;
  const resumen =
    state.panelState === "ready"
      ? `<span class="text-xs text-text-muted">${conRegla} de ${state.items.length} áreas con regla activa</span>`
      : "";
  const cuerpo =
    state.panelState === "loading"
      ? `<div class="px-3 py-10 text-center text-sm text-slate-500">Cargando áreas…</div>`
      : state.panelState === "error"
        ? `<div class="m-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
             ${escapeHtml(state.errorMessage ?? "Error al cargar.")}
             <button type="button" data-config-reintentar class="ml-3 font-semibold underline">Reintentar</button>
           </div>`
        : renderTabla(state);
  return `
    <section class="${RH_LISTADO_SURFACE} overflow-hidden">
      <header class="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
        <div class="min-w-0">
          <h2 class="text-base font-semibold text-text-primary">Home office</h2>
          <p class="mt-0.5 text-sm text-text-secondary">
            Cuántos días de home office puede pedir cada área y con qué frecuencia. Un área sin
            regla, o con la regla apagada, no puede solicitarlo. Aplica solo a solicitudes nuevas.
          </p>
          ${resumen}
        </div>
        <div class="relative w-full sm:w-72">
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400">
            <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd" />
          </svg>
          <input id="config-area-busqueda" type="search" data-config-busqueda value="${escapeHtml(state.busqueda)}"
            placeholder="Buscar área…" aria-label="Buscar área"
            class="block w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 ${FIELD_FOCUS}" />
        </div>
      </header>
      ${cuerpo}
    </section>`;
}

function renderPage(state: State): string {
  return `
    <div class="${RH_DASHBOARD_PAGE_SHELL}">
      <div class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">
        ${renderLaboralesBackBar()}
        <header>
          <h1 class="text-2xl font-semibold tracking-tight text-text-primary">Configuración laborales</h1>
          <p class="mt-1 text-sm text-text-secondary">Reglas de negocio del módulo Laborales que administra RH.</p>
        </header>
        <div id="${ROOT_ID}">${renderPanel(state)}</div>
      </div>
    </div>`;
}

export function mountLaboralesConfiguracion(container: HTMLElement, signal: AbortSignal): void {
  if (!canAccessLaboralesConfiguracionPage()) {
    mountAppShell(container, {
      ...SHELL_OPTS,
      mainHtml: `<div class="${RH_DASHBOARD_PAGE_SHELL}"><div class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">${htmlAccessDenied({
        title: "Acceso restringido",
        description:
          "Configuración laborales es exclusiva de RH con el módulo «Configuración laborales» asignado en Permisos RH.",
        linkHref: "#/laborales",
        linkLabel: "Volver a Laborales",
      })}</div></div>`,
    });
    return;
  }

  const state: State = {
    panelState: "loading",
    items: [],
    busqueda: "",
    guardandoAreaId: null,
    errorMessage: null,
  };

  mountAppShell(container, { ...SHELL_OPTS, mainHtml: renderPage(state) });
  const main = container.querySelector<HTMLElement>("main") ?? container;

  function root(): HTMLElement | null {
    return main.querySelector<HTMLElement>(`#${ROOT_ID}`);
  }

  function paint(): void {
    const r = root();
    if (r) r.innerHTML = renderPanel(state);
  }

  /** Repinta conservando foco y caret del buscador (`innerHTML` recrea el input). */
  function paintPreservandoBusqueda(): void {
    const previo = main.querySelector<HTMLInputElement>("[data-config-busqueda]");
    const caret = previo?.selectionStart ?? null;
    paint();
    const nuevo = main.querySelector<HTMLInputElement>("[data-config-busqueda]");
    if (!nuevo) return;
    nuevo.focus();
    if (caret != null) nuevo.setSelectionRange(caret, caret);
  }

  async function load(): Promise<void> {
    state.panelState = "loading";
    state.errorMessage = null;
    paint();
    try {
      const res = await getHomeOfficeReglasArea();
      if (signal.aborted) return;
      state.items = res.items;
      state.panelState = "ready";
    } catch (error) {
      if (signal.aborted) return;
      state.items = [];
      state.panelState = "error";
      state.errorMessage = laboralesConfigErrorMessage(error, "Error al cargar las áreas.");
    }
    paint();
  }

  function leerFila(row: HTMLElement): { dias: number; periodo: number; activo: boolean } | null {
    const diasEl = row.querySelector<HTMLInputElement>("[data-area-dias]");
    const periodoEl = row.querySelector<HTMLSelectElement>("[data-area-periodo]");
    const activoEl = row.querySelector<HTMLInputElement>("[data-area-activo]");
    if (!diasEl || !periodoEl || !activoEl) return null;
    const dias = Number.parseInt(diasEl.value, 10);
    const periodo = Number.parseInt(periodoEl.value, 10);
    if (!Number.isInteger(dias) || dias < 1 || dias > DIAS_MAX) {
      showEmpleadosToast(main, `Los días permitidos deben ser un entero entre 1 y ${DIAS_MAX}.`, "error");
      diasEl.focus();
      return null;
    }
    if (!Number.isInteger(periodo) || periodo < 1 || periodo > PERIODO_MAX) {
      showEmpleadosToast(main, `El periodo debe estar entre 1 y ${PERIODO_MAX} semanas.`, "error");
      return null;
    }
    return { dias, periodo, activo: activoEl.checked };
  }

  function setGuardando(row: HTMLElement, areaId: number, guardando: boolean): void {
    state.guardandoAreaId = guardando ? areaId : null;
    const btn = row.querySelector<HTMLButtonElement>("[data-area-guardar]");
    if (!btn) return;
    btn.disabled = guardando;
    btn.textContent = guardando ? "Guardando…" : "Guardar";
  }

  async function guardar(areaId: number): Promise<void> {
    if (state.guardandoAreaId != null) return;
    const row = main.querySelector<HTMLElement>(`[data-area-row="${areaId}"]`);
    if (!row) return;
    const valores = leerFila(row);
    if (!valores) return;
    setGuardando(row, areaId, true);
    try {
      const actualizado = await guardarHomeOfficeReglaArea(areaId, {
        dias_permitidos: valores.dias,
        periodo_semanas: valores.periodo,
        activo: valores.activo,
      });
      if (signal.aborted) return;
      const idx = state.items.findIndex((i) => i.area_id === areaId);
      if (idx >= 0) state.items[idx] = actualizado;
      // Solo esta fila: las demás pueden tener cambios sin guardar.
      row.outerHTML = renderRow(actualizado, false);
      showEmpleadosToast(main, `Regla de «${actualizado.area_descripcion}» guardada.`, "success");
    } catch (error) {
      if (signal.aborted) return;
      setGuardando(row, areaId, false);
      showEmpleadosToast(
        main,
        laboralesConfigErrorMessage(error, "No se pudo guardar la regla."),
        "error",
      );
      return;
    }
    state.guardandoAreaId = null;
  }

  main.addEventListener(
    "click",
    (ev) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      const guardarBtn = target.closest<HTMLElement>("[data-area-guardar]");
      if (guardarBtn) {
        const id = Number.parseInt(guardarBtn.getAttribute("data-area-guardar") ?? "", 10);
        if (Number.isInteger(id)) void guardar(id);
        return;
      }
      if (target.closest("[data-config-reintentar]")) {
        void load();
      }
    },
    { signal },
  );

  main.addEventListener(
    "input",
    (ev) => {
      const target = ev.target as HTMLElement | null;
      if (!target?.matches("[data-config-busqueda]")) return;
      state.busqueda = (target as HTMLInputElement).value;
      paintPreservandoBusqueda();
    },
    { signal },
  );

  void load();
}
