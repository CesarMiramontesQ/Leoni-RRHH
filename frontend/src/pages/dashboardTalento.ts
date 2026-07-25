/**
 * Dashboard de Talento (`#/talento/dashboard`): consolidación por área de las
 * señales que ya calculan los módulos de la suite (desempeño, polivalencia,
 * capacitación, PDI, índice objetivo). Solo lectura. Mismo patrón de diseño
 * que `pages/historialObjetivo.ts` / `pages/operaciones.ts` (pageHeading,
 * RH_LISTADO_*, skeletonBlock/errorState, per-mount AbortController, event
 * delegation).
 *
 * Los cinco bloques se piden en PARALELO con `Promise.allSettled`: cada
 * columna se pinta en cuanto llega su bloque y, si uno falla (típicamente el
 * índice objetivo, que consulta DATOS_ANALISIS), solo esa columna/tile queda
 * en n/d — el resto de la página sigue de pie.
 *
 * Role-adaptive: RH con el módulo `dashboard-talento` ve el universo
 * completo; un jefe (supervisor/gerente nativo, o RH en Modo líder/gerente)
 * ve solo las áreas de su equipo, scope ya aplicado por el backend.
 */
import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  alertError,
  BTN_GHOST,
  BTN_SECONDARY,
  badgeRejected,
  errorState,
  FORM_SELECT,
  pageHeading,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SURFACE,
  RH_TABLE_HEAD,
  SELECT_CHEVRON,
  skeletonBlock,
} from "../ui/uiTokens.ts";
import { canAccessRhAssignedModule } from "../auth/jwt.ts";
import { CICLO_ESTADO_LABELS } from "../cicloDesempeno/shared.ts";
import type { CicloDesempenoEstado } from "../api/cicloDesempeno.ts";
import { semaforoBadge } from "./operaciones.ts";
import {
  descargarDashboardExcel,
  getCapacitacion,
  getCiclos,
  getDesempeno,
  getDetalleArea,
  getObjetivo,
  getPdi,
  getPolivalencia,
  type AreaPolivalencia,
  type CicloInfo,
  type BloqueCapacitacion,
  type BloqueDesempeno,
  type BloqueObjetivo,
  type BloquePdi,
  type BloquePolivalencia,
  type DetalleArea,
  type EmpleadoFoco,
  type Semaforo,
} from "../api/talento.ts";

type EstadoBloque<T> = { estado: "cargando" } | { estado: "ok"; datos: T } | { estado: "error"; mensaje: string };

type OrdenColumna = "area" | "desempeno" | "polivalencia" | "capacitacion" | "pdi" | "criticas";

interface EstadoPagina {
  polivalencia: EstadoBloque<BloquePolivalencia>;
  desempeno: EstadoBloque<BloqueDesempeno>;
  capacitacion: EstadoBloque<BloqueCapacitacion>;
  pdi: EstadoBloque<BloquePdi>;
  objetivo: EstadoBloque<BloqueObjetivo>;
  /** Ciclos del selector. Vacío = sin selector (no cargaron o no hay ninguno). */
  ciclos: CicloInfo[];
  /** Ciclo elegido a mano; `null` = el que eligió el backend (ver `cicloVigente`). */
  cicloId: number | null;
  areaAbierta: number | null;
  detalle: EstadoBloque<DetalleArea> | null;
  ordenPor: OrdenColumna;
  ordenDesc: boolean;
  exporting: boolean;
  exportError: string | null;
}

/** Une los cinco bloques por area_id. La lista de filas la manda polivalencia. */
interface FilaArea {
  area_id: number;
  area_nombre: string;
  n_empleados: number;
  desempeno: number | null;
  desempenoSemaforo: Semaforo | null;
  polivalencia: number | null;
  polivalenciaSemaforo: Semaforo | null;
  objetivo: number | null;
  capacitacion: number | null;
  capacitacionSemaforo: Semaforo | null;
  pdi: number | null;
  pdiSemaforo: Semaforo | null;
  n_criticas: number;
}

/** Motivos de "sin datos" que el backend expone como código (`app/services/talento_service.py`). */
const MOTIVO_LABELS: Record<string, string> = {
  sin_ciclo: "Sin ciclo de desempeño configurado.",
  sin_resultados: "El ciclo de desempeño activo aún no tiene resultados.",
  sin_datos: "Sin datos disponibles.",
};

/** Señales de riesgo canónicas (`app/services/talento/types.py::SENALES`). */
const SENAL_LABELS: Record<string, string> = {
  desempeno_bajo: "Desempeño bajo",
  polivalencia_baja: "Polivalencia baja",
  capacitacion_pendiente: "Capacitación pendiente",
  pdi_vencido: "PDI vencido",
};

export function construirFilas(estado: EstadoPagina): FilaArea[] {
  if (estado.polivalencia.estado !== "ok") return [];
  const des = estado.desempeno.estado === "ok" ? estado.desempeno.datos.areas : [];
  const cap = estado.capacitacion.estado === "ok" ? estado.capacitacion.datos.areas : [];
  const pdi = estado.pdi.estado === "ok" ? estado.pdi.datos.areas : [];
  const obj = estado.objetivo.estado === "ok" ? estado.objetivo.datos.areas : [];
  const porId = <T extends { area_id: number | null }>(xs: T[]) =>
    new Map(xs.filter((x) => x.area_id !== null).map((x) => [x.area_id as number, x]));
  const desMap = porId(des);
  const capMap = porId(cap);
  const pdiMap = porId(pdi);
  const objMap = porId(obj);

  return estado.polivalencia.datos.areas.map((a: AreaPolivalencia) => ({
    area_id: a.area_id,
    area_nombre: a.area_nombre,
    n_empleados: a.n_empleados,
    desempeno: desMap.get(a.area_id)?.calificacion_promedio ?? null,
    desempenoSemaforo: desMap.get(a.area_id)?.semaforo ?? null,
    polivalencia: a.pol_pct,
    polivalenciaSemaforo: a.semaforo,
    objetivo: objMap.get(a.area_id)?.indice_promedio ?? null,
    capacitacion: capMap.get(a.area_id)?.cumplimiento_pct ?? null,
    capacitacionSemaforo: capMap.get(a.area_id)?.semaforo ?? null,
    pdi: pdiMap.get(a.area_id)?.cumplimiento_pct ?? null,
    pdiSemaforo: pdiMap.get(a.area_id)?.semaforo ?? null,
    n_criticas: a.n_criticas,
  }));
}

export function ordenarFilas(filas: FilaArea[], estado: EstadoPagina): FilaArea[] {
  const clave: Record<OrdenColumna, (f: FilaArea) => number | string | null> = {
    area: (f) => f.area_nombre,
    desempeno: (f) => f.desempeno,
    polivalencia: (f) => f.polivalencia,
    capacitacion: (f) => f.capacitacion,
    pdi: (f) => f.pdi,
    criticas: (f) => f.n_criticas,
  };
  const get = clave[estado.ordenPor];
  // Los null van siempre al final, en las dos direcciones: "sin dato" no es
  // "lo peor". Se particiona en vez de usar un centinela numérico, porque un
  // centinela solo queda "al final" cuando el orden es descendente.
  const conDato: FilaArea[] = [];
  const sinDato: FilaArea[] = [];
  for (const f of filas) {
    (get(f) === null ? sinDato : conDato).push(f);
  }
  conDato.sort((a, b) => {
    const va = get(a) as number | string;
    const vb = get(b) as number | string;
    if (typeof va === "string" || typeof vb === "string") {
      return String(va).localeCompare(String(vb)) * (estado.ordenDesc ? -1 : 1);
    }
    return (va - vb) * (estado.ordenDesc ? -1 : 1);
  });
  return [...conDato, ...sinDato];
}

/** `null` -> n/d, nunca 0 %. */
export function pctTexto(valor: number | null): string {
  return valor === null ? "n/d" : `${valor.toFixed(1)}%`;
}

/**
 * Ciclo cuyos datos se están mostrando: el elegido a mano y, mientras no haya
 * elección, el que resolvió el backend (activo, o el último cerrado). La
 * respuesta de `/desempeno` es la fuente de la verdad, no el orden de la lista.
 */
export function cicloVigente(estado: EstadoPagina): number | null {
  if (estado.cicloId !== null) return estado.cicloId;
  return estado.desempeno.estado === "ok" ? (estado.desempeno.datos.ciclo?.id ?? null) : null;
}

/** Selector de ciclo. Sin ciclos no se pinta: no habría nada que elegir. */
export function selectorCicloHtml(ciclos: CicloInfo[], seleccionado: number | null): string {
  if (!ciclos.length) return "";
  const opciones = ciclos
    .map((c) => {
      const etiqueta = CICLO_ESTADO_LABELS[c.estado as CicloDesempenoEstado] ?? c.estado;
      return `<option value="${c.id}"${c.id === seleccionado ? " selected" : ""}>${escapeHtml(c.nombre)} (${escapeHtml(etiqueta)})</option>`;
    })
    .join("");
  return `<div class="relative min-w-[12rem]">
    <select data-accion="ciclo" aria-label="Ciclo de desempeño" class="${FORM_SELECT}">${opciones}</select>
    ${SELECT_CHEVRON}
  </div>`;
}

export function orgDesempeno(estado: EstadoPagina): number | null {
  return estado.desempeno.estado === "ok" ? (estado.desempeno.datos.org?.calificacion_promedio ?? null) : null;
}

export function orgPolivalencia(estado: EstadoPagina): number | null {
  return estado.polivalencia.estado === "ok" ? (estado.polivalencia.datos.org?.pol_pct ?? null) : null;
}

export function orgCapacitacion(estado: EstadoPagina): number | null {
  return estado.capacitacion.estado === "ok" ? (estado.capacitacion.datos.org?.cumplimiento_pct ?? null) : null;
}

export function orgPdi(estado: EstadoPagina): number | null {
  return estado.pdi.estado === "ok" ? (estado.pdi.datos.org?.cumplimiento_pct ?? null) : null;
}

export function orgObjetivo(estado: EstadoPagina): number | null {
  return estado.objetivo.estado === "ok" ? (estado.objetivo.datos.org?.indice_promedio ?? null) : null;
}

/** Badge de semáforo (verde/ámbar/rojo), reutilizando `semaforoBadge` de `pages/operaciones.ts`. `null` -> sin badge. */
function badgeSemaforo(sem: Semaforo | null): string {
  if (sem === null) return "";
  if (sem === "verde") return semaforoBadge(sem, "OK");
  if (sem === "ambar") return semaforoBadge(sem, "Alerta");
  return semaforoBadge(sem, "Crítico");
}

/** Celda de porcentaje con semáforo. `null` -> n/d, nunca 0 %. */
export function celdaMetrica(valor: number | null, semaforo: Semaforo | null): string {
  if (valor === null) {
    return `<td class="px-3 py-2 text-sm text-text-muted" title="Sin datos">n/d</td>`;
  }
  return `<td class="px-3 py-2 text-sm"><span class="inline-flex items-center gap-1.5">${badgeSemaforo(semaforo)}<span class="tabular-nums text-text-secondary">${valor.toFixed(1)}%</span></span></td>`;
}

/** Celda del índice objetivo: no trae semáforo propio. `null` -> n/d, nunca 0 %. */
function celdaObjetivo(valor: number | null): string {
  if (valor === null) {
    return `<td class="px-3 py-2 text-sm text-text-muted" title="Sin datos">n/d</td>`;
  }
  return `<td class="px-3 py-2 text-sm tabular-nums text-text-secondary">${valor.toFixed(1)}%</td>`;
}

function celdaCriticas(n: number): string {
  if (n > 0) return `<td class="px-3 py-2 text-sm">${badgeRejected(String(n))}</td>`;
  return `<td class="px-3 py-2 text-sm tabular-nums text-text-muted">0</td>`;
}

function tileHtml(titulo: string, bloque: EstadoBloque<unknown>, valor: string, detalle: string): string {
  if (bloque.estado === "cargando") {
    return `<div class="${RH_LISTADO_SURFACE} p-4"><p class="text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(titulo)}</p><div class="mt-2 h-6 w-20 animate-pulse rounded bg-slate-200"></div></div>`;
  }
  if (bloque.estado === "error") {
    return `<div class="${RH_LISTADO_SURFACE} p-4"><p class="text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(titulo)}</p><p class="mt-1 text-xl font-semibold text-text-muted" title="${escapeHtml(bloque.mensaje)}">n/d</p></div>`;
  }
  return `<div class="${RH_LISTADO_SURFACE} p-4"><p class="text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(titulo)}</p><p class="mt-1 text-xl font-semibold text-text-primary">${escapeHtml(valor)}</p><p class="text-xs text-text-muted">${escapeHtml(detalle)}</p></div>`;
}

function encabezado(label: string, col: OrdenColumna, estado: EstadoPagina): string {
  const activo = estado.ordenPor === col;
  const flecha = activo ? (estado.ordenDesc ? " ▼" : " ▲") : "";
  const ariaSort = activo ? (estado.ordenDesc ? "descending" : "ascending") : "none";
  return `<th class="cursor-pointer select-none px-3 py-2 text-left text-xs font-semibold" data-orden="${col}" role="columnheader" aria-sort="${ariaSort}" tabindex="0">${escapeHtml(label)}${flecha}</th>`;
}

function senalBadge(senal: string): string {
  return badgeRejected(SENAL_LABELS[senal] ?? senal);
}

function empleadoFocoRow(e: EmpleadoFoco): string {
  const senales = e.senales.length ? e.senales.map(senalBadge).join(" ") : `<span class="text-text-muted">—</span>`;
  const subtitulo = e.no_empleado != null ? `#${e.no_empleado}` : `ID ${e.empleado_id}`;
  return `<tr class="border-t border-border">
    <td class="px-3 py-2 align-top">
      <p class="text-sm font-medium text-text-primary">${escapeHtml(e.nombre)}</p>
      <p class="text-xs text-text-muted">${escapeHtml(subtitulo)}</p>
    </td>
    <td class="px-3 py-2 align-top text-sm text-text-secondary">${escapeHtml(e.puesto_nombre ?? "—")}</td>
    <td class="px-3 py-2 align-top text-sm"><span class="flex flex-wrap gap-1">${senales}</span></td>
    <td class="px-3 py-2 align-top text-right">
      <a href="#/empleados/${e.empleado_id}" class="${BTN_GHOST} !px-2 !py-1 !text-xs">Ver ficha</a>
    </td>
  </tr>`;
}

/** Desglose de los 4 agregados del área (desempeño/polivalencia/capacitación/PDI),
 * reusando `tileHtml` -- mismo patrón visual que la banda superior de tiles.
 * El wrapper `{ estado: "ok" }` es sintético: aquí no hay estado de carga/error
 * propio, el bloque completo ya llegó resuelto dentro de `DetalleArea`. */
function tilesAgregadosArea(area: DetalleArea): string {
  const ok = { estado: "ok" as const, datos: null };
  return `<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    ${tileHtml("Desempeño", ok, pctTexto(area.desempeno?.calificacion_promedio ?? null), "promedio del ciclo")}
    ${tileHtml("Polivalencia", ok, pctTexto(area.polivalencia?.pol_pct ?? null), "índice del personal")}
    ${tileHtml("Capacitación", ok, pctTexto(area.capacitacion?.cumplimiento_pct ?? null), "cursos completados")}
    ${tileHtml("PDI", ok, pctTexto(area.pdi?.cumplimiento_pct ?? null), "planes completados")}
  </div>`;
}

export function renderDetallePanel(bloque: EstadoBloque<DetalleArea> | null): string {
  if (bloque === null || bloque.estado === "cargando") {
    return skeletonBlock({ className: "rounded-lg border border-border bg-white p-4", label: "Cargando detalle del área…" });
  }
  if (bloque.estado === "error") {
    return errorState({ message: bloque.mensaje });
  }
  const area = bloque.datos;
  const foco = area.empleados_foco;
  const focoHtml = !foco.length
    ? `<p class="rounded-lg border border-border bg-white px-4 py-3 text-sm text-text-muted">Sin empleados en foco (señales de riesgo) en esta área.</p>`
    : `<div class="overflow-x-auto rounded-lg border border-border bg-white">
        <table class="w-full min-w-[560px] text-left">
          <thead class="${RH_TABLE_HEAD}">
            <tr>
              <th class="px-3 py-2 text-xs font-semibold">Empleado</th>
              <th class="px-3 py-2 text-xs font-semibold">Puesto</th>
              <th class="px-3 py-2 text-xs font-semibold">Señales</th>
              <th class="px-3 py-2 text-xs font-semibold"></th>
            </tr>
          </thead>
          <tbody>${foco.map(empleadoFocoRow).join("")}</tbody>
        </table>
      </div>`;
  return `<div class="space-y-3">${tilesAgregadosArea(area)}${focoHtml}</div>`;
}

function filaHtml(fila: FilaArea, estado: EstadoPagina): string {
  const abierta = estado.areaAbierta === fila.area_id;
  const principal = `<tr class="cursor-pointer border-t border-border hover:bg-active-tint" data-area-id="${fila.area_id}" role="button" tabindex="0" aria-expanded="${abierta}">
    <td class="px-3 py-2 text-sm font-medium text-text-primary">${escapeHtml(fila.area_nombre)}</td>
    <td class="px-3 py-2 text-sm tabular-nums text-text-secondary">${fila.n_empleados}</td>
    ${celdaMetrica(fila.desempeno, fila.desempenoSemaforo)}
    ${celdaMetrica(fila.polivalencia, fila.polivalenciaSemaforo)}
    ${celdaObjetivo(fila.objetivo)}
    ${celdaMetrica(fila.capacitacion, fila.capacitacionSemaforo)}
    ${celdaMetrica(fila.pdi, fila.pdiSemaforo)}
    ${celdaCriticas(fila.n_criticas)}
  </tr>`;
  if (!abierta) return principal;
  const detalle = `<tr class="border-t border-border bg-surface-container-low">
    <td colspan="8" class="px-4 py-4">${renderDetallePanel(estado.detalle)}</td>
  </tr>`;
  return principal + detalle;
}

let mountAbort: AbortController | null = null;

export function mountDashboardTalento(container: HTMLElement, signal?: AbortSignal): void {
  mountAbort?.abort();
  mountAbort = new AbortController();
  const mountSignal = mountAbort.signal;
  if (signal) {
    signal.addEventListener("abort", () => mountAbort?.abort(), { once: true, signal: mountSignal });
  }

  /**
   * Criterio alineado con el backend (`api/v1/talento`, ver openapi.yaml):
   * RH inscrito no-admin necesita el módulo `dashboard-talento` (universo
   * completo); cualquier otro rol que llegue aquí (supervisor/gerente
   * nativo, o RH en Modo líder/gerente) cae en la vista de jefe con scope
   * de equipo, ya resuelto por el backend.
   */
  const esGestionRh = canAccessRhAssignedModule("dashboard-talento", {
    blockGestorTeam: true,
    blockEmpleado: true,
    blockDirector: true,
  });

  const estado: EstadoPagina = {
    polivalencia: { estado: "cargando" },
    desempeno: { estado: "cargando" },
    capacitacion: { estado: "cargando" },
    pdi: { estado: "cargando" },
    objetivo: { estado: "cargando" },
    ciclos: [],
    cicloId: null,
    areaAbierta: null,
    detalle: null,
    ordenPor: "criticas",
    ordenDesc: true,
    exporting: false,
    exportError: null,
  };

  function pageContent(): string {
    const filas = ordenarFilas(construirFilas(estado), estado);
    const motivoDesempeno =
      estado.desempeno.estado === "ok" && !estado.desempeno.datos.disponible
        ? (MOTIVO_LABELS[estado.desempeno.datos.motivo ?? ""] ?? "Datos de desempeño no disponibles.")
        : "";
    const exportLabel = estado.exporting ? "Exportando…" : "Exportar Excel";

    const tabla = filas.length
      ? `<div class="${RH_LISTADO_SURFACE} overflow-x-auto">
          <table class="w-full min-w-[900px] text-left">
            <thead class="${RH_TABLE_HEAD}">
              <tr>
                ${encabezado("Área", "area", estado)}
                <th class="px-3 py-2 text-left text-xs font-semibold">Personal</th>
                ${encabezado("Desempeño", "desempeno", estado)}
                ${encabezado("Polivalencia", "polivalencia", estado)}
                <th class="px-3 py-2 text-left text-xs font-semibold">Objetivo</th>
                ${encabezado("Capacitación", "capacitacion", estado)}
                ${encabezado("PDI", "pdi", estado)}
                ${encabezado("Críticas", "criticas", estado)}
              </tr>
            </thead>
            <tbody>${filas.map((f) => filaHtml(f, estado)).join("")}</tbody>
          </table>
        </div>`
      : `<p class="${RH_LISTADO_SURFACE} px-5 py-8 text-center text-sm text-text-muted">
          ${estado.polivalencia.estado === "cargando" ? "Cargando áreas…" : estado.polivalencia.estado === "error" ? "No se pudo cargar la polivalencia por área." : "Sin áreas en tu alcance."}
        </p>`;

    return `<div class="${RH_LISTADO_PAGE_OUTER}">
      ${pageHeading(
        esGestionRh ? "Dashboard de Talento" : "Dashboard de Talento de mi equipo",
        "Consolidación por área de desempeño, polivalencia, capacitación, PDI e índice objetivo.",
        `${selectorCicloHtml(estado.ciclos, cicloVigente(estado))}<button type="button" data-accion="exportar" class="${BTN_SECONDARY}"${estado.exporting ? " disabled" : ""}>${exportLabel}</button>`,
      )}
      ${estado.exportError ? alertError(estado.exportError) : ""}
      ${motivoDesempeno ? `<p class="text-sm text-text-muted">${escapeHtml(motivoDesempeno)}</p>` : ""}
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        ${tileHtml("Desempeño", estado.desempeno, pctTexto(orgDesempeno(estado)), "promedio del ciclo")}
        ${tileHtml("Polivalencia", estado.polivalencia, pctTexto(orgPolivalencia(estado)), "índice del personal")}
        ${tileHtml("Capacitación", estado.capacitacion, pctTexto(orgCapacitacion(estado)), "cursos completados")}
        ${tileHtml("PDI", estado.pdi, pctTexto(orgPdi(estado)), "planes completados")}
        ${tileHtml("Índice objetivo", estado.objetivo, pctTexto(orgObjetivo(estado)), "últimos 12 meses")}
      </div>
      ${tabla}
    </div>`;
  }

  function render(): void {
    mountAppShell(container, {
      pageTitle: "Dashboard de Talento",
      activeNav: "dashboard-talento",
      mainClass: "py-5 sm:py-6",
      mainHtml: pageContent(),
    });
  }

  async function cargarBloques(): Promise<void> {
    const peticiones = [
      { clave: "polivalencia" as const, promesa: getPolivalencia() },
      { clave: "desempeno" as const, promesa: getDesempeno() },
      { clave: "capacitacion" as const, promesa: getCapacitacion() },
      { clave: "pdi" as const, promesa: getPdi() },
      { clave: "objetivo" as const, promesa: getObjetivo() },
    ];
    // allSettled, no all: un bloque caído no debe cancelar los otros cuatro.
    const resultados = await Promise.allSettled(peticiones.map((p) => p.promesa));
    if (mountSignal.aborted) return;
    resultados.forEach((r, i) => {
      const clave = peticiones[i]!.clave;
      estado[clave] =
        r.status === "fulfilled"
          ? ({ estado: "ok", datos: r.value } as never)
          : { estado: "error", mensaje: r.reason instanceof Error ? r.reason.message : "No disponible" };
    });
    render();
  }

  /**
   * Los ciclos van por su cuenta, fuera de `Promise.allSettled`: si el endpoint
   * falla, la página se queda sin selector pero con todos sus datos, misma
   * degradación por bloque que el resto.
   */
  async function cargarCiclos(): Promise<void> {
    try {
      const ciclos = await getCiclos();
      if (mountSignal.aborted) return;
      estado.ciclos = ciclos;
      render();
    } catch {
      /* sin selector; el dashboard sigue mostrando el ciclo que eligió el backend */
    }
  }

  async function recargarDesempeno(cicloId: number): Promise<void> {
    estado.desempeno = { estado: "cargando" };
    render();
    try {
      const datos = await getDesempeno(cicloId);
      if (mountSignal.aborted || estado.cicloId !== cicloId) return;
      estado.desempeno = { estado: "ok", datos };
    } catch (e) {
      if (mountSignal.aborted || estado.cicloId !== cicloId) return;
      estado.desempeno = { estado: "error", mensaje: e instanceof Error ? e.message : "No disponible" };
    }
    render();
  }

  /**
   * Cambiar de ciclo solo repide lo que depende del ciclo: el bloque de
   * desempeño y, si hay un área abierta, su detalle (las señales de riesgo del
   * área salen del ciclo). Polivalencia, capacitación, PDI e índice objetivo no
   * lo reciben, así que no se vuelven a pedir.
   */
  async function cambiarCiclo(cicloId: number): Promise<void> {
    if (Number.isNaN(cicloId) || cicloId === cicloVigente(estado)) return;
    estado.cicloId = cicloId;
    await recargarDesempeno(cicloId);
    if (mountSignal.aborted || estado.cicloId !== cicloId) return;
    if (estado.areaAbierta !== null) void abrirDetalle(estado.areaAbierta);
  }

  async function abrirDetalle(areaId: number): Promise<void> {
    // `cicloPedido` descarta la respuesta si el usuario cambió de ciclo
    // mientras cargaba: sin esto, el detalle del ciclo anterior pisaría al del
    // nuevo. Se compara `estado.cicloId` (la elección explícita) y no
    // `cicloVigente`, que además cambia solo cuando llega el bloque de
    // desempeño y descartaría respuestas legítimas de la carga inicial.
    const cicloPedido = estado.cicloId;
    estado.detalle = { estado: "cargando" };
    render();
    const vigente = () => !mountSignal.aborted && estado.areaAbierta === areaId && estado.cicloId === cicloPedido;
    try {
      const datos = await getDetalleArea(areaId, cicloVigente(estado) ?? undefined);
      if (!vigente()) return;
      estado.detalle = { estado: "ok", datos };
    } catch (e) {
      if (!vigente()) return;
      estado.detalle = { estado: "error", mensaje: e instanceof Error ? e.message : "No se pudo cargar el detalle del área" };
    }
    render();
  }

  async function exportarActual(): Promise<void> {
    if (estado.exporting) return;
    estado.exporting = true;
    estado.exportError = null;
    render();
    const ok = await descargarDashboardExcel("dashboard_talento.xlsx", cicloVigente(estado) ?? undefined);
    if (mountSignal.aborted) return;
    estado.exporting = false;
    if (!ok) estado.exportError = "No se pudo exportar el dashboard a Excel.";
    render();
  }

  function toggleArea(id: number): void {
    estado.areaAbierta = estado.areaAbierta === id ? null : id;
    if (estado.areaAbierta === null) {
      estado.detalle = null;
      render();
      return;
    }
    render();
    void abrirDetalle(id);
  }

  function ordenarPor(col: OrdenColumna): void {
    estado.ordenDesc = estado.ordenPor === col ? !estado.ordenDesc : true;
    estado.ordenPor = col;
    render();
  }

  container.addEventListener(
    "click",
    (ev) => {
      const target = ev.target as HTMLElement;
      if (target.closest("a[href]")) return;
      const accion = target.closest<HTMLElement>("[data-accion]")?.dataset.accion;
      if (accion === "exportar") {
        void exportarActual();
        return;
      }
      const th = target.closest<HTMLElement>("[data-orden]");
      if (th) {
        ordenarPor(th.dataset.orden as OrdenColumna);
        return;
      }
      const tr = target.closest<HTMLElement>("[data-area-id]");
      if (tr) {
        const id = Number(tr.dataset.areaId);
        if (!Number.isNaN(id)) toggleArea(id);
      }
    },
    { signal: mountSignal },
  );

  container.addEventListener(
    "change",
    (ev) => {
      const select = (ev.target as HTMLElement).closest<HTMLSelectElement>("[data-accion='ciclo']");
      if (!select) return;
      void cambiarCiclo(Number(select.value));
    },
    { signal: mountSignal },
  );

  container.addEventListener(
    "keydown",
    (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      const target = ev.target as HTMLElement;
      const th = target.closest<HTMLElement>("[data-orden]");
      if (th && ev.target === th) {
        ev.preventDefault();
        ordenarPor(th.dataset.orden as OrdenColumna);
        return;
      }
      const tr = target.closest<HTMLElement>("[data-area-id]");
      if (!tr || ev.target !== tr) return;
      ev.preventDefault();
      const id = Number(tr.dataset.areaId);
      if (!Number.isNaN(id)) toggleArea(id);
    },
    { signal: mountSignal },
  );

  render();
  void cargarBloques();
  void cargarCiclos();
}
