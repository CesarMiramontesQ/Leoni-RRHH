/**
 * Motor de Evidencias de Capacitación — gestión RH.
 *
 * Lista de evidencias (empleado, capacitación, tipo, archivo, estado y progreso
 * de firmas), con modales para crear, ver detalle (firmas + asignar/quitar
 * firmante), editar (archivo_url + notas) y eliminar.
 *
 * El estado de la evidencia y de cada firma es DERIVADO en el backend; aquí solo
 * se muestran. RH edita únicamente `archivo_url` y `notas`.
 */
import { mountAppShell } from "../layouts/appShell.ts";
import { getEmpleadosPage } from "../api/empleados.ts";
import { getCursos } from "../api/cursos.ts";
import {
  actualizarEvidencia,
  agregarFirmante,
  crearEvidencia,
  eliminarEvidencia,
  listarEvidencias,
  quitarFirmante,
  type EvidenciaEstado,
  type EvidenciaResponse,
  type EvidenciaTipo,
  type FirmaEstado,
  type FirmaItem,
} from "../api/evidencias.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  alertError,
  badgeApproved,
  badgePending,
  badgeRejected,
  BTN_DANGER,
  BTN_GHOST,
  BTN_PRIMARY,
  BTN_SECONDARY,
  errorState,
  FIELD_INPUT,
  FIELD_TEXTAREA,
  FILTER_FIELD_WRAP,
  FORM_LABEL,
  FORM_SELECT,
  MODAL_OVERLAY,
  MODAL_PANEL,
  pageHeading,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  RH_TABLE_HEAD,
  SELECT_CHEVRON,
  skeletonBlock,
} from "../ui/uiTokens.ts";

// ── Etiquetas ────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<EvidenciaTipo, string> = {
  foto: "Foto",
  documento: "Documento",
  video: "Video",
  firma: "Firma",
};

const EV_ESTADO_LABELS: Record<EvidenciaEstado, string> = {
  pendiente: "Pendiente",
  validada: "Validada",
  devuelta: "Devuelta",
};

const FIRMA_ESTADO_LABELS: Record<FirmaEstado, string> = {
  pendiente: "Pendiente",
  firmada: "Firmada",
  rechazada: "Rechazada",
};

function evEstadoBadge(estado: EvidenciaEstado): string {
  const label = EV_ESTADO_LABELS[estado] ?? estado;
  if (estado === "validada") return badgeApproved(label);
  if (estado === "devuelta") return badgeRejected(label);
  return badgePending(label);
}

function firmaEstadoBadge(estado: FirmaEstado): string {
  const label = FIRMA_ESTADO_LABELS[estado] ?? estado;
  if (estado === "firmada") return badgeApproved(label);
  if (estado === "rechazada") return badgeRejected(label);
  return badgePending(label);
}

/** Solo tratamos como enlace navegable las URLs http(s) o rutas absolutas. */
function safeHref(url: string): string | null {
  const t = url.trim();
  if (/^https?:\/\//i.test(t) || t.startsWith("/")) return t;
  return null;
}

function archivoLink(url: string): string {
  const href = safeHref(url);
  if (!href) {
    return `<span class="text-xs text-slate-600 break-all">${escapeHtml(url)}</span>`;
  }
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="text-xs font-medium text-leoni-blue underline decoration-slate-300 underline-offset-2 hover:decoration-leoni-blue break-all">${escapeHtml(url)}</a>`;
}

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

// ── Estado de la vista ───────────────────────────────────────────────────────

interface EmpleadoOpt {
  id: number;
  nombre: string;
  no: string;
}

interface FirmanteBorrador {
  firmante_id: number;
  rol_firma: string;
  nombre: string;
}

interface CrearForm {
  tipo: EvidenciaTipo;
  archivoUrl: string;
  empleadoId: string;
  capacitacionId: string;
  notas: string;
  firmanteAddId: string;
  firmanteAddRol: string;
  firmantes: FirmanteBorrador[];
}

interface EditarForm {
  archivoUrl: string;
  notas: string;
}

type ModalKind = "crear" | "editar" | "detalle" | null;

interface EvView {
  items: EvidenciaResponse[];
  empleados: EmpleadoOpt[];
  cursos: { id: number; nombre: string }[];
  loading: boolean;
  error: string | null;
  actionError: string | null;
  filtroEmpleadoId: string;
  filtroCapacitacionId: string;
  filtroEstado: string;
  modal: ModalKind;
  editId: number | null;
  detalleId: number | null;
  saving: boolean;
  modalError: string | null;
  firmanteBusy: boolean;
  detalleAddId: string;
  detalleAddRol: string;
  crear: CrearForm;
  editar: EditarForm;
}

function emptyCrearForm(): CrearForm {
  return {
    tipo: "documento",
    archivoUrl: "",
    empleadoId: "",
    capacitacionId: "",
    notas: "",
    firmanteAddId: "",
    firmanteAddRol: "",
    firmantes: [],
  };
}

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

// ── Render: filtros ──────────────────────────────────────────────────────────

function empleadoOptions(empleados: EmpleadoOpt[], selected: string, placeholder: string): string {
  return [
    `<option value=""${selected === "" ? " selected" : ""}>${escapeHtml(placeholder)}</option>`,
    ...empleados.map(
      (e) =>
        `<option value="${e.id}"${String(e.id) === selected ? " selected" : ""}>${escapeHtml(
          e.nombre,
        )}${e.no ? ` · ${escapeHtml(e.no)}` : ""}</option>`,
    ),
  ].join("");
}

function cursoOptions(cursos: { id: number; nombre: string }[], selected: string, placeholder: string): string {
  return [
    `<option value=""${selected === "" ? " selected" : ""}>${escapeHtml(placeholder)}</option>`,
    ...cursos.map(
      (c) => `<option value="${c.id}"${String(c.id) === selected ? " selected" : ""}>${escapeHtml(c.nombre)}</option>`,
    ),
  ].join("");
}

function renderFiltros(v: EvView): string {
  const estados: EvidenciaEstado[] = ["pendiente", "validada", "devuelta"];
  const estadoOpts = [
    `<option value=""${v.filtroEstado === "" ? " selected" : ""}>Todos los estados</option>`,
    ...estados.map(
      (e) => `<option value="${e}"${e === v.filtroEstado ? " selected" : ""}>${escapeHtml(EV_ESTADO_LABELS[e])}</option>`,
    ),
  ].join("");
  return `
    <div class="${RH_LISTADO_SURFACE} flex flex-wrap items-end gap-3 px-4 py-3">
      <div class="${FILTER_FIELD_WRAP}">
        <label class="${RH_LISTADO_LABEL}" for="ev-filtro-empleado">Empleado</label>
        <div class="grid grid-cols-1">
          <select id="ev-filtro-empleado" data-action="ev-filtro-empleado" class="${RH_LISTADO_SELECT} ${RH_LISTADO_FOCUS_RING}">${empleadoOptions(
            v.empleados,
            v.filtroEmpleadoId,
            "Todos",
          )}</select>
          ${SELECT_CHEVRON}
        </div>
      </div>
      <div class="${FILTER_FIELD_WRAP}">
        <label class="${RH_LISTADO_LABEL}" for="ev-filtro-capacitacion">Capacitación</label>
        <div class="grid grid-cols-1">
          <select id="ev-filtro-capacitacion" data-action="ev-filtro-capacitacion" class="${RH_LISTADO_SELECT} ${RH_LISTADO_FOCUS_RING}">${cursoOptions(
            v.cursos,
            v.filtroCapacitacionId,
            "Todas",
          )}</select>
          ${SELECT_CHEVRON}
        </div>
      </div>
      <div class="${FILTER_FIELD_WRAP}">
        <label class="${RH_LISTADO_LABEL}" for="ev-filtro-estado">Estado</label>
        <div class="grid grid-cols-1">
          <select id="ev-filtro-estado" data-action="ev-filtro-estado" class="${RH_LISTADO_SELECT} ${RH_LISTADO_FOCUS_RING}">${estadoOpts}</select>
          ${SELECT_CHEVRON}
        </div>
      </div>
      <button type="button" data-action="ev-filtro-limpiar" class="${BTN_GHOST}">Limpiar</button>
    </div>`;
}

// ── Render: tabla ────────────────────────────────────────────────────────────

function progresoFirmas(ev: EvidenciaResponse): string {
  if (ev.firmas_total === 0) {
    return `<span class="text-xs text-slate-400">Sin firmantes</span>`;
  }
  const pct = Math.round((ev.firmas_firmadas / ev.firmas_total) * 100);
  const done = ev.firmas_firmadas === ev.firmas_total;
  return `
    <div class="flex items-center gap-2">
      <div class="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <div class="h-full rounded-full ${done ? "bg-emerald-500" : "bg-leoni-blue"}" style="width: ${pct}%"></div>
      </div>
      <span class="text-xs font-semibold tabular-nums text-slate-600">${ev.firmas_firmadas}/${ev.firmas_total}</span>
    </div>`;
}

function renderFila(ev: EvidenciaResponse): string {
  return `
    <tr class="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
      <td class="px-3 py-2.5">
        <p class="text-sm font-medium text-slate-900">${escapeHtml(ev.empleado_nombre ?? `Empleado ${ev.empleado_id}`)}</p>
        <p class="text-[11px] tabular-nums text-slate-400">#${ev.empleado_id}</p>
      </td>
      <td class="px-3 py-2.5 text-xs text-slate-600">${escapeHtml(ev.capacitacion_nombre ?? "—")}</td>
      <td class="px-3 py-2.5">
        <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">${escapeHtml(
          TIPO_LABELS[ev.tipo] ?? ev.tipo,
        )}</span>
      </td>
      <td class="px-3 py-2.5 max-w-[220px]">${archivoLink(ev.archivo_url)}</td>
      <td class="px-3 py-2.5">${evEstadoBadge(ev.estado)}</td>
      <td class="px-3 py-2.5">${progresoFirmas(ev)}</td>
      <td class="px-3 py-2.5">
        <div class="flex items-center justify-end gap-1.5">
          <button type="button" class="${BTN_SECONDARY} !px-2.5 !py-1.5 !text-xs" data-action="ev-detalle" data-id="${ev.id}">Detalle</button>
          <button type="button" class="${BTN_SECONDARY} !px-2.5 !py-1.5 !text-xs" data-action="ev-editar" data-id="${ev.id}">Editar</button>
          <button type="button" class="${BTN_DANGER} !px-2.5 !py-1.5 !text-xs" data-action="ev-eliminar" data-id="${ev.id}">Eliminar</button>
        </div>
      </td>
    </tr>`;
}

function renderTabla(v: EvView): string {
  if (v.items.length === 0) {
    return `
      <div class="${RH_LISTADO_SURFACE} px-6 py-16 text-center">
        <p class="text-base font-semibold text-text-primary">Sin evidencias</p>
        <p class="mt-1 text-sm text-text-muted">No hay evidencias que coincidan con los filtros. Registra una nueva con el botón de arriba.</p>
      </div>`;
  }
  return `
    <div class="${RH_LISTADO_SURFACE} overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[860px] border-collapse text-sm">
          <thead class="${RH_TABLE_HEAD}">
            <tr>
              <th class="px-3 py-2 text-left">Empleado</th>
              <th class="px-3 py-2 text-left">Capacitación</th>
              <th class="px-3 py-2 text-left">Tipo</th>
              <th class="px-3 py-2 text-left">Archivo</th>
              <th class="px-3 py-2 text-left">Estado</th>
              <th class="px-3 py-2 text-left">Firmas</th>
              <th class="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${v.items.map(renderFila).join("")}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── Render: modal crear ──────────────────────────────────────────────────────

function renderFirmantesBorrador(v: EvView): string {
  const rows = v.crear.firmantes
    .map(
      (f, idx) => `
        <li class="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span class="min-w-0 text-xs text-slate-700">
            <span class="font-semibold text-slate-900">${escapeHtml(f.nombre)}</span>
            <span class="text-slate-400"> · </span>${escapeHtml(f.rol_firma)}
          </span>
          <button type="button" data-action="ev-firmante-remove" data-idx="${idx}" class="text-xs font-semibold text-red-600 hover:text-red-700">Quitar</button>
        </li>`,
    )
    .join("");
  const lista = v.crear.firmantes.length
    ? `<ul class="flex flex-col gap-1.5">${rows}</ul>`
    : `<p class="text-xs text-slate-400">Sin firmantes asignados todavía.</p>`;
  return `
    <div class="flex flex-col gap-2">
      <label class="${FORM_LABEL}">Firmantes</label>
      ${lista}
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label class="${RH_LISTADO_LABEL}" for="ev-firmante-emp">Empleado</label>
          <div class="grid grid-cols-1">
            <select id="ev-firmante-emp" data-form="firmanteAddId" class="${FORM_SELECT}">${empleadoOptions(
              v.empleados,
              v.crear.firmanteAddId,
              "Selecciona…",
            )}</select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        <div>
          <label class="${RH_LISTADO_LABEL}" for="ev-firmante-rol">Rol de firma</label>
          <input id="ev-firmante-rol" data-form="firmanteAddRol" type="text" value="${escapeHtml(
            v.crear.firmanteAddRol,
          )}" placeholder="Ej. Instructor" class="${FIELD_INPUT}" />
        </div>
        <button type="button" data-action="ev-firmante-add" class="${BTN_SECONDARY} sm:mb-0.5">Agregar</button>
      </div>
    </div>`;
}

function renderModalCrear(v: EvView): string {
  const f = v.crear;
  const tipos: EvidenciaTipo[] = ["foto", "documento", "video", "firma"];
  const tipoOpts = tipos
    .map((t) => `<option value="${t}"${t === f.tipo ? " selected" : ""}>${escapeHtml(TIPO_LABELS[t])}</option>`)
    .join("");
  return `
    <div class="${MODAL_OVERLAY}" data-modal="ev-crear">
      <div class="${MODAL_PANEL} max-w-2xl" role="dialog" aria-modal="true" aria-labelledby="ev-crear-titulo">
        <header class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="ev-crear-titulo" class="text-base font-bold text-text-primary">Nueva evidencia</h2>
          <button type="button" data-action="ev-modal-cerrar" class="text-text-muted hover:text-text-primary" aria-label="Cerrar">✕</button>
        </header>
        <div class="max-h-[70vh] overflow-y-auto px-5 py-4">
          ${v.modalError ? `<div class="mb-3">${alertError(v.modalError)}</div>` : ""}
          <div class="flex flex-col gap-3">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label class="${FORM_LABEL}" for="ev-crear-tipo">Tipo</label>
                <div class="relative grid grid-cols-1">
                  <select id="ev-crear-tipo" data-form="tipo" class="${FORM_SELECT}">${tipoOpts}</select>
                  ${SELECT_CHEVRON}
                </div>
              </div>
              <div>
                <label class="${FORM_LABEL}" for="ev-crear-empleado">Empleado</label>
                <div class="relative grid grid-cols-1">
                  <select id="ev-crear-empleado" data-form="empleadoId" class="${FORM_SELECT}">${empleadoOptions(
                    v.empleados,
                    f.empleadoId,
                    "Selecciona…",
                  )}</select>
                  ${SELECT_CHEVRON}
                </div>
              </div>
            </div>
            <div>
              <label class="${FORM_LABEL}" for="ev-crear-archivo">URL del archivo</label>
              <input id="ev-crear-archivo" data-form="archivoUrl" type="text" value="${escapeHtml(
                f.archivoUrl,
              )}" placeholder="https://…" class="${FIELD_INPUT}" />
            </div>
            <div>
              <label class="${FORM_LABEL}" for="ev-crear-capacitacion">Capacitación (opcional)</label>
              <div class="relative grid grid-cols-1">
                <select id="ev-crear-capacitacion" data-form="capacitacionId" class="${FORM_SELECT}">${cursoOptions(
                  v.cursos,
                  f.capacitacionId,
                  "— sin capacitación —",
                )}</select>
                ${SELECT_CHEVRON}
              </div>
            </div>
            <div>
              <label class="${FORM_LABEL}" for="ev-crear-notas">Notas</label>
              <textarea id="ev-crear-notas" data-form="notas" rows="2" class="${FIELD_TEXTAREA}">${escapeHtml(
                f.notas,
              )}</textarea>
            </div>
            ${renderFirmantesBorrador(v)}
          </div>
        </div>
        <footer class="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button type="button" data-action="ev-modal-cerrar" class="${BTN_SECONDARY}">Cancelar</button>
          <button type="button" data-action="ev-crear-guardar" class="${BTN_PRIMARY}" ${v.saving ? "disabled" : ""}>${
            v.saving ? "Guardando…" : "Crear evidencia"
          }</button>
        </footer>
      </div>
    </div>`;
}

// ── Render: modal editar ─────────────────────────────────────────────────────

function renderModalEditar(v: EvView): string {
  const f = v.editar;
  return `
    <div class="${MODAL_OVERLAY}" data-modal="ev-editar">
      <div class="${MODAL_PANEL} max-w-lg" role="dialog" aria-modal="true" aria-labelledby="ev-editar-titulo">
        <header class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="ev-editar-titulo" class="text-base font-bold text-text-primary">Editar evidencia</h2>
          <button type="button" data-action="ev-modal-cerrar" class="text-text-muted hover:text-text-primary" aria-label="Cerrar">✕</button>
        </header>
        <div class="max-h-[70vh] overflow-y-auto px-5 py-4">
          ${v.modalError ? `<div class="mb-3">${alertError(v.modalError)}</div>` : ""}
          <div class="flex flex-col gap-3">
            <div>
              <label class="${FORM_LABEL}" for="ev-editar-archivo">URL del archivo</label>
              <input id="ev-editar-archivo" data-editform="archivoUrl" type="text" value="${escapeHtml(
                f.archivoUrl,
              )}" placeholder="https://…" class="${FIELD_INPUT}" />
            </div>
            <div>
              <label class="${FORM_LABEL}" for="ev-editar-notas">Notas</label>
              <textarea id="ev-editar-notas" data-editform="notas" rows="3" class="${FIELD_TEXTAREA}">${escapeHtml(
                f.notas,
              )}</textarea>
            </div>
            <p class="text-[11px] text-slate-400">El estado se calcula a partir de las firmas y no se edita manualmente.</p>
          </div>
        </div>
        <footer class="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button type="button" data-action="ev-modal-cerrar" class="${BTN_SECONDARY}">Cancelar</button>
          <button type="button" data-action="ev-editar-guardar" class="${BTN_PRIMARY}" ${v.saving ? "disabled" : ""}>${
            v.saving ? "Guardando…" : "Guardar cambios"
          }</button>
        </footer>
      </div>
    </div>`;
}

// ── Render: modal detalle ────────────────────────────────────────────────────

function renderFirmaDetalle(f: FirmaItem): string {
  return `
    <li class="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="min-w-0">
          <p class="text-sm font-medium text-slate-900">${escapeHtml(f.firmante_nombre ?? `Empleado ${f.firmante_id}`)}</p>
          <p class="text-[11px] text-slate-500">${escapeHtml(f.rol_firma)} · ${fmtFecha(f.fecha_firma)}</p>
        </div>
        <div class="flex items-center gap-2">
          ${firmaEstadoBadge(f.estado)}
          <button type="button" data-action="ev-detalle-firmante-remove" data-firma-id="${f.id}" class="text-xs font-semibold text-red-600 hover:text-red-700">Quitar</button>
        </div>
      </div>
      ${f.comentario ? `<p class="mt-1.5 text-xs italic text-slate-600">“${escapeHtml(f.comentario)}”</p>` : ""}
    </li>`;
}

function renderModalDetalle(v: EvView): string {
  const ev = v.items.find((e) => e.id === v.detalleId);
  if (!ev) return "";
  const firmas = ev.firmas.length
    ? `<ul class="flex flex-col gap-2">${ev.firmas.map(renderFirmaDetalle).join("")}</ul>`
    : `<p class="text-xs text-slate-400">Sin firmantes asignados.</p>`;
  const disabled = v.firmanteBusy ? "disabled" : "";
  return `
    <div class="${MODAL_OVERLAY}" data-modal="ev-detalle">
      <div class="${MODAL_PANEL} max-w-2xl" role="dialog" aria-modal="true" aria-labelledby="ev-detalle-titulo">
        <header class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div class="min-w-0">
            <h2 id="ev-detalle-titulo" class="text-base font-bold text-text-primary">Evidencia · ${escapeHtml(
              TIPO_LABELS[ev.tipo] ?? ev.tipo,
            )}</h2>
            <p class="text-xs text-slate-500">${escapeHtml(ev.empleado_nombre ?? `Empleado ${ev.empleado_id}`)}</p>
          </div>
          <button type="button" data-action="ev-modal-cerrar" class="text-text-muted hover:text-text-primary" aria-label="Cerrar">✕</button>
        </header>
        <div class="max-h-[70vh] overflow-y-auto px-5 py-4">
          ${v.modalError ? `<div class="mb-3">${alertError(v.modalError)}</div>` : ""}
          <div class="flex flex-col gap-4">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p class="${FORM_LABEL}">Capacitación</p>
                <p class="text-sm text-slate-700">${escapeHtml(ev.capacitacion_nombre ?? "—")}</p>
              </div>
              <div>
                <p class="${FORM_LABEL}">Estado</p>
                <p>${evEstadoBadge(ev.estado)}</p>
              </div>
              <div class="sm:col-span-2">
                <p class="${FORM_LABEL}">Archivo</p>
                ${archivoLink(ev.archivo_url)}
              </div>
              ${
                ev.notas
                  ? `<div class="sm:col-span-2"><p class="${FORM_LABEL}">Notas</p><p class="text-sm text-slate-700 whitespace-pre-line">${escapeHtml(
                      ev.notas,
                    )}</p></div>`
                  : ""
              }
            </div>
            <div class="flex flex-col gap-2">
              <p class="${FORM_LABEL}">Firmas (${ev.firmas_firmadas}/${ev.firmas_total})</p>
              ${firmas}
            </div>
            <div class="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
              <p class="text-xs font-semibold text-slate-700">Asignar firmante</p>
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div>
                  <label class="${RH_LISTADO_LABEL}" for="ev-detalle-firmante-emp">Empleado</label>
                  <div class="grid grid-cols-1">
                    <select id="ev-detalle-firmante-emp" data-detalle="detalleAddId" class="${FORM_SELECT}" ${disabled}>${empleadoOptions(
                      v.empleados,
                      v.detalleAddId,
                      "Selecciona…",
                    )}</select>
                    ${SELECT_CHEVRON}
                  </div>
                </div>
                <div>
                  <label class="${RH_LISTADO_LABEL}" for="ev-detalle-firmante-rol">Rol de firma</label>
                  <input id="ev-detalle-firmante-rol" data-detalle="detalleAddRol" type="text" value="${escapeHtml(
                    v.detalleAddRol,
                  )}" placeholder="Ej. Jefe directo" class="${FIELD_INPUT}" ${disabled} />
                </div>
                <button type="button" data-action="ev-detalle-firmante-add" class="${BTN_SECONDARY} sm:mb-0.5" ${disabled}>${
                  v.firmanteBusy ? "…" : "Agregar"
                }</button>
              </div>
            </div>
          </div>
        </div>
        <footer class="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button type="button" data-action="ev-modal-cerrar" class="${BTN_SECONDARY}">Cerrar</button>
        </footer>
      </div>
    </div>`;
}

// ── Render: página ───────────────────────────────────────────────────────────

function renderPage(v: EvView): string {
  const actions = `<button type="button" data-action="ev-nueva" class="${BTN_PRIMARY}">Nueva evidencia</button>`;
  let body: string;
  if (v.loading) {
    body = `
      ${skeletonBlock({ className: `${RH_LISTADO_SURFACE} h-16` })}
      ${skeletonBlock({ className: `${RH_LISTADO_SURFACE} h-64` })}`;
  } else if (v.error) {
    body = errorState({ message: v.error, actionLabel: "Reintentar", actionAttrs: 'data-action="ev-retry"' });
  } else {
    body = `
      ${renderFiltros(v)}
      ${v.actionError ? alertError(v.actionError) : ""}
      ${renderTabla(v)}`;
  }
  let modal = "";
  if (v.modal === "crear") modal = renderModalCrear(v);
  else if (v.modal === "editar") modal = renderModalEditar(v);
  else if (v.modal === "detalle") modal = renderModalDetalle(v);
  return `
    <div class="${RH_LISTADO_PAGE_OUTER}">
      ${pageHeading(
        "Motor de Evidencias",
        "Registro y validación de evidencias de capacitación con firmas de los responsables.",
        actions,
      )}
      ${body}
    </div>
    ${modal}`;
}

// ── Mount ────────────────────────────────────────────────────────────────────

export function mountEvidencias(container: HTMLElement, signal?: AbortSignal): void {
  const view: EvView = {
    items: [],
    empleados: [],
    cursos: [],
    loading: true,
    error: null,
    actionError: null,
    filtroEmpleadoId: "",
    filtroCapacitacionId: "",
    filtroEstado: "",
    modal: null,
    editId: null,
    detalleId: null,
    saving: false,
    modalError: null,
    firmanteBusy: false,
    detalleAddId: "",
    detalleAddRol: "",
    crear: emptyCrearForm(),
    editar: { archivoUrl: "", notas: "" },
  };

  const render = (): void => {
    mountAppShell(container, {
      pageTitle: "Motor de Evidencias",
      activeNav: "evidencias",
      mainHtml: renderPage(view),
    });
  };

  const detail = (e: unknown): string => {
    if (e && typeof e === "object" && "detail" in e) {
      const d = (e as { detail?: unknown }).detail;
      if (typeof d === "string" && d.trim()) return d.trim();
    }
    return (e as Error)?.message ?? "Ocurrió un error";
  };

  const nombreEmpleado = (id: number): string => {
    const emp = view.empleados.find((e) => e.id === id);
    return emp?.nombre ?? `Empleado ${id}`;
  };

  const recargarLista = async (): Promise<void> => {
    view.actionError = null;
    try {
      view.items = await listarEvidencias({
        empleado_id: view.filtroEmpleadoId ? Number(view.filtroEmpleadoId) : null,
        capacitacion_id: view.filtroCapacitacionId ? Number(view.filtroCapacitacionId) : null,
        estado: view.filtroEstado || null,
      });
    } catch (e) {
      view.actionError = detail(e);
    }
  };

  const loadAll = async (): Promise<void> => {
    view.loading = true;
    view.error = null;
    render();
    try {
      const [evs, empPage, cursosResp] = await Promise.all([
        listarEvidencias({
          empleado_id: view.filtroEmpleadoId ? Number(view.filtroEmpleadoId) : null,
          capacitacion_id: view.filtroCapacitacionId ? Number(view.filtroCapacitacionId) : null,
          estado: view.filtroEstado || null,
        }),
        getEmpleadosPage({ page: 1, page_size: 1000 }),
        getCursos({ page_size: 500 }),
      ]);
      if (signal?.aborted) return;
      view.items = evs;
      view.empleados = empPage.items.map((i) => ({ id: i.empleado_id, nombre: i.nombre, no: i.no_empleado }));
      const cursoItems = (cursosResp as { items?: { id: number; nombre: string }[] }).items ?? [];
      view.cursos = cursoItems.map((c) => ({ id: c.id, nombre: c.nombre }));
    } catch (e) {
      view.error = detail(e);
    }
    if (signal?.aborted) return;
    view.loading = false;
    render();
  };

  const reloadListaYRender = async (): Promise<void> => {
    view.loading = false;
    render();
    await recargarLista();
    if (!signal?.aborted) render();
  };

  // ── Modales ────────────────────────────────────────────────────────────────
  const focusTopModal = (): void => {
    window.requestAnimationFrame(() => {
      const dialogs = container.querySelectorAll<HTMLElement>('[data-modal] [role="dialog"]');
      const panel = dialogs[dialogs.length - 1];
      panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    });
  };

  const abrirCrear = (): void => {
    view.crear = emptyCrearForm();
    view.modalError = null;
    view.modal = "crear";
    render();
    focusTopModal();
  };

  const abrirEditar = (id: number): void => {
    const ev = view.items.find((e) => e.id === id);
    if (!ev) return;
    view.editId = id;
    view.editar = { archivoUrl: ev.archivo_url, notas: ev.notas ?? "" };
    view.modalError = null;
    view.modal = "editar";
    render();
    focusTopModal();
  };

  const abrirDetalle = (id: number): void => {
    view.detalleId = id;
    view.detalleAddId = "";
    view.detalleAddRol = "";
    view.modalError = null;
    view.firmanteBusy = false;
    view.modal = "detalle";
    render();
    focusTopModal();
  };

  const cerrarModal = (): void => {
    view.modal = null;
    view.modalError = null;
    render();
  };

  const agregarFirmanteBorrador = (): void => {
    const id = Number(view.crear.firmanteAddId);
    const rol = view.crear.firmanteAddRol.trim();
    if (!id || !rol) {
      view.modalError = "Selecciona un empleado y un rol de firma para agregarlo.";
      render();
      focusTopModal();
      return;
    }
    if (view.crear.firmantes.some((f) => f.firmante_id === id)) {
      view.modalError = "Ese empleado ya está en la lista de firmantes.";
      render();
      return;
    }
    view.crear.firmantes.push({ firmante_id: id, rol_firma: rol, nombre: nombreEmpleado(id) });
    view.crear.firmanteAddId = "";
    view.crear.firmanteAddRol = "";
    view.modalError = null;
    render();
  };

  const quitarFirmanteBorrador = (idx: number): void => {
    view.crear.firmantes.splice(idx, 1);
    render();
  };

  const guardarCrear = async (): Promise<void> => {
    if (view.saving) return;
    const f = view.crear;
    const archivoUrl = f.archivoUrl.trim();
    const empleadoId = Number(f.empleadoId);
    if (!archivoUrl) {
      view.modalError = "La URL del archivo es obligatoria.";
      render();
      focusTopModal();
      return;
    }
    if (!empleadoId) {
      view.modalError = "Selecciona el empleado de la evidencia.";
      render();
      return;
    }
    view.saving = true;
    view.modalError = null;
    render();
    try {
      await crearEvidencia({
        tipo: f.tipo,
        archivo_url: archivoUrl,
        empleado_id: empleadoId,
        capacitacion_id: f.capacitacionId ? Number(f.capacitacionId) : null,
        notas: f.notas.trim() || null,
        firmantes: f.firmantes.map((fi) => ({ firmante_id: fi.firmante_id, rol_firma: fi.rol_firma })),
      });
      if (signal?.aborted) return;
      view.modal = null;
      await recargarLista();
    } catch (e) {
      view.modalError = detail(e);
    }
    view.saving = false;
    if (!signal?.aborted) render();
  };

  const guardarEditar = async (): Promise<void> => {
    if (view.saving || view.editId == null) return;
    const archivoUrl = view.editar.archivoUrl.trim();
    if (!archivoUrl) {
      view.modalError = "La URL del archivo es obligatoria.";
      render();
      focusTopModal();
      return;
    }
    view.saving = true;
    view.modalError = null;
    render();
    try {
      await actualizarEvidencia(view.editId, {
        archivo_url: archivoUrl,
        notas: view.editar.notas.trim() || null,
      });
      if (signal?.aborted) return;
      view.modal = null;
      await recargarLista();
    } catch (e) {
      view.modalError = detail(e);
    }
    view.saving = false;
    if (!signal?.aborted) render();
  };

  const eliminar = async (id: number): Promise<void> => {
    if (!confirm("¿Eliminar esta evidencia? Esta acción no se puede deshacer.")) return;
    view.actionError = null;
    render();
    try {
      await eliminarEvidencia(id);
      await recargarLista();
    } catch (e) {
      view.actionError = detail(e);
    }
    if (!signal?.aborted) render();
  };

  const agregarFirmanteDetalle = async (): Promise<void> => {
    if (view.firmanteBusy || view.detalleId == null) return;
    const id = Number(view.detalleAddId);
    const rol = view.detalleAddRol.trim();
    if (!id || !rol) {
      view.modalError = "Selecciona un empleado y un rol de firma.";
      render();
      focusTopModal();
      return;
    }
    view.firmanteBusy = true;
    view.modalError = null;
    render();
    try {
      const actualizada = await agregarFirmante(view.detalleId, { firmante_id: id, rol_firma: rol });
      if (signal?.aborted) return;
      view.detalleAddId = "";
      view.detalleAddRol = "";
      const idx = view.items.findIndex((e) => e.id === actualizada.id);
      if (idx >= 0) view.items[idx] = actualizada;
    } catch (e) {
      view.modalError = detail(e);
    }
    view.firmanteBusy = false;
    if (!signal?.aborted) render();
  };

  const quitarFirmanteDetalle = async (firmaId: number): Promise<void> => {
    if (view.firmanteBusy) return;
    view.firmanteBusy = true;
    view.modalError = null;
    render();
    try {
      const actualizada = await quitarFirmante(firmaId);
      if (signal?.aborted) return;
      const idx = view.items.findIndex((e) => e.id === actualizada.id);
      if (idx >= 0) view.items[idx] = actualizada;
    } catch (e) {
      view.modalError = detail(e);
    }
    view.firmanteBusy = false;
    if (!signal?.aborted) render();
  };

  // ── Sync de campos de formulario (sin re-render) ────────────────────────────
  const syncField = (target: HTMLElement): void => {
    const t = target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const campo = target.dataset.form as keyof CrearForm | undefined;
    if (campo) {
      if (campo === "firmantes") return;
      (view.crear[campo] as string) = t.value;
      return;
    }
    const editCampo = target.dataset.editform as keyof EditarForm | undefined;
    if (editCampo) {
      view.editar[editCampo] = t.value;
      return;
    }
    const detalleCampo = target.dataset.detalle;
    if (detalleCampo === "detalleAddId") view.detalleAddId = t.value;
    else if (detalleCampo === "detalleAddRol") view.detalleAddRol = t.value;
  };

  // ── Eventos ─────────────────────────────────────────────────────────────────
  const onClick = (e: Event): void => {
    const target = e.target as HTMLElement | null;
    const btn = target?.closest<HTMLElement>("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const id = Number(btn.dataset.id);
    switch (action) {
      case "ev-nueva":
        abrirCrear();
        break;
      case "ev-retry":
        void loadAll();
        break;
      case "ev-filtro-limpiar":
        view.filtroEmpleadoId = "";
        view.filtroCapacitacionId = "";
        view.filtroEstado = "";
        void reloadListaYRender();
        break;
      case "ev-detalle":
        if (id) abrirDetalle(id);
        break;
      case "ev-editar":
        if (id) abrirEditar(id);
        break;
      case "ev-eliminar":
        if (id) void eliminar(id);
        break;
      case "ev-modal-cerrar":
        cerrarModal();
        break;
      case "ev-crear-guardar":
        void guardarCrear();
        break;
      case "ev-editar-guardar":
        void guardarEditar();
        break;
      case "ev-firmante-add":
        agregarFirmanteBorrador();
        break;
      case "ev-firmante-remove":
        quitarFirmanteBorrador(Number(btn.dataset.idx));
        break;
      case "ev-detalle-firmante-add":
        void agregarFirmanteDetalle();
        break;
      case "ev-detalle-firmante-remove":
        void quitarFirmanteDetalle(Number(btn.dataset.firmaId));
        break;
    }
  };

  const onChange = (e: Event): void => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.dataset.form || target.dataset.editform || target.dataset.detalle) {
      syncField(target);
      return;
    }
    const action = target.dataset.action;
    if (action === "ev-filtro-empleado") {
      view.filtroEmpleadoId = (target as HTMLSelectElement).value;
      void reloadListaYRender();
    } else if (action === "ev-filtro-capacitacion") {
      view.filtroCapacitacionId = (target as HTMLSelectElement).value;
      void reloadListaYRender();
    } else if (action === "ev-filtro-estado") {
      view.filtroEstado = (target as HTMLSelectElement).value;
      void reloadListaYRender();
    }
  };

  const onInput = (e: Event): void => {
    const target = e.target as HTMLElement | null;
    if (target?.dataset.form || target?.dataset.editform || target?.dataset.detalle) syncField(target);
  };

  const handleKeydown = (e: KeyboardEvent): void => {
    if (!view.modal) return;
    if (e.key === "Escape") {
      e.preventDefault();
      cerrarModal();
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
  };

  const listenerOpts = signal ? { signal } : undefined;
  container.addEventListener("click", onClick, listenerOpts);
  container.addEventListener("change", onChange, listenerOpts);
  container.addEventListener("input", onInput, listenerOpts);
  container.addEventListener("keydown", handleKeydown, listenerOpts);

  void loadAll();
}
