/**
 * Página de gestión del módulo Metas (`#/talento/metas`): ciclos, asignación
 * de metas (individual/equipo) con sus resultados clave, tablero de avance
 * del equipo y cierre/calificación. Mismo patrón de diseño que
 * `pages/encuestasRh.ts` (pageHeading, renderTabNav con data-tab,
 * skeletonBlock/errorState, per-mount AbortController, event delegation,
 * modales accesibles).
 */
import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  alertError,
  alertInfo,
  alertSuccess,
  BTN_DANGER,
  BTN_GHOST,
  BTN_PRIMARY,
  BTN_SECONDARY,
  errorState,
  FIELD_INPUT,
  FIELD_TEXTAREA,
  FORM_LABEL,
  FORM_SELECT,
  MODAL_OVERLAY,
  MODAL_OVERLAY_NESTED,
  MODAL_PANEL,
  pageHeading,
  renderTabNav,
  RH_DASHBOARD_PAGE_SHELL,
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_LISTADO_SURFACE,
  RH_TABLE_HEAD,
  SELECT_CHEVRON,
  skeletonBlock,
} from "../ui/uiTokens.ts";
import {
  avanceBar,
  avanceRcCliente,
  CICLO_ESTADO_LABELS,
  DIRECCION_LABELS,
  estadoCicloBadge,
  estadoMetaBadge,
  fmtFechaMeta,
  NIVEL_LABELS,
  renderEmptyState,
  TIPO_METRICA_LABELS,
} from "../metas/shared.ts";
import { getAreasOptions, type AreaOption } from "../api/puestos.ts";
import { getEmpleadosPage } from "../api/empleados.ts";
import type { UsuarioListItem } from "../api/usuarios.ts";
import { canAccessRhAssignedModule, getEmpleadoDirectoryNumericIdFromAccessToken } from "../auth/jwt.ts";
import {
  activarCiclo,
  addResultado,
  ajusteCheckin,
  cerrarCiclo,
  cerrarMeta,
  createCiclo,
  createMeta,
  deleteMeta,
  deleteResultado,
  descargarCicloExcel,
  getEquipoAvance,
  getMeta,
  listCiclos,
  listMetas,
  updateCiclo,
  updateMeta,
  updateResultado,
  type EquipoAvanceMiembro,
  type EquipoAvanceResponse,
  type MetaCicloResponse,
  type MetaCreate,
  type MetaNivel,
  type MetaResponse,
  type RcDireccion,
  type RcTipoMetrica,
  type ResultadoClaveCreate,
  type ResultadoClaveResponse,
} from "../api/metas.ts";

/** Elementos enfocables dentro de un panel de modal, para el focus-trap básico (Tab/Shift+Tab). */
const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Acciones de administración de ciclos (solo-RH). Usadas para defensa en
 * profundidad en `handleClick`: aunque el backend ya las rechaza con 403
 * (`role_checker(["operativo"])`), un jefe no debe poder dispararlas ni
 * siquiera si el markup quedara desincronizado.
 */
const CICLO_ADMIN_ACTIONS = new Set([
  "ciclo-nuevo-abrir",
  "ciclo-nuevo-guardar",
  "ciclo-editar-abrir",
  "ciclo-editar-guardar",
  "ciclo-activar",
  "ciclo-cerrar",
]);

type Tab = "ciclos" | "metas" | "tablero";

interface CicloForm {
  nombre: string;
  descripcion: string;
  fechaInicio: string;
  fechaFin: string;
}

function emptyCicloForm(): CicloForm {
  return { nombre: "", descripcion: "", fechaInicio: "", fechaFin: "" };
}

interface RcFormRow {
  titulo: string;
  tipoMetrica: RcTipoMetrica;
  unidad: string;
  direccion: RcDireccion;
  valorInicial: string;
  valorObjetivo: string;
  valorActual: string;
}

function emptyRcFormRow(): RcFormRow {
  return { titulo: "", tipoMetrica: "numero", unidad: "", direccion: "subir", valorInicial: "0", valorObjetivo: "100", valorActual: "" };
}

interface NuevaMetaForm {
  nivel: MetaNivel;
  empleadoId: number | null;
  empleadoNombre: string | null;
  areaId: number | null;
  liderId: string;
  titulo: string;
  descripcion: string;
  peso: string;
  resultadosClave: RcFormRow[];
}

function emptyNuevaMetaForm(liderIdDefault: string): NuevaMetaForm {
  return {
    nivel: "individual",
    empleadoId: null,
    empleadoNombre: null,
    areaId: null,
    liderId: liderIdDefault,
    titulo: "",
    descripcion: "",
    peso: "",
    resultadosClave: [],
  };
}

interface State {
  /** RH-operativo (todas las pestañas/acciones) vs. jefe con scope de equipo (sin administración de ciclos). */
  esGestionRh: boolean;
  tab: Tab;

  ciclos: MetaCicloResponse[] | null;
  ciclosLoading: boolean;
  ciclosError: string | null;
  cicloSeleccionadoId: number | null;

  nuevoCicloOpen: boolean;
  nuevoCicloForm: CicloForm;
  nuevoCicloSaving: boolean;
  nuevoCicloError: string | null;

  editCicloOpen: boolean;
  editCicloId: number | null;
  editCicloForm: CicloForm;
  editCicloSaving: boolean;
  editCicloError: string | null;

  cicloActionError: string | null;
  cicloActionMessage: string | null;

  metas: MetaResponse[] | null;
  metasLoading: boolean;
  metasError: string | null;
  filtroNivel: MetaNivel | "todas";

  nuevaMetaOpen: boolean;
  nuevaMetaForm: NuevaMetaForm;
  nuevaMetaSaving: boolean;
  nuevaMetaError: string | null;
  empleadoQuery: string;
  empleadoResults: UsuarioListItem[] | null;
  empleadoSearching: boolean;
  areasOptions: AreaOption[] | null;

  metaDetalleId: number | null;
  metaDetalle: MetaResponse | null;
  metaDetalleLoading: boolean;
  metaDetalleError: string | null;
  metaEditTitulo: string;
  metaEditDescripcion: string;
  metaEditPeso: string;
  metaEditSaving: boolean;
  metaActionError: string | null;
  metaActionMessage: string | null;

  rcNuevoForm: RcFormRow | null;
  rcNuevoSaving: boolean;
  rcNuevoError: string | null;

  rcCheckinValores: Record<number, string>;
  rcCheckinNotas: Record<number, string>;
  rcCheckinSaving: Record<number, boolean>;
  rcCheckinError: Record<number, string | null>;

  rcEditId: number | null;
  rcEditTitulo: string;
  rcEditUnidad: string;
  rcEditValorObjetivo: string;
  rcEditSaving: boolean;
  rcEditError: string | null;

  cerrarMetaOpen: boolean;
  cerrarMetaCalificacion: string;
  cerrarMetaComentario: string;
  cerrarMetaSaving: boolean;
  cerrarMetaError: string | null;

  tablero: EquipoAvanceResponse | null;
  tableroLoading: boolean;
  tableroError: string | null;

  /** Cache de `empleado_id -> nombre` acumulada desde tablero/búsqueda de empleado (MetaResponse no trae nombre). */
  nombresCache: Record<number, string>;
}

let mountAbort: AbortController | null = null;

export function mountMetas(container: HTMLElement, signal?: AbortSignal): void {
  mountAbort?.abort();
  mountAbort = new AbortController();
  const mountSignal = mountAbort.signal;
  if (signal) {
    signal.addEventListener("abort", () => mountAbort?.abort(), { once: true, signal: mountSignal });
  }

  const liderDefault = getEmpleadoDirectoryNumericIdFromAccessToken();
  /**
   * Criterio (positivo) alineado con el backend: `POST/activar/cerrar/PUT
   * /ciclos` exige `role_checker(["operativo"])`, cuyo criterio para un RH
   * inscrito no-admin es el módulo `metas` (prefix `/api/v1/metas`), NO
   * `dashboard` — no cambiar el módulo aquí sin revisar `role_checker` en
   * `app/api/v1/metas/router.py`. Cualquier otro rol (supervisor/gerente
   * nativo, director, empleado, o admin/RH-legacy en Modo líder/gerente)
   * cae en la vista de jefe: gestiona metas/tablero de su equipo, scope ya
   * aplicado por el backend en `_gestion_or_equipo()`. Usar la forma
   * positiva evita que un rol no-líder (p. ej. director) que llegue a la
   * página vea controles de administración de ciclos que el backend
   * rechazaría (403).
   */
  const esGestionRh = canAccessRhAssignedModule("metas", {
    blockGestorTeam: true,
    blockEmpleado: true,
    blockDirector: true,
  });

  const state: State = {
    esGestionRh,
    tab: esGestionRh ? "ciclos" : "metas",

    ciclos: null,
    ciclosLoading: true,
    ciclosError: null,
    cicloSeleccionadoId: null,

    nuevoCicloOpen: false,
    nuevoCicloForm: emptyCicloForm(),
    nuevoCicloSaving: false,
    nuevoCicloError: null,

    editCicloOpen: false,
    editCicloId: null,
    editCicloForm: emptyCicloForm(),
    editCicloSaving: false,
    editCicloError: null,

    cicloActionError: null,
    cicloActionMessage: null,

    metas: null,
    metasLoading: false,
    metasError: null,
    filtroNivel: "todas",

    nuevaMetaOpen: false,
    nuevaMetaForm: emptyNuevaMetaForm(liderDefault != null ? String(liderDefault) : ""),
    nuevaMetaSaving: false,
    nuevaMetaError: null,
    empleadoQuery: "",
    empleadoResults: null,
    empleadoSearching: false,
    areasOptions: null,

    metaDetalleId: null,
    metaDetalle: null,
    metaDetalleLoading: false,
    metaDetalleError: null,
    metaEditTitulo: "",
    metaEditDescripcion: "",
    metaEditPeso: "",
    metaEditSaving: false,
    metaActionError: null,
    metaActionMessage: null,

    rcNuevoForm: null,
    rcNuevoSaving: false,
    rcNuevoError: null,

    rcCheckinValores: {},
    rcCheckinNotas: {},
    rcCheckinSaving: {},
    rcCheckinError: {},

    rcEditId: null,
    rcEditTitulo: "",
    rcEditUnidad: "",
    rcEditValorObjetivo: "",
    rcEditSaving: false,
    rcEditError: null,

    cerrarMetaOpen: false,
    cerrarMetaCalificacion: "",
    cerrarMetaComentario: "",
    cerrarMetaSaving: false,
    cerrarMetaError: null,

    tablero: null,
    tableroLoading: false,
    tableroError: null,

    nombresCache: {},
  };

  // ── Carga de datos ──────────────────────────────────────────────────────────

  async function loadCiclos(): Promise<void> {
    state.ciclosLoading = true;
    render();
    try {
      state.ciclos = await listCiclos();
      state.ciclosError = null;
      if (state.cicloSeleccionadoId == null || !state.ciclos.some((c) => c.id === state.cicloSeleccionadoId)) {
        const activo = state.ciclos.find((c) => c.estado === "activo");
        state.cicloSeleccionadoId = activo?.id ?? state.ciclos[0]?.id ?? null;
      }
    } catch (err: unknown) {
      state.ciclosError = (err as Error)?.message ?? "No se pudieron cargar los ciclos";
    }
    state.ciclosLoading = false;
    render();
    if (state.tab === "metas") void loadMetas();
    if (state.tab === "tablero") void loadTablero();
  }

  async function loadMetas(): Promise<void> {
    if (state.cicloSeleccionadoId == null) {
      state.metas = [];
      render();
      return;
    }
    state.metasLoading = true;
    render();
    try {
      state.metas = await listMetas({ ciclo_id: state.cicloSeleccionadoId });
      state.metasError = null;
    } catch (err: unknown) {
      state.metasError = (err as Error)?.message ?? "No se pudieron cargar las metas";
    }
    state.metasLoading = false;
    render();
  }

  async function loadTablero(): Promise<void> {
    if (state.cicloSeleccionadoId == null) {
      state.tablero = null;
      render();
      return;
    }
    state.tableroLoading = true;
    render();
    try {
      state.tablero = await getEquipoAvance(state.cicloSeleccionadoId);
      state.tableroError = null;
      for (const miembro of state.tablero.miembros) {
        if (miembro.empleado_nombre) state.nombresCache[miembro.empleado_id] = miembro.empleado_nombre;
      }
    } catch (err: unknown) {
      state.tableroError = (err as Error)?.message ?? "No se pudo cargar el tablero";
    }
    state.tableroLoading = false;
    render();
  }

  async function loadAreasOptions(): Promise<void> {
    if (state.areasOptions != null) return;
    state.areasOptions = await getAreasOptions();
    render();
  }

  async function openMetaDetalle(id: number): Promise<void> {
    state.metaDetalleId = id;
    state.metaDetalle = null;
    state.metaDetalleLoading = true;
    state.metaDetalleError = null;
    state.metaActionError = null;
    state.metaActionMessage = null;
    state.rcNuevoForm = null;
    state.rcEditId = null;
    render();
    try {
      const m = await getMeta(id);
      state.metaDetalle = m;
      state.metaEditTitulo = m.titulo;
      state.metaEditDescripcion = m.descripcion ?? "";
      state.metaEditPeso = String(m.peso);
      state.metaDetalleError = null;
    } catch (err: unknown) {
      state.metaDetalleError = (err as Error)?.message ?? "No se pudo cargar la meta";
    }
    state.metaDetalleLoading = false;
    render();
    focusTopModal();
  }

  function closeMetaDetalle(): void {
    state.metaDetalleId = null;
    state.metaDetalle = null;
    render();
    void loadMetas();
    if (state.tab === "tablero") void loadTablero();
  }

  // ── Render: pestaña Ciclos ───────────────────────────────────────────────────

  function renderCicloRow(c: MetaCicloResponse): string {
    const acciones: string[] = [];
    if (c.estado !== "cerrado") {
      acciones.push(`<button type="button" data-action="ciclo-editar-abrir" data-id="${c.id}" class="${BTN_GHOST}">Editar</button>`);
    }
    if (c.estado === "borrador") {
      acciones.push(`<button type="button" data-action="ciclo-activar" data-id="${c.id}" class="${BTN_SECONDARY}">Activar</button>`);
    }
    if (c.estado === "activo") {
      acciones.push(`<button type="button" data-action="ciclo-cerrar" data-id="${c.id}" class="${BTN_DANGER}">Cerrar ciclo</button>`);
    }
    acciones.push(`<button type="button" data-action="ciclo-exportar" data-id="${c.id}" class="${BTN_GHOST}">Exportar Excel</button>`);
    return `
    <tr class="border-b border-slate-100 last:border-b-0">
      <td class="px-3 py-3 align-middle">
        <p class="font-semibold text-text-primary">${escapeHtml(c.nombre)}</p>
        ${c.descripcion ? `<p class="text-xs text-text-muted">${escapeHtml(c.descripcion)}</p>` : ""}
      </td>
      <td class="px-3 py-3 align-middle">${estadoCicloBadge(c.estado)}</td>
      <td class="px-3 py-3 align-middle text-sm text-text-muted">${escapeHtml(fmtFechaMeta(c.fecha_inicio))} – ${escapeHtml(fmtFechaMeta(c.fecha_fin))}</td>
      <td class="px-3 py-3 align-middle"><div class="flex flex-wrap items-center gap-2">${acciones.join("")}</div></td>
    </tr>`;
  }

  function renderCiclosTab(): string {
    if (state.ciclosLoading) {
      return skeletonBlock({ className: `${RH_LISTADO_SURFACE} px-6 py-16`, label: "Cargando ciclos…" });
    }
    if (state.ciclosError) {
      return errorState({ message: state.ciclosError, actionLabel: "Reintentar", actionAttrs: 'data-action="reload-ciclos"' });
    }
    const ciclos = state.ciclos ?? [];
    return `
    <div class="flex flex-col gap-4">
      ${state.cicloActionError ? alertError(state.cicloActionError) : ""}
      ${state.cicloActionMessage ? alertSuccess(state.cicloActionMessage) : ""}
      ${
        ciclos.length === 0
          ? renderEmptyState({
              title: "No hay ciclos de metas",
              subtitle: "Crea el primer ciclo para empezar a asignar metas.",
              actionHtml: `<button type="button" data-action="ciclo-nuevo-abrir" class="${BTN_PRIMARY}">+ Nuevo ciclo</button>`,
            })
          : `<section class="${RH_LISTADO_SURFACE} overflow-x-auto">
              <table class="min-w-[760px] w-full text-left">
                <thead class="${RH_TABLE_HEAD}">
                  <tr>
                    <th class="px-3 py-2.5">Ciclo</th>
                    <th class="px-3 py-2.5">Estado</th>
                    <th class="px-3 py-2.5">Vigencia</th>
                    <th class="px-3 py-2.5">Acciones</th>
                  </tr>
                </thead>
                <tbody>${ciclos.map(renderCicloRow).join("")}</tbody>
              </table>
            </section>`
      }
    </div>`;
  }

  function renderCicloFormFields(f: CicloForm, prefix: "nuevo" | "editar"): string {
    return `
    <div class="flex flex-col gap-3">
      <div>
        <label class="${FORM_LABEL}" for="ciclo-${prefix}-nombre">Nombre</label>
        <input id="ciclo-${prefix}-nombre" data-ciclo-field="nombre" data-ciclo-prefix="${prefix}" type="text" value="${escapeHtml(f.nombre)}" class="${FIELD_INPUT}" placeholder="Ej. Metas Q3 2026" />
      </div>
      <div>
        <label class="${FORM_LABEL}" for="ciclo-${prefix}-descripcion">Descripción (opcional)</label>
        <textarea id="ciclo-${prefix}-descripcion" data-ciclo-field="descripcion" data-ciclo-prefix="${prefix}" rows="2" class="${FIELD_TEXTAREA}">${escapeHtml(f.descripcion)}</textarea>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="${FORM_LABEL}" for="ciclo-${prefix}-inicio">Fecha inicio</label>
          <input id="ciclo-${prefix}-inicio" data-ciclo-field="fechaInicio" data-ciclo-prefix="${prefix}" type="date" value="${escapeHtml(f.fechaInicio)}" class="${FIELD_INPUT}" />
        </div>
        <div>
          <label class="${FORM_LABEL}" for="ciclo-${prefix}-fin">Fecha fin</label>
          <input id="ciclo-${prefix}-fin" data-ciclo-field="fechaFin" data-ciclo-prefix="${prefix}" type="date" value="${escapeHtml(f.fechaFin)}" class="${FIELD_INPUT}" />
        </div>
      </div>
    </div>`;
  }

  function renderNuevoCicloModal(): string {
    if (!state.nuevoCicloOpen) return "";
    const f = state.nuevoCicloForm;
    const puedeGuardar = !!f.fechaInicio && !!f.fechaFin;
    return `
    <div class="${MODAL_OVERLAY}" data-modal="ciclo-nuevo">
      <div class="${MODAL_PANEL} max-w-lg" role="dialog" aria-modal="true" aria-labelledby="ciclo-nuevo-titulo">
        <header class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="ciclo-nuevo-titulo" class="text-base font-bold text-text-primary">Nuevo ciclo de metas</h2>
          <button type="button" data-action="ciclo-nuevo-cerrar" class="text-text-muted hover:text-text-primary" aria-label="Cerrar">✕</button>
        </header>
        <div class="max-h-[70vh] overflow-y-auto px-5 py-4">
          ${state.nuevoCicloError ? `<div class="mb-3">${alertError(state.nuevoCicloError)}</div>` : ""}
          ${renderCicloFormFields(f, "nuevo")}
        </div>
        <footer class="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button type="button" data-action="ciclo-nuevo-cerrar" class="${BTN_SECONDARY}">Cancelar</button>
          <button type="button" data-action="ciclo-nuevo-guardar" class="${BTN_PRIMARY}" ${!puedeGuardar || state.nuevoCicloSaving ? "disabled" : ""}>
            ${state.nuevoCicloSaving ? "Creando…" : "Crear ciclo"}
          </button>
        </footer>
      </div>
    </div>`;
  }

  function renderEditCicloModal(): string {
    if (!state.editCicloOpen) return "";
    const f = state.editCicloForm;
    return `
    <div class="${MODAL_OVERLAY}" data-modal="ciclo-editar">
      <div class="${MODAL_PANEL} max-w-lg" role="dialog" aria-modal="true" aria-labelledby="ciclo-editar-titulo">
        <header class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="ciclo-editar-titulo" class="text-base font-bold text-text-primary">Editar ciclo</h2>
          <button type="button" data-action="ciclo-editar-cerrar" class="text-text-muted hover:text-text-primary" aria-label="Cerrar">✕</button>
        </header>
        <div class="max-h-[70vh] overflow-y-auto px-5 py-4">
          ${state.editCicloError ? `<div class="mb-3">${alertError(state.editCicloError)}</div>` : ""}
          ${renderCicloFormFields(f, "editar")}
        </div>
        <footer class="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button type="button" data-action="ciclo-editar-cerrar" class="${BTN_SECONDARY}">Cancelar</button>
          <button type="button" data-action="ciclo-editar-guardar" class="${BTN_PRIMARY}" ${state.editCicloSaving ? "disabled" : ""}>
            ${state.editCicloSaving ? "Guardando…" : "Guardar cambios"}
          </button>
        </footer>
      </div>
    </div>`;
  }

  // ── Render: selector de ciclo (compartido Metas/Tablero) ────────────────────

  function renderCicloSelector(): string {
    const ciclos = state.ciclos ?? [];
    return `
    <div class="min-w-[14rem]">
      <label class="${FORM_LABEL}" for="metas-ciclo-selector">Ciclo</label>
      <div class="relative">
        <select id="metas-ciclo-selector" data-action="ciclo-selector" class="${FORM_SELECT}">
          ${ciclos.map((c) => `<option value="${c.id}"${state.cicloSeleccionadoId === c.id ? " selected" : ""}>${escapeHtml(c.nombre)} (${CICLO_ESTADO_LABELS[c.estado]})</option>`).join("")}
        </select>
        ${SELECT_CHEVRON}
      </div>
    </div>`;
  }

  // ── Render: pestaña Metas ────────────────────────────────────────────────────

  function renderMetaRow(m: MetaResponse): string {
    const dueno =
      m.nivel === "individual"
        ? (m.empleado_id != null ? state.nombresCache[m.empleado_id] : null) ?? `Empleado #${m.empleado_id ?? "—"}`
        : `Equipo (líder #${m.lider_id ?? "—"})`;
    return `
    <tr class="border-b border-slate-100 last:border-b-0">
      <td class="px-3 py-3 align-middle">
        <p class="font-semibold text-text-primary">${escapeHtml(m.titulo)}</p>
        ${m.descripcion ? `<p class="text-xs text-text-muted">${escapeHtml(m.descripcion)}</p>` : ""}
      </td>
      <td class="px-3 py-3 align-middle text-sm text-text-secondary">${NIVEL_LABELS[m.nivel]} · ${escapeHtml(dueno)}</td>
      <td class="px-3 py-3 align-middle">${estadoMetaBadge(m.estado)}</td>
      <td class="px-3 py-3 align-middle text-sm tabular-nums">${m.peso}%</td>
      <td class="px-3 py-3 align-middle min-w-[8rem]">${avanceBar(m.avance)}</td>
      <td class="px-3 py-3 align-middle"><button type="button" data-action="meta-detalle-abrir" data-id="${m.id}" class="${BTN_GHOST}">Ver detalle</button></td>
    </tr>`;
  }

  function renderMetasList(puedeAsignar: boolean): string {
    if (state.metasLoading) {
      return skeletonBlock({ className: `${RH_LISTADO_SURFACE} px-6 py-16`, label: "Cargando metas…" });
    }
    if (state.metasError) {
      return errorState({ message: state.metasError, actionLabel: "Reintentar", actionAttrs: 'data-action="reload-metas"' });
    }
    const metas = (state.metas ?? []).filter((m) => state.filtroNivel === "todas" || m.nivel === state.filtroNivel);
    if (metas.length === 0) {
      const sinNingunaMeta = state.filtroNivel === "todas";
      if (sinNingunaMeta && puedeAsignar) {
        return renderEmptyState({
          title: state.esGestionRh ? "Aún no hay metas en este ciclo" : "Tu equipo aún no tiene metas en este ciclo",
          subtitle: "Asigna una nueva meta para este ciclo.",
          actionHtml: `<button type="button" data-action="meta-nueva-abrir" class="${BTN_PRIMARY}">+ Asignar meta</button>`,
        });
      }
      return renderEmptyState({
        title: "No hay metas con este filtro",
        subtitle: sinNingunaMeta ? "Asigna una nueva meta para este ciclo." : "Ajusta el filtro de nivel para ver otras metas.",
      });
    }
    return `<section class="${RH_LISTADO_SURFACE} overflow-x-auto">
      <table class="min-w-[860px] w-full text-left">
        <thead class="${RH_TABLE_HEAD}">
          <tr>
            <th class="px-3 py-2.5">Meta</th>
            <th class="px-3 py-2.5">Nivel / dueño</th>
            <th class="px-3 py-2.5">Estado</th>
            <th class="px-3 py-2.5">Peso</th>
            <th class="px-3 py-2.5">Avance</th>
            <th class="px-3 py-2.5">Acciones</th>
          </tr>
        </thead>
        <tbody>${metas.map(renderMetaRow).join("")}</tbody>
      </table>
    </section>`;
  }

  function renderMetasTab(): string {
    if (state.ciclosLoading) {
      return skeletonBlock({ className: `${RH_LISTADO_SURFACE} px-6 py-16`, label: "Cargando ciclos…" });
    }
    if ((state.ciclos ?? []).length === 0) {
      return renderEmptyState(
        state.esGestionRh
          ? { title: "Aún no hay ciclos", subtitle: "Crea un ciclo en la pestaña Ciclos antes de asignar metas." }
          : { title: "Aún no hay ciclos de metas", subtitle: "Pídele a RH que cree uno." },
      );
    }
    const cicloActual = (state.ciclos ?? []).find((c) => c.id === state.cicloSeleccionadoId) ?? null;
    const puedeAsignar = cicloActual?.estado === "activo";
    return `
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div class="flex flex-wrap items-end gap-3">
          ${renderCicloSelector()}
          <div class="min-w-[10rem]">
            <label class="${FORM_LABEL}" for="metas-filtro-nivel">Nivel</label>
            <div class="relative">
              <select id="metas-filtro-nivel" data-action="filtro-nivel" class="${FORM_SELECT}">
                <option value="todas"${state.filtroNivel === "todas" ? " selected" : ""}>Todas</option>
                <option value="individual"${state.filtroNivel === "individual" ? " selected" : ""}>Individual</option>
                <option value="equipo"${state.filtroNivel === "equipo" ? " selected" : ""}>Equipo</option>
              </select>
              ${SELECT_CHEVRON}
            </div>
          </div>
        </div>
        <button type="button" data-action="meta-nueva-abrir" class="${BTN_PRIMARY}" ${!puedeAsignar ? "disabled" : ""}>+ Nueva meta</button>
      </div>
      ${!puedeAsignar ? alertInfo("Solo se pueden asignar metas nuevas en un ciclo activo.") : ""}
      ${state.metaActionError ? alertError(state.metaActionError) : ""}
      ${state.metaActionMessage ? alertSuccess(state.metaActionMessage) : ""}
      ${renderMetasList(puedeAsignar)}
    </div>`;
  }

  // ── Render: modal Nueva meta ─────────────────────────────────────────────────

  function renderNivelFieldset(): string {
    const f = state.nuevaMetaForm;
    return `
    <fieldset>
      <legend class="${FORM_LABEL}">Nivel</legend>
      <div class="flex gap-2" role="radiogroup" aria-label="Nivel de la meta">
        <button type="button" role="radio" aria-checked="${f.nivel === "individual"}" data-action="meta-nivel" data-value="individual" class="${f.nivel === "individual" ? BTN_PRIMARY : BTN_SECONDARY}">Individual</button>
        <button type="button" role="radio" aria-checked="${f.nivel === "equipo"}" data-action="meta-nivel" data-value="equipo" class="${f.nivel === "equipo" ? BTN_PRIMARY : BTN_SECONDARY}">Equipo</button>
      </div>
    </fieldset>`;
  }

  function renderEmpleadoPicker(): string {
    const f = state.nuevaMetaForm;
    if (f.empleadoId != null) {
      return `<div class="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <span class="text-sm text-text-primary">${escapeHtml(f.empleadoNombre ?? `Empleado #${f.empleadoId}`)}</span>
        <button type="button" data-action="empleado-quitar" class="${BTN_GHOST}">Cambiar</button>
      </div>`;
    }
    return `
    <div class="flex flex-col gap-2">
      <div class="flex gap-2">
        <input type="text" data-field="empleado-query" value="${escapeHtml(state.empleadoQuery)}" class="${FIELD_INPUT}" placeholder="Buscar por nombre o número de empleado…" />
        <button type="button" data-action="empleado-buscar" class="${BTN_SECONDARY} shrink-0" ${state.empleadoSearching ? "disabled" : ""}>${state.empleadoSearching ? "Buscando…" : "Buscar"}</button>
      </div>
      ${
        state.empleadoResults == null
          ? ""
          : state.empleadoResults.length === 0
            ? `<p class="text-xs text-text-muted">Sin resultados.</p>`
            : `<div class="max-h-40 overflow-y-auto rounded-lg border border-slate-200">
                ${state.empleadoResults
                  .map(
                    (u) => `
                  <button type="button" data-action="empleado-seleccionar" data-id="${u.empleado_id}" data-nombre="${escapeHtml(u.nombre)}" class="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50">
                    <span>${escapeHtml(u.nombre)}</span>
                    <span class="text-xs text-text-muted">#${u.empleado_id}</span>
                  </button>`,
                  )
                  .join("")}
              </div>`
      }
    </div>`;
  }

  function renderRcFormRow(row: RcFormRow, index: number): string {
    return `
    <div class="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
      <div class="flex items-center justify-between">
        <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Resultado clave ${index + 1}</p>
        <button type="button" data-action="rc-form-quitar" data-index="${index}" class="${BTN_GHOST}">Quitar</button>
      </div>
      <input type="text" data-rc-field="titulo" data-rc-index="${index}" value="${escapeHtml(row.titulo)}" class="${FIELD_INPUT}" placeholder="Título del resultado clave" />
      <div class="grid grid-cols-2 gap-2">
        <div class="relative">
          <select data-rc-field="tipoMetrica" data-rc-index="${index}" class="${FORM_SELECT}">
            ${Object.entries(TIPO_METRICA_LABELS).map(([v, l]) => `<option value="${v}"${row.tipoMetrica === v ? " selected" : ""}>${l}</option>`).join("")}
          </select>
          ${SELECT_CHEVRON}
        </div>
        <div class="relative">
          <select data-rc-field="direccion" data-rc-index="${index}" class="${FORM_SELECT}">
            ${Object.entries(DIRECCION_LABELS).map(([v, l]) => `<option value="${v}"${row.direccion === v ? " selected" : ""}>${l}</option>`).join("")}
          </select>
          ${SELECT_CHEVRON}
        </div>
      </div>
      <input type="text" data-rc-field="unidad" data-rc-index="${index}" value="${escapeHtml(row.unidad)}" class="${FIELD_INPUT}" placeholder="Unidad (opcional, ej. %, pzas, $)" />
      <div class="grid grid-cols-3 gap-2">
        <div>
          <label class="text-[11px] text-text-muted">Valor inicial</label>
          <input type="number" step="any" data-rc-field="valorInicial" data-rc-index="${index}" value="${escapeHtml(row.valorInicial)}" class="${FIELD_INPUT}" />
        </div>
        <div>
          <label class="text-[11px] text-text-muted">Valor objetivo</label>
          <input type="number" step="any" data-rc-field="valorObjetivo" data-rc-index="${index}" value="${escapeHtml(row.valorObjetivo)}" class="${FIELD_INPUT}" />
        </div>
        <div>
          <label class="text-[11px] text-text-muted">Valor actual (opcional)</label>
          <input type="number" step="any" data-rc-field="valorActual" data-rc-index="${index}" value="${escapeHtml(row.valorActual)}" class="${FIELD_INPUT}" placeholder="= inicial" />
        </div>
      </div>
    </div>`;
  }

  function renderNuevaMetaModal(): string {
    if (!state.nuevaMetaOpen) return "";
    const f = state.nuevaMetaForm;
    const areas = state.areasOptions ?? [];
    const puedeGuardar = f.nivel === "individual" ? f.empleadoId != null : f.areaId != null;
    return `
    <div class="${MODAL_OVERLAY}" data-modal="meta-nueva">
      <div class="${MODAL_PANEL} max-w-2xl" role="dialog" aria-modal="true" aria-labelledby="meta-nueva-titulo">
        <header class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="meta-nueva-titulo" class="text-base font-bold text-text-primary">Nueva meta</h2>
          <button type="button" data-action="meta-nueva-cerrar" class="text-text-muted hover:text-text-primary" aria-label="Cerrar">✕</button>
        </header>
        <div class="max-h-[70vh] overflow-y-auto px-5 py-4">
          ${state.nuevaMetaError ? `<div class="mb-3">${alertError(state.nuevaMetaError)}</div>` : ""}
          <div class="flex flex-col gap-4">
            ${renderNivelFieldset()}
            ${
              f.nivel === "individual"
                ? `<div><label class="${FORM_LABEL}">Empleado</label>${renderEmpleadoPicker()}</div>`
                : `<div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="${FORM_LABEL}" for="meta-nueva-area">Área</label>
                      <div class="relative">
                        <select id="meta-nueva-area" data-action="meta-area" class="${FORM_SELECT}">
                          <option value="">Selecciona…</option>
                          ${areas.map((a) => `<option value="${a.id}"${f.areaId === a.id ? " selected" : ""}>${escapeHtml(a.label)}</option>`).join("")}
                        </select>
                        ${SELECT_CHEVRON}
                      </div>
                    </div>
                    <div>
                      <label class="${FORM_LABEL}" for="meta-nueva-lider">ID de líder del equipo</label>
                      <input id="meta-nueva-lider" data-field="lider-id" type="number" value="${escapeHtml(f.liderId)}" class="${FIELD_INPUT}" placeholder="Tu propio ID de empleado" />
                    </div>
                  </div>`
            }
            <div>
              <label class="${FORM_LABEL}" for="meta-nueva-titulo-campo">Título</label>
              <input id="meta-nueva-titulo-campo" data-field="titulo" type="text" value="${escapeHtml(f.titulo)}" class="${FIELD_INPUT}" />
            </div>
            <div>
              <label class="${FORM_LABEL}" for="meta-nueva-descripcion">Descripción (opcional)</label>
              <textarea id="meta-nueva-descripcion" data-field="descripcion" rows="2" class="${FIELD_TEXTAREA}">${escapeHtml(f.descripcion)}</textarea>
            </div>
            <div class="max-w-[10rem]">
              <label class="${FORM_LABEL}" for="meta-nueva-peso">Peso (0-100)</label>
              <input id="meta-nueva-peso" data-field="peso" type="number" min="0" max="100" step="any" value="${escapeHtml(f.peso)}" class="${FIELD_INPUT}" />
            </div>
            <div>
              <div class="mb-2 flex items-center justify-between">
                <p class="${FORM_LABEL} mb-0">Resultados clave</p>
                <button type="button" data-action="rc-form-agregar" class="${BTN_GHOST}">+ Agregar resultado clave</button>
              </div>
              ${
                f.resultadosClave.length === 0
                  ? `<p class="text-xs text-text-muted">Sin resultados clave (puedes agregarlos después desde el detalle de la meta).</p>`
                  : `<div class="flex flex-col gap-3">${f.resultadosClave.map(renderRcFormRow).join("")}</div>`
              }
            </div>
          </div>
        </div>
        <footer class="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button type="button" data-action="meta-nueva-cerrar" class="${BTN_SECONDARY}">Cancelar</button>
          <button type="button" data-action="meta-nueva-guardar" class="${BTN_PRIMARY}" ${!puedeGuardar || state.nuevaMetaSaving ? "disabled" : ""}>
            ${state.nuevaMetaSaving ? "Creando…" : "Crear meta"}
          </button>
        </footer>
      </div>
    </div>`;
  }

  // ── Render: modal Detalle de meta ────────────────────────────────────────────

  function renderRcEditForm(rc: ResultadoClaveResponse): string {
    return `
    <div class="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
      ${state.rcEditError ? `<p class="text-xs text-red-700">${escapeHtml(state.rcEditError)}</p>` : ""}
      <input type="text" data-field="rc-edit-titulo" value="${escapeHtml(state.rcEditTitulo)}" class="${FIELD_INPUT}" placeholder="Título" />
      <div class="grid grid-cols-2 gap-2">
        <input type="text" data-field="rc-edit-unidad" value="${escapeHtml(state.rcEditUnidad)}" class="${FIELD_INPUT}" placeholder="Unidad" />
        <input type="number" step="any" data-field="rc-edit-valor-objetivo" value="${escapeHtml(state.rcEditValorObjetivo)}" class="${FIELD_INPUT}" placeholder="Valor objetivo" />
      </div>
      <div class="flex justify-end gap-2">
        <button type="button" data-action="rc-editar-cancelar" class="${BTN_SECONDARY}">Cancelar</button>
        <button type="button" data-action="rc-editar-guardar" data-id="${rc.id}" class="${BTN_PRIMARY}" ${state.rcEditSaving ? "disabled" : ""}>${state.rcEditSaving ? "Guardando…" : "Guardar"}</button>
      </div>
    </div>`;
  }

  function renderRcDetalleRow(rc: ResultadoClaveResponse, editable: boolean): string {
    const checkinValor = state.rcCheckinValores[rc.id] ?? "";
    const checkinNota = state.rcCheckinNotas[rc.id] ?? "";
    const saving = state.rcCheckinSaving[rc.id] ?? false;
    const error = state.rcCheckinError[rc.id];
    const isEditing = state.rcEditId === rc.id;
    const previewInicial =
      checkinValor.trim() !== "" && Number.isFinite(Number(checkinValor))
        ? `${avanceRcCliente({
            tipo_metrica: rc.tipo_metrica,
            direccion: rc.direccion,
            valor_inicial: rc.valor_inicial,
            valor_objetivo: rc.valor_objetivo,
            valor_actual: Number(checkinValor),
          })}%`
        : "";
    return `
    <div class="rounded-lg border border-slate-200 p-3">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-text-primary">${escapeHtml(rc.titulo)}</p>
          <p class="text-xs text-text-muted">${TIPO_METRICA_LABELS[rc.tipo_metrica]}${rc.tipo_metrica !== "booleano" ? ` · ${DIRECCION_LABELS[rc.direccion]}` : ""}${rc.unidad ? ` · ${escapeHtml(rc.unidad)}` : ""}</p>
          <p class="text-xs tabular-nums text-text-muted">Inicial ${rc.valor_inicial} → Objetivo ${rc.valor_objetivo} · Actual ${rc.valor_actual}</p>
        </div>
        ${
          editable
            ? `<div class="flex shrink-0 gap-1.5">
                <button type="button" data-action="rc-editar-abrir" data-id="${rc.id}" class="${BTN_GHOST}">Editar</button>
                <button type="button" data-action="rc-eliminar" data-id="${rc.id}" class="${BTN_GHOST}">Eliminar</button>
              </div>`
            : ""
        }
      </div>
      <div class="mt-2">${avanceBar(rc.avance, { compact: true })}</div>
      ${isEditing ? renderRcEditForm(rc) : ""}
      ${
        editable && !isEditing
          ? `<div class="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-end">
              <div class="flex-1">
                <label class="text-[11px] text-text-muted">Nuevo valor</label>
                <div class="flex items-center gap-2">
                  <input type="number" step="any" data-checkin-valor="${rc.id}" value="${escapeHtml(checkinValor)}" class="${FIELD_INPUT}" />
                  <span class="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-text-secondary" data-rc-preview="${rc.id}">${previewInicial}</span>
                </div>
              </div>
              <div class="flex-1">
                <label class="text-[11px] text-text-muted">Nota (opcional)</label>
                <input type="text" data-checkin-nota="${rc.id}" value="${escapeHtml(checkinNota)}" class="${FIELD_INPUT}" />
              </div>
              <button type="button" data-action="rc-checkin-guardar" data-id="${rc.id}" class="${BTN_SECONDARY} shrink-0" ${saving ? "disabled" : ""}>${saving ? "Guardando…" : "Registrar ajuste"}</button>
            </div>
            ${error ? `<p class="mt-1 text-xs text-red-700">${escapeHtml(error)}</p>` : ""}`
          : ""
      }
    </div>`;
  }

  function renderRcNuevoForm(): string {
    if (!state.rcNuevoForm) {
      return `<button type="button" data-action="rc-nuevo-abrir" class="${BTN_GHOST} mt-2">+ Agregar resultado clave</button>`;
    }
    const row = state.rcNuevoForm;
    return `
    <div class="mt-3 rounded-lg border border-dashed border-slate-300 p-3">
      <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Nuevo resultado clave</p>
      ${state.rcNuevoError ? `<p class="mb-2 text-xs text-red-700">${escapeHtml(state.rcNuevoError)}</p>` : ""}
      <div class="flex flex-col gap-2">
        <input type="text" data-rc-field="titulo" data-rc-index="new" value="${escapeHtml(row.titulo)}" class="${FIELD_INPUT}" placeholder="Título" />
        <div class="grid grid-cols-2 gap-2">
          <div class="relative">
            <select data-rc-field="tipoMetrica" data-rc-index="new" class="${FORM_SELECT}">
              ${Object.entries(TIPO_METRICA_LABELS).map(([v, l]) => `<option value="${v}"${row.tipoMetrica === v ? " selected" : ""}>${l}</option>`).join("")}
            </select>
            ${SELECT_CHEVRON}
          </div>
          <div class="relative">
            <select data-rc-field="direccion" data-rc-index="new" class="${FORM_SELECT}">
              ${Object.entries(DIRECCION_LABELS).map(([v, l]) => `<option value="${v}"${row.direccion === v ? " selected" : ""}>${l}</option>`).join("")}
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        <input type="text" data-rc-field="unidad" data-rc-index="new" value="${escapeHtml(row.unidad)}" class="${FIELD_INPUT}" placeholder="Unidad (opcional)" />
        <div class="grid grid-cols-3 gap-2">
          <input type="number" step="any" data-rc-field="valorInicial" data-rc-index="new" value="${escapeHtml(row.valorInicial)}" class="${FIELD_INPUT}" placeholder="Inicial" />
          <input type="number" step="any" data-rc-field="valorObjetivo" data-rc-index="new" value="${escapeHtml(row.valorObjetivo)}" class="${FIELD_INPUT}" placeholder="Objetivo" />
          <input type="number" step="any" data-rc-field="valorActual" data-rc-index="new" value="${escapeHtml(row.valorActual)}" class="${FIELD_INPUT}" placeholder="Actual (= inicial)" />
        </div>
      </div>
      <div class="mt-2 flex justify-end gap-2">
        <button type="button" data-action="rc-nuevo-cancelar" class="${BTN_SECONDARY}">Cancelar</button>
        <button type="button" data-action="rc-nuevo-guardar" class="${BTN_PRIMARY}" ${state.rcNuevoSaving ? "disabled" : ""}>${state.rcNuevoSaving ? "Agregando…" : "Agregar"}</button>
      </div>
    </div>`;
  }

  function renderMetaDetalleBody(): string {
    if (state.metaDetalleLoading) {
      return skeletonBlock({ label: "Cargando meta…" });
    }
    if (state.metaDetalleError || !state.metaDetalle) {
      return errorState({ message: state.metaDetalleError ?? "No se pudo cargar la meta" });
    }
    const m = state.metaDetalle;
    const editable = m.estado !== "cerrada";
    const dueno =
      m.nivel === "individual"
        ? (m.empleado_id != null ? state.nombresCache[m.empleado_id] : null) ?? `Empleado #${m.empleado_id ?? "—"}`
        : `Equipo (líder #${m.lider_id ?? "—"})`;
    return `
    <div class="flex flex-col gap-4">
      ${state.metaActionError ? alertError(state.metaActionError) : ""}
      ${state.metaActionMessage ? alertSuccess(state.metaActionMessage) : ""}
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          ${estadoMetaBadge(m.estado)}
          <span class="text-xs text-text-muted">${NIVEL_LABELS[m.nivel]} · ${escapeHtml(dueno)}</span>
        </div>
        <div class="w-40">${avanceBar(m.avance)}</div>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label class="${FORM_LABEL}" for="meta-detalle-titulo-campo">Título</label>
          <input id="meta-detalle-titulo-campo" data-field="detalle-titulo" type="text" value="${escapeHtml(state.metaEditTitulo)}" class="${FIELD_INPUT}" ${editable ? "" : "disabled"} />
        </div>
        <div class="sm:col-span-2">
          <label class="${FORM_LABEL}" for="meta-detalle-descripcion-campo">Descripción</label>
          <textarea id="meta-detalle-descripcion-campo" data-field="detalle-descripcion" rows="2" class="${FIELD_TEXTAREA}" ${editable ? "" : "disabled"}>${escapeHtml(state.metaEditDescripcion)}</textarea>
        </div>
        <div class="max-w-[10rem]">
          <label class="${FORM_LABEL}" for="meta-detalle-peso-campo">Peso</label>
          <input id="meta-detalle-peso-campo" data-field="detalle-peso" type="number" min="0" max="100" step="any" value="${escapeHtml(state.metaEditPeso)}" class="${FIELD_INPUT}" ${editable ? "" : "disabled"} />
        </div>
      </div>
      ${
        editable
          ? `<div class="flex justify-end"><button type="button" data-action="meta-detalle-guardar" class="${BTN_SECONDARY}" ${state.metaEditSaving ? "disabled" : ""}>${state.metaEditSaving ? "Guardando…" : "Guardar cambios"}</button></div>`
          : ""
      }
      ${
        m.estado === "cerrada"
          ? alertInfo(`Calificación de cierre: ${m.calificacion_cierre ?? "—"}${m.comentario_cierre ? ` · ${m.comentario_cierre}` : ""}`)
          : ""
      }
      <div>
        <p class="mb-2 text-sm font-semibold text-text-primary">Resultados clave</p>
        ${
          m.resultados_clave.length === 0
            ? `<p class="text-xs text-text-muted">Sin resultados clave todavía.</p>`
            : `<div class="flex flex-col gap-3">${m.resultados_clave.map((rc) => renderRcDetalleRow(rc, editable)).join("")}</div>`
        }
        ${editable ? renderRcNuevoForm() : ""}
      </div>
      ${
        editable
          ? `<div class="flex justify-between border-t border-slate-100 pt-3">
              <button type="button" data-action="meta-eliminar" class="${BTN_DANGER}">Eliminar meta</button>
              <button type="button" data-action="meta-cerrar-abrir" class="${BTN_PRIMARY}">Cerrar y calificar</button>
            </div>`
          : ""
      }
    </div>`;
  }

  function renderCerrarMetaModal(): string {
    if (!state.cerrarMetaOpen) return "";
    return `
    <div class="${MODAL_OVERLAY_NESTED}" data-modal="meta-cerrar">
      <div class="${MODAL_PANEL} max-w-md" role="dialog" aria-modal="true" aria-labelledby="meta-cerrar-titulo">
        <header class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="meta-cerrar-titulo" class="text-base font-bold text-text-primary">Cerrar y calificar meta</h2>
          <button type="button" data-action="meta-cerrar-cerrar" class="text-text-muted hover:text-text-primary" aria-label="Cerrar">✕</button>
        </header>
        <div class="px-5 py-4">
          ${state.cerrarMetaError ? `<div class="mb-3">${alertError(state.cerrarMetaError)}</div>` : ""}
          <div class="flex flex-col gap-3">
            <div>
              <label class="${FORM_LABEL}" for="meta-cerrar-calificacion">Calificación (0-100)</label>
              <input id="meta-cerrar-calificacion" data-field="cerrar-calificacion" type="number" min="0" max="100" step="any" value="${escapeHtml(state.cerrarMetaCalificacion)}" class="${FIELD_INPUT}" />
            </div>
            <div>
              <label class="${FORM_LABEL}" for="meta-cerrar-comentario">Comentario (opcional)</label>
              <textarea id="meta-cerrar-comentario" data-field="cerrar-comentario" rows="2" class="${FIELD_TEXTAREA}">${escapeHtml(state.cerrarMetaComentario)}</textarea>
            </div>
          </div>
        </div>
        <footer class="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button type="button" data-action="meta-cerrar-cerrar" class="${BTN_SECONDARY}">Cancelar</button>
          <button type="button" data-action="meta-cerrar-guardar" class="${BTN_PRIMARY}" ${state.cerrarMetaSaving ? "disabled" : ""}>${state.cerrarMetaSaving ? "Guardando…" : "Cerrar y calificar"}</button>
        </footer>
      </div>
    </div>`;
  }

  function renderMetaDetalleModal(): string {
    if (state.metaDetalleId == null) return "";
    return `
    <div class="${MODAL_OVERLAY}" data-modal="meta-detalle">
      <div class="${MODAL_PANEL} max-w-3xl" role="dialog" aria-modal="true" aria-labelledby="meta-detalle-titulo">
        <header class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="meta-detalle-titulo" class="text-base font-bold text-text-primary">Detalle de la meta</h2>
          <button type="button" data-action="meta-detalle-cerrar" class="text-text-muted hover:text-text-primary" aria-label="Cerrar">✕</button>
        </header>
        <div class="max-h-[75vh] overflow-y-auto px-5 py-4">
          ${renderMetaDetalleBody()}
        </div>
      </div>
    </div>
    ${renderCerrarMetaModal()}`;
  }

  // ── Render: pestaña Tablero de equipo ────────────────────────────────────────

  function renderMetaMiniRow(m: MetaResponse): string {
    return `
    <div class="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
      <div class="min-w-0">
        <p class="truncate text-sm text-text-primary">${escapeHtml(m.titulo)}</p>
        <div class="mt-0.5">${estadoMetaBadge(m.estado)}</div>
      </div>
      <div class="w-32 shrink-0">${avanceBar(m.avance, { compact: true })}</div>
    </div>`;
  }

  function renderMiembroCard(miembro: EquipoAvanceMiembro): string {
    return `
    <article class="${RH_LISTADO_SURFACE} p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="font-semibold text-text-primary">${escapeHtml(miembro.empleado_nombre ?? `Empleado #${miembro.empleado_id}`)}</p>
        <div class="w-40">${avanceBar(miembro.avance_global)}</div>
      </div>
      <div class="mt-3 flex flex-col gap-2">
        ${miembro.metas.map((m) => renderMetaMiniRow(m)).join("")}
      </div>
    </article>`;
  }

  function renderTableroBody(): string {
    if (state.tableroLoading) {
      return skeletonBlock({ className: `${RH_LISTADO_SURFACE} px-6 py-16`, label: "Cargando tablero…" });
    }
    if (state.tableroError) {
      return errorState({ message: state.tableroError, actionLabel: "Reintentar", actionAttrs: 'data-action="reload-tablero"' });
    }
    const t = state.tablero;
    if (!t || (t.miembros.length === 0 && t.metas_equipo.length === 0)) {
      return renderEmptyState({ title: "Sin metas en este ciclo", subtitle: "Asigna metas desde la pestaña Metas para ver el avance aquí." });
    }
    return `
    <div class="flex flex-col gap-4">
      ${t.miembros.length > 0 ? `<div class="flex flex-col gap-3">${t.miembros.map(renderMiembroCard).join("")}</div>` : ""}
      ${
        t.metas_equipo.length > 0
          ? `<div>
              <p class="mb-2 text-sm font-semibold text-text-primary">Metas de equipo</p>
              <div class="flex flex-col gap-2">${t.metas_equipo.map((m) => renderMetaMiniRow(m)).join("")}</div>
            </div>`
          : ""
      }
    </div>`;
  }

  function renderTableroTab(): string {
    if (state.ciclosLoading) {
      return skeletonBlock({ className: `${RH_LISTADO_SURFACE} px-6 py-16`, label: "Cargando ciclos…" });
    }
    if ((state.ciclos ?? []).length === 0) {
      return renderEmptyState(
        state.esGestionRh
          ? { title: "Aún no hay ciclos", subtitle: "Crea un ciclo para ver el tablero de avance." }
          : { title: "Aún no hay ciclos de metas", subtitle: "Pídele a RH que cree uno." },
      );
    }
    return `
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        ${renderCicloSelector()}
        ${state.cicloSeleccionadoId != null ? `<button type="button" data-action="ciclo-exportar" data-id="${state.cicloSeleccionadoId}" class="${BTN_SECONDARY}">Exportar Excel</button>` : ""}
      </div>
      ${renderTableroBody()}
    </div>`;
  }

  // ── Render raíz ───────────────────────────────────────────────────────────────

  function pageContent(): string {
    return `
    <div class="${RH_DASHBOARD_PAGE_SHELL}">
    <div class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">
      <div class="flex flex-col gap-2">
        <p class="text-xs font-medium text-text-muted">${state.esGestionRh ? "Talento" : "Talento · Mi equipo"}</p>
        ${pageHeading(
          state.esGestionRh ? "Metas" : "Metas de mi equipo",
          state.esGestionRh
            ? "Objetivos y resultados clave (OKR) por ciclo, con seguimiento de avance y cumplimiento del equipo."
            : "Asigna objetivos y resultados clave (OKR) a tu equipo, da seguimiento a su avance y califica el cierre del ciclo.",
        )}
      </div>
      <div data-tabs="metas-main">
        ${renderTabNav(
          [
            ...(state.esGestionRh ? [{ id: "ciclos", label: "Ciclos" }] : []),
            { id: "metas", label: "Metas" },
            { id: "tablero", label: "Tablero de equipo" },
          ],
          state.tab,
          { ariaLabel: "Secciones de Metas" },
        )}
      </div>
      ${state.tab === "ciclos" && state.esGestionRh ? renderCiclosTab() : state.tab === "metas" ? renderMetasTab() : renderTableroTab()}
    </div>
    </div>
    ${renderNuevoCicloModal()}
    ${renderEditCicloModal()}
    ${renderNuevaMetaModal()}
    ${renderMetaDetalleModal()}`;
  }

  function render(): void {
    mountAppShell(container, {
      pageTitle: "Metas",
      activeNav: "metas",
      mainClass: "py-0",
      mainHtml: pageContent(),
    });
  }

  function focusTopModal(): void {
    window.requestAnimationFrame(() => {
      const dialogs = container.querySelectorAll<HTMLElement>('[data-modal] [role="dialog"]');
      const panel = dialogs[dialogs.length - 1];
      const target = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      target?.focus();
    });
  }

  // ── Acciones: ciclos ──────────────────────────────────────────────────────────

  async function onGuardarNuevoCiclo(): Promise<void> {
    if (state.nuevoCicloSaving) return;
    const f = state.nuevoCicloForm;
    if (!f.nombre.trim()) {
      state.nuevoCicloError = "El nombre es obligatorio";
      render();
      return;
    }
    if (!f.fechaInicio || !f.fechaFin) {
      state.nuevoCicloError = "Define fecha de inicio y fin";
      render();
      return;
    }
    state.nuevoCicloSaving = true;
    state.nuevoCicloError = null;
    render();
    try {
      await createCiclo({
        nombre: f.nombre.trim(),
        descripcion: f.descripcion.trim() || null,
        fecha_inicio: f.fechaInicio,
        fecha_fin: f.fechaFin,
      });
      state.nuevoCicloSaving = false;
      state.nuevoCicloOpen = false;
      state.cicloActionMessage = "Ciclo creado.";
      await loadCiclos();
    } catch (err: unknown) {
      state.nuevoCicloSaving = false;
      state.nuevoCicloError = (err as Error)?.message ?? "No se pudo crear el ciclo";
      render();
    }
  }

  async function onGuardarEditCiclo(): Promise<void> {
    if (state.editCicloId == null || state.editCicloSaving) return;
    const f = state.editCicloForm;
    if (!f.nombre.trim()) {
      state.editCicloError = "El nombre es obligatorio";
      render();
      return;
    }
    state.editCicloSaving = true;
    state.editCicloError = null;
    render();
    try {
      await updateCiclo(state.editCicloId, {
        nombre: f.nombre.trim(),
        descripcion: f.descripcion.trim() || null,
        fecha_inicio: f.fechaInicio || undefined,
        fecha_fin: f.fechaFin || undefined,
      });
      state.editCicloSaving = false;
      state.editCicloOpen = false;
      state.cicloActionMessage = "Ciclo actualizado.";
      await loadCiclos();
    } catch (err: unknown) {
      state.editCicloSaving = false;
      state.editCicloError = (err as Error)?.message ?? "No se pudo actualizar el ciclo";
      render();
    }
  }

  async function onActivarCiclo(id: number): Promise<void> {
    state.cicloActionError = null;
    try {
      await activarCiclo(id);
      state.cicloActionMessage = "Ciclo activado.";
      await loadCiclos();
    } catch (err: unknown) {
      state.cicloActionError = (err as Error)?.message ?? "No se pudo activar el ciclo";
      render();
    }
  }

  async function onCerrarCiclo(id: number): Promise<void> {
    if (!window.confirm("¿Cerrar este ciclo? Ya no se podrán asignar ni modificar metas. Todas las metas individuales deben estar calificadas.")) return;
    state.cicloActionError = null;
    try {
      await cerrarCiclo(id);
      state.cicloActionMessage = "Ciclo cerrado.";
      await loadCiclos();
    } catch (err: unknown) {
      state.cicloActionError = (err as Error)?.message ?? "No se pudo cerrar el ciclo";
      render();
    }
  }

  async function onExportarCiclo(id: number): Promise<void> {
    try {
      const ok = await descargarCicloExcel(id, `metas_ciclo_${id}.xlsx`);
      if (!ok) {
        state.cicloActionError = "No se pudo descargar el export";
        render();
      }
    } catch {
      state.cicloActionError = "No se pudo descargar el export";
      render();
    }
  }

  // ── Acciones: nueva meta ─────────────────────────────────────────────────────

  function openNuevaMetaModal(): void {
    if (state.cicloSeleccionadoId == null) return;
    const defaultLider = getEmpleadoDirectoryNumericIdFromAccessToken();
    state.nuevaMetaForm = emptyNuevaMetaForm(defaultLider != null ? String(defaultLider) : "");
    state.nuevaMetaError = null;
    state.empleadoQuery = "";
    state.empleadoResults = null;
    state.nuevaMetaOpen = true;
    render();
    focusTopModal();
  }

  function closeNuevaMetaModal(): void {
    state.nuevaMetaOpen = false;
    render();
  }

  async function onBuscarEmpleado(): Promise<void> {
    const q = state.empleadoQuery.trim();
    if (!q) return;
    state.empleadoSearching = true;
    render();
    try {
      const page = await getEmpleadosPage({ page: 1, page_size: 8, q });
      state.empleadoResults = page.items;
      for (const it of page.items) state.nombresCache[it.empleado_id] = it.nombre;
    } catch {
      state.empleadoResults = [];
    }
    state.empleadoSearching = false;
    render();
  }

  function buildRcCreatePayload(row: RcFormRow): ResultadoClaveCreate | null {
    const titulo = row.titulo.trim();
    if (!titulo) return null;
    const valorInicial = Number(row.valorInicial);
    const valorObjetivo = Number(row.valorObjetivo);
    if (!Number.isFinite(valorInicial) || !Number.isFinite(valorObjetivo)) return null;
    const valorActualStr = row.valorActual.trim();
    const valorActual = valorActualStr === "" ? undefined : Number(valorActualStr);
    return {
      titulo,
      tipo_metrica: row.tipoMetrica,
      unidad: row.unidad.trim() || null,
      direccion: row.direccion,
      valor_inicial: valorInicial,
      valor_objetivo: valorObjetivo,
      valor_actual: valorActual != null && Number.isFinite(valorActual) ? valorActual : undefined,
    };
  }

  async function onGuardarNuevaMeta(): Promise<void> {
    if (state.nuevaMetaSaving || state.cicloSeleccionadoId == null) return;
    const f = state.nuevaMetaForm;
    if (!f.titulo.trim()) {
      state.nuevaMetaError = "El título es obligatorio";
      render();
      return;
    }
    const peso = Number(f.peso);
    if (!Number.isFinite(peso) || peso < 0 || peso > 100) {
      state.nuevaMetaError = "El peso debe ser un número entre 0 y 100";
      render();
      return;
    }
    const resultadosClave = f.resultadosClave.map(buildRcCreatePayload).filter((x): x is ResultadoClaveCreate => x != null);

    let payload: MetaCreate;
    if (f.nivel === "individual") {
      if (f.empleadoId == null) {
        state.nuevaMetaError = "Selecciona un empleado";
        render();
        return;
      }
      payload = {
        ciclo_id: state.cicloSeleccionadoId,
        nivel: "individual",
        empleado_id: f.empleadoId,
        titulo: f.titulo.trim(),
        descripcion: f.descripcion.trim() || null,
        peso,
        resultados_clave: resultadosClave,
      };
    } else {
      const liderId = Number(f.liderId);
      if (f.areaId == null || !Number.isFinite(liderId)) {
        state.nuevaMetaError = "Selecciona el área e indica el ID de líder";
        render();
        return;
      }
      payload = {
        ciclo_id: state.cicloSeleccionadoId,
        nivel: "equipo",
        area_id: f.areaId,
        lider_id: liderId,
        titulo: f.titulo.trim(),
        descripcion: f.descripcion.trim() || null,
        peso,
        resultados_clave: resultadosClave,
      };
    }

    state.nuevaMetaSaving = true;
    state.nuevaMetaError = null;
    render();
    try {
      await createMeta(payload);
      state.nuevaMetaSaving = false;
      state.nuevaMetaOpen = false;
      state.metaActionMessage = "Meta creada.";
      await loadMetas();
    } catch (err: unknown) {
      state.nuevaMetaSaving = false;
      state.nuevaMetaError = (err as Error)?.message ?? "No se pudo crear la meta";
      render();
    }
  }

  // ── Acciones: detalle de meta ────────────────────────────────────────────────

  async function onGuardarMetaDetalle(): Promise<void> {
    if (!state.metaDetalle || state.metaEditSaving) return;
    if (!state.metaEditTitulo.trim()) {
      state.metaActionError = "El título es obligatorio";
      render();
      return;
    }
    const peso = Number(state.metaEditPeso);
    if (!Number.isFinite(peso) || peso < 0 || peso > 100) {
      state.metaActionError = "El peso debe ser un número entre 0 y 100";
      render();
      return;
    }
    state.metaEditSaving = true;
    state.metaActionError = null;
    render();
    try {
      state.metaDetalle = await updateMeta(state.metaDetalle.id, {
        titulo: state.metaEditTitulo.trim(),
        descripcion: state.metaEditDescripcion.trim() || null,
        peso,
      });
      state.metaEditSaving = false;
      state.metaActionMessage = "Cambios guardados.";
      render();
    } catch (err: unknown) {
      state.metaEditSaving = false;
      state.metaActionError = (err as Error)?.message ?? "No se pudo guardar";
      render();
    }
  }

  async function onEliminarMeta(): Promise<void> {
    if (!state.metaDetalle) return;
    if (!window.confirm("¿Eliminar esta meta? Esta acción no se puede deshacer.")) return;
    try {
      await deleteMeta(state.metaDetalle.id);
      closeMetaDetalle();
    } catch (err: unknown) {
      state.metaActionError = (err as Error)?.message ?? "No se pudo eliminar la meta";
      render();
    }
  }

  function openRcNuevoForm(): void {
    state.rcNuevoForm = emptyRcFormRow();
    state.rcNuevoError = null;
    render();
  }

  function closeRcNuevoForm(): void {
    state.rcNuevoForm = null;
    state.rcNuevoError = null;
    render();
  }

  async function onGuardarRcNuevo(): Promise<void> {
    if (!state.metaDetalle || !state.rcNuevoForm || state.rcNuevoSaving) return;
    const payload = buildRcCreatePayload(state.rcNuevoForm);
    if (!payload) {
      state.rcNuevoError = "Completa título, valor inicial y valor objetivo";
      render();
      return;
    }
    state.rcNuevoSaving = true;
    state.rcNuevoError = null;
    render();
    try {
      await addResultado(state.metaDetalle.id, payload);
      state.rcNuevoForm = null;
      state.rcNuevoSaving = false;
      state.metaDetalle = await getMeta(state.metaDetalle.id);
      render();
    } catch (err: unknown) {
      state.rcNuevoSaving = false;
      state.rcNuevoError = (err as Error)?.message ?? "No se pudo agregar el resultado clave";
      render();
    }
  }

  async function onEliminarRc(rcId: number): Promise<void> {
    if (!state.metaDetalle) return;
    if (!window.confirm("¿Eliminar este resultado clave?")) return;
    try {
      await deleteResultado(state.metaDetalle.id, rcId);
      state.metaDetalle = await getMeta(state.metaDetalle.id);
      render();
    } catch (err: unknown) {
      state.metaActionError = (err as Error)?.message ?? "No se pudo eliminar el resultado clave";
      render();
    }
  }

  function openRcEdit(rc: ResultadoClaveResponse): void {
    state.rcEditId = rc.id;
    state.rcEditTitulo = rc.titulo;
    state.rcEditUnidad = rc.unidad ?? "";
    state.rcEditValorObjetivo = String(rc.valor_objetivo);
    state.rcEditError = null;
    render();
  }

  function closeRcEdit(): void {
    state.rcEditId = null;
    state.rcEditError = null;
    render();
  }

  async function onGuardarRcEdit(rcId: number): Promise<void> {
    if (!state.metaDetalle || state.rcEditSaving) return;
    const valorObjetivo = Number(state.rcEditValorObjetivo);
    if (!state.rcEditTitulo.trim() || !Number.isFinite(valorObjetivo)) {
      state.rcEditError = "Completa el título y un valor objetivo válido";
      render();
      return;
    }
    state.rcEditSaving = true;
    state.rcEditError = null;
    render();
    try {
      await updateResultado(state.metaDetalle.id, rcId, {
        titulo: state.rcEditTitulo.trim(),
        unidad: state.rcEditUnidad.trim() || null,
        valor_objetivo: valorObjetivo,
      });
      state.rcEditId = null;
      state.rcEditSaving = false;
      state.metaDetalle = await getMeta(state.metaDetalle.id);
      render();
    } catch (err: unknown) {
      state.rcEditSaving = false;
      state.rcEditError = (err as Error)?.message ?? "No se pudo actualizar el resultado clave";
      render();
    }
  }

  function updateCheckinPreview(rcId: number, valorStr: string): void {
    const rc = state.metaDetalle?.resultados_clave.find((r) => r.id === rcId);
    const span = container.querySelector<HTMLElement>(`[data-rc-preview="${rcId}"]`);
    if (!rc || !span) return;
    if (valorStr.trim() === "") {
      span.textContent = "";
      return;
    }
    const valor = Number(valorStr);
    if (!Number.isFinite(valor)) {
      span.textContent = "";
      return;
    }
    const pct = avanceRcCliente({
      tipo_metrica: rc.tipo_metrica,
      direccion: rc.direccion,
      valor_inicial: rc.valor_inicial,
      valor_objetivo: rc.valor_objetivo,
      valor_actual: valor,
    });
    span.textContent = `${pct}%`;
  }

  async function onGuardarRcCheckin(rcId: number): Promise<void> {
    if (!state.metaDetalle) return;
    const valorStr = state.rcCheckinValores[rcId] ?? "";
    const valor = Number(valorStr);
    if (valorStr.trim() === "" || !Number.isFinite(valor)) {
      state.rcCheckinError[rcId] = "Ingresa un valor numérico";
      render();
      return;
    }
    state.rcCheckinSaving[rcId] = true;
    state.rcCheckinError[rcId] = null;
    render();
    try {
      await ajusteCheckin(rcId, { valor, nota: (state.rcCheckinNotas[rcId] ?? "").trim() || null });
      delete state.rcCheckinValores[rcId];
      delete state.rcCheckinNotas[rcId];
      state.rcCheckinSaving[rcId] = false;
      state.metaDetalle = await getMeta(state.metaDetalle.id);
      state.metaActionMessage = "Ajuste registrado.";
      render();
    } catch (err: unknown) {
      state.rcCheckinSaving[rcId] = false;
      state.rcCheckinError[rcId] = (err as Error)?.message ?? "No se pudo registrar el ajuste";
      render();
    }
  }

  function openCerrarMeta(): void {
    state.cerrarMetaOpen = true;
    state.cerrarMetaCalificacion = "";
    state.cerrarMetaComentario = "";
    state.cerrarMetaError = null;
    render();
    focusTopModal();
  }

  function closeCerrarMeta(): void {
    state.cerrarMetaOpen = false;
    render();
  }

  async function onGuardarCerrarMeta(): Promise<void> {
    if (!state.metaDetalle || state.cerrarMetaSaving) return;
    const calificacion = Number(state.cerrarMetaCalificacion);
    if (!Number.isFinite(calificacion) || calificacion < 0 || calificacion > 100) {
      state.cerrarMetaError = "La calificación debe ser un número entre 0 y 100";
      render();
      return;
    }
    state.cerrarMetaSaving = true;
    state.cerrarMetaError = null;
    render();
    try {
      state.metaDetalle = await cerrarMeta(state.metaDetalle.id, {
        calificacion,
        comentario: state.cerrarMetaComentario.trim() || null,
      });
      state.cerrarMetaSaving = false;
      state.cerrarMetaOpen = false;
      state.metaActionMessage = "Meta cerrada y calificada.";
      render();
    } catch (err: unknown) {
      state.cerrarMetaSaving = false;
      state.cerrarMetaError = (err as Error)?.message ?? "No se pudo cerrar la meta";
      render();
    }
  }

  // ── Delegación de eventos ─────────────────────────────────────────────────────

  function handleClick(e: Event): void {
    const t = e.target as HTMLElement;

    const tabEl = t.closest<HTMLElement>('[role="tab"][data-tab]');
    if (tabEl) {
      const group = tabEl.closest<HTMLElement>("[data-tabs]")?.dataset.tabs;
      const tabId = tabEl.dataset.tab;
      if (group === "metas-main" && (tabId === "ciclos" || tabId === "metas" || tabId === "tablero")) {
        if (tabId === "ciclos" && !state.esGestionRh) return;
        state.tab = tabId;
        render();
        if (tabId === "metas") void loadMetas();
        if (tabId === "tablero") void loadTablero();
      }
      return;
    }

    const actionEl = t.closest<HTMLElement>("[data-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action && CICLO_ADMIN_ACTIONS.has(action) && !state.esGestionRh) return;

    switch (action) {
      case "reload-ciclos":
        void loadCiclos();
        return;
      case "reload-metas":
        void loadMetas();
        return;
      case "reload-tablero":
        void loadTablero();
        return;
      case "ciclo-nuevo-abrir":
        state.nuevoCicloForm = emptyCicloForm();
        state.nuevoCicloError = null;
        state.nuevoCicloOpen = true;
        render();
        focusTopModal();
        return;
      case "ciclo-nuevo-cerrar":
        state.nuevoCicloOpen = false;
        render();
        return;
      case "ciclo-nuevo-guardar":
        void onGuardarNuevoCiclo();
        return;
      case "ciclo-editar-abrir": {
        const id = Number(actionEl.dataset.id);
        const c = (state.ciclos ?? []).find((x) => x.id === id);
        if (c) {
          state.editCicloId = id;
          state.editCicloForm = { nombre: c.nombre, descripcion: c.descripcion ?? "", fechaInicio: c.fecha_inicio, fechaFin: c.fecha_fin };
          state.editCicloError = null;
          state.editCicloOpen = true;
          render();
          focusTopModal();
        }
        return;
      }
      case "ciclo-editar-cerrar":
        state.editCicloOpen = false;
        render();
        return;
      case "ciclo-editar-guardar":
        void onGuardarEditCiclo();
        return;
      case "ciclo-activar": {
        const id = Number(actionEl.dataset.id);
        if (id) void onActivarCiclo(id);
        return;
      }
      case "ciclo-cerrar": {
        const id = Number(actionEl.dataset.id);
        if (id) void onCerrarCiclo(id);
        return;
      }
      case "ciclo-exportar": {
        const id = Number(actionEl.dataset.id);
        if (id) void onExportarCiclo(id);
        return;
      }
      case "meta-nueva-abrir":
        openNuevaMetaModal();
        return;
      case "meta-nueva-cerrar":
        closeNuevaMetaModal();
        return;
      case "meta-nueva-guardar":
        void onGuardarNuevaMeta();
        return;
      case "meta-nivel":
        state.nuevaMetaForm.nivel = actionEl.dataset.value === "equipo" ? "equipo" : "individual";
        render();
        if (state.nuevaMetaForm.nivel === "equipo") void loadAreasOptions();
        return;
      case "empleado-buscar":
        void onBuscarEmpleado();
        return;
      case "empleado-seleccionar":
        state.nuevaMetaForm.empleadoId = Number(actionEl.dataset.id);
        state.nuevaMetaForm.empleadoNombre = actionEl.dataset.nombre ?? null;
        if (state.nuevaMetaForm.empleadoId != null && actionEl.dataset.nombre) {
          state.nombresCache[state.nuevaMetaForm.empleadoId] = actionEl.dataset.nombre;
        }
        render();
        return;
      case "empleado-quitar":
        state.nuevaMetaForm.empleadoId = null;
        state.nuevaMetaForm.empleadoNombre = null;
        render();
        return;
      case "rc-form-agregar":
        state.nuevaMetaForm.resultadosClave.push(emptyRcFormRow());
        render();
        return;
      case "rc-form-quitar": {
        const idx = Number(actionEl.dataset.index);
        state.nuevaMetaForm.resultadosClave.splice(idx, 1);
        render();
        return;
      }
      case "meta-detalle-abrir": {
        const id = Number(actionEl.dataset.id);
        if (id) void openMetaDetalle(id);
        return;
      }
      case "meta-detalle-cerrar":
        closeMetaDetalle();
        return;
      case "meta-detalle-guardar":
        void onGuardarMetaDetalle();
        return;
      case "meta-eliminar":
        void onEliminarMeta();
        return;
      case "meta-cerrar-abrir":
        openCerrarMeta();
        return;
      case "meta-cerrar-cerrar":
        closeCerrarMeta();
        return;
      case "meta-cerrar-guardar":
        void onGuardarCerrarMeta();
        return;
      case "rc-nuevo-abrir":
        openRcNuevoForm();
        return;
      case "rc-nuevo-cancelar":
        closeRcNuevoForm();
        return;
      case "rc-nuevo-guardar":
        void onGuardarRcNuevo();
        return;
      case "rc-editar-abrir": {
        const id = Number(actionEl.dataset.id);
        const rc = state.metaDetalle?.resultados_clave.find((r) => r.id === id);
        if (rc) openRcEdit(rc);
        return;
      }
      case "rc-editar-cancelar":
        closeRcEdit();
        return;
      case "rc-editar-guardar": {
        const id = Number(actionEl.dataset.id);
        if (id) void onGuardarRcEdit(id);
        return;
      }
      case "rc-eliminar": {
        const id = Number(actionEl.dataset.id);
        if (id) void onEliminarRc(id);
        return;
      }
      case "rc-checkin-guardar": {
        const id = Number(actionEl.dataset.id);
        if (id) void onGuardarRcCheckin(id);
        return;
      }
      default:
        return;
    }
  }

  function handleChange(e: Event): void {
    const t = e.target as HTMLElement;
    if (t instanceof HTMLSelectElement && t.dataset.action === "filtro-nivel") {
      state.filtroNivel = (t.value === "individual" || t.value === "equipo") ? t.value : "todas";
      render();
      return;
    }
    if (t instanceof HTMLSelectElement && t.dataset.action === "ciclo-selector") {
      state.cicloSeleccionadoId = Number(t.value) || null;
      render();
      if (state.tab === "metas") void loadMetas();
      if (state.tab === "tablero") void loadTablero();
      return;
    }
    if (t instanceof HTMLSelectElement && t.dataset.action === "meta-area") {
      state.nuevaMetaForm.areaId = t.value ? Number(t.value) : null;
      render();
      return;
    }
    if (t instanceof HTMLSelectElement && t.dataset.rcField && t.dataset.rcIndex != null) {
      const row = t.dataset.rcIndex === "new" ? state.rcNuevoForm : state.nuevaMetaForm.resultadosClave[Number(t.dataset.rcIndex)];
      if (row) {
        if (t.dataset.rcField === "tipoMetrica") row.tipoMetrica = t.value as RcTipoMetrica;
        else if (t.dataset.rcField === "direccion") row.direccion = t.value as RcDireccion;
        render();
      }
      return;
    }
  }

  function handleInput(e: Event): void {
    const t = e.target as HTMLElement;
    if (!(t instanceof HTMLInputElement) && !(t instanceof HTMLTextAreaElement)) return;

    const cicloField = t.dataset.cicloField;
    const cicloPrefix = t.dataset.cicloPrefix;
    if (cicloField && cicloPrefix) {
      const form = cicloPrefix === "nuevo" ? state.nuevoCicloForm : state.editCicloForm;
      if (cicloField === "nombre") form.nombre = t.value;
      else if (cicloField === "descripcion") form.descripcion = t.value;
      else if (cicloField === "fechaInicio") {
        form.fechaInicio = t.value;
        render();
      } else if (cicloField === "fechaFin") {
        form.fechaFin = t.value;
        render();
      }
      return;
    }

    const field = t.dataset.field;
    if (field === "empleado-query") {
      state.empleadoQuery = t.value;
      return;
    }
    if (field === "titulo") {
      state.nuevaMetaForm.titulo = t.value;
      return;
    }
    if (field === "descripcion") {
      state.nuevaMetaForm.descripcion = t.value;
      return;
    }
    if (field === "peso") {
      state.nuevaMetaForm.peso = t.value;
      return;
    }
    if (field === "lider-id") {
      state.nuevaMetaForm.liderId = t.value;
      return;
    }
    if (field === "detalle-titulo") {
      state.metaEditTitulo = t.value;
      return;
    }
    if (field === "detalle-descripcion") {
      state.metaEditDescripcion = t.value;
      return;
    }
    if (field === "detalle-peso") {
      state.metaEditPeso = t.value;
      return;
    }
    if (field === "cerrar-calificacion") {
      state.cerrarMetaCalificacion = t.value;
      return;
    }
    if (field === "cerrar-comentario") {
      state.cerrarMetaComentario = t.value;
      return;
    }
    if (field === "rc-edit-titulo") {
      state.rcEditTitulo = t.value;
      return;
    }
    if (field === "rc-edit-unidad") {
      state.rcEditUnidad = t.value;
      return;
    }
    if (field === "rc-edit-valor-objetivo") {
      state.rcEditValorObjetivo = t.value;
      return;
    }

    const rcField = t.dataset.rcField;
    const rcIndex = t.dataset.rcIndex;
    if (rcField && rcIndex != null) {
      const row = rcIndex === "new" ? state.rcNuevoForm : state.nuevaMetaForm.resultadosClave[Number(rcIndex)];
      if (row) {
        if (rcField === "titulo") row.titulo = t.value;
        else if (rcField === "unidad") row.unidad = t.value;
        else if (rcField === "valorInicial") row.valorInicial = t.value;
        else if (rcField === "valorObjetivo") row.valorObjetivo = t.value;
        else if (rcField === "valorActual") row.valorActual = t.value;
      }
      return;
    }

    const checkinValorRcId = t.dataset.checkinValor;
    if (checkinValorRcId != null) {
      const rcId = Number(checkinValorRcId);
      state.rcCheckinValores[rcId] = t.value;
      updateCheckinPreview(rcId, t.value);
      return;
    }
    const checkinNotaRcId = t.dataset.checkinNota;
    if (checkinNotaRcId != null) {
      state.rcCheckinNotas[Number(checkinNotaRcId)] = t.value;
      return;
    }
  }

  // ── A11y de modales: Escape cierra, Tab hace ciclo dentro del panel abierto ──

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      if (state.cerrarMetaOpen) {
        e.preventDefault();
        closeCerrarMeta();
        return;
      }
      if (state.metaDetalleId != null) {
        e.preventDefault();
        closeMetaDetalle();
        return;
      }
      if (state.nuevaMetaOpen) {
        e.preventDefault();
        closeNuevaMetaModal();
        return;
      }
      if (state.editCicloOpen) {
        e.preventDefault();
        state.editCicloOpen = false;
        render();
        return;
      }
      if (state.nuevoCicloOpen) {
        e.preventDefault();
        state.nuevoCicloOpen = false;
        render();
        return;
      }
      return;
    }
    if (e.key === "Tab") {
      const dialogs = container.querySelectorAll<HTMLElement>('[data-modal] [role="dialog"]');
      const panel = dialogs[dialogs.length - 1];
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    }
  }

  render();
  container.addEventListener("click", handleClick, { signal: mountSignal });
  container.addEventListener("change", handleChange, { signal: mountSignal });
  container.addEventListener("input", handleInput, { signal: mountSignal });
  container.addEventListener("keydown", handleKeydown, { signal: mountSignal });

  void loadCiclos();
}
