import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml, fmtDateTimeIso } from "../ui/uiUtils.ts";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  FIELD_INPUT,
  FIELD_TEXTAREA,
  FORM_LABEL,
  FORM_SELECT,
  MODAL_OVERLAY,
  MODAL_PANEL,
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  RH_LISTADO_FOCUS_RING,
  SELECT_CHEVRON,
  alertError,
  badgeApproved,
  badgeChangesRequested,
  badgePending,
  errorState,
  pageHeading,
  skeletonBlock,
} from "../ui/uiTokens.ts";
import { getEmpleadosPage } from "../api/empleados.ts";
import {
  actualizarOpl,
  agregarVersion,
  crearOpl,
  eliminarOpl,
  enviarARevision,
  listarOpls,
  type OPLEstado,
  type OPLResponse,
} from "../api/opls.ts";

// ── Helpers ──────────────────────────────────────────────────────────────────

const OPL_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const ESTADO_LABELS: Record<OPLEstado, string> = {
  borrador: "Borrador",
  revision: "En revisión",
  aprobada: "Aprobada",
};

/**
 * Sanea un href proveniente del servidor/usuario: solo permite URLs http(s)
 * absolutas o rutas internas (`/...`, sin `//host`). Rechaza `javascript:`,
 * `data:` y esquemas protocol-relative. Devuelve `null` si no es seguro.
 */
function safeHref(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const url = raw.trim();
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return null;
}

function estadoBadge(estado: string): string {
  if (estado === "aprobada") return badgeApproved(ESTADO_LABELS.aprobada);
  if (estado === "revision") return badgeChangesRequested(ESTADO_LABELS.revision);
  return badgePending(ESTADO_LABELS.borrador);
}

function detailMsg(e: unknown): string {
  if (e && typeof e === "object" && "detail" in e) {
    const d = (e as { detail?: unknown }).detail;
    if (typeof d === "string" && d.trim()) return d.trim();
  }
  return (e as Error)?.message ?? "Ocurrió un error";
}

// ── Estado de la vista ───────────────────────────────────────────────────────

interface EmpleadoOption {
  id: number;
  nombre: string;
}

interface OplForm {
  codigo: string;
  titulo: string;
  proceso: string;
  maquina: string;
  aprobadorId: string;
}

interface VersionForm {
  archivoUrl: string;
  cambios: string;
}

interface OplsView {
  items: OPLResponse[];
  empleados: EmpleadoOption[];
  loading: boolean;
  error: string | null;
  actionError: string | null;
  filters: { codigo: string; estado: string; proceso: string; maquina: string };
  // Modal crear/editar
  modalOpen: boolean;
  modalMode: "crear" | "editar";
  editId: number | null;
  saving: boolean;
  modalError: string | null;
  form: OplForm;
  // Modal detalle / versiones
  detailId: number | null;
  detailError: string | null;
  versionForm: VersionForm;
  addingVersion: boolean;
  sending: boolean;
}

function emptyForm(): OplForm {
  return { codigo: "", titulo: "", proceso: "", maquina: "", aprobadorId: "" };
}

function emptyVersionForm(): VersionForm {
  return { archivoUrl: "", cambios: "" };
}

let oplActionsBusy = false;

// ── Render: filtros ──────────────────────────────────────────────────────────

function renderFiltros(v: OplsView): string {
  const f = v.filters;
  const estadoOpts = [
    `<option value=""${f.estado === "" ? " selected" : ""}>Todos</option>`,
    ...(Object.keys(ESTADO_LABELS) as OPLEstado[]).map(
      (e) => `<option value="${e}"${e === f.estado ? " selected" : ""}>${escapeHtml(ESTADO_LABELS[e])}</option>`,
    ),
  ].join("");
  return `
    <div class="${RH_LISTADO_SURFACE} flex flex-wrap items-end gap-3 px-4 py-3">
      <div class="min-w-[10rem] flex-1">
        <label class="${RH_LISTADO_LABEL}" for="opl-f-codigo">Código</label>
        <input id="opl-f-codigo" data-filter="codigo" type="search" autocomplete="off" placeholder="Ej. OPL-2041" value="${escapeHtml(f.codigo)}" class="${FIELD_INPUT} ${RH_LISTADO_FOCUS_RING}" />
      </div>
      <div class="min-w-[9rem]">
        <label class="${RH_LISTADO_LABEL}" for="opl-f-estado">Estado</label>
        <div class="grid grid-cols-1">
          <select id="opl-f-estado" data-filter="estado" class="${RH_LISTADO_SELECT} ${RH_LISTADO_FOCUS_RING}">${estadoOpts}</select>
          ${SELECT_CHEVRON}
        </div>
      </div>
      <div class="min-w-[9rem] flex-1">
        <label class="${RH_LISTADO_LABEL}" for="opl-f-proceso">Proceso</label>
        <input id="opl-f-proceso" data-filter="proceso" type="search" autocomplete="off" value="${escapeHtml(f.proceso)}" class="${FIELD_INPUT} ${RH_LISTADO_FOCUS_RING}" />
      </div>
      <div class="min-w-[9rem] flex-1">
        <label class="${RH_LISTADO_LABEL}" for="opl-f-maquina">Máquina</label>
        <input id="opl-f-maquina" data-filter="maquina" type="search" autocomplete="off" value="${escapeHtml(f.maquina)}" class="${FIELD_INPUT} ${RH_LISTADO_FOCUS_RING}" />
      </div>
      <div class="flex items-center gap-2">
        <button type="button" data-action="opl-aplicar-filtros" class="${RH_LISTADO_BTN_PRIMARY}">Filtrar</button>
        <button type="button" data-action="opl-limpiar-filtros" class="${RH_LISTADO_BTN_GHOST}">Limpiar</button>
      </div>
    </div>`;
}

// ── Render: tarjeta de OPL ───────────────────────────────────────────────────

function renderCard(o: OPLResponse): string {
  const meta: string[] = [];
  if (o.proceso) meta.push(`Proceso: ${escapeHtml(o.proceso)}`);
  if (o.maquina) meta.push(`Máquina: ${escapeHtml(o.maquina)}`);
  const metaHtml = meta.length
    ? `<p class="mt-1 text-xs text-text-muted">${meta.join(" &middot; ")}</p>`
    : "";
  const aprobador = o.aprobador_nombre
    ? escapeHtml(o.aprobador_nombre)
    : `<span class="text-text-muted">Sin aprobador</span>`;
  const puedeEnviar =
    o.estado_aprobacion === "borrador" && o.total_versiones >= 1 && o.aprobador_id != null;
  const enviarBtn = puedeEnviar
    ? `<button type="button" data-action="opl-enviar" data-id="${o.id}" class="${BTN_SECONDARY} text-xs"${oplActionsBusy ? " disabled" : ""}>Enviar a revisión</button>`
    : "";
  return `
    <div class="${RH_LISTADO_SURFACE} flex flex-col gap-3 px-5 py-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-mono text-xs font-semibold text-slate-500">${escapeHtml(o.codigo)}</span>
            ${estadoBadge(o.estado_aprobacion)}
          </div>
          <h2 class="mt-1 text-sm font-semibold leading-snug text-text-primary">${escapeHtml(o.titulo)}</h2>
          ${metaHtml}
        </div>
        <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
          ${enviarBtn}
          <button type="button" data-action="opl-ver" data-id="${o.id}" class="${RH_LISTADO_BTN_GHOST} text-xs">Ver versiones</button>
          <button type="button" data-action="opl-editar" data-id="${o.id}" class="${RH_LISTADO_BTN_GHOST} text-xs">Editar</button>
          <button type="button" data-action="opl-eliminar" data-id="${o.id}" class="text-xs font-semibold text-red-600 transition hover:text-red-800">Eliminar</button>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
        <span>${o.total_versiones} versi${o.total_versiones === 1 ? "ón" : "ones"}</span>
        <span>Aprobador: ${aprobador}</span>
      </div>
    </div>`;
}

// ── Render: modal crear/editar ───────────────────────────────────────────────

function aprobadorOptions(v: OplsView, selectedId: string): string {
  return [
    `<option value=""${selectedId === "" ? " selected" : ""}>— sin aprobador —</option>`,
    ...v.empleados.map(
      (e) => `<option value="${e.id}"${String(e.id) === selectedId ? " selected" : ""}>${escapeHtml(e.nombre)}</option>`,
    ),
  ].join("");
}

function renderModal(v: OplsView): string {
  if (!v.modalOpen) return "";
  const f = v.form;
  const titulo = v.modalMode === "crear" ? "Nueva OPL" : "Editar OPL";
  const codigoField =
    v.modalMode === "crear"
      ? `<div>
          <label class="${FORM_LABEL}" for="opl-form-codigo">Código</label>
          <input id="opl-form-codigo" data-form="codigo" type="text" value="${escapeHtml(f.codigo)}" class="${FIELD_INPUT}" />
        </div>`
      : "";
  return `
    <div class="${MODAL_OVERLAY}" data-modal="opl-modal">
      <div class="${MODAL_PANEL} max-w-lg" role="dialog" aria-modal="true" aria-labelledby="opl-modal-titulo">
        <header class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="opl-modal-titulo" class="text-base font-bold text-text-primary">${escapeHtml(titulo)}</h2>
          <button type="button" data-action="opl-modal-cerrar" class="text-text-muted hover:text-text-primary" aria-label="Cerrar">✕</button>
        </header>
        <div class="max-h-[70vh] overflow-y-auto px-5 py-4">
          ${v.modalError ? `<div class="mb-3">${alertError(v.modalError)}</div>` : ""}
          <div class="flex flex-col gap-3">
            ${codigoField}
            <div>
              <label class="${FORM_LABEL}" for="opl-form-titulo">Título</label>
              <input id="opl-form-titulo" data-form="titulo" type="text" value="${escapeHtml(f.titulo)}" class="${FIELD_INPUT}" />
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label class="${FORM_LABEL}" for="opl-form-proceso">Proceso</label>
                <input id="opl-form-proceso" data-form="proceso" type="text" value="${escapeHtml(f.proceso)}" class="${FIELD_INPUT}" />
              </div>
              <div>
                <label class="${FORM_LABEL}" for="opl-form-maquina">Máquina</label>
                <input id="opl-form-maquina" data-form="maquina" type="text" value="${escapeHtml(f.maquina)}" class="${FIELD_INPUT}" />
              </div>
            </div>
            <div>
              <label class="${FORM_LABEL}" for="opl-form-aprobador">Aprobador</label>
              <div class="relative grid grid-cols-1">
                <select id="opl-form-aprobador" data-form="aprobadorId" class="${FORM_SELECT}">${aprobadorOptions(v, f.aprobadorId)}</select>
                ${SELECT_CHEVRON}
              </div>
            </div>
          </div>
        </div>
        <footer class="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button type="button" data-action="opl-modal-cerrar" class="${BTN_SECONDARY}">Cancelar</button>
          <button type="button" data-action="opl-modal-guardar" class="${BTN_PRIMARY}"${v.saving ? " disabled" : ""}>${v.saving ? "Guardando…" : "Guardar"}</button>
        </footer>
      </div>
    </div>`;
}

// ── Render: modal detalle / versiones ────────────────────────────────────────

function renderVersionRow(vItem: OPLResponse["versiones"][number]): string {
  const href = safeHref(vItem.archivo_url);
  const linkHtml = href
    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="text-xs font-semibold text-[#1e40af] hover:underline">Abrir archivo</a>`
    : `<span class="text-xs text-text-muted">Enlace no disponible</span>`;
  const autor = vItem.creado_por_nombre ? escapeHtml(vItem.creado_por_nombre) : "—";
  const cambios = vItem.cambios_descripcion
    ? `<p class="mt-1 text-xs text-text-secondary">${escapeHtml(vItem.cambios_descripcion)}</p>`
    : "";
  return `
    <div class="rounded-lg border border-slate-200 px-3 py-2.5">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-xs font-semibold text-text-primary">Versión ${vItem.version_num}</span>
        ${linkHtml}
      </div>
      <p class="mt-0.5 text-[11px] text-text-muted">${escapeHtml(fmtDateTimeIso(vItem.fecha))} &middot; ${autor}</p>
      ${cambios}
    </div>`;
}

function renderDetailModal(v: OplsView): string {
  if (v.detailId == null) return "";
  const o = v.items.find((x) => x.id === v.detailId);
  if (!o) return "";
  const vf = v.versionForm;
  const versionesHtml =
    o.versiones.length > 0
      ? o.versiones
          .slice()
          .sort((a, b) => b.version_num - a.version_num)
          .map(renderVersionRow)
          .join("")
      : `<p class="text-sm text-text-muted">Sin versiones todavía. Agrega la primera abajo.</p>`;
  const puedeEnviar =
    o.estado_aprobacion === "borrador" && o.total_versiones >= 1 && o.aprobador_id != null;
  const enviarHint =
    o.estado_aprobacion === "borrador" && !puedeEnviar
      ? `<p class="text-xs text-text-muted">Para enviar a revisión se necesita al menos una versión y un aprobador designado.</p>`
      : "";
  return `
    <div class="${MODAL_OVERLAY}" data-modal="opl-detail">
      <div class="${MODAL_PANEL} max-w-2xl" role="dialog" aria-modal="true" aria-labelledby="opl-detail-titulo">
        <header class="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-mono text-xs font-semibold text-slate-500">${escapeHtml(o.codigo)}</span>
              ${estadoBadge(o.estado_aprobacion)}
            </div>
            <h2 id="opl-detail-titulo" class="mt-1 text-base font-bold text-text-primary">${escapeHtml(o.titulo)}</h2>
          </div>
          <button type="button" data-action="opl-detail-cerrar" class="text-text-muted hover:text-text-primary" aria-label="Cerrar">✕</button>
        </header>
        <div class="max-h-[70vh] overflow-y-auto px-5 py-4">
          ${v.detailError ? `<div class="mb-3">${alertError(v.detailError)}</div>` : ""}
          <div class="flex flex-col gap-2">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-text-muted">Versiones (${o.total_versiones})</h3>
            ${versionesHtml}
          </div>
          <div class="mt-5 border-t border-slate-100 pt-4">
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Agregar versión</h3>
            <div class="flex flex-col gap-3">
              <div>
                <label class="${FORM_LABEL}" for="opl-ver-url">URL del archivo</label>
                <input id="opl-ver-url" data-version="archivoUrl" type="text" value="${escapeHtml(vf.archivoUrl)}" placeholder="https://… o /ruta/interna" class="${FIELD_INPUT}" />
              </div>
              <div>
                <label class="${FORM_LABEL}" for="opl-ver-cambios">Descripción de cambios</label>
                <textarea id="opl-ver-cambios" data-version="cambios" rows="2" class="${FIELD_TEXTAREA}">${escapeHtml(vf.cambios)}</textarea>
              </div>
              <div>
                <button type="button" data-action="opl-agregar-version" class="${BTN_PRIMARY} text-sm"${v.addingVersion ? " disabled" : ""}>${v.addingVersion ? "Agregando…" : "Agregar versión"}</button>
              </div>
            </div>
          </div>
        </div>
        <footer class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-4">
          <div class="flex flex-col gap-1">${enviarHint}</div>
          <div class="flex items-center gap-2">
            ${puedeEnviar ? `<button type="button" data-action="opl-detail-enviar" data-id="${o.id}" class="${BTN_SECONDARY}"${v.sending ? " disabled" : ""}>${v.sending ? "Enviando…" : "Enviar a revisión"}</button>` : ""}
            <button type="button" data-action="opl-detail-cerrar" class="${BTN_SECONDARY}">Cerrar</button>
          </div>
        </footer>
      </div>
    </div>`;
}

// ── Render: página ───────────────────────────────────────────────────────────

function renderPage(v: OplsView): string {
  let body: string;
  if (v.loading) {
    body = `
      ${skeletonBlock({ className: "h-16 rounded-2xl border border-[#e5e7eb] bg-white" })}
      ${skeletonBlock({ className: "h-28 rounded-2xl border border-[#e5e7eb] bg-white" })}
      ${skeletonBlock({ className: "h-28 rounded-2xl border border-[#e5e7eb] bg-white" })}`;
  } else if (v.error) {
    body = errorState({ message: v.error, actionLabel: "Reintentar", actionAttrs: 'data-action="opl-retry"' });
  } else if (v.items.length === 0) {
    body = `
      <div class="${RH_LISTADO_SURFACE} px-6 py-16 text-center">
        <p class="text-base font-semibold text-text-primary">Sin OPLs</p>
        <p class="mt-1 text-sm text-text-muted">Crea la primera OPL con el botón «Nueva OPL».</p>
      </div>`;
  } else {
    body = `<div class="flex flex-col gap-3">${v.items.map(renderCard).join("")}</div>`;
  }

  const actionErrorHtml = v.actionError
    ? `<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700" role="alert">${escapeHtml(v.actionError)}</div>`
    : "";

  const heading = pageHeading(
    "Manejo de OPLs",
    "Gestiona las OPLs, sus versiones y el flujo de aprobación.",
    `<button type="button" data-action="opl-nueva" class="${BTN_PRIMARY}"${oplActionsBusy ? " disabled" : ""}>Nueva OPL</button>`,
  );

  return `
    <div class="${RH_LISTADO_PAGE_OUTER}">
      ${heading}
      ${renderFiltros(v)}
      ${actionErrorHtml}
      ${body}
    </div>
    ${renderModal(v)}
    ${renderDetailModal(v)}`;
}

// ── Montaje ──────────────────────────────────────────────────────────────────

export function mountOpls(container: HTMLElement, signal?: AbortSignal): void {
  const view: OplsView = {
    items: [],
    empleados: [],
    loading: true,
    error: null,
    actionError: null,
    filters: { codigo: "", estado: "", proceso: "", maquina: "" },
    modalOpen: false,
    modalMode: "crear",
    editId: null,
    saving: false,
    modalError: null,
    form: emptyForm(),
    detailId: null,
    detailError: null,
    versionForm: emptyVersionForm(),
    addingVersion: false,
    sending: false,
  };

  const render = (): void => {
    mountAppShell(container, {
      pageTitle: "Manejo de OPLs",
      activeNav: "opls",
      mainHtml: renderPage(view),
    });
  };

  const focusTopModal = (): void => {
    window.requestAnimationFrame(() => {
      const dialogs = container.querySelectorAll<HTMLElement>('[data-modal] [role="dialog"]');
      const panel = dialogs[dialogs.length - 1];
      const t = panel?.querySelector<HTMLElement>(OPL_FOCUSABLE_SELECTOR);
      t?.focus();
    });
  };

  const refreshList = async (): Promise<void> => {
    try {
      const items = await listarOpls(view.filters);
      if (signal?.aborted) return;
      view.items = items;
    } catch (e) {
      view.actionError = detailMsg(e);
    }
  };

  const loadAll = async (): Promise<void> => {
    view.loading = true;
    view.error = null;
    render();
    try {
      const [items, empleadosPage] = await Promise.all([
        listarOpls(view.filters),
        getEmpleadosPage({ page: 1, page_size: 500 }),
      ]);
      if (signal?.aborted) return;
      view.items = items;
      view.empleados = empleadosPage.items.map((e) => ({ id: e.empleado_id, nombre: e.nombre }));
    } catch (e) {
      view.error = detailMsg(e);
    }
    if (signal?.aborted) return;
    view.loading = false;
    render();
  };

  const aplicarFiltros = async (): Promise<void> => {
    view.loading = true;
    view.error = null;
    view.actionError = null;
    render();
    try {
      const items = await listarOpls(view.filters);
      if (signal?.aborted) return;
      view.items = items;
    } catch (e) {
      view.error = detailMsg(e);
    }
    if (signal?.aborted) return;
    view.loading = false;
    render();
  };

  // ── Modal crear/editar ──────────────────────────────────────────────────
  const abrirModalCrear = (): void => {
    view.modalMode = "crear";
    view.editId = null;
    view.form = emptyForm();
    view.modalError = null;
    view.modalOpen = true;
    render();
    focusTopModal();
  };

  const abrirModalEditar = (id: number): void => {
    const o = view.items.find((x) => x.id === id);
    if (!o) return;
    view.modalMode = "editar";
    view.editId = id;
    view.form = {
      codigo: o.codigo,
      titulo: o.titulo,
      proceso: o.proceso ?? "",
      maquina: o.maquina ?? "",
      aprobadorId: o.aprobador_id != null ? String(o.aprobador_id) : "",
    };
    view.modalError = null;
    view.modalOpen = true;
    render();
    focusTopModal();
  };

  const guardarModal = async (): Promise<void> => {
    if (view.saving) return;
    const f = view.form;
    const titulo = f.titulo.trim();
    if (view.modalMode === "crear" && !f.codigo.trim()) {
      view.modalError = "El código es obligatorio.";
      render();
      focusTopModal();
      return;
    }
    if (titulo.length < 2) {
      view.modalError = "El título debe tener al menos 2 caracteres.";
      render();
      focusTopModal();
      return;
    }
    view.saving = true;
    view.modalError = null;
    render();
    const aprobadorId = f.aprobadorId.trim() ? Number(f.aprobadorId) : null;
    try {
      if (view.modalMode === "crear") {
        await crearOpl({
          codigo: f.codigo.trim(),
          titulo,
          proceso: f.proceso.trim() || null,
          maquina: f.maquina.trim() || null,
          aprobador_id: aprobadorId,
        });
      } else if (view.editId != null) {
        await actualizarOpl(view.editId, {
          titulo,
          proceso: f.proceso.trim() || null,
          maquina: f.maquina.trim() || null,
          aprobador_id: aprobadorId,
        });
      }
      if (signal?.aborted) return;
      view.modalOpen = false;
      await refreshList();
    } catch (e) {
      view.modalError = detailMsg(e);
    }
    view.saving = false;
    if (!signal?.aborted) render();
  };

  const eliminar = async (id: number): Promise<void> => {
    if (oplActionsBusy) return;
    if (!confirm("¿Eliminar esta OPL y todas sus versiones?")) return;
    oplActionsBusy = true;
    view.actionError = null;
    render();
    try {
      await eliminarOpl(id);
      if (view.detailId === id) view.detailId = null;
      await refreshList();
    } catch (e) {
      view.actionError = detailMsg(e);
    }
    oplActionsBusy = false;
    if (!signal?.aborted) render();
  };

  const enviar = async (id: number): Promise<void> => {
    if (oplActionsBusy || view.sending) return;
    oplActionsBusy = true;
    view.sending = true;
    view.actionError = null;
    view.detailError = null;
    render();
    try {
      await enviarARevision(id);
      await refreshList();
    } catch (e) {
      const msg = detailMsg(e);
      if (view.detailId === id) view.detailError = msg;
      else view.actionError = msg;
    }
    oplActionsBusy = false;
    view.sending = false;
    if (!signal?.aborted) render();
  };

  // ── Modal detalle / versiones ───────────────────────────────────────────
  const abrirDetalle = (id: number): void => {
    view.detailId = id;
    view.detailError = null;
    view.versionForm = emptyVersionForm();
    render();
    focusTopModal();
  };

  const agregarVersionAction = async (): Promise<void> => {
    if (view.addingVersion || view.detailId == null) return;
    const url = view.versionForm.archivoUrl.trim();
    if (!url) {
      view.detailError = "La URL del archivo es obligatoria.";
      render();
      return;
    }
    if (!safeHref(url)) {
      view.detailError = "La URL debe ser http(s) o una ruta interna que empiece con «/».";
      render();
      return;
    }
    view.addingVersion = true;
    view.detailError = null;
    render();
    try {
      await agregarVersion(view.detailId, {
        archivo_url: url,
        cambios_descripcion: view.versionForm.cambios.trim() || null,
      });
      if (signal?.aborted) return;
      view.versionForm = emptyVersionForm();
      await refreshList();
    } catch (e) {
      view.detailError = detailMsg(e);
    }
    view.addingVersion = false;
    if (!signal?.aborted) render();
  };

  // ── Sync de campos ──────────────────────────────────────────────────────
  const syncFormField = (target: HTMLElement): void => {
    const campo = target.dataset?.form as keyof OplForm | undefined;
    if (campo) {
      view.form[campo] = (target as HTMLInputElement | HTMLSelectElement).value;
      return;
    }
    const vcampo = target.dataset?.version as keyof VersionForm | undefined;
    if (vcampo) {
      view.versionForm[vcampo] = (target as HTMLInputElement | HTMLTextAreaElement).value;
      return;
    }
    const filtro = target.dataset?.filter as keyof OplsView["filters"] | undefined;
    if (filtro) {
      view.filters[filtro] = (target as HTMLInputElement | HTMLSelectElement).value;
    }
  };

  const closeModals = (): void => {
    if (view.detailId != null) {
      view.detailId = null;
      render();
      return;
    }
    if (view.modalOpen) {
      view.modalOpen = false;
      render();
    }
  };

  const onClick = (e: Event): void => {
    const target = e.target as HTMLElement | null;
    const btn = target?.closest<HTMLElement>("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const id = Number(btn.dataset.id);
    switch (action) {
      case "opl-retry":
        void loadAll();
        break;
      case "opl-aplicar-filtros":
        void aplicarFiltros();
        break;
      case "opl-limpiar-filtros":
        view.filters = { codigo: "", estado: "", proceso: "", maquina: "" };
        void aplicarFiltros();
        break;
      case "opl-nueva":
        abrirModalCrear();
        break;
      case "opl-editar":
        if (id) abrirModalEditar(id);
        break;
      case "opl-eliminar":
        if (id) void eliminar(id);
        break;
      case "opl-ver":
        if (id) abrirDetalle(id);
        break;
      case "opl-enviar":
      case "opl-detail-enviar":
        if (id) void enviar(id);
        break;
      case "opl-modal-cerrar":
        view.modalOpen = false;
        render();
        break;
      case "opl-modal-guardar":
        void guardarModal();
        break;
      case "opl-detail-cerrar":
        view.detailId = null;
        render();
        break;
      case "opl-agregar-version":
        void agregarVersionAction();
        break;
      default:
        break;
    }
  };

  const onChange = (e: Event): void => {
    const target = e.target as HTMLElement | null;
    if (target) syncFormField(target);
  };

  const onInput = (e: Event): void => {
    const target = e.target as HTMLElement | null;
    if (target && (target.dataset?.form || target.dataset?.version || target.dataset?.filter)) {
      syncFormField(target);
    }
  };

  const handleKeydown = (e: KeyboardEvent): void => {
    if (view.detailId == null && !view.modalOpen) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeModals();
    }
  };

  const listenerOpts = signal ? { signal } : undefined;
  container.addEventListener("click", onClick, listenerOpts);
  container.addEventListener("change", onChange, listenerOpts);
  container.addEventListener("input", onInput, listenerOpts);
  container.addEventListener("keydown", handleKeydown, listenerOpts);

  void loadAll();
}
