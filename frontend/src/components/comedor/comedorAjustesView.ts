/**
 * Render de «Ajustes Comedor»: administración de comedores + horario de comida por turno.
 *
 * Layout B (Admin List) de `design.md`: encabezado, tabs, stat-filter cards (variante C
 * de §8.6: la métrica *es* el filtro), barra de filtros y data grid. Componente puro —
 * no monta listeners ni llama al API; eso vive en `pages/comedorAjustes.ts`.
 */

import type { ComedorApiItem, ComedorTurnoHorarioApi } from "../../api/comedor.ts";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  FIELD_FOCUS,
  FILTER_FIELD_WRAP,
  RH_LISTADO_SURFACE,
  RH_TABLE_HEAD,
  badgeApproved,
  badgeCancelled,
  badgePending,
  errorState,
  renderTabNav,
  skeletonBlock,
} from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

export type AjustesTabId = "comedores" | "horarios";
export type PanelState = "loading" | "ready" | "empty" | "error";
export type ComedorFiltroEstado = "todos" | "activos" | "inactivos";
export type TurnoFiltroHorario = "todos" | "configurados" | "sin-configurar";

export type ComedorAjustesViewState = {
  tab: AjustesTabId;
  comedores: {
    panelState: PanelState;
    items: readonly ComedorApiItem[];
    filtroEstado: ComedorFiltroEstado;
    busqueda: string;
    errorMessage: string | null;
  };
  turnos: {
    panelState: PanelState;
    items: readonly ComedorTurnoHorarioApi[];
    filtroHorario: TurnoFiltroHorario;
    busqueda: string;
    incluirInactivos: boolean;
    /** `false` = pedir el catálogo completo, no solo los turnos con personal. */
    soloEnUso: boolean;
    guardandoCodigo: string | null;
    errorMessage: string | null;
    /**
     * Horas escritas y todavía no guardadas, por `tu_codigo`. Sin esto, filtrar o buscar
     * repinta la tabla desde `items` y descarta en silencio lo que el usuario capturó.
     */
    borradores: Record<string, { inicio: string; fin: string }>;
  };
};

const TIME_INPUT_CLS = `w-[7.5rem] rounded-md border border-slate-200 px-2.5 py-1.5 text-sm tabular-nums text-text-primary ${FIELD_FOCUS}`;
const SEARCH_INPUT_CLS = `block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 ${FIELD_FOCUS}`;
const TH = "sticky top-0 z-20 bg-[#f8fafc] px-3 py-2 text-left";
const TD = "px-3 py-2.5 align-middle";

// ── Helpers de formato ───────────────────────────────────────────────────────

/** `HH:MM:SS` del backend → `HH:MM` que espera un `<input type="time">`. */
export function toInputTime(value: string | null): string {
  return value ? value.slice(0, 5) : "";
}

/** Minutos entre dos `HH:MM`; `null` si falta alguna o el rango es inválido. */
export function duracionMinutos(inicio: string, fin: string): number | null {
  if (!inicio || !fin) return null;
  const [hi, mi] = inicio.split(":").map(Number);
  const [hf, mf] = fin.split(":").map(Number);
  if ([hi, mi, hf, mf].some((n) => !Number.isFinite(n))) return null;
  const total = hf * 60 + mf - (hi * 60 + mi);
  return total > 0 ? total : null;
}

/** 60 → «1 h»; 90 → «1 h 30 min»; 45 → «45 min». */
export function formatDuracion(min: number | null): string {
  if (min == null) return "—";
  const horas = Math.floor(min / 60);
  const resto = min % 60;
  if (horas === 0) return `${resto} min`;
  if (resto === 0) return `${horas} h`;
  return `${horas} h ${resto} min`;
}

/** Personal activo del turno; «—» cuando la caché aún no se ha sincronizado. */
function formatEmpleados(empleados: number | null): string {
  if (empleados == null) return "—";
  return String(empleados);
}

/** «45 h · 6 días» a partir de lo que TRESS define para el turno. */
function formatJornada(item: ComedorTurnoHorarioApi): string {
  const partes: string[] = [];
  if (item.jornada_horas != null && item.jornada_horas > 0) {
    const h = Number.isInteger(item.jornada_horas)
      ? String(item.jornada_horas)
      : item.jornada_horas.toFixed(1).replace(/\.0$/, "");
    partes.push(`${h} h`);
  }
  if (item.dias_semana != null && item.dias_semana > 0) {
    partes.push(`${item.dias_semana} ${item.dias_semana === 1 ? "día" : "días"}`);
  }
  return partes.length > 0 ? partes.join(" · ") : "—";
}

// ── Filtrado (exportado: la página lo reusa para los conteos) ────────────────

export function filtrarComedores(
  items: readonly ComedorApiItem[],
  filtroEstado: ComedorFiltroEstado,
  busqueda: string,
): ComedorApiItem[] {
  const q = busqueda.trim().toLowerCase();
  return items.filter((item) => {
    if (filtroEstado === "activos" && !item.activo) return false;
    if (filtroEstado === "inactivos" && item.activo) return false;
    if (!q) return true;
    return (
      item.nombre.toLowerCase().includes(q) ||
      (item.ubicacion ?? "").toLowerCase().includes(q)
    );
  });
}

export function filtrarTurnos(
  items: readonly ComedorTurnoHorarioApi[],
  filtroHorario: TurnoFiltroHorario,
  busqueda: string,
): ComedorTurnoHorarioApi[] {
  const q = busqueda.trim().toLowerCase();
  return items.filter((item) => {
    const configurado = item.hora_inicio_comida != null && item.hora_fin_comida != null;
    if (filtroHorario === "configurados" && !configurado) return false;
    if (filtroHorario === "sin-configurar" && configurado) return false;
    if (!q) return true;
    return (
      item.tu_codigo.toLowerCase().includes(q) ||
      item.descripcion.toLowerCase().includes(q)
    );
  });
}

// ── Stat-filter cards (design.md §8.6 variante C) ────────────────────────────

type StatSegment = {
  value: string;
  label: string;
  count: number;
  dotClass: string;
};

function statFilterCards(
  segments: readonly StatSegment[],
  activo: string,
  dataAttr: string,
  ariaLabel: string,
): string {
  const cards = segments
    .map((seg) => {
      const isActive = seg.value === activo;
      const stateCls = isActive
        ? "border-leoni-blue bg-[rgba(219,234,254,0.45)] shadow-[0_6px_18px_rgba(30,64,175,0.12)]"
        : "border-[rgba(148,163,184,0.24)] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:border-leoni-blue/40 hover:bg-slate-50/70";
      return `
        <button type="button" ${dataAttr}="${escapeHtml(seg.value)}" aria-pressed="${isActive}"
          class="group flex flex-col gap-2 rounded-[14px] border p-4 text-left transition ${stateCls} focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue/40 focus-visible:ring-offset-2">
          <span class="flex items-center gap-2">
            <span class="size-2 shrink-0 rounded-full ${seg.dotClass}" aria-hidden="true"></span>
            <span class="text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(seg.label)}</span>
          </span>
          <span class="text-2xl font-bold tabular-nums text-text-primary">${seg.count}</span>
        </button>`;
    })
    .join("");
  return `<section class="grid grid-cols-2 gap-3 sm:grid-cols-3" role="group" aria-label="${escapeHtml(ariaLabel)}">${cards}</section>`;
}

function filterBar(inner: string): string {
  return `<section class="rounded-xl border border-border bg-white p-3 shadow-sm ring-1 ring-slate-900/5 sm:p-4">
    <div class="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-2 sm:gap-x-3 xl:flex-nowrap">${inner}</div>
  </section>`;
}

/**
 * El catálogo de turnos ronda las 76 filas, así que la tabla scrollea dentro de su
 * propia caja con el encabezado fijo (mismo patrón que las tablas largas de RH), en vez
 * de estirar la página y dejar las columnas fuera de vista.
 */
function tableShell(minWidth: string, head: string, body: string): string {
  return `<section class="${RH_LISTADO_SURFACE} overflow-hidden">
    <div class="max-h-[62vh] overflow-auto">
      <table class="${minWidth} w-full text-left">
        <thead class="${RH_TABLE_HEAD}"><tr>${head}</tr></thead>
        <tbody class="divide-y divide-slate-100/90">${body}</tbody>
      </table>
    </div>
  </section>`;
}

function emptyRow(colspan: number, mensaje: string): string {
  return `<tr><td colspan="${colspan}" class="px-3 py-10 text-center text-sm text-slate-500">${escapeHtml(mensaje)}</td></tr>`;
}

// ── Pestaña: Comedores ───────────────────────────────────────────────────────

function renderComedoresPanel(state: ComedorAjustesViewState): string {
  const { panelState, items, filtroEstado, busqueda, errorMessage } = state.comedores;

  if (panelState === "loading") {
    return skeletonBlock({ className: `${RH_LISTADO_SURFACE} h-64`, label: "Cargando comedores…" });
  }
  if (panelState === "error") {
    return errorState({
      message: errorMessage ?? "No se pudo cargar la lista de comedores.",
      actionLabel: "Reintentar",
      actionAttrs: 'data-ajustes-retry="comedores"',
    });
  }

  const activos = items.filter((i) => i.activo).length;
  const stats = statFilterCards(
    [
      { value: "todos", label: "Total", count: items.length, dotClass: "bg-leoni-blue" },
      { value: "activos", label: "Activos", count: activos, dotClass: "bg-emerald-500" },
      { value: "inactivos", label: "Inactivos", count: items.length - activos, dotClass: "bg-slate-400" },
    ],
    filtroEstado,
    "data-comedor-filtro-estado",
    "Filtrar comedores por estado",
  );

  const filtros = filterBar(`
    <div class="${FILTER_FIELD_WRAP}">
      <label for="comedor-busqueda" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Buscar</label>
      <input id="comedor-busqueda" type="search" data-comedor-busqueda value="${escapeHtml(busqueda)}"
        placeholder="Nombre o ubicación" class="${SEARCH_INPUT_CLS}" />
    </div>
    <button type="button" data-comedor-agregar class="${BTN_PRIMARY} shrink-0">Agregar comedor</button>
  `);

  const visibles = filtrarComedores(items, filtroEstado, busqueda);
  const filas =
    visibles.length === 0
      ? emptyRow(
          5,
          items.length === 0
            ? "No hay comedores registrados."
            : "Ningún comedor coincide con el filtro.",
        )
      : visibles
          .map((item) => {
            const ubicacion = item.ubicacion?.trim() ? escapeHtml(item.ubicacion) : "<span class='text-text-muted'>Sin ubicación</span>";
            const capacidad = item.capacidad != null ? `${item.capacidad}` : "—";
            return `
              <tr class="hover:bg-active-tint">
                <td class="${TD} text-sm font-medium text-text-primary">${escapeHtml(item.nombre)}</td>
                <td class="${TD} text-sm text-text-secondary">${ubicacion}</td>
                <td class="${TD} text-sm tabular-nums text-text-secondary">${capacidad}</td>
                <td class="${TD} text-sm">${item.activo ? badgeApproved("Activo") : badgeCancelled("Inactivo")}</td>
                <td class="${TD} text-right text-sm">
                  <button type="button" data-comedor-editar="${item.id}" class="${BTN_SECONDARY} !px-3 !py-1.5">Editar</button>
                </td>
              </tr>`;
          })
          .join("");

  const tabla = tableShell(
    "min-w-[720px]",
    `<th class="${TH} text-xs font-semibold uppercase">Nombre</th>
     <th class="${TH} text-xs font-semibold uppercase">Ubicación</th>
     <th class="${TH} text-xs font-semibold uppercase">Capacidad</th>
     <th class="${TH} text-xs font-semibold uppercase">Estado</th>
     <th class="${TH} text-right text-xs font-semibold uppercase">Acciones</th>`,
    filas,
  );

  return `<div class="flex flex-col gap-4 sm:gap-5">${stats}${filtros}${tabla}</div>`;
}

// ── Pestaña: Horarios de comida ──────────────────────────────────────────────

/** Estado de la celda «Duración»: badge o el tiempo formateado. */
export function celdaDuracionHtml(
  activo: boolean,
  inicio: string,
  fin: string,
): string {
  if (!activo) return badgeCancelled("Turno inactivo");
  const dur = duracionMinutos(inicio, fin);
  if (dur == null) return badgePending("Sin configurar");
  return `<span class="text-sm tabular-nums text-text-secondary">${escapeHtml(formatDuracion(dur))}</span>`;
}

function renderTurnoRow(
  item: ComedorTurnoHorarioApi,
  guardando: boolean,
  borrador: { inicio: string; fin: string } | undefined,
): string {
  const codigo = escapeHtml(item.tu_codigo);
  const guardadoInicio = toInputTime(item.hora_inicio_comida);
  const guardadoFin = toInputTime(item.hora_fin_comida);
  const inicio = borrador?.inicio ?? guardadoInicio;
  const fin = borrador?.fin ?? guardadoFin;
  const sinGuardar = inicio !== guardadoInicio || fin !== guardadoFin;

  const estado = celdaDuracionHtml(item.activo, inicio, fin);
  const marcaSinGuardar = sinGuardar
    ? `<span data-turno-sin-guardar class="text-[11px] font-semibold uppercase tracking-wide text-amber-600">Sin guardar</span>`
    : "";

  return `
    <tr class="hover:bg-active-tint${sinGuardar ? " bg-amber-50/40" : ""}" data-turno-row="${codigo}">
      <td class="${TD}">
        <div class="flex flex-col gap-0.5">
          <span class="font-mono text-xs font-semibold text-text-primary">${codigo}</span>
          <span class="text-sm text-text-secondary">${escapeHtml(item.descripcion)}</span>
          ${marcaSinGuardar}
        </div>
      </td>
      <td class="${TD} text-sm tabular-nums text-text-secondary">${escapeHtml(formatJornada(item))}</td>
      <td class="${TD} text-sm tabular-nums text-text-secondary">${formatEmpleados(item.empleados_activos)}</td>
      <td class="${TD}">
        <input type="time" step="60" value="${inicio}" data-turno-hora-inicio
          aria-label="Hora inicio comida del turno ${codigo}" class="${TIME_INPUT_CLS}" />
      </td>
      <td class="${TD}">
        <input type="time" step="60" value="${fin}" data-turno-hora-fin
          aria-label="Hora fin comida del turno ${codigo}" class="${TIME_INPUT_CLS}" />
      </td>
      <td class="${TD}" data-turno-duracion>${estado}</td>
      <td class="${TD} text-right">
        <button type="button" data-turno-guardar="${codigo}" ${guardando ? "disabled" : ""}
          class="${BTN_SECONDARY} !px-3 !py-1.5 disabled:cursor-not-allowed disabled:opacity-60">
          ${guardando ? "Guardando…" : "Guardar"}
        </button>
      </td>
    </tr>`;
}

function renderTurnosPanel(state: ComedorAjustesViewState): string {
  const {
    panelState,
    items,
    filtroHorario,
    busqueda,
    incluirInactivos,
    soloEnUso,
    guardandoCodigo,
    errorMessage,
    borradores,
  } = state.turnos;

  if (panelState === "loading") {
    return skeletonBlock({ className: `${RH_LISTADO_SURFACE} h-64`, label: "Cargando turnos…" });
  }
  if (panelState === "error") {
    return errorState({
      message: errorMessage ?? "No se pudo cargar la lista de turnos.",
      actionLabel: "Reintentar",
      actionAttrs: 'data-ajustes-retry="turnos"',
    });
  }

  const configurados = items.filter(
    (i) => i.hora_inicio_comida != null && i.hora_fin_comida != null,
  ).length;
  const stats = statFilterCards(
    [
      { value: "todos", label: "Turnos", count: items.length, dotClass: "bg-leoni-blue" },
      { value: "configurados", label: "Con horario", count: configurados, dotClass: "bg-emerald-500" },
      { value: "sin-configurar", label: "Sin horario", count: items.length - configurados, dotClass: "bg-amber-400" },
    ],
    filtroHorario,
    "data-turno-filtro-horario",
    "Filtrar turnos por estado del horario",
  );

  const filtros = filterBar(`
    <div class="${FILTER_FIELD_WRAP}">
      <label for="turno-busqueda" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Buscar</label>
      <input id="turno-busqueda" type="search" data-turno-busqueda value="${escapeHtml(busqueda)}"
        placeholder="Código o descripción del turno" class="${SEARCH_INPUT_CLS}" />
    </div>
    <label class="inline-flex shrink-0 items-center gap-2 py-2 text-sm text-text-secondary">
      <input type="checkbox" data-turno-catalogo-completo ${!soloEnUso ? "checked" : ""}
        class="h-4 w-4 rounded border-slate-300 text-leoni-blue focus:ring-leoni-blue" />
      Ver catálogo completo
    </label>
    <label class="inline-flex shrink-0 items-center gap-2 py-2 text-sm text-text-secondary">
      <input type="checkbox" data-turno-incluir-inactivos ${incluirInactivos ? "checked" : ""}
        class="h-4 w-4 rounded border-slate-300 text-leoni-blue focus:ring-leoni-blue" />
      Mostrar turnos inactivos
    </label>
  `);

  const visibles = filtrarTurnos(items, filtroHorario, busqueda);
  const filas =
    visibles.length === 0
      ? emptyRow(
          7,
          items.length === 0
            ? "No hay turnos con personal asignado."
            : "Ningún turno coincide con el filtro.",
        )
      : visibles
          .map((item) =>
            renderTurnoRow(item, guardandoCodigo === item.tu_codigo, borradores[item.tu_codigo]),
          )
          .join("");

  const tabla = tableShell(
    "min-w-[980px]",
    `<th class="${TH} text-xs font-semibold uppercase">Turno</th>
     <th class="${TH} text-xs font-semibold uppercase">Jornada</th>
     <th class="${TH} text-xs font-semibold uppercase">Empleados</th>
     <th class="${TH} text-xs font-semibold uppercase">Hora inicio comida</th>
     <th class="${TH} text-xs font-semibold uppercase">Hora fin comida</th>
     <th class="${TH} text-xs font-semibold uppercase">Duración</th>
     <th class="${TH} text-right text-xs font-semibold uppercase">Acciones</th>`,
    filas,
  );

  return `<div class="flex flex-col gap-4 sm:gap-5">${stats}${filtros}${tabla}</div>`;
}

// ── Página ───────────────────────────────────────────────────────────────────

export function renderComedorAjustes(state: ComedorAjustesViewState): string {
  const sinHorario = state.turnos.items.filter(
    (i) => i.hora_inicio_comida == null || i.hora_fin_comida == null,
  ).length;

  const tabs = renderTabNav(
    [
      { id: "comedores", label: "Comedores", badge: String(state.comedores.items.length) },
      {
        id: "horarios",
        label: "Horarios de comida",
        badge: sinHorario > 0 ? `${sinHorario} sin configurar` : String(state.turnos.items.length),
      },
    ],
    state.tab,
    { ariaLabel: "Secciones de ajustes de comedor" },
  );

  const panel =
    state.tab === "comedores" ? renderComedoresPanel(state) : renderTurnosPanel(state);

  return `
    <div class="flex flex-col gap-5 sm:gap-6">
      <header class="flex min-w-0 flex-col gap-2">
        <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Ajustes Comedor</h1>
        <p class="max-w-2xl text-sm leading-relaxed text-text-secondary">
          Administra los comedores de la planta y la franja de comida que corresponde a cada turno.
        </p>
      </header>
      ${tabs}
      <div role="tabpanel">${panel}</div>
    </div>
  `;
}
