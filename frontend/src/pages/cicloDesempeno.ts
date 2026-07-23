/**
 * Página de gestión del módulo Ciclo de Desempeño (`#/talento/ciclo-desempeno`):
 * ciclos (config de pesos/umbrales, vínculo a meta-ciclo + campaña 360°,
 * ciclo de vida borrador→activo→cerrado) y matriz 9-Box + calificaciones del
 * equipo con captura de potencial. Mismo patrón de diseño que
 * `pages/metas.ts` (pageHeading, renderTabNav con data-tab, skeletonBlock/
 * errorState, per-mount AbortController, event delegation, modales
 * accesibles con focus-trap).
 *
 * Role-adaptive:
 *  - RH (`canAccessRhAssignedModule("ciclo-desempeno", {...})`): pestaña
 *    "Ciclos" (CRUD + vincular meta-ciclo/campaña 360° + activar/cerrar +
 *    export) + pestaña "Resultados y 9-Box" (global).
 *  - Jefe (supervisor/gerente, scope de equipo resuelto por el backend):
 *    solo pestaña "Resultados y 9-Box" de su equipo, con captura de
 *    potencial. Sin CRUD de ciclos (el backend lo rechazaría con 403).
 */
import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  alertError,
  alertInfo,
  alertSuccess,
  alertWarning,
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
  MODAL_PANEL,
  pageHeading,
  renderTabNav,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SURFACE,
  RH_TABLE_HEAD,
  SELECT_CHEVRON,
  skeletonBlock,
} from "../ui/uiTokens.ts";
import { bandaBadge, BANDA_LABELS, CICLO_ESTADO_LABELS, estadoCicloDesempenoBadge, fmtFechaCiclo, fmtScore, renderEmptyState } from "../cicloDesempeno/shared.ts";
import { canAccessRhAssignedModule } from "../auth/jwt.ts";
import { listCiclos as listMetaCiclos, type MetaCicloResponse } from "../api/metas.ts";
import { fetchEval360Campanas, type CampanaApi } from "../api/evaluacion360.ts";
import {
  activarCicloDesempeno,
  calibrarCiclo,
  cerrarCicloDesempeno,
  createCicloDesempeno,
  descargarCicloDesempenoExcel,
  get9BoxCiclo,
  getDistribucionCiclo,
  getResultadosCiclo,
  listCiclosDesempeno,
  setPotencialCiclo,
  updateCicloDesempeno,
  type BandaAjusteItem,
  type CeldaResponse,
  type CicloDesempenoBanda,
  type CicloDesempenoResponse,
  type CicloDesempenoResultadoResponse,
  type DistribucionResponse,
  type NueveBoxResponse,
  type PotencialUpdateItem,
} from "../api/cicloDesempeno.ts";

/** Elementos enfocables dentro de un panel de modal, para el focus-trap básico (Tab/Shift+Tab). */
const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Acciones de administración de ciclos (solo-RH). Defensa en profundidad en
 * `handleClick`: el backend ya rechaza con 403 (`role_checker(["operativo"])`),
 * pero un jefe no debe poder dispararlas ni siquiera si el markup quedara
 * desincronizado.
 */
const CICLO_ADMIN_ACTIONS = new Set([
  "ciclo-nuevo-abrir",
  "ciclo-nuevo-guardar",
  "ciclo-editar-abrir",
  "ciclo-editar-guardar",
  "ciclo-activar",
  "ciclo-cerrar",
  "ciclo-cerrar-forzar",
  "calibracion-guardar",
]);

type Tab = "ciclos" | "resultados";

/** Orden de filas (vertical, alto arriba) y columnas (horizontal) de la matriz 9-Box. */
const FILAS_DESEMPENO: readonly CicloDesempenoBanda[] = ["alto", "medio", "bajo"];
const COLUMNAS_POTENCIAL: readonly CicloDesempenoBanda[] = ["bajo", "medio", "alto"];

/**
 * Relleno de la barra de distribución por banda. Reutiliza los mismos tonos
 * semánticos del punto de las badges (`badgeApproved`/`badgePending`/
 * `badgeRejected` en uiTokens): alto=positivo, medio=neutro, bajo=negativo.
 */
const BANDA_BAR_CLASS: Record<CicloDesempenoBanda, string> = {
  alto: "bg-emerald-500",
  medio: "bg-amber-400",
  bajo: "bg-red-400",
};

interface CicloForm {
  nombre: string;
  descripcion: string;
  fechaInicio: string;
  fechaFin: string;
  metaCicloId: string;
  eval360CampanaId: string;
  pesoMetas: string;
  pesoCompetencias: string;
  umbralMedio: string;
  umbralAlto: string;
}

function emptyCicloForm(): CicloForm {
  return {
    nombre: "",
    descripcion: "",
    fechaInicio: "",
    fechaFin: "",
    metaCicloId: "",
    eval360CampanaId: "",
    pesoMetas: "60",
    pesoCompetencias: "40",
    umbralMedio: "50",
    umbralAlto: "75",
  };
}

function cicloFormFromResponse(c: CicloDesempenoResponse): CicloForm {
  return {
    nombre: c.nombre,
    descripcion: c.descripcion ?? "",
    fechaInicio: c.fecha_inicio ?? "",
    fechaFin: c.fecha_fin ?? "",
    metaCicloId: c.meta_ciclo_id != null ? String(c.meta_ciclo_id) : "",
    eval360CampanaId: c.eval360_campana_id != null ? String(c.eval360_campana_id) : "",
    pesoMetas: String(c.peso_metas),
    pesoCompetencias: String(c.peso_competencias),
    umbralMedio: String(c.umbral_medio),
    umbralAlto: String(c.umbral_alto),
  };
}

interface State {
  /** RH-operativo (todas las pestañas/acciones) vs. jefe con scope de equipo (sin administración de ciclos). */
  esGestionRh: boolean;
  tab: Tab;

  ciclos: CicloDesempenoResponse[] | null;
  ciclosLoading: boolean;
  ciclosError: string | null;
  cicloSeleccionadoId: number | null;

  metaCiclosOptions: MetaCicloResponse[] | null;
  campanasOptions: CampanaApi[] | null;

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
  /** Ciclo pendiente de reintento con `forzar=true` tras un 422 de cierre. */
  cicloForzarPendienteId: number | null;

  resultados: CicloDesempenoResultadoResponse[] | null;
  resultadosLoading: boolean;
  resultadosError: string | null;

  nueveBox: NueveBoxResponse | null;
  nueveBoxLoading: boolean;

  /** Valores en edición de potencial por `empleado_id` (string, para inputs). */
  potencialEdits: Record<number, string>;
  potencialSaving: boolean;
  potencialError: string | null;
  potencialMessage: string | null;

  /** Calibración (solo RH global): distribución + ajuste directo de banda. */
  distribucion: DistribucionResponse | null;
  distribucionLoading: boolean;
  /** Banda ajustada en edición por `empleado_id`: "" = sin ajuste (reversión). */
  bandaAjustadaEdits: Record<number, string>;
  /** Motivo del ajuste en edición por `empleado_id`. */
  motivoEdits: Record<number, string>;
  calibracionSaving: boolean;
  calibracionError: string | null;
  calibracionMessage: string | null;
}

let mountAbort: AbortController | null = null;

export function mountCicloDesempeno(container: HTMLElement, signal?: AbortSignal): void {
  mountAbort?.abort();
  mountAbort = new AbortController();
  const mountSignal = mountAbort.signal;
  if (signal) {
    signal.addEventListener("abort", () => mountAbort?.abort(), { once: true, signal: mountSignal });
  }

  /**
   * Criterio (positivo) alineado con el backend: `POST/activar/cerrar/PUT
   * /ciclos` exige `role_checker(["operativo"])`, cuyo criterio para un RH
   * inscrito no-admin es el módulo `ciclo-desempeno`. Cualquier otro rol
   * (supervisor/gerente nativo, o admin en Modo líder/gerente) cae en la
   * vista de jefe: gestiona 9-Box/calificaciones/potencial de su equipo,
   * scope ya aplicado por el backend en `_gestion_or_equipo()`.
   */
  const esGestionRh = canAccessRhAssignedModule("ciclo-desempeno", {
    blockGestorTeam: true,
    blockEmpleado: true,
    blockDirector: true,
  });

  const state: State = {
    esGestionRh,
    tab: esGestionRh ? "ciclos" : "resultados",

    ciclos: null,
    ciclosLoading: true,
    ciclosError: null,
    cicloSeleccionadoId: null,

    metaCiclosOptions: null,
    campanasOptions: null,

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
    cicloForzarPendienteId: null,

    resultados: null,
    resultadosLoading: false,
    resultadosError: null,

    nueveBox: null,
    nueveBoxLoading: false,

    potencialEdits: {},
    potencialSaving: false,
    potencialError: null,
    potencialMessage: null,

    distribucion: null,
    distribucionLoading: false,
    bandaAjustadaEdits: {},
    motivoEdits: {},
    calibracionSaving: false,
    calibracionError: null,
    calibracionMessage: null,
  };

  // ── Carga de datos ──────────────────────────────────────────────────────────

  async function loadCiclos(): Promise<void> {
    state.ciclosLoading = true;
    render();
    try {
      state.ciclos = await listCiclosDesempeno();
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
    if (state.tab === "resultados") void loadResultadosYBox();
  }

  async function loadResultadosYBox(): Promise<void> {
    if (state.cicloSeleccionadoId == null) {
      state.resultados = [];
      state.nueveBox = null;
      render();
      return;
    }
    const cicloId = state.cicloSeleccionadoId;
    state.resultadosLoading = true;
    state.nueveBoxLoading = true;
    if (state.esGestionRh) state.distribucionLoading = true;
    render();
    try {
      const [resultados, nueveBox, distribucion] = await Promise.all([
        getResultadosCiclo(cicloId),
        get9BoxCiclo(cicloId),
        state.esGestionRh ? getDistribucionCiclo(cicloId) : Promise.resolve(null),
      ]);
      state.resultados = resultados;
      state.nueveBox = nueveBox;
      state.distribucion = distribucion;
      state.resultadosError = null;
      state.potencialEdits = Object.fromEntries(
        resultados.map((r) => [r.empleado_id, r.potencial != null ? String(r.potencial) : ""]),
      );
      state.bandaAjustadaEdits = Object.fromEntries(
        resultados.map((r) => [r.empleado_id, r.banda_desempeno_ajustada ?? ""]),
      );
      state.motivoEdits = Object.fromEntries(resultados.map((r) => [r.empleado_id, r.banda_ajuste_motivo ?? ""]));
    } catch (err: unknown) {
      state.resultadosError = (err as Error)?.message ?? "No se pudieron cargar los resultados";
    }
    state.resultadosLoading = false;
    state.nueveBoxLoading = false;
    state.distribucionLoading = false;
    render();
  }

  async function loadMetaCiclosOptions(): Promise<void> {
    if (state.metaCiclosOptions != null) return;
    try {
      state.metaCiclosOptions = await listMetaCiclos();
    } catch {
      state.metaCiclosOptions = [];
    }
    render();
  }

  async function loadCampanasOptions(): Promise<void> {
    if (state.campanasOptions != null) return;
    try {
      const page = await fetchEval360Campanas({ page: 1, page_size: 100 });
      state.campanasOptions = page.items;
    } catch {
      state.campanasOptions = [];
    }
    render();
  }

  // ── Render: pestaña Ciclos ───────────────────────────────────────────────────

  function renderCicloRow(c: CicloDesempenoResponse): string {
    const acciones: string[] = [];
    if (c.estado === "borrador") {
      acciones.push(`<button type="button" data-action="ciclo-editar-abrir" data-id="${c.id}" class="${BTN_GHOST}">Editar</button>`);
      acciones.push(`<button type="button" data-action="ciclo-activar" data-id="${c.id}" class="${BTN_SECONDARY}">Activar</button>`);
    }
    if (c.estado === "activo") {
      acciones.push(`<button type="button" data-action="ciclo-cerrar" data-id="${c.id}" class="${BTN_DANGER}">Cerrar ciclo</button>`);
    }
    acciones.push(`<button type="button" data-action="ciclo-exportar" data-id="${c.id}" class="${BTN_GHOST}">Exportar Excel</button>`);
    const vinculos = `Metas: ${c.meta_ciclo_id != null ? `#${c.meta_ciclo_id}` : "Sin vincular"} · 360°: ${c.eval360_campana_id != null ? `#${c.eval360_campana_id}` : "Sin vincular"}`;
    return `
    <tr class="border-b border-slate-100 last:border-b-0">
      <td class="px-3 py-3 align-middle">
        <p class="font-semibold text-text-primary">${escapeHtml(c.nombre)}</p>
        ${c.descripcion ? `<p class="text-xs text-text-muted">${escapeHtml(c.descripcion)}</p>` : ""}
        <p class="mt-0.5 text-xs text-text-muted">${escapeHtml(vinculos)}</p>
      </td>
      <td class="px-3 py-3 align-middle">${estadoCicloDesempenoBadge(c.estado)}</td>
      <td class="px-3 py-3 align-middle text-sm text-text-muted">${escapeHtml(fmtFechaCiclo(c.fecha_inicio))} – ${escapeHtml(fmtFechaCiclo(c.fecha_fin))}</td>
      <td class="px-3 py-3 align-middle text-sm tabular-nums text-text-secondary">${c.peso_metas}% / ${c.peso_competencias}%</td>
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
      ${
        state.cicloActionError
          ? state.cicloForzarPendienteId != null
            ? errorState({
                message: state.cicloActionError,
                actionLabel: "Forzar cierre",
                actionAttrs: `data-action="ciclo-cerrar-forzar" data-id="${state.cicloForzarPendienteId}"`,
              })
            : alertError(state.cicloActionError)
          : ""
      }
      ${state.cicloActionMessage ? alertSuccess(state.cicloActionMessage) : ""}
      ${
        ciclos.length === 0
          ? renderEmptyState({
              title: "No hay ciclos de desempeño",
              subtitle: "Crea el primer ciclo para combinar metas y evaluación 360° en una calificación final.",
              actionHtml: `<button type="button" data-action="ciclo-nuevo-abrir" class="${BTN_PRIMARY}">+ Nuevo ciclo</button>`,
            })
          : `<div class="flex justify-end"><button type="button" data-action="ciclo-nuevo-abrir" class="${BTN_PRIMARY}">+ Nuevo ciclo</button></div>
            <section class="${RH_LISTADO_SURFACE} overflow-x-auto">
              <table class="min-w-[880px] w-full text-left">
                <thead class="${RH_TABLE_HEAD}">
                  <tr>
                    <th class="px-3 py-2.5">Ciclo</th>
                    <th class="px-3 py-2.5">Estado</th>
                    <th class="px-3 py-2.5">Vigencia</th>
                    <th class="px-3 py-2.5">Pesos (metas/comp.)</th>
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
    const metaCiclos = state.metaCiclosOptions ?? [];
    const campanas = state.campanasOptions ?? [];
    return `
    <div class="flex flex-col gap-3">
      <div>
        <label class="${FORM_LABEL}" for="cd-${prefix}-nombre">Nombre</label>
        <input id="cd-${prefix}-nombre" data-cd-field="nombre" data-cd-prefix="${prefix}" type="text" value="${escapeHtml(f.nombre)}" class="${FIELD_INPUT}" placeholder="Ej. Desempeño anual 2026" />
      </div>
      <div>
        <label class="${FORM_LABEL}" for="cd-${prefix}-descripcion">Descripción (opcional)</label>
        <textarea id="cd-${prefix}-descripcion" data-cd-field="descripcion" data-cd-prefix="${prefix}" rows="2" class="${FIELD_TEXTAREA}">${escapeHtml(f.descripcion)}</textarea>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="${FORM_LABEL}" for="cd-${prefix}-inicio">Fecha inicio</label>
          <input id="cd-${prefix}-inicio" data-cd-field="fechaInicio" data-cd-prefix="${prefix}" type="date" value="${escapeHtml(f.fechaInicio)}" class="${FIELD_INPUT}" />
        </div>
        <div>
          <label class="${FORM_LABEL}" for="cd-${prefix}-fin">Fecha fin</label>
          <input id="cd-${prefix}-fin" data-cd-field="fechaFin" data-cd-prefix="${prefix}" type="date" value="${escapeHtml(f.fechaFin)}" class="${FIELD_INPUT}" />
        </div>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label class="${FORM_LABEL}" for="cd-${prefix}-meta-ciclo">Ciclo de metas vinculado (opcional)</label>
          <div class="relative">
            <select id="cd-${prefix}-meta-ciclo" data-action="cd-meta-ciclo" data-cd-prefix="${prefix}" class="${FORM_SELECT}">
              <option value="">Sin vincular</option>
              ${metaCiclos.map((m) => `<option value="${m.id}"${f.metaCicloId === String(m.id) ? " selected" : ""}>${escapeHtml(m.nombre)} (${m.estado})</option>`).join("")}
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        <div>
          <label class="${FORM_LABEL}" for="cd-${prefix}-campana-360">Campaña 360° vinculada (opcional)</label>
          <div class="relative">
            <select id="cd-${prefix}-campana-360" data-action="cd-campana-360" data-cd-prefix="${prefix}" class="${FORM_SELECT}">
              <option value="">Sin vincular</option>
              ${campanas.map((c) => `<option value="${c.id}"${f.eval360CampanaId === String(c.id) ? " selected" : ""}>${escapeHtml(c.nombre)} (${c.estado})</option>`).join("")}
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="${FORM_LABEL}" for="cd-${prefix}-peso-metas">Peso metas (%)</label>
          <input id="cd-${prefix}-peso-metas" data-cd-field="pesoMetas" data-cd-prefix="${prefix}" type="number" min="0" step="any" value="${escapeHtml(f.pesoMetas)}" class="${FIELD_INPUT}" />
        </div>
        <div>
          <label class="${FORM_LABEL}" for="cd-${prefix}-peso-competencias">Peso competencias/360° (%)</label>
          <input id="cd-${prefix}-peso-competencias" data-cd-field="pesoCompetencias" data-cd-prefix="${prefix}" type="number" min="0" step="any" value="${escapeHtml(f.pesoCompetencias)}" class="${FIELD_INPUT}" />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="${FORM_LABEL}" for="cd-${prefix}-umbral-medio">Umbral banda media (%)</label>
          <input id="cd-${prefix}-umbral-medio" data-cd-field="umbralMedio" data-cd-prefix="${prefix}" type="number" min="0" max="100" step="any" value="${escapeHtml(f.umbralMedio)}" class="${FIELD_INPUT}" />
        </div>
        <div>
          <label class="${FORM_LABEL}" for="cd-${prefix}-umbral-alto">Umbral banda alta (%)</label>
          <input id="cd-${prefix}-umbral-alto" data-cd-field="umbralAlto" data-cd-prefix="${prefix}" type="number" min="0" max="100" step="any" value="${escapeHtml(f.umbralAlto)}" class="${FIELD_INPUT}" />
        </div>
      </div>
    </div>`;
  }

  function renderNuevoCicloModal(): string {
    if (!state.nuevoCicloOpen) return "";
    const f = state.nuevoCicloForm;
    const puedeGuardar = !!f.nombre.trim() && !!f.fechaInicio && !!f.fechaFin;
    return `
    <div class="${MODAL_OVERLAY}" data-modal="cd-ciclo-nuevo">
      <div class="${MODAL_PANEL} max-w-lg" role="dialog" aria-modal="true" aria-labelledby="cd-ciclo-nuevo-titulo">
        <header class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="cd-ciclo-nuevo-titulo" class="text-base font-bold text-text-primary">Nuevo ciclo de desempeño</h2>
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
    <div class="${MODAL_OVERLAY}" data-modal="cd-ciclo-editar">
      <div class="${MODAL_PANEL} max-w-lg" role="dialog" aria-modal="true" aria-labelledby="cd-ciclo-editar-titulo">
        <header class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="cd-ciclo-editar-titulo" class="text-base font-bold text-text-primary">Editar ciclo</h2>
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

  // ── Render: selector de ciclo (compartido con pestaña Resultados) ───────────

  function renderCicloSelector(): string {
    const ciclos = state.ciclos ?? [];
    return `
    <div class="min-w-[16rem]">
      <label class="${FORM_LABEL}" for="cd-ciclo-selector">Ciclo</label>
      <div class="relative">
        <select id="cd-ciclo-selector" data-action="ciclo-selector" class="${FORM_SELECT}">
          ${ciclos.map((c) => `<option value="${c.id}"${state.cicloSeleccionadoId === c.id ? " selected" : ""}>${escapeHtml(c.nombre)} (${CICLO_ESTADO_LABELS[c.estado]})</option>`).join("")}
        </select>
        ${SELECT_CHEVRON}
      </div>
    </div>`;
  }

  // ── Render: pestaña Resultados y 9-Box ───────────────────────────────────────

  function renderCelda(bd: CicloDesempenoBanda, bp: CicloDesempenoBanda, celda: CeldaResponse | undefined): string {
    const empleados = celda?.empleados ?? [];
    return `
    <div class="flex min-h-[7rem] flex-col gap-1.5 rounded-lg border border-slate-200 bg-white p-2.5">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">${BANDA_LABELS[bd]} / ${BANDA_LABELS[bp]}</span>
        <span class="shrink-0 text-xs font-bold tabular-nums text-text-secondary">${empleados.length}</span>
      </div>
      <div class="flex flex-1 flex-col gap-1 overflow-y-auto">
        ${
          empleados.length === 0
            ? `<p class="text-xs text-text-muted">Sin colaboradores</p>`
            : empleados
                .map(
                  (e) =>
                    `<p class="truncate text-xs text-text-primary" title="${escapeHtml(e.empleado_nombre ?? `Empleado #${e.empleado_id}`)}">${escapeHtml(e.empleado_nombre ?? `Empleado #${e.empleado_id}`)}</p>`,
                )
                .join("")
        }
      </div>
    </div>`;
  }

  function render9BoxMatrix(): string {
    if (state.nueveBoxLoading) {
      return skeletonBlock({ className: `${RH_LISTADO_SURFACE} px-6 py-16`, label: "Cargando matriz 9-Box…" });
    }
    const nb = state.nueveBox;
    if (!nb) return "";
    const celdaMap = new Map<string, CeldaResponse>();
    for (const c of nb.celdas) celdaMap.set(`${c.banda_desempeno}_${c.banda_potencial}`, c);
    const totalUbicados = nb.celdas.reduce((acc, c) => acc + c.empleados.length, 0);
    return `
    <div class="${RH_LISTADO_SURFACE} p-4">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm font-semibold text-text-primary">Matriz 9-Box</p>
        <p class="text-xs text-text-muted">Desempeño (vertical) × Potencial (horizontal) · ${totalUbicados} ubicado(s)</p>
      </div>
      <div class="overflow-x-auto">
        <div class="grid min-w-[36rem] grid-cols-[6rem_repeat(3,1fr)] gap-2">
          <div></div>
          ${COLUMNAS_POTENCIAL.map((bp) => `<div class="text-center text-[11px] font-semibold uppercase tracking-wide text-text-muted">Potencial ${BANDA_LABELS[bp]}</div>`).join("")}
          ${FILAS_DESEMPENO.map(
            (bd) => `
          <div class="flex items-center justify-end pr-1 text-right text-[11px] font-semibold uppercase tracking-wide text-text-muted">Desemp. ${BANDA_LABELS[bd]}</div>
          ${COLUMNAS_POTENCIAL.map((bp) => renderCelda(bd, bp, celdaMap.get(`${bd}_${bp}`))).join("")}`,
          ).join("")}
        </div>
      </div>
    </div>`;
  }

  function renderResultadoRow(r: CicloDesempenoResultadoResponse, editable: boolean): string {
    const potencialValue = state.potencialEdits[r.empleado_id] ?? "";
    return `
    <tr class="border-b border-slate-100 last:border-b-0">
      <td class="px-3 py-3 align-middle">
        <p class="font-semibold text-text-primary">${escapeHtml(r.empleado_nombre ?? `Empleado #${r.empleado_id}`)}</p>
      </td>
      <td class="px-3 py-3 align-middle text-sm tabular-nums text-text-secondary">${fmtScore(r.cumplimiento_metas)}</td>
      <td class="px-3 py-3 align-middle text-sm tabular-nums text-text-secondary">${fmtScore(r.calificacion_360_norm)}</td>
      <td class="px-3 py-3 align-middle text-sm font-semibold tabular-nums text-text-primary">${fmtScore(r.calificacion_desempeno)}</td>
      <td class="px-3 py-3 align-middle">${bandaBadge(r.banda_desempeno)}</td>
      <td class="px-3 py-3 align-middle">
        ${
          editable
            ? `<input type="number" min="0" max="100" step="any" data-potencial-empleado="${r.empleado_id}" value="${escapeHtml(potencialValue)}" class="${FIELD_INPUT} w-24" />`
            : `<span class="text-sm tabular-nums text-text-secondary">${fmtScore(r.potencial)}</span>`
        }
      </td>
      <td class="px-3 py-3 align-middle">${bandaBadge(r.banda_potencial)}</td>
    </tr>`;
  }

  function renderResultadosTabla(editable: boolean): string {
    if (state.resultadosLoading) {
      return skeletonBlock({ className: `${RH_LISTADO_SURFACE} px-6 py-16`, label: "Cargando resultados…" });
    }
    if (state.resultadosError) {
      return errorState({ message: state.resultadosError, actionLabel: "Reintentar", actionAttrs: 'data-action="reload-resultados"' });
    }
    const resultados = state.resultados ?? [];
    if (resultados.length === 0) {
      return renderEmptyState({
        title: "Sin colaboradores en este ciclo",
        subtitle: "El ciclo aún no ha sido activado o no hay metas/participantes 360° vinculados.",
      });
    }
    return `
    <section class="${RH_LISTADO_SURFACE} overflow-x-auto">
      <table class="min-w-[900px] w-full text-left">
        <thead class="${RH_TABLE_HEAD}">
          <tr>
            <th class="px-3 py-2.5">Empleado</th>
            <th class="px-3 py-2.5">Cumplimiento metas</th>
            <th class="px-3 py-2.5">360° (norm.)</th>
            <th class="px-3 py-2.5">Calificación desempeño</th>
            <th class="px-3 py-2.5">Banda desempeño</th>
            <th class="px-3 py-2.5">Potencial</th>
            <th class="px-3 py-2.5">Banda potencial</th>
          </tr>
        </thead>
        <tbody>${resultados.map((r) => renderResultadoRow(r, editable)).join("")}</tbody>
      </table>
    </section>`;
  }

  // ── Render: Calibración (solo RH global) ─────────────────────────────────────

  /**
   * Barra de distribución actual vs. objetivo por banda (orden alto→medio→bajo).
   * El relleno reutiliza los tonos semánticos de las badges (emerald/amber/red);
   * no se introducen colores nuevos.
   */
  function renderDistribucionBar(): string {
    if (state.distribucionLoading) {
      return skeletonBlock({ className: `${RH_LISTADO_SURFACE} px-6 py-12`, label: "Cargando distribución…" });
    }
    const d = state.distribucion;
    if (!d) return "";
    const filas = FILAS_DESEMPENO.map((b) => {
      const count = d.actual[b] ?? 0;
      const pctActual = d.actual.pct[b] ?? 0;
      const objetivo = d.objetivo[b] ?? 0;
      const desv = d.desviacion[b] ?? 0;
      const anchoActual = Math.max(0, Math.min(100, pctActual));
      const posObjetivo = Math.max(0, Math.min(100, objetivo));
      const desvStr = `${desv > 0 ? "+" : ""}${desv.toFixed(1)} pp`;
      return `
      <div class="flex flex-col gap-1.5">
        <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
          <span class="flex items-center gap-2">${bandaBadge(b)}<span class="tabular-nums text-text-secondary">${count} colab.</span></span>
          <span class="tabular-nums text-text-muted">Actual ${pctActual.toFixed(1)}% · Objetivo ${objetivo.toFixed(1)}% · Desv. ${desvStr}</span>
        </div>
        <div class="relative h-2 w-full rounded-full bg-slate-100">
          <div class="absolute inset-y-0 left-0 rounded-full ${BANDA_BAR_CLASS[b]}" style="width:${anchoActual}%"></div>
          <div class="absolute inset-y-[-3px] w-px bg-slate-500/70" style="left:${posObjetivo}%" title="Objetivo ${objetivo.toFixed(1)}%"></div>
        </div>
      </div>`;
    }).join("");
    return `
    <div class="${RH_LISTADO_SURFACE} p-4">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm font-semibold text-text-primary">Distribución de bandas</p>
        <p class="text-xs text-text-muted">Relleno = actual · marca = objetivo · ${d.actual.total} colaborador(es)</p>
      </div>
      <div class="flex flex-col gap-3">${filas}</div>
    </div>`;
  }

  function renderCalibracionRow(r: CicloDesempenoResultadoResponse): string {
    const bandaSel = state.bandaAjustadaEdits[r.empleado_id] ?? "";
    const motivo = state.motivoEdits[r.empleado_id] ?? "";
    const opciones = ["", "bajo", "medio", "alto"]
      .map((v) => {
        const label = v === "" ? "Sin ajuste (usar cálculo)" : BANDA_LABELS[v as CicloDesempenoBanda];
        return `<option value="${v}"${bandaSel === v ? " selected" : ""}>${escapeHtml(label)}</option>`;
      })
      .join("");
    const ajustadoPor =
      r.banda_desempeno_ajustada != null
        ? `<p class="text-xs text-text-muted">Ajustó #${r.banda_ajustada_por_id ?? "—"}</p>
           <p class="text-xs text-text-muted">${escapeHtml(fmtFechaCiclo(r.banda_ajustada_at))}</p>`
        : `<span class="text-xs text-text-muted">—</span>`;
    const calculada = r.banda_desempeno ? BANDA_LABELS[r.banda_desempeno] : "sin dato";
    const avisoOverride =
      r.banda_desempeno_ajustada != null
        ? `<tr class="border-b border-slate-100"><td colspan="5" class="px-3 pb-3 pt-0">
            ${alertWarning(`Banda ajustada manualmente (calculada: ${calculada}).`, "note")}
          </td></tr>`
        : "";
    return `
    <tr class="border-b border-slate-100 last:border-b-0">
      <td class="px-3 py-3 align-middle">
        <p class="font-semibold text-text-primary">${escapeHtml(r.empleado_nombre ?? `Empleado #${r.empleado_id}`)}</p>
      </td>
      <td class="px-3 py-3 align-middle">${bandaBadge(r.banda_desempeno)}</td>
      <td class="px-3 py-3 align-middle">
        <div class="relative w-40">
          <select data-banda-ajustada-empleado="${r.empleado_id}" class="${FORM_SELECT}">${opciones}</select>
          ${SELECT_CHEVRON}
        </div>
      </td>
      <td class="px-3 py-3 align-middle">
        <input type="text" data-motivo-empleado="${r.empleado_id}" value="${escapeHtml(motivo)}" maxlength="500" placeholder="Motivo del ajuste" class="${FIELD_INPUT} w-56" />
      </td>
      <td class="px-3 py-3 align-middle">${ajustadoPor}</td>
    </tr>
    ${avisoOverride}`;
  }

  function renderCalibracion(): string {
    if (!state.esGestionRh) return "";
    if (state.resultadosLoading) return "";
    if (state.resultadosError) return "";
    const resultados = state.resultados ?? [];
    return `
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <h2 class="text-base font-bold text-text-primary">Calibración</h2>
        <p class="text-sm text-text-muted">Ajusta manualmente la banda de desempeño sobre el cálculo automático. Dejar “Sin ajuste” revierte al valor calculado.</p>
      </div>
      ${renderDistribucionBar()}
      ${state.calibracionError ? alertError(state.calibracionError) : ""}
      ${state.calibracionMessage ? alertSuccess(state.calibracionMessage) : ""}
      ${
        resultados.length === 0
          ? renderEmptyState({ title: "Sin colaboradores para calibrar", subtitle: "Activa el ciclo para poblar los resultados." })
          : `<section class="${RH_LISTADO_SURFACE} overflow-x-auto">
              <table class="min-w-[820px] w-full text-left">
                <thead class="${RH_TABLE_HEAD}">
                  <tr>
                    <th class="px-3 py-2.5">Empleado</th>
                    <th class="px-3 py-2.5">Banda calculada</th>
                    <th class="px-3 py-2.5">Banda ajustada</th>
                    <th class="px-3 py-2.5">Motivo</th>
                    <th class="px-3 py-2.5">Ajuste</th>
                  </tr>
                </thead>
                <tbody>${resultados.map(renderCalibracionRow).join("")}</tbody>
              </table>
            </section>
            <div class="flex justify-end">
              <button type="button" data-action="calibracion-guardar" class="${BTN_PRIMARY}" ${state.calibracionSaving ? "disabled" : ""}>
                ${state.calibracionSaving ? "Guardando…" : "Guardar calibración"}
              </button>
            </div>`
      }
    </div>`;
  }

  function renderResultadosTab(): string {
    if (state.ciclosLoading) {
      return skeletonBlock({ className: `${RH_LISTADO_SURFACE} px-6 py-16`, label: "Cargando ciclos…" });
    }
    if ((state.ciclos ?? []).length === 0) {
      return renderEmptyState(
        state.esGestionRh
          ? { title: "Aún no hay ciclos", subtitle: "Crea un ciclo en la pestaña Ciclos para ver resultados y la matriz 9-Box." }
          : { title: "Aún no hay ciclos de desempeño", subtitle: "Pídele a RH que cree uno." },
      );
    }
    const cicloActual = (state.ciclos ?? []).find((c) => c.id === state.cicloSeleccionadoId) ?? null;
    const editable = cicloActual?.estado === "activo";
    return `
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        ${renderCicloSelector()}
        ${state.cicloSeleccionadoId != null ? `<button type="button" data-action="ciclo-exportar" data-id="${state.cicloSeleccionadoId}" class="${BTN_SECONDARY}">Exportar Excel</button>` : ""}
      </div>
      ${cicloActual?.estado === "cerrado" ? alertInfo("Este ciclo está cerrado: la calificación quedó congelada al momento del cierre.") : ""}
      ${cicloActual?.estado === "borrador" ? alertInfo("Este ciclo está en borrador: actívalo para determinar participantes y capturar potencial.") : ""}
      ${render9BoxMatrix()}
      ${state.potencialError ? alertError(state.potencialError) : ""}
      ${state.potencialMessage ? alertSuccess(state.potencialMessage) : ""}
      ${renderResultadosTabla(editable)}
      ${
        editable
          ? `<div class="flex justify-end">
              <button type="button" data-action="potencial-guardar" class="${BTN_PRIMARY}" ${state.potencialSaving ? "disabled" : ""}>
                ${state.potencialSaving ? "Guardando…" : "Guardar potencial"}
              </button>
            </div>`
          : ""
      }
      ${state.esGestionRh ? `<div class="mt-2 border-t border-slate-200/70 pt-4">${renderCalibracion()}</div>` : ""}
    </div>`;
  }

  // ── Render raíz ───────────────────────────────────────────────────────────────

  function pageContent(): string {
    const tabs = state.esGestionRh
      ? [
          { id: "ciclos", label: "Ciclos" },
          { id: "resultados", label: "Resultados y 9-Box" },
        ]
      : [{ id: "resultados", label: "Resultados y 9-Box" }];
    return `
    <div class="${RH_LISTADO_PAGE_OUTER}">
      <div class="flex flex-col gap-2">
        <p class="text-xs font-medium text-text-muted">${state.esGestionRh ? "Talento" : "Talento · Mi equipo"}</p>
        ${pageHeading(
          state.esGestionRh ? "Ciclo de Desempeño" : "Desempeño de mi equipo",
          state.esGestionRh
            ? "Combina cumplimiento de metas y evaluación 360° en una calificación final por ciclo, con matriz 9-Box de desempeño × potencial."
            : "Consulta la calificación y matriz 9-Box de tu equipo, y captura el potencial de cada colaborador.",
        )}
      </div>
      ${
        tabs.length > 1
          ? `<div data-tabs="ciclo-desempeno-main">${renderTabNav(tabs, state.tab, { ariaLabel: "Secciones de Ciclo de Desempeño" })}</div>`
          : ""
      }
      ${state.tab === "ciclos" && state.esGestionRh ? renderCiclosTab() : renderResultadosTab()}
    </div>
    ${renderNuevoCicloModal()}
    ${renderEditCicloModal()}`;
  }

  function render(): void {
    mountAppShell(container, {
      pageTitle: "Ciclo de Desempeño",
      activeNav: "ciclo-desempeno",
      mainClass: "py-5 sm:py-6",
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

  function parseCicloPayload(f: CicloForm): {
    nombre: string;
    descripcion: string | null;
    fecha_inicio: string;
    fecha_fin: string;
    meta_ciclo_id: number | null;
    eval360_campana_id: number | null;
    peso_metas: number;
    peso_competencias: number;
    umbral_medio: number;
    umbral_alto: number;
  } | null {
    const pesoMetas = Number(f.pesoMetas);
    const pesoCompetencias = Number(f.pesoCompetencias);
    const umbralMedio = Number(f.umbralMedio);
    const umbralAlto = Number(f.umbralAlto);
    if (![pesoMetas, pesoCompetencias, umbralMedio, umbralAlto].every(Number.isFinite)) return null;
    return {
      nombre: f.nombre.trim(),
      descripcion: f.descripcion.trim() || null,
      fecha_inicio: f.fechaInicio,
      fecha_fin: f.fechaFin,
      meta_ciclo_id: f.metaCicloId ? Number(f.metaCicloId) : null,
      eval360_campana_id: f.eval360CampanaId ? Number(f.eval360CampanaId) : null,
      peso_metas: pesoMetas,
      peso_competencias: pesoCompetencias,
      umbral_medio: umbralMedio,
      umbral_alto: umbralAlto,
    };
  }

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
    const payload = parseCicloPayload(f);
    if (!payload) {
      state.nuevoCicloError = "Revisa los pesos y umbrales: deben ser números válidos";
      render();
      return;
    }
    state.nuevoCicloSaving = true;
    state.nuevoCicloError = null;
    render();
    try {
      await createCicloDesempeno(payload);
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
    const payload = parseCicloPayload(f);
    if (!payload) {
      state.editCicloError = "Revisa los pesos y umbrales: deben ser números válidos";
      render();
      return;
    }
    state.editCicloSaving = true;
    state.editCicloError = null;
    render();
    try {
      await updateCicloDesempeno(state.editCicloId, payload);
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
    state.cicloForzarPendienteId = null;
    try {
      await activarCicloDesempeno(id);
      state.cicloActionMessage = "Ciclo activado.";
      await loadCiclos();
    } catch (err: unknown) {
      state.cicloActionError = (err as Error)?.message ?? "No se pudo activar el ciclo";
      render();
    }
  }

  async function onCerrarCiclo(id: number, forzar: boolean): Promise<void> {
    state.cicloActionError = null;
    state.cicloForzarPendienteId = null;
    render();
    try {
      await cerrarCicloDesempeno(id, forzar);
      state.cicloActionMessage = forzar ? "Ciclo cerrado (forzado)." : "Ciclo cerrado.";
      await loadCiclos();
    } catch (err: unknown) {
      state.cicloActionError = (err as Error)?.message ?? "No se pudo cerrar el ciclo";
      state.cicloForzarPendienteId = id;
      render();
    }
  }

  async function onExportarCiclo(id: number): Promise<void> {
    try {
      const ok = await descargarCicloDesempenoExcel(id, `ciclo_desempeno_${id}.xlsx`);
      if (!ok) {
        state.cicloActionError = "No se pudo descargar el export";
        render();
      }
    } catch {
      state.cicloActionError = "No se pudo descargar el export";
      render();
    }
  }

  // ── Acciones: potencial ───────────────────────────────────────────────────────

  async function onGuardarPotencial(): Promise<void> {
    if (state.cicloSeleccionadoId == null || state.potencialSaving) return;
    const items: PotencialUpdateItem[] = [];
    for (const [empIdStr, valStr] of Object.entries(state.potencialEdits)) {
      const val = valStr.trim();
      if (val === "") continue;
      const num = Number(val);
      if (!Number.isFinite(num) || num < 0 || num > 100) {
        state.potencialError = "El potencial debe ser un número entre 0 y 100";
        render();
        return;
      }
      items.push({ empleado_id: Number(empIdStr), potencial: num });
    }
    if (items.length === 0) {
      state.potencialError = "Captura al menos un valor de potencial";
      render();
      return;
    }
    state.potencialSaving = true;
    state.potencialError = null;
    render();
    try {
      await setPotencialCiclo(state.cicloSeleccionadoId, items);
      state.potencialSaving = false;
      state.potencialMessage = "Potencial guardado.";
      await loadResultadosYBox();
    } catch (err: unknown) {
      state.potencialSaving = false;
      state.potencialError = (err as Error)?.message ?? "No se pudo guardar el potencial";
      render();
    }
  }

  // ── Acciones: calibración (solo RH global) ───────────────────────────────────

  async function onGuardarCalibracion(): Promise<void> {
    if (!state.esGestionRh || state.cicloSeleccionadoId == null || state.calibracionSaving) return;
    const resultados = state.resultados ?? [];
    const items: BandaAjusteItem[] = [];
    for (const r of resultados) {
      const loadedBanda = r.banda_desempeno_ajustada ?? "";
      const loadedMotivo = (r.banda_ajuste_motivo ?? "").trim();
      const curBanda = state.bandaAjustadaEdits[r.empleado_id] ?? "";
      const curMotivo = (state.motivoEdits[r.empleado_id] ?? "").trim();
      // Fila modificada = banda cambiada, o (con ajuste vigente) motivo editado.
      const bandaCambio = curBanda !== loadedBanda;
      const motivoCambio = curBanda !== "" && curMotivo !== loadedMotivo;
      if (!bandaCambio && !motivoCambio) continue;
      if (curBanda !== "" && !curMotivo) {
        state.calibracionError = `Captura el motivo del ajuste de ${r.empleado_nombre ?? `Empleado #${r.empleado_id}`}`;
        state.calibracionMessage = null;
        render();
        return;
      }
      items.push({
        empleado_id: r.empleado_id,
        banda_ajustada: curBanda === "" ? null : (curBanda as CicloDesempenoBanda),
        motivo: curBanda === "" ? null : curMotivo,
      });
    }
    if (items.length === 0) {
      state.calibracionError = "No hay cambios de calibración que guardar.";
      state.calibracionMessage = null;
      render();
      return;
    }
    state.calibracionSaving = true;
    state.calibracionError = null;
    render();
    try {
      await calibrarCiclo(state.cicloSeleccionadoId, items);
      state.calibracionSaving = false;
      state.calibracionMessage = "Calibración guardada.";
      await loadResultadosYBox();
    } catch (err: unknown) {
      state.calibracionSaving = false;
      state.calibracionError = (err as Error)?.message ?? "No se pudo guardar la calibración";
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
      if (group === "ciclo-desempeno-main" && (tabId === "ciclos" || tabId === "resultados")) {
        if (tabId === "ciclos" && !state.esGestionRh) return;
        state.tab = tabId;
        render();
        if (tabId === "resultados") void loadResultadosYBox();
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
      case "reload-resultados":
        void loadResultadosYBox();
        return;
      case "ciclo-nuevo-abrir":
        state.nuevoCicloForm = emptyCicloForm();
        state.nuevoCicloError = null;
        state.nuevoCicloOpen = true;
        render();
        void loadMetaCiclosOptions();
        void loadCampanasOptions();
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
          state.editCicloForm = cicloFormFromResponse(c);
          state.editCicloError = null;
          state.editCicloOpen = true;
          render();
          void loadMetaCiclosOptions();
          void loadCampanasOptions();
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
        if (id && window.confirm("¿Activar este ciclo? Se determinarán los participantes a partir de las metas y la evaluación 360° vinculadas.")) {
          void onActivarCiclo(id);
        }
        return;
      }
      case "ciclo-cerrar": {
        const id = Number(actionEl.dataset.id);
        if (id && window.confirm("¿Cerrar este ciclo? Se congelará la calificación final de cada colaborador.")) {
          void onCerrarCiclo(id, false);
        }
        return;
      }
      case "ciclo-cerrar-forzar": {
        const id = Number(actionEl.dataset.id);
        if (id && window.confirm("¿Forzar el cierre aunque las fuentes vinculadas (metas/360°) no estén finalizadas?")) {
          void onCerrarCiclo(id, true);
        }
        return;
      }
      case "ciclo-exportar": {
        const id = Number(actionEl.dataset.id);
        if (id) void onExportarCiclo(id);
        return;
      }
      case "potencial-guardar":
        void onGuardarPotencial();
        return;
      case "calibracion-guardar":
        void onGuardarCalibracion();
        return;
      default:
        return;
    }
  }

  function handleChange(e: Event): void {
    const t = e.target as HTMLElement;
    if (t instanceof HTMLSelectElement && t.dataset.action === "ciclo-selector") {
      state.cicloSeleccionadoId = Number(t.value) || null;
      render();
      if (state.tab === "resultados") void loadResultadosYBox();
      return;
    }
    if (t instanceof HTMLSelectElement && t.dataset.action === "cd-meta-ciclo") {
      const form = t.dataset.cdPrefix === "nuevo" ? state.nuevoCicloForm : state.editCicloForm;
      form.metaCicloId = t.value;
      return;
    }
    if (t instanceof HTMLSelectElement && t.dataset.action === "cd-campana-360") {
      const form = t.dataset.cdPrefix === "nuevo" ? state.nuevoCicloForm : state.editCicloForm;
      form.eval360CampanaId = t.value;
      return;
    }
    if (t instanceof HTMLSelectElement && t.dataset.bandaAjustadaEmpleado != null) {
      state.bandaAjustadaEdits[Number(t.dataset.bandaAjustadaEmpleado)] = t.value;
      return;
    }
  }

  function handleInput(e: Event): void {
    const t = e.target as HTMLElement;
    if (!(t instanceof HTMLInputElement) && !(t instanceof HTMLTextAreaElement)) return;

    const cdField = t.dataset.cdField;
    const cdPrefix = t.dataset.cdPrefix;
    if (cdField && cdPrefix) {
      const form = cdPrefix === "nuevo" ? state.nuevoCicloForm : state.editCicloForm;
      if (cdField in form) (form as unknown as Record<string, string>)[cdField] = t.value;
      return;
    }

    const potencialEmpleadoId = t.dataset.potencialEmpleado;
    if (potencialEmpleadoId != null) {
      state.potencialEdits[Number(potencialEmpleadoId)] = t.value;
      return;
    }

    const motivoEmpleadoId = t.dataset.motivoEmpleado;
    if (motivoEmpleadoId != null) {
      state.motivoEdits[Number(motivoEmpleadoId)] = t.value;
      return;
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
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
