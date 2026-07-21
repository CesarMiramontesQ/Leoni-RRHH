import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  alertError,
  alertSuccess,
  BTN_GHOST,
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_DANGER,
  FIELD_FOCUS,
  FIELD_INPUT,
  FIELD_TEXTAREA,
  MODAL_OVERLAY,
  MODAL_PANEL,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SURFACE,
  RH_TABLE_HEAD,
  SELECT_CHEVRON,
  badgeApproved,
  badgeCancelled,
  badgeOpen,
} from "../ui/uiTokens.ts";
import { getAreasOptions, type AreaOption } from "../api/puestos.ts";
import {
  addPregunta,
  cerrarEncuesta,
  createEncuesta,
  crearEncuestaDesdePlantilla,
  deleteEncuesta,
  deletePregunta,
  forzarRecordatorios,
  getEncuesta,
  getResultadosGlobales,
  listEncuestas,
  listParticipantes,
  listPlantillas,
  previewAudiencia,
  publicarEncuesta,
  reordenarPreguntas,
  updateEncuesta,
  updatePregunta,
  type AudienciaFiltros,
  type AudienciaPreview,
  type EncuestaEstado,
  type EncuestaResponse,
  type EncuestaTipo,
  type ParticipanteItem,
  type PlantillaResponse,
  type PreguntaResponse,
  type PreguntaTipo,
} from "../api/encuestasRh.ts";

const TIPO_LABELS: Record<EncuestaTipo, string> = {
  clima: "Clima organizacional",
  pulso: "Pulso",
  otra: "Otra",
};

const PREGUNTA_TIPO_LABELS: Record<PreguntaTipo, string> = {
  likert: "Escala (1 a 5)",
  opcion_multiple: "Opción múltiple",
  texto: "Texto abierto",
};

const ROLES_AUDIENCIA: { value: string; label: string }[] = [
  { value: "empleado", label: "Empleado" },
  { value: "supervisor", label: "Supervisor" },
  { value: "gerente", label: "Gerente" },
  { value: "rh", label: "RH" },
  { value: "director", label: "Director" },
];

type Subview = { kind: "list" } | { kind: "nueva" } | { kind: "detalle"; id: number };

function parseSubview(hash: string): Subview {
  const h = (hash || "").trim();
  if (h.startsWith("#/talento/encuestas/nueva")) return { kind: "nueva" };
  const m = /^#\/talento\/encuestas\/(\d+)/.exec(h);
  if (m && m[1]) return { kind: "detalle", id: Number(m[1]) };
  return { kind: "list" };
}

function estadoBadge(estado: EncuestaEstado): string {
  if (estado === "borrador") return badgeCancelled("Borrador");
  if (estado === "publicada") return badgeOpen("Publicada");
  return badgeApproved("Cerrada");
}

function fmtFecha(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value.length <= 10 ? value + "T00:00:00" : value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

/** Clave estable de un set de filtros de audiencia (orden-insensible) para detectar si un preview sigue vigente. */
function filtrosKey(f: AudienciaFiltros): string {
  return JSON.stringify({
    areas: [...f.areas].sort((a, b) => a - b),
    turnos: [...f.turnos].sort(),
    roles: [...f.roles].sort(),
  });
}

interface MetaForm {
  titulo: string;
  descripcion: string;
  tipo: EncuestaTipo;
  esAnonima: boolean | null;
  umbralMinimoRespuestas: number;
  recordatorioCadaDias: number;
  fechaCierreProgramada: string;
}

function emptyMetaForm(): MetaForm {
  return {
    titulo: "",
    descripcion: "",
    tipo: "otra",
    esAnonima: null,
    umbralMinimoRespuestas: 5,
    recordatorioCadaDias: 3,
    fechaCierreProgramada: "",
  };
}

interface PreguntaForm {
  editingId: number | null;
  tipo: PreguntaTipo;
  texto: string;
  requerida: boolean;
  seleccionMultiple: boolean;
  opciones: string[];
}

function emptyPreguntaForm(): PreguntaForm {
  return { editingId: null, tipo: "likert", texto: "", requerida: true, seleccionMultiple: false, opciones: ["", ""] };
}

interface State {
  subview: Subview;

  // Lista
  encuestas: EncuestaResponse[] | null;
  listLoading: boolean;
  listError: string | null;
  filtroEstado: EncuestaEstado | "todas";
  tasaPorId: Record<number, number | null>;

  // Nueva
  nuevaModo: "cero" | "plantilla";
  nuevaMetaForm: MetaForm;
  nuevaSaving: boolean;
  nuevaError: string | null;
  plantillas: PlantillaResponse[] | null;
  plantillasLoading: boolean;
  plantillaSeleccionadaId: number | null;
  plantillaEsAnonima: boolean | null;

  // Detalle
  detalle: EncuestaResponse | null;
  detalleLoading: boolean;
  detalleError: string | null;
  detalleTab: "preguntas" | "participantes";
  actionError: string | null;
  actionMessage: string | null;

  // Edición de metadatos (modal)
  metaEditOpen: boolean;
  metaEditForm: MetaForm;
  metaEditSaving: boolean;
  metaEditError: string | null;

  // Preguntas builder
  preguntaForm: PreguntaForm | null;
  preguntaSaving: boolean;
  preguntaError: string | null;
  reorderSaving: boolean;

  // Participantes
  participantes: ParticipanteItem[] | null;
  participantesLoading: boolean;
  participantesError: string | null;

  // Publicar modal
  publicarOpen: boolean;
  publicarEncuestaId: number | null;
  publicarAreas: number[];
  publicarTurnos: string;
  publicarRoles: string[];
  publicarFechaCierre: string;
  areasOptions: AreaOption[] | null;
  previewLoading: boolean;
  previewResult: AudienciaPreview | null;
  previewFiltrosKey: string | null;
  previewError: string | null;
  publicarSaving: boolean;
  publicarError: string | null;
}

export function mountEncuestasRh(container: HTMLElement, signal?: AbortSignal): void {
  const state: State = {
    subview: parseSubview(window.location.hash),
    encuestas: null,
    listLoading: true,
    listError: null,
    filtroEstado: "todas",
    tasaPorId: {},

    nuevaModo: "cero",
    nuevaMetaForm: emptyMetaForm(),
    nuevaSaving: false,
    nuevaError: null,
    plantillas: null,
    plantillasLoading: false,
    plantillaSeleccionadaId: null,
    plantillaEsAnonima: null,

    detalle: null,
    detalleLoading: true,
    detalleError: null,
    detalleTab: "preguntas",
    actionError: null,
    actionMessage: null,

    metaEditOpen: false,
    metaEditForm: emptyMetaForm(),
    metaEditSaving: false,
    metaEditError: null,

    preguntaForm: null,
    preguntaSaving: false,
    preguntaError: null,
    reorderSaving: false,

    participantes: null,
    participantesLoading: false,
    participantesError: null,

    publicarOpen: false,
    publicarEncuestaId: null,
    publicarAreas: [],
    publicarTurnos: "",
    publicarRoles: [],
    publicarFechaCierre: "",
    areasOptions: null,
    previewLoading: false,
    previewResult: null,
    previewFiltrosKey: null,
    previewError: null,
    publicarSaving: false,
    publicarError: null,
  };

  // ── Carga de datos ──────────────────────────────────────────────────────────

  async function loadList(): Promise<void> {
    state.listLoading = true;
    render();
    try {
      const estado = state.filtroEstado === "todas" ? null : state.filtroEstado;
      state.encuestas = await listEncuestas(estado);
      state.listError = null;
      const publicadas = state.encuestas.filter((e) => e.estado !== "borrador");
      render();
      const resultados = await Promise.allSettled(publicadas.map((e) => getResultadosGlobales(e.id)));
      resultados.forEach((r, idx) => {
        const enc = publicadas[idx];
        if (!enc) return;
        state.tasaPorId[enc.id] = r.status === "fulfilled" ? r.value.tasa_respuesta : null;
      });
    } catch (err: unknown) {
      state.listError = (err as Error)?.message ?? "No se pudieron cargar las encuestas";
    }
    state.listLoading = false;
    render();
  }

  async function loadDetalle(id: number): Promise<void> {
    state.detalleLoading = true;
    state.detalle = null;
    state.actionError = null;
    render();
    try {
      state.detalle = await getEncuesta(id);
      state.detalleError = null;
    } catch (err: unknown) {
      state.detalleError = (err as Error)?.message ?? "No se pudo cargar la encuesta";
    }
    state.detalleLoading = false;
    render();
  }

  async function loadParticipantes(id: number): Promise<void> {
    state.participantesLoading = true;
    render();
    try {
      state.participantes = await listParticipantes(id);
      state.participantesError = null;
    } catch (err: unknown) {
      state.participantesError = (err as Error)?.message ?? "No se pudo cargar la lista de participantes";
    }
    state.participantesLoading = false;
    render();
  }

  async function loadPlantillas(): Promise<void> {
    state.plantillasLoading = true;
    render();
    try {
      state.plantillas = await listPlantillas();
    } catch {
      state.plantillas = [];
    }
    state.plantillasLoading = false;
    render();
  }

  async function loadAreasOptions(): Promise<void> {
    if (state.areasOptions != null) return;
    state.areasOptions = await getAreasOptions();
    render();
  }

  // ── Render: lista ────────────────────────────────────────────────────────────

  function renderListRow(e: EncuestaResponse): string {
    const tasa = state.tasaPorId[e.id];
    const tasaHtml =
      e.estado === "borrador"
        ? `<span class="text-text-muted">—</span>`
        : tasa == null
          ? `<span class="text-text-muted">Calculando…</span>`
          : `<span class="font-semibold tabular-nums">${tasa}%</span>`;
    const acciones: string[] = [];
    if (e.estado === "borrador") {
      acciones.push(`<a href="#/talento/encuestas/${e.id}" class="${BTN_GHOST}">Editar</a>`);
      acciones.push(
        `<button type="button" data-action="abrir-publicar" data-id="${e.id}" class="${BTN_SECONDARY}">Publicar</button>`,
      );
      acciones.push(
        `<button type="button" data-action="eliminar-encuesta" data-id="${e.id}" class="${BTN_DANGER}">Eliminar</button>`,
      );
    } else {
      acciones.push(`<a href="#/talento/encuestas/${e.id}" class="${BTN_GHOST}">Ver</a>`);
      acciones.push(`<a href="#/talento/encuestas/${e.id}/resultados" class="${BTN_SECONDARY}">Resultados</a>`);
      if (e.estado === "publicada") {
        acciones.push(
          `<button type="button" data-action="recordatorios" data-id="${e.id}" class="${BTN_GHOST}">Recordatorio</button>`,
        );
        acciones.push(
          `<button type="button" data-action="cerrar-encuesta" data-id="${e.id}" class="${BTN_DANGER}">Cerrar</button>`,
        );
      }
    }
    return `
    <tr class="border-b border-slate-100 last:border-b-0">
      <td class="px-3 py-3 align-middle">
        <p class="font-semibold text-text-primary">${escapeHtml(e.titulo)}</p>
        <p class="text-xs text-text-muted">${escapeHtml(TIPO_LABELS[e.tipo])}</p>
      </td>
      <td class="px-3 py-3 align-middle">${estadoBadge(e.estado)}</td>
      <td class="px-3 py-3 align-middle text-sm">${e.es_anonima ? "Sí" : "No"}</td>
      <td class="px-3 py-3 align-middle text-sm">${tasaHtml}</td>
      <td class="px-3 py-3 align-middle text-sm text-text-muted">${escapeHtml(fmtFecha(e.fecha_cierre_programada))}</td>
      <td class="px-3 py-3 align-middle">
        <div class="flex flex-wrap items-center gap-2">${acciones.join("")}</div>
      </td>
    </tr>`;
  }

  function renderListFilterBar(): string {
    const opciones: { value: EncuestaEstado | "todas"; label: string }[] = [
      { value: "todas", label: "Todas" },
      { value: "borrador", label: "Borrador" },
      { value: "publicada", label: "Publicada" },
      { value: "cerrada", label: "Cerrada" },
    ];
    return `
    <section class="${RH_LISTADO_SURFACE} p-3 sm:p-4">
      <div class="flex flex-wrap items-end gap-3">
        <div class="min-w-[10rem]">
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted" for="encuestas-rh-filtro-estado">Estado</label>
          <div class="relative">
            <select id="encuestas-rh-filtro-estado" data-action="filtro-estado" class="col-start-1 row-start-1 w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pr-8 pl-3 text-sm text-slate-900 shadow-sm ${FIELD_FOCUS}">
              ${opciones.map((o) => `<option value="${o.value}"${state.filtroEstado === o.value ? " selected" : ""}>${o.label}</option>`).join("")}
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
      </div>
    </section>`;
  }

  function renderList(): string {
    if (state.listLoading) {
      return `<div class="${RH_LISTADO_SURFACE} animate-pulse px-6 py-16" aria-busy="true"><p class="sr-only">Cargando…</p></div>`;
    }
    if (state.listError) {
      return `<div class="${RH_LISTADO_SURFACE} px-6 py-10 text-center" role="alert">
        <p class="text-sm font-semibold text-red-700">${escapeHtml(state.listError)}</p>
        <button type="button" data-action="reload-list" class="${BTN_GHOST} mx-auto mt-4">Reintentar</button>
      </div>`;
    }
    const items = state.encuestas ?? [];
    return `
    <div class="flex flex-col gap-4">
      ${renderListFilterBar()}
      ${
        items.length === 0
          ? `<div class="${RH_LISTADO_SURFACE} flex flex-col items-center justify-center px-6 py-16 text-center">
              <p class="text-sm font-semibold text-text-primary">No hay encuestas con este filtro</p>
              <p class="mt-1 text-sm text-text-muted">Crea una encuesta nueva o cambia el filtro de estado.</p>
            </div>`
          : `<section class="${RH_LISTADO_SURFACE} overflow-x-auto">
              <table class="min-w-[860px] w-full text-left">
                <thead class="${RH_TABLE_HEAD}">
                  <tr>
                    <th class="px-3 py-2.5">Encuesta</th>
                    <th class="px-3 py-2.5">Estado</th>
                    <th class="px-3 py-2.5">Anónima</th>
                    <th class="px-3 py-2.5">Tasa de respuesta</th>
                    <th class="px-3 py-2.5">Cierre programado</th>
                    <th class="px-3 py-2.5">Acciones</th>
                  </tr>
                </thead>
                <tbody>${items.map(renderListRow).join("")}</tbody>
              </table>
            </section>`
      }
    </div>`;
  }

  // ── Render: nueva ─────────────────────────────────────────────────────────────

  function renderNuevaMetaForm(): string {
    const f = state.nuevaMetaForm;
    return `
    <div class="${RH_LISTADO_SURFACE} p-5 sm:p-6">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted" for="nueva-titulo">Título</label>
          <input id="nueva-titulo" data-field="titulo" type="text" value="${escapeHtml(f.titulo)}" class="${FIELD_INPUT}" placeholder="Ej. Encuesta de clima Q3" />
        </div>
        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted" for="nueva-descripcion">Descripción (opcional)</label>
          <textarea id="nueva-descripcion" data-field="descripcion" rows="2" class="${FIELD_TEXTAREA}">${escapeHtml(f.descripcion)}</textarea>
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted" for="nueva-tipo">Tipo</label>
          <div class="relative">
            <select id="nueva-tipo" data-field="tipo" class="col-start-1 row-start-1 w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pr-8 pl-3 text-sm text-slate-900 shadow-sm ${FIELD_FOCUS}">
              ${Object.entries(TIPO_LABELS).map(([v, l]) => `<option value="${v}"${f.tipo === v ? " selected" : ""}>${l}</option>`).join("")}
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">¿Es anónima?</label>
          <div class="flex gap-2">
            <button type="button" data-action="nueva-anonima" data-value="true" class="${f.esAnonima === true ? BTN_PRIMARY : BTN_SECONDARY}">Sí</button>
            <button type="button" data-action="nueva-anonima" data-value="false" class="${f.esAnonima === false ? BTN_PRIMARY : BTN_SECONDARY}">No</button>
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted" for="nueva-umbral">Umbral mínimo de respuestas</label>
          <input id="nueva-umbral" data-field="umbral" type="number" min="1" value="${f.umbralMinimoRespuestas}" class="${FIELD_INPUT}" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted" for="nueva-recordatorio">Recordatorio cada (días)</label>
          <input id="nueva-recordatorio" data-field="recordatorio" type="number" min="1" value="${f.recordatorioCadaDias}" class="${FIELD_INPUT}" />
        </div>
      </div>
    </div>`;
  }

  function renderNuevaPlantillas(): string {
    if (state.plantillasLoading || state.plantillas == null) {
      return `<div class="${RH_LISTADO_SURFACE} animate-pulse px-6 py-10" aria-busy="true"></div>`;
    }
    if (state.plantillas.length === 0) {
      return `<div class="${RH_LISTADO_SURFACE} px-6 py-10 text-center text-sm text-text-muted">No hay plantillas disponibles.</div>`;
    }
    return `
    <div class="${RH_LISTADO_SURFACE} flex flex-col divide-y divide-slate-100 p-2">
      ${state.plantillas
        .map((p) => {
          const selected = state.plantillaSeleccionadaId === p.id;
          return `
        <label class="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-3 transition ${selected ? "bg-blue-50" : "hover:bg-slate-50"}">
          <input type="radio" name="plantilla" data-action="plantilla-select" data-id="${p.id}" class="mt-1 size-4 border-slate-300 text-accent focus:ring-accent" ${selected ? "checked" : ""} />
          <span class="min-w-0">
            <span class="block text-sm font-semibold text-text-primary">${escapeHtml(p.nombre)}</span>
            ${p.descripcion ? `<span class="block text-xs text-text-muted">${escapeHtml(p.descripcion)}</span>` : ""}
            <span class="mt-0.5 block text-xs text-text-muted">${p.definicion.length} pregunta(s)${p.tipo ? ` · ${escapeHtml(TIPO_LABELS[p.tipo])}` : ""}</span>
          </span>
        </label>`;
        })
        .join("")}
    </div>
    ${
      state.plantillaSeleccionadaId != null
        ? `<div class="${RH_LISTADO_SURFACE} mt-3 p-4">
            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">¿Es anónima?</label>
            <div class="flex gap-2">
              <button type="button" data-action="plantilla-anonima" data-value="true" class="${state.plantillaEsAnonima === true ? BTN_PRIMARY : BTN_SECONDARY}">Sí</button>
              <button type="button" data-action="plantilla-anonima" data-value="false" class="${state.plantillaEsAnonima === false ? BTN_PRIMARY : BTN_SECONDARY}">No</button>
            </div>
          </div>`
        : ""
    }`;
  }

  function renderNueva(): string {
    const modoTab = (id: "cero" | "plantilla", label: string): string => {
      const active = state.nuevaModo === id;
      const cls = active
        ? "-mb-px border-b-2 border-accent px-1 py-3 text-sm font-semibold text-accent"
        : "-mb-px border-b-2 border-transparent px-1 py-3 text-sm font-semibold text-slate-500 hover:text-text-primary";
      return `<button type="button" role="tab" aria-selected="${active}" data-action="nueva-modo" data-modo="${id}" class="${cls}">${label}</button>`;
    };
    // No se valida el título aquí (input de texto: no se re-renderiza en cada
    // tecleo para no perder el foco/cursor); se valida al enviar.
    const puedeGuardar =
      state.nuevaModo === "cero"
        ? state.nuevaMetaForm.esAnonima != null
        : state.plantillaSeleccionadaId != null && state.plantillaEsAnonima != null;
    return `
    <div class="${RH_LISTADO_PAGE_OUTER}">
      <header class="flex flex-col gap-1">
        <a href="#/talento/encuestas" class="w-fit text-xs font-semibold text-accent hover:underline">← Volver a encuestas</a>
        <h1 class="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">Nueva encuesta</h1>
        <p class="text-sm text-text-muted">Define los metadatos; agregarás las preguntas en el siguiente paso.</p>
      </header>
      ${state.nuevaError ? alertError(state.nuevaError) : ""}
      <div role="tablist" class="flex gap-x-6 border-b border-slate-200/70">
        ${modoTab("cero", "Desde cero")}
        ${modoTab("plantilla", "Desde plantilla")}
      </div>
      ${state.nuevaModo === "cero" ? renderNuevaMetaForm() : renderNuevaPlantillas()}
      <div class="flex justify-end gap-2">
        <a href="#/talento/encuestas" class="${BTN_SECONDARY}">Cancelar</a>
        <button type="button" data-action="nueva-guardar" class="${BTN_PRIMARY}" ${!puedeGuardar || state.nuevaSaving ? "disabled" : ""}>
          ${state.nuevaSaving ? "Creando…" : "Crear encuesta"}
        </button>
      </div>
    </div>`;
  }

  // ── Render: detalle / builder ────────────────────────────────────────────────

  function renderPreguntaFormPanel(): string {
    const f = state.preguntaForm;
    if (!f) return "";
    const isOpcionMultiple = f.tipo === "opcion_multiple";
    return `
    <div class="${RH_LISTADO_SURFACE} mt-3 p-4">
      <p class="mb-3 text-sm font-semibold text-text-primary">${f.editingId != null ? "Editar pregunta" : "Nueva pregunta"}</p>
      ${state.preguntaError ? `<div class="mb-3">${alertError(state.preguntaError)}</div>` : ""}
      <div class="flex flex-col gap-3">
        <div>
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted" for="pregunta-texto">Texto de la pregunta</label>
          <input id="pregunta-texto" data-pregunta-field="texto" type="text" value="${escapeHtml(f.texto)}" class="${FIELD_INPUT}" />
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted" for="pregunta-tipo">Tipo de pregunta</label>
            <div class="relative">
              <select id="pregunta-tipo" data-pregunta-field="tipo" class="col-start-1 row-start-1 w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pr-8 pl-3 text-sm text-slate-900 shadow-sm ${FIELD_FOCUS}">
                ${Object.entries(PREGUNTA_TIPO_LABELS).map(([v, l]) => `<option value="${v}"${f.tipo === v ? " selected" : ""}>${l}</option>`).join("")}
              </select>
              ${SELECT_CHEVRON}
            </div>
          </div>
          <div class="flex items-end gap-4 pb-2">
            <label class="flex items-center gap-2 text-sm text-text-primary">
              <input type="checkbox" data-pregunta-field="requerida" class="size-4 rounded-sm border-slate-300 text-accent focus:ring-accent" ${f.requerida ? "checked" : ""} />
              Obligatoria
            </label>
            ${
              isOpcionMultiple
                ? `<label class="flex items-center gap-2 text-sm text-text-primary">
                    <input type="checkbox" data-pregunta-field="seleccion_multiple" class="size-4 rounded-sm border-slate-300 text-accent focus:ring-accent" ${f.seleccionMultiple ? "checked" : ""} />
                    Selección múltiple
                  </label>`
                : ""
            }
          </div>
        </div>
        ${
          isOpcionMultiple
            ? `<div>
                <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Opciones</p>
                <div class="flex flex-col gap-2">
                  ${f.opciones
                    .map(
                      (o, i) => `
                    <div class="flex items-center gap-2">
                      <input type="text" data-opcion-index="${i}" value="${escapeHtml(o)}" class="${FIELD_INPUT}" placeholder="Opción ${i + 1}" />
                      <button type="button" data-action="pregunta-quitar-opcion" data-index="${i}" class="${BTN_GHOST}" ${f.opciones.length <= 2 ? "disabled" : ""}>Quitar</button>
                    </div>`,
                    )
                    .join("")}
                </div>
                <button type="button" data-action="pregunta-agregar-opcion" class="${BTN_GHOST} mt-2">+ Agregar opción</button>
              </div>`
            : ""
        }
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <button type="button" data-action="pregunta-cancelar" class="${BTN_SECONDARY}">Cancelar</button>
        <button type="button" data-action="pregunta-guardar" class="${BTN_PRIMARY}" ${state.preguntaSaving ? "disabled" : ""}>
          ${state.preguntaSaving ? "Guardando…" : "Guardar pregunta"}
        </button>
      </div>
    </div>`;
  }

  function renderPreguntaRow(p: PreguntaResponse, index: number, total: number, editable: boolean): string {
    const detalleTexto =
      p.tipo === "opcion_multiple"
        ? `${p.opciones.length} opción(es)${p.seleccion_multiple ? " · selección múltiple" : ""}`
        : PREGUNTA_TIPO_LABELS[p.tipo];
    const acciones = editable
      ? `<div class="flex shrink-0 items-center gap-1.5">
          <button type="button" data-action="pregunta-mover" data-id="${p.id}" data-dir="up" class="${BTN_GHOST}" ${index === 0 ? "disabled" : ""} aria-label="Mover arriba">↑</button>
          <button type="button" data-action="pregunta-mover" data-id="${p.id}" data-dir="down" class="${BTN_GHOST}" ${index === total - 1 ? "disabled" : ""} aria-label="Mover abajo">↓</button>
          <button type="button" data-action="pregunta-editar" data-id="${p.id}" class="${BTN_GHOST}">Editar</button>
          <button type="button" data-action="pregunta-eliminar" data-id="${p.id}" class="${BTN_DANGER}">Eliminar</button>
        </div>`
      : "";
    return `
    <div class="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
      <div class="min-w-0">
        <p class="text-sm font-semibold text-text-primary">${index + 1}. ${escapeHtml(p.texto)}${p.requerida ? ` <span class="text-red-500">*</span>` : ""}</p>
        <p class="text-xs text-text-muted">${escapeHtml(detalleTexto)}</p>
      </div>
      ${acciones}
    </div>`;
  }

  function renderPreguntasTab(detalle: EncuestaResponse): string {
    const editable = detalle.estado === "borrador";
    const preguntas = [...detalle.preguntas].sort((a, b) => a.orden - b.orden);
    return `
    <div class="flex flex-col gap-3">
      ${
        !editable
          ? `<div class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">Las preguntas ya no se pueden modificar porque la encuesta está ${detalle.estado === "publicada" ? "publicada" : "cerrada"}.</div>`
          : ""
      }
      <section class="${RH_LISTADO_SURFACE}">
        ${
          preguntas.length === 0
            ? `<div class="px-4 py-8 text-center text-sm text-text-muted">Aún no hay preguntas.</div>`
            : preguntas.map((p, i) => renderPreguntaRow(p, i, preguntas.length, editable)).join("")
        }
      </section>
      ${editable && !state.preguntaForm ? `<button type="button" data-action="pregunta-nueva" class="${BTN_SECONDARY} w-fit">+ Agregar pregunta</button>` : ""}
      ${editable ? renderPreguntaFormPanel() : ""}
    </div>`;
  }

  function renderParticipantesTab(detalle: EncuestaResponse): string {
    if (detalle.estado === "borrador") {
      return `<div class="${RH_LISTADO_SURFACE} px-6 py-10 text-center text-sm text-text-muted">Publica la encuesta para ver la lista de participantes.</div>`;
    }
    if (state.participantesLoading || state.participantes == null) {
      return `<div class="${RH_LISTADO_SURFACE} animate-pulse px-6 py-16" aria-busy="true"></div>`;
    }
    if (state.participantesError) {
      return `<div class="${RH_LISTADO_SURFACE} px-6 py-10 text-center" role="alert"><p class="text-sm font-semibold text-red-700">${escapeHtml(state.participantesError)}</p></div>`;
    }
    const total = state.participantes.length;
    const respondidas = state.participantes.filter((p) => p.estado === "respondida").length;
    const tasa = total > 0 ? Math.round((respondidas / total) * 1000) / 10 : 0;
    return `
    <div class="flex flex-col gap-3">
      <div class="${RH_LISTADO_SURFACE} flex flex-wrap items-center gap-6 p-4">
        <div><p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Participantes</p><p class="text-xl font-bold text-text-primary">${total}</p></div>
        <div><p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Respondieron</p><p class="text-xl font-bold text-text-primary">${respondidas}</p></div>
        <div><p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Tasa de respuesta</p><p class="text-xl font-bold text-text-primary">${tasa}%</p></div>
      </div>
      <section class="${RH_LISTADO_SURFACE} overflow-x-auto">
        <table class="min-w-[520px] w-full text-left">
          <thead class="${RH_TABLE_HEAD}">
            <tr><th class="px-3 py-2.5">Empleado</th><th class="px-3 py-2.5">Estado</th><th class="px-3 py-2.5">Fecha de respuesta</th></tr>
          </thead>
          <tbody>
            ${
              total === 0
                ? `<tr><td colspan="3" class="px-3 py-10 text-center text-sm text-slate-500">Sin participantes.</td></tr>`
                : state.participantes
                    .map(
                      (p) => `
              <tr class="border-b border-slate-100 last:border-b-0">
                <td class="px-3 py-2.5 text-sm text-text-primary">${escapeHtml(p.empleado_nombre ?? `Empleado #${p.empleado_id}`)}</td>
                <td class="px-3 py-2.5">${p.estado === "respondida" ? badgeApproved("Respondida") : badgeCancelled("Pendiente")}</td>
                <td class="px-3 py-2.5 text-sm text-text-muted">${escapeHtml(fmtFecha(p.fecha_respuesta))}</td>
              </tr>`,
                    )
                    .join("")
            }
          </tbody>
        </table>
      </section>
    </div>`;
  }

  function renderDetalleAcciones(detalle: EncuestaResponse): string {
    const acciones: string[] = [
      `<button type="button" data-action="metaeditar-abrir" class="${BTN_SECONDARY}">Editar datos</button>`,
    ];
    if (detalle.estado === "borrador") {
      acciones.push(`<button type="button" data-action="abrir-publicar" data-id="${detalle.id}" class="${BTN_PRIMARY}">Publicar</button>`);
      acciones.push(`<button type="button" data-action="eliminar-encuesta" data-id="${detalle.id}" class="${BTN_DANGER}">Eliminar</button>`);
    } else {
      acciones.push(`<a href="#/talento/encuestas/${detalle.id}/resultados" class="${BTN_PRIMARY}">Ver resultados</a>`);
      if (detalle.estado === "publicada") {
        acciones.push(`<button type="button" data-action="recordatorios" data-id="${detalle.id}" class="${BTN_SECONDARY}">Enviar recordatorio</button>`);
        acciones.push(`<button type="button" data-action="cerrar-encuesta" data-id="${detalle.id}" class="${BTN_DANGER}">Cerrar encuesta</button>`);
      }
    }
    return `<div class="flex flex-wrap items-center gap-2">${acciones.join("")}</div>`;
  }

  function renderMetaEditModal(): string {
    if (!state.metaEditOpen || !state.detalle) return "";
    const editable = state.detalle.estado === "borrador";
    const f = state.metaEditForm;
    return `
    <div class="${MODAL_OVERLAY}" data-modal="meta-edit">
      <div class="${MODAL_PANEL} max-w-lg" role="dialog" aria-modal="true">
        <header class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 class="text-base font-bold text-text-primary">Editar datos de la encuesta</h2>
          <button type="button" data-action="metaeditar-cerrar" class="text-text-muted hover:text-text-primary" aria-label="Cerrar">✕</button>
        </header>
        <div class="max-h-[70vh] overflow-y-auto px-5 py-4">
          ${state.metaEditError ? `<div class="mb-3">${alertError(state.metaEditError)}</div>` : ""}
          <div class="flex flex-col gap-3">
            <div>
              <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted" for="metaedit-titulo">Título</label>
              <input id="metaedit-titulo" data-metaedit-field="titulo" type="text" value="${escapeHtml(f.titulo)}" class="${FIELD_INPUT}" />
            </div>
            <div>
              <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted" for="metaedit-descripcion">Descripción</label>
              <textarea id="metaedit-descripcion" data-metaedit-field="descripcion" rows="2" class="${FIELD_TEXTAREA}">${escapeHtml(f.descripcion)}</textarea>
            </div>
            ${
              editable
                ? `
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted" for="metaedit-umbral">Umbral mínimo</label>
                <input id="metaedit-umbral" data-metaedit-field="umbral" type="number" min="1" value="${f.umbralMinimoRespuestas}" class="${FIELD_INPUT}" />
              </div>
              <div>
                <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted" for="metaedit-recordatorio">Recordatorio (días)</label>
                <input id="metaedit-recordatorio" data-metaedit-field="recordatorio" type="number" min="1" value="${f.recordatorioCadaDias}" class="${FIELD_INPUT}" />
              </div>
            </div>`
                : ""
            }
            <div>
              <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted" for="metaedit-cierre">Fecha de cierre programada</label>
              <input id="metaedit-cierre" data-metaedit-field="cierre" type="date" value="${escapeHtml(f.fechaCierreProgramada)}" class="${FIELD_INPUT}" />
            </div>
          </div>
        </div>
        <footer class="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button type="button" data-action="metaeditar-cerrar" class="${BTN_SECONDARY}">Cancelar</button>
          <button type="button" data-action="metaeditar-guardar" class="${BTN_PRIMARY}" ${state.metaEditSaving ? "disabled" : ""}>
            ${state.metaEditSaving ? "Guardando…" : "Guardar cambios"}
          </button>
        </footer>
      </div>
    </div>`;
  }

  function renderDetalle(): string {
    if (state.detalleLoading) {
      return `<div class="${RH_LISTADO_SURFACE} animate-pulse px-6 py-16" aria-busy="true"><p class="sr-only">Cargando…</p></div>`;
    }
    if (state.detalleError || !state.detalle) {
      return `<div class="${RH_LISTADO_SURFACE} px-6 py-10 text-center" role="alert">
        <p class="text-sm font-semibold text-red-700">${escapeHtml(state.detalleError ?? "No se pudo cargar la encuesta")}</p>
        <a href="#/talento/encuestas" class="${BTN_GHOST} mx-auto mt-4 w-fit">Volver a encuestas</a>
      </div>`;
    }
    const detalle = state.detalle;
    const tab = (id: "preguntas" | "participantes", label: string): string => {
      const active = state.detalleTab === id;
      const cls = active
        ? "-mb-px border-b-2 border-accent px-1 py-3 text-sm font-semibold text-accent"
        : "-mb-px border-b-2 border-transparent px-1 py-3 text-sm font-semibold text-slate-500 hover:text-text-primary";
      return `<button type="button" role="tab" aria-selected="${active}" data-action="detalle-tab" data-tab="${id}" class="${cls}">${label}</button>`;
    };
    return `
    <div class="${RH_LISTADO_PAGE_OUTER}">
      <header class="flex flex-col gap-3">
        <a href="#/talento/encuestas" class="w-fit text-xs font-semibold text-accent hover:underline">← Volver a encuestas</a>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">${escapeHtml(detalle.titulo)}</h1>
              ${estadoBadge(detalle.estado)}
            </div>
            ${detalle.descripcion ? `<p class="mt-1 text-sm text-text-muted">${escapeHtml(detalle.descripcion)}</p>` : ""}
            <p class="mt-1 text-xs text-text-muted">${escapeHtml(TIPO_LABELS[detalle.tipo])} · ${detalle.es_anonima ? "Anónima" : "No anónima"} · Umbral mínimo ${detalle.umbral_minimo_respuestas} · Recordatorio cada ${detalle.recordatorio_cada_dias} día(s)</p>
            ${
              detalle.estado !== "borrador"
                ? `<p class="mt-1 text-xs text-text-muted">Publicada: ${escapeHtml(fmtFecha(detalle.fecha_publicacion))} · Cierre programado: ${escapeHtml(fmtFecha(detalle.fecha_cierre_programada))}${detalle.fecha_cierre_real ? ` · Cierre real: ${escapeHtml(fmtFecha(detalle.fecha_cierre_real))}` : ""}</p>`
                : ""
            }
          </div>
          ${renderDetalleAcciones(detalle)}
        </div>
      </header>
      ${state.actionError ? alertError(state.actionError) : ""}
      ${state.actionMessage ? alertSuccess(state.actionMessage) : ""}
      <div role="tablist" class="flex gap-x-6 border-b border-slate-200/70">
        ${tab("preguntas", "Preguntas")}
        ${tab("participantes", "Participantes")}
      </div>
      ${state.detalleTab === "preguntas" ? renderPreguntasTab(detalle) : renderParticipantesTab(detalle)}
    </div>
    ${renderMetaEditModal()}`;
  }

  // ── Render: modal publicar ────────────────────────────────────────────────────

  function renderPublicarModal(): string {
    if (!state.publicarOpen) return "";
    const areas = state.areasOptions ?? [];
    const vigente = previewVigente();
    const totalVigente = vigente ? (state.previewResult?.total ?? 0) : null;
    const audienciaVacia = vigente && totalVigente === 0;
    const puedePublicar = !state.publicarSaving && !!state.publicarFechaCierre && vigente && (totalVigente ?? 0) > 0;
    return `
    <div class="${MODAL_OVERLAY}" data-modal="publicar">
      <div class="${MODAL_PANEL} max-w-xl" role="dialog" aria-modal="true">
        <header class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 class="text-base font-bold text-text-primary">Publicar encuesta</h2>
          <button type="button" data-action="publicar-cerrar" class="text-text-muted hover:text-text-primary" aria-label="Cerrar">✕</button>
        </header>
        <div class="max-h-[70vh] overflow-y-auto px-5 py-4">
          ${state.publicarError ? `<div class="mb-3">${alertError(state.publicarError)}</div>` : ""}
          <div class="flex flex-col gap-4">
            <div>
              <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted" for="publicar-cierre">Fecha de cierre programada</label>
              <input id="publicar-cierre" data-publicar-field="cierre" type="date" value="${escapeHtml(state.publicarFechaCierre)}" class="${FIELD_INPUT}" />
            </div>
            <div>
              <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Áreas (vacío = todas)</p>
              <div class="grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-3">
                ${
                  areas.length === 0
                    ? `<p class="col-span-full py-2 text-center text-xs text-text-muted">Cargando áreas…</p>`
                    : areas
                        .map(
                          (a) => `
                    <label class="flex items-center gap-1.5 text-xs text-text-primary">
                      <input type="checkbox" data-publicar-area="${a.id}" class="size-3.5 rounded-sm border-slate-300 text-accent focus:ring-accent" ${state.publicarAreas.includes(a.id) ? "checked" : ""} />
                      ${escapeHtml(a.label)}
                    </label>`,
                        )
                        .join("")
                }
              </div>
            </div>
            <div>
              <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted" for="publicar-turnos">Turnos (separados por coma, vacío = todos)</label>
              <input id="publicar-turnos" data-publicar-field="turnos" type="text" value="${escapeHtml(state.publicarTurnos)}" class="${FIELD_INPUT}" placeholder="Ej. Matutino, Vespertino" />
            </div>
            <div>
              <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Roles (vacío = todos)</p>
              <div class="flex flex-wrap gap-3">
                ${ROLES_AUDIENCIA.map(
                  (r) => `
                  <label class="flex items-center gap-1.5 text-xs text-text-primary">
                    <input type="checkbox" data-publicar-rol="${r.value}" class="size-3.5 rounded-sm border-slate-300 text-accent focus:ring-accent" ${state.publicarRoles.includes(r.value) ? "checked" : ""} />
                    ${r.label}
                  </label>`,
                ).join("")}
              </div>
            </div>
            <div>
              <button type="button" data-action="publicar-preview" class="${BTN_SECONDARY}" ${state.previewLoading ? "disabled" : ""}>
                ${state.previewLoading ? "Calculando…" : "Vista previa de audiencia"}
              </button>
              ${
                state.previewError
                  ? `<p class="mt-2 text-xs text-red-700">${escapeHtml(state.previewError)}</p>`
                  : state.previewResult
                    ? vigente
                      ? `<div class="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                          <p class="font-semibold">${state.previewResult.total} empleado(s) recibirán la encuesta.</p>
                          ${
                            state.previewResult.por_area.length > 0
                              ? `<p class="mt-1 text-xs">${state.previewResult.por_area.map((a) => `${escapeHtml(a.area_nombre ?? "Sin área")}: ${a.total}`).join(" · ")}</p>`
                              : ""
                          }
                        </div>`
                      : `<p class="mt-2 text-xs text-amber-700">Los filtros cambiaron desde la última vista previa. Vuelve a calcularla antes de publicar.</p>`
                    : ""
              }
            </div>
          </div>
        </div>
        <footer class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-4">
          <p class="text-xs ${audienciaVacia ? "text-red-700" : "text-text-muted"}">
            ${
              audienciaVacia
                ? "La audiencia está vacía. Ajusta los filtros."
                : vigente
                  ? `Se enviará a ${totalVigente} empleado(s).`
                  : "Calcula la vista previa de audiencia para habilitar la publicación."
            }
          </p>
          <div class="flex gap-2">
            <button type="button" data-action="publicar-cerrar" class="${BTN_SECONDARY}">Cancelar</button>
            <button type="button" data-action="publicar-confirmar" class="${BTN_PRIMARY}" ${!puedePublicar ? "disabled" : ""}>
              ${state.publicarSaving ? "Publicando…" : "Publicar"}
            </button>
          </div>
        </footer>
      </div>
    </div>`;
  }

  // ── Render raíz ───────────────────────────────────────────────────────────────

  function renderMain(): string {
    if (state.subview.kind === "list") return renderList();
    if (state.subview.kind === "nueva") return renderNueva();
    return renderDetalle();
  }

  function pageContent(): string {
    if (state.subview.kind === "list") {
      return `
      <div class="${RH_LISTADO_PAGE_OUTER}">
        <header class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p class="text-xs font-medium text-text-muted">Talento</p>
            <h1 class="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">Encuestas RH</h1>
            <p class="mt-1 text-sm text-text-muted">Encuestas de clima, pulso y otras mediciones organizacionales.</p>
          </div>
          <a href="#/talento/encuestas/nueva" class="${BTN_PRIMARY} w-fit shrink-0">+ Nueva encuesta</a>
        </header>
        ${renderList()}
      </div>
      ${renderPublicarModal()}`;
    }
    return `${renderMain()}${renderPublicarModal()}`;
  }

  function render(): void {
    mountAppShell(container, {
      pageTitle: "Encuestas RH",
      activeNav: "encuestas-rh",
      mainClass: "py-5 sm:py-6",
      mainHtml: pageContent(),
    });
  }

  // ── Acciones: lista ───────────────────────────────────────────────────────────

  async function onEliminarEncuesta(id: number): Promise<void> {
    if (!window.confirm("¿Eliminar esta encuesta en borrador? Esta acción no se puede deshacer.")) return;
    try {
      await deleteEncuesta(id);
      if (state.subview.kind === "detalle") {
        window.location.hash = "#/talento/encuestas";
        return;
      }
      await loadList();
    } catch (err: unknown) {
      state.actionError = (err as Error)?.message ?? "No se pudo eliminar la encuesta";
      state.listError = state.subview.kind === "list" ? state.actionError : state.listError;
      render();
    }
  }

  async function onCerrarEncuesta(id: number): Promise<void> {
    if (!window.confirm("¿Cerrar esta encuesta? Ya no se podrán registrar más respuestas.")) return;
    try {
      await cerrarEncuesta(id);
      if (state.subview.kind === "detalle") {
        state.actionMessage = "La encuesta fue cerrada.";
        await loadDetalle(id);
        return;
      }
      await loadList();
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? "No se pudo cerrar la encuesta";
      if (state.subview.kind === "detalle") state.actionError = msg;
      render();
    }
  }

  async function onForzarRecordatorios(id: number): Promise<void> {
    try {
      const res = await forzarRecordatorios(id);
      state.actionMessage = `Se enviaron ${res.recordatorios_enviados} recordatorio(s).`;
      state.actionError = null;
      render();
    } catch (err: unknown) {
      state.actionError = (err as Error)?.message ?? "No se pudieron enviar los recordatorios";
      render();
    }
  }

  // ── Acciones: nueva ───────────────────────────────────────────────────────────

  async function onGuardarNueva(): Promise<void> {
    if (state.nuevaModo === "cero" && !state.nuevaMetaForm.titulo.trim()) {
      state.nuevaError = "El título es obligatorio";
      render();
      return;
    }
    state.nuevaSaving = true;
    state.nuevaError = null;
    render();
    try {
      let creada: EncuestaResponse;
      if (state.nuevaModo === "cero") {
        const f = state.nuevaMetaForm;
        creada = await createEncuesta({
          titulo: f.titulo.trim(),
          descripcion: f.descripcion.trim() || null,
          tipo: f.tipo,
          es_anonima: f.esAnonima ?? true,
          umbral_minimo_respuestas: f.umbralMinimoRespuestas,
          recordatorio_cada_dias: f.recordatorioCadaDias,
          preguntas: [],
        });
      } else {
        if (state.plantillaSeleccionadaId == null || state.plantillaEsAnonima == null) {
          throw new Error("Selecciona una plantilla y especifica si es anónima");
        }
        creada = await crearEncuestaDesdePlantilla(state.plantillaSeleccionadaId, state.plantillaEsAnonima);
      }
      window.location.hash = `#/talento/encuestas/${creada.id}`;
    } catch (err: unknown) {
      state.nuevaSaving = false;
      state.nuevaError = (err as Error)?.message ?? "No se pudo crear la encuesta";
      render();
    }
  }

  // ── Acciones: preguntas ───────────────────────────────────────────────────────

  function openPreguntaForm(pregunta?: PreguntaResponse): void {
    if (pregunta) {
      state.preguntaForm = {
        editingId: pregunta.id,
        tipo: pregunta.tipo,
        texto: pregunta.texto,
        requerida: pregunta.requerida,
        seleccionMultiple: pregunta.seleccion_multiple,
        opciones: pregunta.opciones.length > 0 ? pregunta.opciones.map((o) => o.texto) : ["", ""],
      };
    } else {
      state.preguntaForm = emptyPreguntaForm();
    }
    state.preguntaError = null;
    render();
  }

  async function onGuardarPregunta(): Promise<void> {
    if (!state.preguntaForm || !state.detalle) return;
    const f = state.preguntaForm;
    if (!f.texto.trim()) {
      state.preguntaError = "El texto de la pregunta es obligatorio";
      render();
      return;
    }
    const opciones =
      f.tipo === "opcion_multiple"
        ? f.opciones.map((t) => t.trim()).filter((t) => t.length > 0).map((texto, i) => ({ texto, orden: i }))
        : [];
    if (f.tipo === "opcion_multiple" && opciones.length < 2) {
      state.preguntaError = "Agrega al menos 2 opciones";
      render();
      return;
    }
    state.preguntaSaving = true;
    state.preguntaError = null;
    render();
    try {
      if (f.editingId != null) {
        await updatePregunta(state.detalle.id, f.editingId, {
          tipo: f.tipo,
          texto: f.texto.trim(),
          requerida: f.requerida,
          seleccion_multiple: f.tipo === "opcion_multiple" ? f.seleccionMultiple : false,
          opciones: f.tipo === "opcion_multiple" ? opciones : [],
        });
      } else {
        const orden = state.detalle.preguntas.length;
        await addPregunta(state.detalle.id, {
          orden,
          tipo: f.tipo,
          texto: f.texto.trim(),
          requerida: f.requerida,
          seleccion_multiple: f.tipo === "opcion_multiple" ? f.seleccionMultiple : false,
          opciones: f.tipo === "opcion_multiple" ? opciones : [],
        });
      }
      state.preguntaForm = null;
      state.preguntaSaving = false;
      await loadDetalle(state.detalle.id);
    } catch (err: unknown) {
      state.preguntaSaving = false;
      state.preguntaError = (err as Error)?.message ?? "No se pudo guardar la pregunta";
      render();
    }
  }

  async function onEliminarPregunta(preguntaId: number): Promise<void> {
    if (!state.detalle) return;
    if (!window.confirm("¿Eliminar esta pregunta?")) return;
    try {
      await deletePregunta(state.detalle.id, preguntaId);
      await loadDetalle(state.detalle.id);
    } catch (err: unknown) {
      state.actionError = (err as Error)?.message ?? "No se pudo eliminar la pregunta";
      render();
    }
  }

  async function onMoverPregunta(preguntaId: number, dir: "up" | "down"): Promise<void> {
    if (!state.detalle || state.reorderSaving) return;
    const ordenadas = [...state.detalle.preguntas].sort((a, b) => a.orden - b.orden);
    const idx = ordenadas.findIndex((p) => p.id === preguntaId);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= ordenadas.length) return;
    const ids = ordenadas.map((p) => p.id);
    [ids[idx], ids[swapIdx]] = [ids[swapIdx]!, ids[idx]!];
    state.reorderSaving = true;
    render();
    try {
      await reordenarPreguntas(state.detalle.id, ids);
      await loadDetalle(state.detalle.id);
    } catch (err: unknown) {
      state.actionError = (err as Error)?.message ?? "No se pudo reordenar las preguntas";
      render();
    }
    state.reorderSaving = false;
  }

  // ── Acciones: editar metadatos ────────────────────────────────────────────────

  function openMetaEdit(): void {
    if (!state.detalle) return;
    const d = state.detalle;
    state.metaEditForm = {
      titulo: d.titulo,
      descripcion: d.descripcion ?? "",
      tipo: d.tipo,
      esAnonima: d.es_anonima,
      umbralMinimoRespuestas: d.umbral_minimo_respuestas,
      recordatorioCadaDias: d.recordatorio_cada_dias,
      fechaCierreProgramada: d.fecha_cierre_programada ?? "",
    };
    state.metaEditOpen = true;
    state.metaEditError = null;
    render();
  }

  async function onGuardarMetaEdit(): Promise<void> {
    if (!state.detalle) return;
    const f = state.metaEditForm;
    if (!f.titulo.trim()) {
      state.metaEditError = "El título es obligatorio";
      render();
      return;
    }
    state.metaEditSaving = true;
    state.metaEditError = null;
    render();
    try {
      // Solo se envia fecha_cierre_programada si realmente cambio: el form
      // la prellena siempre (openMetaEdit) y en publicadas el service exige
      // nueva > actual, asi que reenviar el mismo valor (p. ej. al editar
      // solo el titulo) rompia el guardado sin este chequeo.
      const nuevaFechaCierre = f.fechaCierreProgramada || null;
      const fechaCierreCambio = nuevaFechaCierre !== (state.detalle.fecha_cierre_programada ?? null);

      const payload =
        state.detalle.estado === "borrador"
          ? {
              titulo: f.titulo.trim(),
              descripcion: f.descripcion.trim() || null,
              tipo: f.tipo,
              es_anonima: f.esAnonima ?? undefined,
              umbral_minimo_respuestas: f.umbralMinimoRespuestas,
              recordatorio_cada_dias: f.recordatorioCadaDias,
              ...(fechaCierreCambio ? { fecha_cierre_programada: nuevaFechaCierre } : {}),
            }
          : {
              titulo: f.titulo.trim(),
              descripcion: f.descripcion.trim() || null,
              ...(fechaCierreCambio ? { fecha_cierre_programada: nuevaFechaCierre } : {}),
            };
      await updateEncuesta(state.detalle.id, payload);
      state.metaEditOpen = false;
      state.metaEditSaving = false;
      await loadDetalle(state.detalle.id);
    } catch (err: unknown) {
      state.metaEditSaving = false;
      state.metaEditError = (err as Error)?.message ?? "No se pudo actualizar la encuesta";
      render();
    }
  }

  // ── Acciones: publicar ───────────────────────────────────────────────────────

  function openPublicarModal(id: number): void {
    state.publicarOpen = true;
    state.publicarEncuestaId = id;
    state.publicarAreas = [];
    state.publicarTurnos = "";
    state.publicarRoles = [];
    state.publicarFechaCierre = "";
    state.previewResult = null;
    state.previewFiltrosKey = null;
    state.previewError = null;
    state.publicarError = null;
    render();
    void loadAreasOptions();
  }

  function closePublicarModal(): void {
    state.publicarOpen = false;
    state.publicarEncuestaId = null;
    render();
  }

  function currentFiltros(): { areas: number[]; turnos: string[]; roles: string[] } {
    return {
      areas: state.publicarAreas,
      turnos: state.publicarTurnos
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
      roles: state.publicarRoles,
    };
  }

  /** true si hay un preview exitoso calculado con exactamente los filtros actuales del modal. */
  function previewVigente(): boolean {
    return state.previewResult != null && state.previewFiltrosKey === filtrosKey(currentFiltros());
  }

  async function onPreviewAudiencia(): Promise<void> {
    const filtros = currentFiltros();
    state.previewLoading = true;
    state.previewError = null;
    render();
    try {
      state.previewResult = await previewAudiencia(filtros);
      state.previewFiltrosKey = filtrosKey(filtros);
    } catch (err: unknown) {
      state.previewError = (err as Error)?.message ?? "No se pudo calcular la audiencia";
    }
    state.previewLoading = false;
    render();
  }

  async function onConfirmarPublicar(): Promise<void> {
    if (state.publicarEncuestaId == null) return;
    if (!state.publicarFechaCierre) {
      state.publicarError = "Define la fecha de cierre programada";
      render();
      return;
    }
    if (!previewVigente()) {
      state.publicarError = "Calcula la vista previa de audiencia con los filtros actuales antes de publicar";
      render();
      return;
    }
    if ((state.previewResult?.total ?? 0) === 0) {
      state.publicarError = "La audiencia está vacía. Ajusta los filtros antes de publicar";
      render();
      return;
    }
    state.publicarSaving = true;
    state.publicarError = null;
    render();
    try {
      await publicarEncuesta(state.publicarEncuestaId, {
        filtros: currentFiltros(),
        fecha_cierre_programada: state.publicarFechaCierre,
      });
      const id = state.publicarEncuestaId;
      closePublicarModal();
      if (state.subview.kind === "detalle") {
        state.actionMessage = "La encuesta fue publicada.";
        await loadDetalle(id);
      } else {
        await loadList();
      }
    } catch (err: unknown) {
      state.publicarSaving = false;
      state.publicarError = (err as Error)?.message ?? "No se pudo publicar la encuesta";
      render();
    }
  }

  // ── Delegación de eventos ─────────────────────────────────────────────────────

  function handleClick(e: Event): void {
    const t = e.target as HTMLElement;
    const actionEl = t.closest<HTMLElement>("[data-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action === "reload-list") {
      void loadList();
      return;
    }
    if (action === "abrir-publicar") {
      const id = Number(actionEl.dataset.id);
      if (id) openPublicarModal(id);
      return;
    }
    if (action === "publicar-cerrar") {
      closePublicarModal();
      return;
    }
    if (action === "publicar-preview") {
      void onPreviewAudiencia();
      return;
    }
    if (action === "publicar-confirmar") {
      void onConfirmarPublicar();
      return;
    }
    if (action === "eliminar-encuesta") {
      const id = Number(actionEl.dataset.id);
      if (id) void onEliminarEncuesta(id);
      return;
    }
    if (action === "cerrar-encuesta") {
      const id = Number(actionEl.dataset.id);
      if (id) void onCerrarEncuesta(id);
      return;
    }
    if (action === "recordatorios") {
      const id = Number(actionEl.dataset.id);
      if (id) void onForzarRecordatorios(id);
      return;
    }
    if (action === "nueva-modo") {
      const modo = actionEl.dataset.modo as "cero" | "plantilla" | undefined;
      if (modo) {
        state.nuevaModo = modo;
        if (modo === "plantilla" && state.plantillas == null) void loadPlantillas();
        render();
      }
      return;
    }
    if (action === "nueva-anonima") {
      state.nuevaMetaForm.esAnonima = actionEl.dataset.value === "true";
      render();
      return;
    }
    if (action === "plantilla-anonima") {
      state.plantillaEsAnonima = actionEl.dataset.value === "true";
      render();
      return;
    }
    if (action === "plantilla-select") {
      const id = Number(actionEl.dataset.id);
      if (id) {
        state.plantillaSeleccionadaId = id;
        render();
      }
      return;
    }
    if (action === "nueva-guardar") {
      void onGuardarNueva();
      return;
    }
    if (action === "detalle-tab") {
      const tabId = actionEl.dataset.tab as "preguntas" | "participantes" | undefined;
      if (tabId) {
        state.detalleTab = tabId;
        if (tabId === "participantes" && state.participantes == null && state.detalle && state.detalle.estado !== "borrador") {
          void loadParticipantes(state.detalle.id);
        }
        render();
      }
      return;
    }
    if (action === "pregunta-nueva") {
      openPreguntaForm();
      return;
    }
    if (action === "pregunta-editar") {
      const id = Number(actionEl.dataset.id);
      const pregunta = state.detalle?.preguntas.find((p) => p.id === id);
      if (pregunta) openPreguntaForm(pregunta);
      return;
    }
    if (action === "pregunta-cancelar") {
      state.preguntaForm = null;
      state.preguntaError = null;
      render();
      return;
    }
    if (action === "pregunta-guardar") {
      void onGuardarPregunta();
      return;
    }
    if (action === "pregunta-eliminar") {
      const id = Number(actionEl.dataset.id);
      if (id) void onEliminarPregunta(id);
      return;
    }
    if (action === "pregunta-mover") {
      const id = Number(actionEl.dataset.id);
      const dir = actionEl.dataset.dir as "up" | "down" | undefined;
      if (id && dir) void onMoverPregunta(id, dir);
      return;
    }
    if (action === "pregunta-agregar-opcion") {
      if (state.preguntaForm) {
        state.preguntaForm.opciones.push("");
        render();
      }
      return;
    }
    if (action === "pregunta-quitar-opcion") {
      const idx = Number(actionEl.dataset.index);
      if (state.preguntaForm && state.preguntaForm.opciones.length > 2) {
        state.preguntaForm.opciones.splice(idx, 1);
        render();
      }
      return;
    }
    if (action === "metaeditar-abrir") {
      openMetaEdit();
      return;
    }
    if (action === "metaeditar-cerrar") {
      state.metaEditOpen = false;
      render();
      return;
    }
    if (action === "metaeditar-guardar") {
      void onGuardarMetaEdit();
      return;
    }
  }

  function handleChange(e: Event): void {
    const t = e.target as HTMLElement;
    if (t instanceof HTMLSelectElement && t.dataset.action === "filtro-estado") {
      state.filtroEstado = t.value as EncuestaEstado | "todas";
      void loadList();
      return;
    }
    if (t instanceof HTMLSelectElement && t.dataset.field === "tipo") {
      state.nuevaMetaForm.tipo = t.value as EncuestaTipo;
      return;
    }
    if (t instanceof HTMLSelectElement && t.dataset.preguntaField === "tipo" && state.preguntaForm) {
      state.preguntaForm.tipo = t.value as PreguntaTipo;
      render();
      return;
    }
    if (t instanceof HTMLInputElement && t.dataset.publicarArea != null) {
      const id = Number(t.dataset.publicarArea);
      state.publicarAreas = t.checked
        ? [...state.publicarAreas.filter((a) => a !== id), id]
        : state.publicarAreas.filter((a) => a !== id);
      render(); // el preview vigente puede quedar desactualizado al cambiar filtros
      return;
    }
    if (t instanceof HTMLInputElement && t.dataset.publicarRol != null) {
      const v = t.dataset.publicarRol;
      state.publicarRoles = t.checked
        ? [...state.publicarRoles.filter((r) => r !== v), v]
        : state.publicarRoles.filter((r) => r !== v);
      render(); // el preview vigente puede quedar desactualizado al cambiar filtros
      return;
    }
    if (t instanceof HTMLInputElement && t.dataset.publicarField === "turnos") {
      // "change" (no "input"): se dispara al salir del campo, sin interrumpir la escritura.
      render(); // refresca el estado vigente/disabled del botón Publicar
      return;
    }
    if (t instanceof HTMLInputElement && t.dataset.preguntaField === "requerida" && state.preguntaForm) {
      state.preguntaForm.requerida = t.checked;
      return;
    }
    if (t instanceof HTMLInputElement && t.dataset.preguntaField === "seleccion_multiple" && state.preguntaForm) {
      state.preguntaForm.seleccionMultiple = t.checked;
      return;
    }
  }

  function handleInput(e: Event): void {
    const t = e.target as HTMLElement;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) {
      const field = t.dataset.field;
      if (field === "titulo") state.nuevaMetaForm.titulo = t.value;
      else if (field === "descripcion") state.nuevaMetaForm.descripcion = t.value;
      else if (field === "umbral") state.nuevaMetaForm.umbralMinimoRespuestas = Number(t.value) || 1;
      else if (field === "recordatorio") state.nuevaMetaForm.recordatorioCadaDias = Number(t.value) || 1;

      const metaField = t.dataset.metaeditField;
      if (metaField === "titulo") state.metaEditForm.titulo = t.value;
      else if (metaField === "descripcion") state.metaEditForm.descripcion = t.value;
      else if (metaField === "umbral") state.metaEditForm.umbralMinimoRespuestas = Number(t.value) || 1;
      else if (metaField === "recordatorio") state.metaEditForm.recordatorioCadaDias = Number(t.value) || 1;
      else if (metaField === "cierre") state.metaEditForm.fechaCierreProgramada = t.value;

      const publicarField = t.dataset.publicarField;
      if (publicarField === "cierre") {
        state.publicarFechaCierre = t.value;
        render(); // input tipo date: refresca el estado disabled del botón Publicar
        return;
      }
      if (publicarField === "turnos") {
        state.publicarTurnos = t.value;
        return;
      }

      if (t.dataset.preguntaField === "texto" && state.preguntaForm) {
        state.preguntaForm.texto = t.value;
        return;
      }
      const opcionIndex = t.dataset.opcionIndex;
      if (opcionIndex != null && state.preguntaForm) {
        state.preguntaForm.opciones[Number(opcionIndex)] = t.value;
        return;
      }
    }
  }

  render();
  container.addEventListener("click", handleClick, { signal });
  container.addEventListener("change", handleChange, { signal });
  container.addEventListener("input", handleInput, { signal });

  if (state.subview.kind === "list") {
    void loadList();
  } else if (state.subview.kind === "nueva") {
    state.listLoading = false;
  } else if (state.subview.kind === "detalle") {
    void loadDetalle(state.subview.id);
  }
}
