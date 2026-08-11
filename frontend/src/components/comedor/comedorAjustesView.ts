/**
 * Render de «Ajustes Comedor»: comedores, ventana de comida por jornada y validación.
 *
 * Layout B (Admin List) de `design.md`: encabezado, tabs, stat-filter cards (variante C
 * de §8.6: la métrica *es* el filtro), barra de filtros y data grid. Componente puro —
 * no monta listeners ni llama al API; eso vive en `pages/comedorAjustes.ts`.
 *
 * La pestaña de horarios tiene **una sola superficie editable**: la tabla de jornadas.
 * Los turnos se muestran en modo lectura con su ciclo desplegable. El motivo es que una
 * jornada la comparten varios turnos —la de 06:00-14:00 la recorren ocho—, así que
 * permitir editarla desde dentro de cada turno dejaría dos campos abiertos para el mismo
 * dato y borradores que se pisan entre sí. Editar en un solo lugar también hace evidente
 * que el cambio alcanza a todos los turnos que pasan por esa jornada.
 */

import type {
  ComedorApiItem,
  ComedorJornadaComidaApi,
  ComedorTurnoCicloBloqueApi,
  ComedorTurnoComidaApi,
  ComedorVentanaComidaApi,
} from "../../api/comedor.ts";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  FIELD_FOCUS,
  FILTER_FIELD_WRAP,
  RH_LISTADO_SURFACE,
  RH_TABLE_HEAD,
  alertInfo,
  alertWarning,
  badgeApproved,
  badgeCancelled,
  badgeInProgress,
  badgePending,
  errorState,
  renderTabNav,
  skeletonBlock,
} from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

export type AjustesTabId = "comedores" | "horarios" | "validacion";
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
    items: readonly ComedorTurnoComidaApi[];
    jornadas: readonly ComedorJornadaComidaApi[];
    filtroHorario: TurnoFiltroHorario;
    busqueda: string;
    incluirInactivos: boolean;
    /** `false` = pedir el catálogo completo, no solo los turnos con personal. */
    soloEnUso: boolean;
    /** `ho_codigo` que se está guardando. */
    guardandoCodigo: string | null;
    /** `tu_codigo` de los turnos con el ciclo desplegado. */
    expandidos: readonly string[];
    errorMessage: string | null;
    /**
     * Horas escritas y todavía no guardadas, por `ho_codigo`. Sin esto, filtrar o buscar
     * repinta la tabla desde `jornadas` y descarta en silencio lo que el usuario capturó.
     */
    borradores: Record<string, { inicio: string; fin: string }>;
  };
  validacion: {
    noEmpleado: string;
    fecha: string;
    estado: "idle" | "loading" | "ready" | "error";
    resultado: ComedorVentanaComidaApi | null;
    errorMessage: string | null;
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

/**
 * Minutos entre dos `HH:MM`; `null` si falta alguna o si son iguales.
 *
 * Un fin menor que el inicio **no** es un error: la jornada de 18:00-06:00 come cerca de
 * medianoche (23:30-00:30) y esa ventana cruza al día siguiente, así que se le suman las
 * 24 h en vez de descartarla.
 */
export function duracionMinutos(inicio: string, fin: string): number | null {
  if (!inicio || !fin) return null;
  const [hi, mi] = inicio.split(":").map(Number);
  const [hf, mf] = fin.split(":").map(Number);
  if ([hi, mi, hf, mf].some((n) => !Number.isFinite(n))) return null;
  const total = hf * 60 + mf - (hi * 60 + mi);
  if (total === 0) return null;
  return total > 0 ? total : total + 24 * 60;
}

/** `true` cuando la ventana termina al día siguiente. */
export function cruzaMedianoche(inicio: string, fin: string): boolean {
  if (!inicio || !fin) return false;
  return fin <= inicio;
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

/** «06:00 – 14:00» a partir de la entrada y la salida de la jornada. */
export function formatRangoJornada(
  entrada: string | null,
  salida: string | null,
): string {
  if (!entrada || !salida) return "—";
  return `${toInputTime(entrada)} – ${toInputTime(salida)}`;
}

/** «Semanal» en un turno fijo, «56 días» en uno rotativo. */
export function formatCiclo(item: ComedorTurnoComidaApi): string {
  if (item.longitud_ciclo == null) return "—";
  if (item.tipo_turno === "FIJO") return "Semanal";
  return `${item.longitud_ciclo} días`;
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

export function filtrarJornadas(
  items: readonly ComedorJornadaComidaApi[],
  filtroHorario: TurnoFiltroHorario,
  busqueda: string,
): ComedorJornadaComidaApi[] {
  const q = busqueda.trim().toLowerCase();
  return items.filter((item) => {
    const configurada = item.hora_inicio_comida != null && item.hora_fin_comida != null;
    if (filtroHorario === "configurados" && !configurada) return false;
    if (filtroHorario === "sin-configurar" && configurada) return false;
    if (!q) return true;
    return (
      item.ho_codigo.toLowerCase().includes(q) ||
      item.descripcion.toLowerCase().includes(q) ||
      // Buscar «G9» debe encontrar las jornadas que ese turno recorre.
      item.turnos.some((t) => t.toLowerCase().includes(q))
    );
  });
}

export function filtrarTurnos(
  items: readonly ComedorTurnoComidaApi[],
  busqueda: string,
): ComedorTurnoComidaApi[] {
  const q = busqueda.trim().toLowerCase();
  if (!q) return [...items];
  return items.filter(
    (item) =>
      item.tu_codigo.toLowerCase().includes(q) ||
      item.descripcion.toLowerCase().includes(q) ||
      item.jornadas.some((j) => j.toLowerCase().includes(q)),
  );
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
  if (!activo) return badgeCancelled("Jornada inactiva");
  const dur = duracionMinutos(inicio, fin);
  if (dur == null) return badgePending("Sin configurar");
  const nota = cruzaMedianoche(inicio, fin)
    ? ` <span class="text-[11px] text-text-muted">(cruza medianoche)</span>`
    : "";
  return `<span class="text-sm tabular-nums text-text-secondary">${escapeHtml(formatDuracion(dur))}</span>${nota}`;
}

/** Chips con los turnos que recorren una jornada: el alcance de editarla. */
function chipsTurnos(turnos: readonly string[]): string {
  if (turnos.length === 0) {
    return `<span class="text-xs text-text-muted">Ningún turno la usa</span>`;
  }
  return `<div class="flex flex-wrap gap-1">${turnos
    .map(
      (t) =>
        `<span class="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-text-secondary">${escapeHtml(t)}</span>`,
    )
    .join("")}</div>`;
}

function renderJornadaRow(
  item: ComedorJornadaComidaApi,
  guardando: boolean,
  borrador: { inicio: string; fin: string } | undefined,
): string {
  const codigo = escapeHtml(item.ho_codigo);
  const guardadoInicio = toInputTime(item.hora_inicio_comida);
  const guardadoFin = toInputTime(item.hora_fin_comida);
  const inicio = borrador?.inicio ?? guardadoInicio;
  const fin = borrador?.fin ?? guardadoFin;
  const sinGuardar = inicio !== guardadoInicio || fin !== guardadoFin;

  const marcaSinGuardar = sinGuardar
    ? `<span data-jornada-sin-guardar class="text-[11px] font-semibold uppercase tracking-wide text-amber-600">Sin guardar</span>`
    : "";
  const alcance =
    item.empleados_activos != null && item.empleados_activos > 0
      ? `<span class="text-[11px] text-text-muted">Afecta a ${item.turnos.length} ${
          item.turnos.length === 1 ? "turno" : "turnos"
        } · ${item.empleados_activos} ${item.empleados_activos === 1 ? "empleado" : "empleados"}</span>`
      : "";

  return `
    <tr class="hover:bg-active-tint${sinGuardar ? " bg-amber-50/40" : ""}" data-jornada-row="${codigo}" id="jornada-${codigo}">
      <td class="${TD}">
        <div class="flex flex-col gap-0.5">
          <span class="font-mono text-xs font-semibold text-text-primary">${codigo}</span>
          <span class="text-sm text-text-secondary">${escapeHtml(item.descripcion || "Sin descripción")}</span>
          <span class="text-xs tabular-nums text-text-muted">${escapeHtml(formatRangoJornada(item.hora_entrada, item.hora_salida))}</span>
          ${marcaSinGuardar}
        </div>
      </td>
      <td class="${TD}">
        <div class="flex flex-col gap-1">${chipsTurnos(item.turnos)}${alcance}</div>
      </td>
      <td class="${TD} text-sm tabular-nums text-text-secondary">${formatEmpleados(item.empleados_activos)}</td>
      <td class="${TD}">
        <input type="time" step="60" value="${inicio}" data-jornada-hora-inicio
          aria-label="Hora inicio comida de la jornada ${codigo}" class="${TIME_INPUT_CLS}" />
      </td>
      <td class="${TD}">
        <input type="time" step="60" value="${fin}" data-jornada-hora-fin
          aria-label="Hora fin comida de la jornada ${codigo}" class="${TIME_INPUT_CLS}" />
      </td>
      <td class="${TD}" data-jornada-duracion>${celdaDuracionHtml(item.activo, inicio, fin)}</td>
      <td class="${TD} text-right">
        <button type="button" data-jornada-guardar="${codigo}" ${guardando ? "disabled" : ""}
          class="${BTN_SECONDARY} !px-3 !py-1.5 disabled:cursor-not-allowed disabled:opacity-60">
          ${guardando ? "Guardando…" : "Guardar"}
        </button>
      </td>
    </tr>`;
}

/** Un tramo del ciclo. Un día de descanso nunca muestra ventana de comida. */
function renderBloque(bloque: ComedorTurnoCicloBloqueApi): string {
  if (bloque.estatus === "DESCANSO") {
    return `
      <li class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
        <span class="w-24 shrink-0 text-xs font-semibold text-text-secondary">${escapeHtml(bloque.etiqueta)}</span>
        <span class="text-xs text-text-muted">Descanso</span>
        <span class="text-xs text-text-muted">— sin comida</span>
      </li>`;
  }

  const jornada = `${escapeHtml(bloque.ho_codigo ?? "—")}${
    bloque.ho_descripcion ? ` · ${escapeHtml(bloque.ho_descripcion)}` : ""
  }`;
  const comida = bloque.configurada
    ? `<span class="text-xs font-semibold tabular-nums text-text-primary">Comida ${toInputTime(bloque.hora_inicio_comida)} – ${toInputTime(bloque.hora_fin_comida)}</span>`
    : `<span class="text-xs text-amber-600">Sin configurar</span>
       <button type="button" data-jornada-ir="${escapeHtml(bloque.ho_codigo ?? "")}"
         class="text-xs font-semibold text-leoni-blue underline underline-offset-2">Configurar</button>`;

  return `
    <li class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
      <span class="w-24 shrink-0 text-xs font-semibold text-text-secondary">${escapeHtml(bloque.etiqueta)}</span>
      <span class="text-xs text-text-secondary">${jornada}</span>
      <span class="text-xs tabular-nums text-text-muted">${escapeHtml(formatRangoJornada(bloque.hora_entrada, bloque.hora_salida))}</span>
      ${comida}
    </li>`;
}

function renderTurnoRow(item: ComedorTurnoComidaApi, expandido: boolean): string {
  const codigo = escapeHtml(item.tu_codigo);
  const tipo =
    item.tipo_turno === "ROTATIVO" ? badgeInProgress("Rotativo") : badgeApproved("Fijo");
  const total = item.jornadas.length;
  const cobertura =
    total === 0
      ? "—"
      : item.jornadas_configuradas === total
        ? badgeApproved(`${total} / ${total} jornadas`)
        : badgePending(`${item.jornadas_configuradas} / ${total} jornadas`);

  const detalle = !expandido
    ? ""
    : item.aviso
      ? `<tr data-turno-detalle="${codigo}"><td colspan="6" class="px-3 pb-3">${alertWarning(item.aviso)}</td></tr>`
      : `<tr data-turno-detalle="${codigo}"><td colspan="6" class="bg-slate-50/60 px-3 pb-3 pt-1">
           <ol class="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
             ${item.bloques.map(renderBloque).join("")}
           </ol>
         </td></tr>`;

  return `
    <tr class="hover:bg-active-tint" data-turno-row="${codigo}">
      <td class="${TD}">
        <div class="flex flex-col gap-0.5">
          <span class="font-mono text-xs font-semibold text-text-primary">${codigo}</span>
          <span class="text-sm text-text-secondary">${escapeHtml(item.descripcion)}</span>
        </div>
      </td>
      <td class="${TD} text-sm">${tipo}</td>
      <td class="${TD} text-sm tabular-nums text-text-secondary">${escapeHtml(formatCiclo(item))}</td>
      <td class="${TD} text-sm tabular-nums text-text-secondary">${formatEmpleados(item.empleados_activos)}</td>
      <td class="${TD} text-sm">${cobertura}</td>
      <td class="${TD} text-right">
        <button type="button" data-turno-expandir="${codigo}" aria-expanded="${expandido}"
          class="${BTN_SECONDARY} !px-3 !py-1.5">
          ${expandido ? "Ocultar ciclo" : item.tipo_turno === "ROTATIVO" ? "Ver rotación" : "Ver semana"}
        </button>
      </td>
    </tr>${detalle}`;
}

function renderTurnosPanel(state: ComedorAjustesViewState): string {
  const {
    panelState,
    items,
    jornadas,
    filtroHorario,
    busqueda,
    incluirInactivos,
    soloEnUso,
    guardandoCodigo,
    expandidos,
    errorMessage,
    borradores,
  } = state.turnos;

  if (panelState === "loading") {
    return skeletonBlock({ className: `${RH_LISTADO_SURFACE} h-64`, label: "Cargando jornadas…" });
  }
  if (panelState === "error") {
    return errorState({
      message: errorMessage ?? "No se pudo cargar la configuración de comida.",
      actionLabel: "Reintentar",
      actionAttrs: 'data-ajustes-retry="turnos"',
    });
  }

  const configuradas = jornadas.filter(
    (j) => j.hora_inicio_comida != null && j.hora_fin_comida != null,
  ).length;
  const stats = statFilterCards(
    [
      { value: "todos", label: "Jornadas", count: jornadas.length, dotClass: "bg-leoni-blue" },
      { value: "configurados", label: "Con horario", count: configuradas, dotClass: "bg-emerald-500" },
      { value: "sin-configurar", label: "Sin horario", count: jornadas.length - configuradas, dotClass: "bg-amber-400" },
    ],
    filtroHorario,
    "data-turno-filtro-horario",
    "Filtrar jornadas por estado del horario",
  );

  const filtros = filterBar(`
    <div class="${FILTER_FIELD_WRAP}">
      <label for="turno-busqueda" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Buscar</label>
      <input id="turno-busqueda" type="search" data-turno-busqueda value="${escapeHtml(busqueda)}"
        placeholder="Jornada, turno o descripción" class="${SEARCH_INPUT_CLS}" />
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

  const jornadasVisibles = filtrarJornadas(jornadas, filtroHorario, busqueda);
  const filasJornadas =
    jornadasVisibles.length === 0
      ? emptyRow(
          7,
          jornadas.length === 0
            ? "No hay jornadas que configurar."
            : "Ninguna jornada coincide con el filtro.",
        )
      : jornadasVisibles
          .map((item) =>
            renderJornadaRow(
              item,
              guardandoCodigo === item.ho_codigo,
              borradores[item.ho_codigo],
            ),
          )
          .join("");

  const tablaJornadas = tableShell(
    "min-w-[1040px]",
    `<th class="${TH} text-xs font-semibold uppercase">Jornada</th>
     <th class="${TH} text-xs font-semibold uppercase">Turnos que la usan</th>
     <th class="${TH} text-xs font-semibold uppercase">Empleados</th>
     <th class="${TH} text-xs font-semibold uppercase">Hora inicio comida</th>
     <th class="${TH} text-xs font-semibold uppercase">Hora fin comida</th>
     <th class="${TH} text-xs font-semibold uppercase">Duración</th>
     <th class="${TH} text-right text-xs font-semibold uppercase">Acciones</th>`,
    filasJornadas,
  );

  const turnosVisibles = filtrarTurnos(items, busqueda);
  const filasTurnos =
    turnosVisibles.length === 0
      ? emptyRow(
          6,
          items.length === 0
            ? "No hay turnos con personal asignado."
            : "Ningún turno coincide con el filtro.",
        )
      : turnosVisibles
          .map((item) => renderTurnoRow(item, expandidos.includes(item.tu_codigo)))
          .join("");

  const tablaTurnos = tableShell(
    "min-w-[880px]",
    `<th class="${TH} text-xs font-semibold uppercase">Turno</th>
     <th class="${TH} text-xs font-semibold uppercase">Tipo</th>
     <th class="${TH} text-xs font-semibold uppercase">Ciclo</th>
     <th class="${TH} text-xs font-semibold uppercase">Empleados</th>
     <th class="${TH} text-xs font-semibold uppercase">Cobertura</th>
     <th class="${TH} text-right text-xs font-semibold uppercase">Configuración</th>`,
    filasTurnos,
  );

  return `<div class="flex flex-col gap-4 sm:gap-5">
    ${stats}
    ${filtros}
    <section class="flex flex-col gap-2">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-text-muted">Horario de comida por jornada</h2>
      <p class="text-xs text-text-secondary">
        La hora de comer depende de la jornada que toca ese día. Un turno rotativo recorre
        varias, así que se configura aquí una vez y aplica a todos los turnos que pasan por ella.
      </p>
      ${tablaJornadas}
    </section>
    <section class="flex flex-col gap-2">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-text-muted">Turnos y su ciclo</h2>
      <p class="text-xs text-text-secondary">
        Vista de solo lectura: despliega un turno para ver qué jornada le toca cada día del ciclo.
      </p>
      ${tablaTurnos}
    </section>
  </div>`;
}

// ── Pestaña: Validación ──────────────────────────────────────────────────────

const MOTIVO_TEXTO: Record<string, string> = {
  DESCANSO: "Este día no le corresponde comida: está de descanso.",
  JORNADA_SIN_CONFIGURAR:
    "La jornada de ese día todavía no tiene ventana de comida configurada.",
  JORNADA_FUERA_DE_CATALOGO:
    "La jornada de ese día no está en el catálogo replicado de nómina.",
  SIN_TURNO: "Esta persona no tiene turno asignado.",
  TURNO_FUERA_DE_CATALOGO: "Su turno todavía no está en el catálogo replicado de nómina.",
  PATRON_INVALIDO: "El patrón de rotación de su turno no se puede interpretar.",
  ANCLA_INVALIDA: "Su turno rotativo no tiene fecha de inicio de ciclo en nómina.",
};

function renderResultadoValidacion(r: ComedorVentanaComidaApi): string {
  const filas: string[] = [];
  const dato = (etiqueta: string, valor: string) =>
    `<div class="flex flex-col gap-0.5">
       <span class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(etiqueta)}</span>
       <span class="text-sm text-text-primary">${valor}</span>
     </div>`;

  filas.push(dato("Empleado", `${escapeHtml(r.no_empleado)}${r.nombre ? ` · ${escapeHtml(r.nombre)}` : ""}`));
  filas.push(dato("Fecha", escapeHtml(r.fecha)));
  if (r.tu_codigo) {
    const tipo =
      r.tipo_turno === "ROTATIVO" ? badgeInProgress("Rotativo") : badgeApproved("Fijo");
    filas.push(
      dato(
        "Turno",
        `<span class="font-mono text-xs font-semibold">${escapeHtml(r.tu_codigo)}</span> ${tipo}`,
      ),
    );
  }
  if (r.posicion_ciclo != null && r.longitud_ciclo != null) {
    filas.push(dato("Posición del ciclo", `Día ${r.posicion_ciclo} de ${r.longitud_ciclo}`));
  }
  if (r.ho_codigo) {
    filas.push(
      dato(
        "Jornada",
        `<span class="font-mono text-xs font-semibold">${escapeHtml(r.ho_codigo)}</span> ${escapeHtml(
          r.ho_descripcion ?? "",
        )} <span class="tabular-nums text-text-muted">${escapeHtml(formatRangoJornada(r.hora_entrada, r.hora_salida))}</span>`,
      ),
    );
  }

  const comida =
    r.hora_inicio_comida && r.hora_fin_comida
      ? `<p class="text-2xl font-bold tabular-nums text-text-primary">
           Comida ${toInputTime(r.hora_inicio_comida)} – ${toInputTime(r.hora_fin_comida)}
         </p>`
      : r.motivo_sin_ventana === "DESCANSO"
        ? `<div class="flex items-center gap-2">${badgeCancelled("Descanso")}<span class="text-sm text-text-secondary">Sin comida asignada</span></div>`
        : `<div class="flex items-center gap-2">${badgePending("Sin ventana")}<span class="text-sm text-text-secondary">No hay horario que aplicar</span></div>`;

  const motivo =
    r.motivo_sin_ventana && r.motivo_sin_ventana !== "DESCANSO"
      ? alertWarning(MOTIVO_TEXTO[r.motivo_sin_ventana] ?? r.motivo_sin_ventana)
      : "";
  const aviso = r.aviso ? alertInfo(r.aviso) : "";
  const sync = r.turno_sincronizado_en
    ? `<p class="text-xs text-text-muted">Turno tomado del último sync: ${escapeHtml(
        r.turno_sincronizado_en.slice(0, 16).replace("T", " "),
      )}. Es el turno vigente hoy, no un histórico.</p>`
    : `<p class="text-xs text-text-muted">El turno mostrado es el vigente hoy, no un histórico.</p>`;

  return `<section class="${RH_LISTADO_SURFACE} flex flex-col gap-4 p-4 sm:p-5">
    ${comida}
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">${filas.join("")}</div>
    ${motivo}${aviso}${sync}
  </section>`;
}

function renderValidacionPanel(state: ComedorAjustesViewState): string {
  const { noEmpleado, fecha, estado, resultado, errorMessage } = state.validacion;

  const form = `<section class="rounded-xl border border-border bg-white p-3 shadow-sm ring-1 ring-slate-900/5 sm:p-4">
    <div class="flex min-w-0 flex-wrap items-end gap-x-3 gap-y-2">
      <div class="${FILTER_FIELD_WRAP}">
        <label for="validacion-empleado" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Número de empleado</label>
        <input id="validacion-empleado" type="number" min="1" data-validacion-empleado value="${escapeHtml(noEmpleado)}"
          placeholder="Ej. 406" class="${SEARCH_INPUT_CLS}" />
      </div>
      <div class="${FILTER_FIELD_WRAP}">
        <label for="validacion-fecha" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Fecha</label>
        <input id="validacion-fecha" type="date" data-validacion-fecha value="${escapeHtml(fecha)}"
          class="${SEARCH_INPUT_CLS}" />
      </div>
      <button type="button" data-validacion-consultar ${estado === "loading" ? "disabled" : ""}
        class="${BTN_PRIMARY} shrink-0 disabled:cursor-not-allowed disabled:opacity-60">
        ${estado === "loading" ? "Consultando…" : "Consultar"}
      </button>
    </div>
  </section>`;

  let resultadoHtml = "";
  if (estado === "loading") {
    resultadoHtml = skeletonBlock({ className: `${RH_LISTADO_SURFACE} h-40`, label: "Consultando…" });
  } else if (estado === "error") {
    resultadoHtml = errorState({
      message: errorMessage ?? "No se pudo consultar la ventana de comida.",
      actionLabel: "Reintentar",
      actionAttrs: "data-validacion-consultar",
    });
  } else if (estado === "ready" && resultado) {
    resultadoHtml = renderResultadoValidacion(resultado);
  } else {
    resultadoHtml = `<p class="text-sm text-text-secondary">
      Indica un número de empleado y una fecha para ver qué turno le toca ese día, en qué
      posición del ciclo cae y qué horario de comida le aplica.
    </p>`;
  }

  return `<div class="flex flex-col gap-4 sm:gap-5">${form}${resultadoHtml}</div>`;
}

// ── Página ───────────────────────────────────────────────────────────────────

export function renderComedorAjustes(state: ComedorAjustesViewState): string {
  const sinHorario = state.turnos.jornadas.filter(
    (j) => j.hora_inicio_comida == null || j.hora_fin_comida == null,
  ).length;

  const tabs = renderTabNav(
    [
      { id: "comedores", label: "Comedores", badge: String(state.comedores.items.length) },
      {
        id: "horarios",
        label: "Horarios de comida",
        badge:
          sinHorario > 0
            ? `${sinHorario} sin configurar`
            : String(state.turnos.jornadas.length),
      },
      { id: "validacion", label: "Validación" },
    ],
    state.tab,
    { ariaLabel: "Secciones de ajustes de comedor" },
  );

  const panel =
    state.tab === "comedores"
      ? renderComedoresPanel(state)
      : state.tab === "validacion"
        ? renderValidacionPanel(state)
        : renderTurnosPanel(state);

  return `
    <div class="flex flex-col gap-5 sm:gap-6">
      <header class="flex min-w-0 flex-col gap-2">
        <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Ajustes Comedor</h1>
        <p class="max-w-2xl text-sm leading-relaxed text-text-secondary">
          Administra los comedores de la planta y la ventana de comida de cada jornada, tanto
          para los turnos fijos como para los rotativos.
        </p>
      </header>
      ${tabs}
      <div role="tabpanel">${panel}</div>
    </div>
  `;
}
