/**
 * Plantillas y estilos del modal «Nueva solicitud» RH.
 * Separado del montaje para mantener el archivo de lógica más legible.
 */

import { calcularDiasSolicitadosInclusive, fechasOrdenValidas } from "../../solicitudes/rh/rhNewRequestDays.ts";
import type { UsuarioListItem } from "../../api/usuarios.ts";
import { formatNombreEmpleadoUi } from "../../utils/nombreEmpleadoDisplay.ts";
import { formatNoEmpleadoDisplay } from "../../utils/noEmpleadoDisplay.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
export { escapeHtml };

/** Título de bloque (escaneable, accesible). */
const SEC_TITLE =
  "text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500";

/** Contenedor de sección con aire (vista clara). */
const SEC_BOX =
  "rounded-2xl border border-slate-200/70 bg-slate-50/50 p-5 shadow-sm shadow-slate-900/[0.02]";

const LABEL =
  "mb-2 block text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-500";

const CONTROL =
  "h-11 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.03] transition-[border-color,box-shadow] duration-200 placeholder:text-slate-400/70 hover:border-slate-300 focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/25";

const CONTROL_INVALID =
  "border-red-400/90 focus:border-red-500 focus:ring-red-500/20";

const NR_SELECT_CHEVRON = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="pointer-events-none col-start-1 row-start-1 mr-2.5 size-4 self-center justify-self-end text-slate-400">
  <path fill-rule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
</svg>`;

/** Selector de tipo (supervisor / empleado): tarjetas en contenedor tonal. */
const NR_TIPO_LIST_WRAP =
  "rounded-2xl border border-slate-200/75 bg-linear-to-br from-slate-100/90 to-slate-50/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] ring-1 ring-slate-900/[0.04]";

const NR_TIPO_CARD_BASE =
  "group flex w-full min-h-[3.5rem] min-w-0 items-center gap-3 rounded-xl border px-3.5 py-3.5 text-left shadow-sm transition-[background-color,border-color,box-shadow,transform,color] duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 sm:min-h-[4rem] sm:gap-3.5 sm:py-4 active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-colors";

const nrTipoCardActive = `${NR_TIPO_CARD_BASE} border-leoni-blue/40 bg-white text-text-primary shadow-md shadow-slate-900/[0.08] ring-[0.5px] ring-leoni-blue/35`;

const nrTipoCardInactive = `${NR_TIPO_CARD_BASE} border-slate-200/95 bg-white/65 text-slate-700 hover:border-slate-300 hover:bg-white hover:shadow-[0_2px_8px_-2px_rgba(15,23,42,0.07)]`;

const NR_TIPO_ICON_WRAP_BASE =
  "flex size-10 shrink-0 items-center justify-center rounded-[10px] border transition-colors duration-200";

const tipoIconWrapActive = `${NR_TIPO_ICON_WRAP_BASE} border-leoni-blue/25 bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] text-leoni-blue`;

const tipoIconWrapInactive = `${NR_TIPO_ICON_WRAP_BASE} border-slate-200/85 bg-white/95 text-slate-500 group-hover:border-slate-300 group-hover:text-slate-600`;

/** Ancho del panel del diálogo: estrecho por defecto; supervisor más ancho desde `sm` (móvil sin cambios). */
function rhNuevaSolicitudModalDialogWidthClass(wideForSupervisor: boolean): string {
  return wideForSupervisor
    ? "max-w-[26rem] sm:max-w-4xl"
    : "max-w-[26rem] sm:max-w-lg";
}

export function shellHtml(opts?: { wideForSupervisor?: boolean }): string {
  const wide = opts?.wideForSupervisor === true;
  const dialogW = rhNuevaSolicitudModalDialogWidthClass(wide);
  return `
    <div
      id="rh-nr-overlay"
      class="fixed inset-0 z-[60] hidden items-center justify-center bg-slate-900/40 p-4 sm:p-5 backdrop-blur-[3px]"
      role="presentation"
    >
      <div
        class="flex max-h-[min(92vh,880px)] w-full ${dialogW} flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_20px_50px_-16px_rgba(15,23,42,0.18)] [color-scheme:light]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rh-nr-title"
      >
        <header class="shrink-0 border-b border-slate-100 px-5 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 pr-2">
              <h2 id="rh-nr-title" class="text-xl font-bold tracking-tight text-slate-900">Nueva Solicitud</h2>
              <p id="rh-nr-subtitle" class="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
                Selecciona el tipo de solicitud y completa los campos requeridos.
              </p>
            </div>
            <button
              type="button"
              class="-m-1 flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
              data-rh-nr-close
              aria-label="Cerrar modal"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-5" aria-hidden="true">
                <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </header>
        <div id="rh-nr-body" class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6 sm:py-7"></div>
      </div>
    </div>`;
}

export function loadingBodyHtml(): string {
  return `
    <div class="flex items-center gap-3 py-14 text-sm text-slate-500">
      <svg class="size-5 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      Cargando formulario…
    </div>`;
}

export function empleadoOptionLabel(u: UsuarioListItem): string {
  const name = formatNombreEmpleadoUi(u.nombre).trim() || u.nombre.trim() || "Sin nombre";
  const no = formatNoEmpleadoDisplay(u.no_empleado);
  return `${no} · ${name}`;
}

/** Texto del `<option>` solo con nombre (p. ej. modal nueva incidencia). */
export function empleadoOptionLabelSoloNombre(u: UsuarioListItem): string {
  return formatNombreEmpleadoUi(u.nombre).trim() || u.nombre.trim() || "Sin nombre";
}

export type BuildEmpleadoOptionsOpts = {
  /** Si es true, el texto visible de cada opción es únicamente el nombre. */
  soloNombre?: boolean;
};

export function buildEmpleadoOptions(
  items: UsuarioListItem[],
  selectedId: string,
  opts?: BuildEmpleadoOptionsOpts,
): string {
  const labelFn = opts?.soloNombre ? empleadoOptionLabelSoloNombre : empleadoOptionLabel;
  const head = `<option value="" ${selectedId === "" ? "selected" : ""}>Selecciona un empleado…</option>`;
  const rest = items
    .map((u) => {
      const v = String(u.id);
      const sel = v === selectedId ? "selected" : "";
      return `<option value="${escapeHtml(v)}" ${sel}>${escapeHtml(labelFn(u))}</option>`;
    })
    .join("");
  return head + rest;
}

function iconSvgVacaciones(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5 shrink-0" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Z" />
  </svg>`;
}

function iconSvgHomeOffice(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5 shrink-0" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125h4.125v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
  </svg>`;
}

/** Documento con líneas — distinto del ícono de casa (Home Office). */
function iconSvgPermisoSinGoce(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5 shrink-0" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5h7.5A2.25 2.25 0 0118 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-7.5A2.25 2.25 0 016 17.25V6.75A2.25 2.25 0 018.25 4.5z" />
    <path stroke-linecap="round" d="M9 9.75h6M9 13.5h6M9 17.25h4.5" />
  </svg>`;
}

/** Botones‑tarjeta del tipo de solicitud (solo UI; mismo `data-rh-nr-tipo` para el montaje TS). */
function buildRhTipoChipRowHtml(opts: {
  vacActive: boolean;
  hoActive: boolean;
  permisoActive: boolean;
  showPermisoSinGoce: boolean;
  showHomeOffice?: boolean;
}): string {
  const showHo = opts.showHomeOffice !== false;
  const tipoCount = 1 + (showHo ? 1 : 0) + (opts.showPermisoSinGoce ? 1 : 0);
  const gridCols =
    tipoCount >= 3 ? "grid-cols-1 sm:grid-cols-3"
    : tipoCount === 2 ? "grid-cols-1 sm:grid-cols-2"
    : "grid-cols-1";

  function chip(
    active: boolean,
    tipoAttr: "vacaciones" | "home_office" | "permiso_sin_goce_sueldo",
    svg: string,
    title: string,
    subtitle: string | null,
  ): string {
    const card = active ? nrTipoCardActive : nrTipoCardInactive;
    const wrap = active ? tipoIconWrapActive : tipoIconWrapInactive;
    const subExtra = subtitle
      ? `<span class="mt-0.5 block text-[11px] font-medium leading-snug ${active ? "text-slate-600" : "text-slate-500 group-hover:text-slate-600"}">${escapeHtml(subtitle)}</span>`
      : "";
    return `
      <button
        type="button"
        role="tab"
        aria-selected="${active}"
        data-rh-nr-tipo="${tipoAttr}"
        class="${card}"
      >
        <span class="${wrap}">${svg}</span>
        <span class="min-w-0 flex-1">
          <span class="block text-[13px] font-semibold leading-snug tracking-tight ${active ? "text-text-primary" : "text-slate-800"}">${escapeHtml(title)}</span>
          ${subExtra}
        </span>
      </button>`;
  }

  const permisoBtn = opts.showPermisoSinGoce
    ? chip(opts.permisoActive, "permiso_sin_goce_sueldo", iconSvgPermisoSinGoce(), "Permiso sin goce", "Sin goce de sueldo")
    : "";

  const hoBtn = showHo
    ? chip(opts.hoActive, "home_office", iconSvgHomeOffice(), "Home Office", null)
    : "";

  return `
    <div class="${NR_TIPO_LIST_WRAP}" role="tablist" aria-label="Tipo de solicitud">
      <div class="grid ${gridCols} gap-2.5 sm:gap-3">
        ${chip(opts.vacActive, "vacaciones", iconSvgVacaciones(), "Vacaciones", null)}
        ${hoBtn}
        ${permisoBtn}
      </div>
    </div>`;
}

export type SupervisorSolicitudSujeto = "personal" | "team";

function buildSupervisorSolicitudSubjectHtml(subject: SupervisorSolicitudSujeto): string {
  const personalOn = subject === "personal";
  const teamOn = subject === "team";
  const optBase =
    "flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3.5 text-left transition-[background-color,border-color,box-shadow] duration-200 ease-out has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-leoni-blue has-[:focus-visible]:ring-offset-2 sm:py-4";
  const inactive = `${optBase} border-slate-200/95 bg-white/70 hover:border-slate-300 hover:bg-white hover:shadow-sm`;
  const active = `${optBase} border-leoni-blue/40 bg-white shadow-md shadow-slate-900/[0.07] ring-[0.5px] ring-leoni-blue/35`;
  return `
    <fieldset class="${SEC_BOX} space-y-3" aria-describedby="rh-nr-sujeto-desc">
      <legend id="rh-nr-sec-sujeto" class="${SEC_TITLE}">Sujeto de la solicitud</legend>
      <p id="rh-nr-sujeto-desc" class="text-xs leading-relaxed text-slate-500">
        Define si registrarás tus propios días y permisos o los de un colaborador bajo tu mando directo (alcance habitual del supervisor en el sistema).
      </p>
      <div class="${NR_TIPO_LIST_WRAP}">
        <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
          <label class="${personalOn ? active : inactive}">
            <input
              type="radio"
              name="rh-nr-solicitud-sujeto"
              value="personal"
              class="mt-0.5 size-[1.125rem] shrink-0 accent-[var(--color-accent)]"
              ${personalOn ? "checked" : ""}
            />
            <span class="min-w-0 flex-1">
              <span class="block text-[13px] font-semibold leading-snug tracking-tight text-text-primary">Solicitud personal</span>
              <span class="mt-0.5 block text-[11px] font-medium leading-snug text-slate-500">Para tus vacaciones u horarios como colaborador</span>
            </span>
          </label>
          <label class="${teamOn ? active : inactive}">
            <input
              type="radio"
              name="rh-nr-solicitud-sujeto"
              value="team"
              class="mt-0.5 size-[1.125rem] shrink-0 accent-[var(--color-accent)]"
              ${teamOn ? "checked" : ""}
            />
            <span class="min-w-0 flex-1">
              <span class="block text-[13px] font-semibold leading-snug tracking-tight text-text-primary">Miembro del equipo</span>
              <span class="mt-0.5 block text-[11px] font-medium leading-snug text-slate-500">Registro en nombre de un colaborador</span>
            </span>
          </label>
        </div>
      </div>
    </fieldset>`;
}

export type RhNewRequestFormParams = {
  tipo:
    | "vacaciones"
    | "home_office"
    | "matrimonio"
    | "incapacidad_interna"
    | "defuncion"
    | "paternidad"
    | "permiso_sin_goce_sueldo";
  showPaidLeaveTypes?: boolean;
  showUnpaidLeaveType?: boolean;
  items: UsuarioListItem[];
  selectedEmpleadoId: string;
  empleadoSearchQ: string;
  fechaInicio: string;
  fechaFin: string;
  motivo: string;
  comentarios: string;
  diasLabel: string;
  infoHtml: string;
  resumenState: "neutral" | "valid" | "exceeded" | "error";
  resumenHint: string;
  fechaInInvalid: boolean;
  fechaFinInvalid: boolean;
  canSubmit: boolean;
  /** Sin selector: campo oculto `empleado_id` (portal o corrección de solicitud existente). */
  fixedEmpleado?: { directoryId: string; displayLine: string };
  /** Corrección tras `changes_requested`: tipo y empleado fijos; solo fechas y comentarios. */
  modoRevision?: boolean;
  submitLabel?: string;
  /** Empleado + Home Office: selección de un solo día (fecha_fin = fecha_inicio). */
  singleDayHomeOfficeMode?: boolean;
  /** Controla visibilidad del bloque de Motivo. */
  showMotivoField?: boolean;
  /** Radio personal vs equipo (solo supervisor). */
  showSupervisorSolicitudSubject?: boolean;
  supervisorSolicitudSubject?: SupervisorSolicitudSujeto;
  /** Reemplaza el texto de ayuda bajo titular fijo (p. ej. solicitud propia supervisor). */
  fixedEmpleadoAyudaOverride?: string;
  /** Texto del párrafo introductorio en la sección de búsqueda de empleado. */
  empleadoBusquedaAyuda?: string;
  /**
   * Si es true y `showUnpaidLeaveType`: ocultar chip «Permiso sin goce» (supervisor en solicitud personal).
   */
  supervisorOcultarPermisoSinGoceEnTipo?: boolean;
  /**
   * Supervisor en «Miembro del equipo»: no mostrar campo Motivo; solo comentarios (permiso sin goce se valida ahí).
   */
  omitMotivoCampoSupervisorEquipo?: boolean;
  /** Oculta Home Office cuando el colaborador no es Administrativo (roles distintos a RH). */
  showHomeOfficeType?: boolean;
};

export const RESUMEN_BASE =
  "rounded-2xl px-5 py-4 transition-colors duration-200 ring-1 ring-inset";

export const RESUMEN_STATE: Record<RhNewRequestFormParams["resumenState"], string> = {
  neutral:
    "bg-slate-50/90 ring-slate-200/70",
  valid:
    "bg-emerald-50/80 ring-emerald-200/60",
  exceeded:
    "bg-amber-50/90 ring-amber-200/70",
  error: "bg-red-50/80 ring-red-200/70",
};

export const RESUMEN_VALUE_CLASS: Record<RhNewRequestFormParams["resumenState"], string> = {
  neutral: "text-leoni-blue",
  valid: "text-emerald-800",
  exceeded: "text-amber-800",
  error: "text-red-700",
};

export function buildInfoVacacionesHtml(dias: number | null, diasSolicitados: number, fechasOk: boolean): string {
  const iconCal = `<div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-leoni-blue shadow-sm ring-1 ring-leoni-blue/15" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  </div>`;

  if (dias == null) {
    return `<div class="flex items-center gap-3 rounded-2xl border border-leoni-blue/15 bg-leoni-blue/[0.06] px-4 py-3 text-sm leading-snug text-slate-600">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5 shrink-0 text-leoni-blue" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
      </svg>
      <span>Selecciona un empleado para ver los días de vacaciones disponibles.</span>
    </div>`;
  }

  let secondary = "";
  if (fechasOk && diasSolicitados > 0) {
    const rest = dias - diasSolicitados;
    if (rest >= 0) {
      secondary = `<p class="mt-1.5 text-xs font-medium text-slate-500">Después de esta solicitud: <span class="tabular-nums text-slate-700">${rest}</span> días</p>`;
    } else {
      secondary = `<p class="mt-1.5 text-xs font-semibold text-amber-700">Después de esta solicitud: saldo insuficiente (${rest} días).</p>`;
    }
  }

  return `<div class="flex items-start gap-4 rounded-2xl border border-leoni-blue/15 bg-gradient-to-br from-leoni-blue/[0.07] to-slate-50/90 px-4 py-3.5">
    ${iconCal}
    <div class="min-w-0 flex-1">
      <p class="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Días disponibles</p>
      <p class="mt-1 text-3xl font-bold tabular-nums leading-none tracking-tight text-leoni-blue">${escapeHtml(String(dias))}</p>
      ${secondary}
    </div>
  </div>`;
}

export function buildInfoHomeOfficeHtml(text: string): string {
  return `<div class="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-3 text-sm leading-snug text-slate-600">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="mt-0.5 size-4 shrink-0 text-leoni-blue" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
    </svg>
    <span>${escapeHtml(text)}</span>
  </div>`;
}

export function buildFormHtml(p: RhNewRequestFormParams): string {
  const vacActive = p.tipo === "vacaciones";
  const hoActive = p.tipo === "home_office";
  const permisoSinGoceActive = p.tipo === "permiso_sin_goce_sueldo";
  const selfMode = Boolean(p.fixedEmpleado);
  const revision = Boolean(p.modoRevision);
  const formSelfAttr = Boolean(p.fixedEmpleado) ? ` data-rh-nr-self="1"` : "";
  const formRevisionAttr = revision ? ` data-rh-nr-revision="1"` : "";
  const formSupEquipoSinMotivoAttr = p.omitMotivoCampoSupervisorEquipo === true ? ` data-rh-nr-sup-equipo-sin-motivo="1"` : "";
  const tipoEtiquetaLectura =
    p.tipo === "vacaciones" ? "Vacaciones"
    : p.tipo === "home_office" ? "Home office"
    : p.tipo === "matrimonio" ? "Matrimonio"
    : p.tipo === "incapacidad_interna" ? "Incapacidad interna"
    : p.tipo === "defuncion" ? "Defunción"
    : p.tipo === "paternidad" ? "Paternidad"
    : "Permiso sin goce de sueldo";
  const submitLabel = p.submitLabel ?? "Enviar solicitud";
  const singleDayMode = p.singleDayHomeOfficeMode === true;
  const showMotivoField = p.showMotivoField !== false;
  const motivoValue = p.motivo ?? "";
  const comentariosValue = p.comentarios ?? "";
  const searchIcon = `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400">
    <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd" />
  </svg>`;

  const fiClass = `${CONTROL} font-medium tabular-nums ${p.fechaInInvalid ? CONTROL_INVALID : ""}`;
  const ffClass = `${CONTROL} font-medium tabular-nums ${p.fechaFinInvalid ? CONTROL_INVALID : ""}`;

  const empleadoAyudaFija =
    revision ?
      "El colaborador de la solicitud no puede cambiarse al corregir. Solo puedes ajustar fechas y comentarios."
    : "La solicitud queda registrada para tu usuario. No está permitido elegir otro colaborador.";
  const textoAyudaFijoEmpleado =
    revision ? empleadoAyudaFija : (p.fixedEmpleadoAyudaOverride?.trim() || empleadoAyudaFija);
  const empleadoTituloSeccion = revision ? "Colaborador de la solicitud" : "Solicitante";
  const empleadoSectionIntro =
    (p.empleadoBusquedaAyuda ?? "").trim() ||
    "Busca y selecciona la persona para la que registras la solicitud.";

  const supervisorSujetoSection =
    p.showSupervisorSolicitudSubject && !revision
      ? buildSupervisorSolicitudSubjectHtml(p.supervisorSolicitudSubject ?? "personal")
      : "";

  const empleadoBlock = selfMode
    ? `<section class="${SEC_BOX} space-y-3" aria-labelledby="rh-nr-sec-empleado">
        <h3 id="rh-nr-sec-empleado" class="${SEC_TITLE}">${escapeHtml(empleadoTituloSeccion)}</h3>
        <p class="text-sm font-medium text-slate-800">${escapeHtml(p.fixedEmpleado!.displayLine)}</p>
        <p class="text-xs text-slate-500">${escapeHtml(textoAyudaFijoEmpleado)}</p>
        <input type="hidden" name="empleado_id" id="rh-nr-empleado-id" value="${escapeHtml(p.fixedEmpleado!.directoryId)}" />
      </section>`
    : `<section class="${SEC_BOX} space-y-4" aria-labelledby="rh-nr-sec-empleado" data-rh-nr-empleado-section>
        <h3 id="rh-nr-sec-empleado" class="${SEC_TITLE}">Empleado</h3>
        <p class="text-xs text-slate-500">${escapeHtml(empleadoSectionIntro)}</p>
        <div class="space-y-3">
          <div>
            <label for="rh-nr-empleado-q" class="${LABEL}">Buscar empleado</label>
            <div class="relative">
              ${searchIcon}
              <input
                id="rh-nr-empleado-q"
                type="search"
                autocomplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded="false"
                aria-controls="rh-nr-empleado"
                data-rh-nr-empleado-search
                placeholder="Nombre o número de empleado…"
                value="${escapeHtml(p.empleadoSearchQ)}"
                class="${CONTROL} pl-10"
              />
            </div>
          </div>
          <div>
            <label for="rh-nr-empleado" class="${LABEL}">Empleado seleccionado</label>
            <div class="grid grid-cols-1">
              <select id="rh-nr-empleado" name="empleado_id" required class="col-start-1 row-start-1 ${CONTROL} cursor-pointer appearance-none pr-10 font-medium">
                ${buildEmpleadoOptions(p.items, p.selectedEmpleadoId)}
              </select>
              ${NR_SELECT_CHEVRON}
            </div>
          </div>
        </div>
      </section>`;

  const revisionCallout = revision
    ? `<div class="rounded-xl border border-amber-200/90 bg-amber-50/95 px-4 py-3.5 text-sm text-amber-950 shadow-sm shadow-amber-900/5" role="status">
        <p class="text-[11px] font-bold uppercase tracking-[0.08em] text-amber-800/90">Cambios solicitados</p>
        <p class="mt-1.5 text-[13px] leading-relaxed text-amber-950/95">
          Tu aprobador devolvió la solicitud para que la corrijas. Solo tú puedes editarla en este estado.
          Ajusta las fechas o los comentarios y usa <strong class="font-semibold">Guardar y reenviar</strong> para volver a enviarla a aprobación.
        </p>
      </div>`
    : "";

  const pieFlujo = revision
    ? `<p class="text-xs leading-relaxed text-slate-600">
        Al confirmar, la solicitud pasa a <strong class="font-semibold text-slate-800">pendiente de aprobación</strong> y se notifica a tu supervisor para una nueva revisión.
      </p>`
    : `<p class="text-xs leading-relaxed text-slate-500">La solicitud será registrada en el sistema y seguirá el flujo correspondiente.</p>`;

  const chipIncluyePermisoSinGoce =
    p.showUnpaidLeaveType === true && p.supervisorOcultarPermisoSinGoceEnTipo !== true;
  const showHomeOfficeType = p.showHomeOfficeType !== false;

  const avisoTipoSupervisorSinPermisoSinGoce =
    p.showSupervisorSolicitudSubject &&
    !revision &&
    p.supervisorSolicitudSubject === "personal" &&
    p.showUnpaidLeaveType &&
    !p.showPaidLeaveTypes
      ? `<p class="mt-1.5 text-xs leading-relaxed text-slate-500">
          En solicitud personal solo puedes usar <strong class="font-medium text-slate-700">Vacaciones</strong>${
            showHomeOfficeType
              ? ` u <strong class="font-medium text-slate-700">Home Office</strong>`
              : ""
          }. El permiso sin goce solo aplica al registrar una solicitud para un miembro del equipo.
        </p>`
      : "";

  return `
    <form id="rh-nr-form" class="space-y-8" novalidate${formSelfAttr}${formRevisionAttr}${formSupEquipoSinMotivoAttr}>
    <p id="rh-nr-error" class="hidden rounded-xl border border-red-200/90 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert" aria-live="assertive"></p>
    ${revisionCallout}

      ${supervisorSujetoSection}

      <section class="space-y-3" aria-labelledby="rh-nr-sec-tipo">
        <div>
          <h3 id="rh-nr-sec-tipo" class="${SEC_TITLE}">Tipo de solicitud</h3>
          ${avisoTipoSupervisorSinPermisoSinGoce}
        </div>
        ${
          revision ?
            `<div class="rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-3.5 shadow-sm">
          <p class="text-sm font-semibold text-slate-900">${escapeHtml(tipoEtiquetaLectura)}</p>
          <p class="mt-1 text-xs text-slate-500">No se puede modificar el tipo al corregir una solicitud existente.</p>
        </div>`
          : p.showPaidLeaveTypes ?
            `<div class="space-y-3">
          <p class="text-xs text-slate-500">Solicitudes estándar y con goce de sueldo (solo RH).</p>
          <div class="grid grid-cols-1">
            <select id="rh-nr-tipo-select" data-rh-nr-tipo-select class="col-start-1 row-start-1 ${CONTROL} cursor-pointer appearance-none pr-10 font-medium">
              <optgroup label="Solicitudes estándar">
                <option value="vacaciones" ${p.tipo === "vacaciones" ? "selected" : ""}>Vacaciones</option>
                ${
                  showHomeOfficeType
                    ? `<option value="home_office" ${p.tipo === "home_office" ? "selected" : ""}>Home Office</option>`
                    : ""
                }
                ${
                  p.showUnpaidLeaveType
                    ? `<option value="permiso_sin_goce_sueldo" ${p.tipo === "permiso_sin_goce_sueldo" ? "selected" : ""}>Permiso sin goce de sueldo</option>`
                    : ""
                }
              </optgroup>
              <optgroup label="Solicitudes con goce de sueldo">
                <option value="matrimonio" ${p.tipo === "matrimonio" ? "selected" : ""}>Matrimonio (2 días)</option>
                <option value="incapacidad_interna" ${p.tipo === "incapacidad_interna" ? "selected" : ""}>Incapacidad interna (duración RH)</option>
                <option value="defuncion" ${p.tipo === "defuncion" ? "selected" : ""}>Defunción (3 días)</option>
                <option value="paternidad" ${p.tipo === "paternidad" ? "selected" : ""}>Paternidad (7 días hábiles)</option>
              </optgroup>
            </select>
            ${NR_SELECT_CHEVRON}
          </div>
        </div>`
          : p.showUnpaidLeaveType ?
            `${buildRhTipoChipRowHtml({
              vacActive,
              hoActive,
              permisoActive: permisoSinGoceActive,
              showPermisoSinGoce: chipIncluyePermisoSinGoce,
              showHomeOffice: showHomeOfficeType,
            })}`
          : `${buildRhTipoChipRowHtml({
              vacActive,
              hoActive,
              permisoActive: permisoSinGoceActive,
              showPermisoSinGoce: false,
              showHomeOffice: showHomeOfficeType,
            })}`
        }
      </section>

      <section class="space-y-3" aria-labelledby="rh-nr-sec-disponibilidad">
        <h3 id="rh-nr-sec-disponibilidad" class="${SEC_TITLE}">Disponibilidad</h3>
        <div id="rh-nr-info-card">${p.infoHtml}</div>
      </section>

      ${empleadoBlock}

      <section class="${SEC_BOX} space-y-4" aria-labelledby="rh-nr-sec-fechas">
        <h3 id="rh-nr-sec-fechas" class="${SEC_TITLE}">Rango de fechas</h3>
        <p class="text-xs text-slate-500">
          ${
            singleDayMode ?
              "Para Home Office se permite seleccionar únicamente un día."
            : "Define el periodo cubierto por la solicitud. Ambas fechas forman un solo rango."
          }
        </p>
        ${
          singleDayMode ?
            `<div class="grid grid-cols-1 gap-5">
              <div>
                <label for="rh-nr-inicio" class="${LABEL}">Fecha</label>
                <input id="rh-nr-inicio" name="fecha_inicio" type="date" required class="${fiClass}" value="${escapeHtml(p.fechaInicio)}" aria-invalid="${p.fechaInInvalid}" />
                <input id="rh-nr-fin" name="fecha_fin" type="hidden" value="${escapeHtml(p.fechaInicio)}" />
              </div>
            </div>`
          : `<div class="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
              <div>
                <label for="rh-nr-inicio" class="${LABEL}">Fecha de inicio</label>
                <input id="rh-nr-inicio" name="fecha_inicio" type="date" required class="${fiClass}" value="${escapeHtml(p.fechaInicio)}" aria-invalid="${p.fechaInInvalid}" />
              </div>
              <div>
                <label for="rh-nr-fin" class="${LABEL}">Fecha de fin</label>
                <input id="rh-nr-fin" name="fecha_fin" type="date" required class="${ffClass}" value="${escapeHtml(p.fechaFin)}" aria-invalid="${p.fechaFinInvalid}" />
              </div>
            </div>`
        }
      </section>

      <section class="space-y-2" aria-labelledby="rh-nr-sec-resumen">
        <h3 id="rh-nr-sec-resumen" class="${SEC_TITLE}">Resumen de la solicitud</h3>
        <div id="rh-nr-resumen" data-state="${p.resumenState}" class="${RESUMEN_BASE} ${RESUMEN_STATE[p.resumenState]}" role="status" aria-live="polite">
          <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <span class="text-sm font-medium text-slate-600">Total de días solicitados</span>
            <span id="rh-nr-dias" class="text-2xl font-bold tabular-nums tracking-tight sm:text-3xl ${RESUMEN_VALUE_CLASS[p.resumenState]}">${escapeHtml(p.diasLabel)}</span>
          </div>
          <p id="rh-nr-resumen-hint" class="mt-2 text-xs leading-relaxed text-slate-600 ${p.resumenHint ? "" : "hidden"}">${escapeHtml(p.resumenHint)}</p>
        </div>
      </section>

      ${
        showMotivoField ?
          `<section class="space-y-2" aria-labelledby="rh-nr-sec-motivo">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <h3 id="rh-nr-sec-motivo" class="${SEC_TITLE} !mb-0">Motivo</h3>
              <span class="text-[10px] font-medium uppercase tracking-wide text-slate-400">${p.tipo === "permiso_sin_goce_sueldo" ? "Obligatorio" : "Opcional"}</span>
            </div>
            <textarea
              id="rh-nr-motivo"
              name="motivo"
              rows="3"
              ${p.tipo === "permiso_sin_goce_sueldo" ? "required" : ""}
              placeholder="Describe el motivo de la solicitud…"
              aria-describedby="rh-nr-motivo-help"
              class="min-h-[6rem] w-full resize-y rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-900 shadow-sm shadow-slate-900/[0.03] transition-[border-color,box-shadow] duration-200 placeholder:text-slate-400/65 hover:border-slate-300 focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/20"
            >${escapeHtml(motivoValue)}</textarea>
            <p id="rh-nr-motivo-help" class="text-xs text-slate-500">Especifica la justificación principal del permiso.</p>
          </section>`
        : `<input type="hidden" id="rh-nr-motivo" name="motivo" value="${escapeHtml(motivoValue)}" />`
      }

      <section class="space-y-2" aria-labelledby="rh-nr-sec-comentarios">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="rh-nr-sec-comentarios" class="${SEC_TITLE} !mb-0">Comentarios</h3>
          <span class="text-[10px] font-medium uppercase tracking-wide text-slate-400">${
            p.omitMotivoCampoSupervisorEquipo === true && p.tipo === "permiso_sin_goce_sueldo" ? "Obligatorio" : "Opcional"
          }</span>
        </div>
        <textarea
          id="rh-nr-comentarios"
          name="comentarios"
          rows="5"
          ${p.omitMotivoCampoSupervisorEquipo === true && p.tipo === "permiso_sin_goce_sueldo" ? "required" : ""}
          placeholder="${
            p.omitMotivoCampoSupervisorEquipo === true && p.tipo === "permiso_sin_goce_sueldo" ?
              "Describe el contexto y la justificación del permiso para el colaborador…"
            : "Agrega notas adicionales sobre esta solicitud…"
          }"
          aria-describedby="rh-nr-comentarios-help"
          class="min-h-[7.5rem] w-full resize-y rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-900 shadow-sm shadow-slate-900/[0.03] transition-[border-color,box-shadow] duration-200 placeholder:text-slate-400/65 hover:border-slate-300 focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/20"
        >${escapeHtml(comentariosValue)}</textarea>
        <p id="rh-nr-comentarios-help" class="text-xs text-slate-500">${
          p.omitMotivoCampoSupervisorEquipo === true && p.tipo === "permiso_sin_goce_sueldo" ?
            "En solicitudes de equipo, el contexto del permiso sin goce se registra solo aquí."
          : "Agrega notas adicionales sobre esta solicitud si el contexto lo requiere."
        }</p>
      </section>

      <div class="flex gap-2.5 rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="mt-0.5 size-3.5 shrink-0 text-slate-400 opacity-80" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
        </svg>
        ${pieFlujo}
      </div>

      <footer class="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end sm:gap-3">
        <button type="button" data-rh-nr-close class="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 sm:w-auto">
          Cancelar
        </button>
        <button type="submit" id="rh-nr-submit" ${p.canSubmit ? "" : "disabled"} class="min-h-11 w-full rounded-xl bg-leoni-blue px-6 text-sm font-semibold text-white shadow-md shadow-leoni-blue/20 transition-[background-color,box-shadow,opacity] duration-200 hover:bg-leoni-blue-light hover:shadow-lg hover:shadow-leoni-blue/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 sm:w-auto">
          ${escapeHtml(submitLabel)}
        </button>
      </footer>
    </form>`;
}

export type RhModalComputedUi = {
  resumenState: RhNewRequestFormParams["resumenState"];
  resumenHint: string;
  diasLabel: string;
  fechaInInvalid: boolean;
  fechaFinInvalid: boolean;
  canSubmit: boolean;
};

export function computeRhModalFormUi(
  tipo:
    | "vacaciones"
    | "home_office"
    | "matrimonio"
    | "incapacidad_interna"
    | "defuncion"
    | "paternidad"
    | "permiso_sin_goce_sueldo",
  contextoVac: number | null,
  selectedEmpleadoId: string,
  fechaInicio: string,
  fechaFin: string,
  motivo: string,
  empleadoSelectorOmitted = false,
  comentarios = "",
  permisoSinGoceMotivoViaComentarios = false,
): RhModalComputedUi {
  const dias = calcularDiasSolicitadosInclusive(fechaInicio, fechaFin);
  const bothDates = Boolean(fechaInicio.trim() && fechaFin.trim());
  const fechasOk = fechasOrdenValidas(fechaInicio, fechaFin);
  const fechaInInvalid = bothDates && !fechasOk;
  const fechaFinInvalid = fechaInInvalid;

  const diasLabel =
    dias <= 0 && (fechaInicio.trim() || fechaFin.trim()) ? "—" : `${dias} ${dias === 1 ? "día" : "días"}`;

  let resumenState: RhNewRequestFormParams["resumenState"] = "neutral";
  let resumenHint = "";

  if (bothDates && !fechasOk) {
    resumenState = "error";
    resumenHint = "La fecha de fin debe ser igual o posterior a la de inicio.";
  } else if (bothDates && dias <= 0) {
    resumenState = "error";
    resumenHint = "El rango debe incluir al menos un día calendario.";
  } else if (tipo === "vacaciones" && contextoVac != null && dias > 0 && dias > contextoVac) {
    resumenState = "exceeded";
    resumenHint = empleadoSelectorOmitted
      ? `Esta solicitud supera los ${contextoVac} días disponibles en tu saldo.`
      : `Esta solicitud supera los ${contextoVac} días disponibles para el empleado seleccionado.`;
  } else if (dias > 0 && fechasOk) {
    resumenState = "valid";
    if (tipo === "vacaciones" && contextoVac != null) {
      const rest = contextoVac - dias;
      resumenHint =
        rest >= 0
          ? `Tras esta solicitud quedarían ${rest} día${rest === 1 ? "" : "s"} de vacaciones.`
          : "El saldo de vacaciones quedaría en negativo con este rango.";
    } else {
      resumenHint = "";
    }
  }

  const empOk = empleadoSelectorOmitted || selectedEmpleadoId.trim() !== "";
  const motivoOk =
    tipo !== "permiso_sin_goce_sueldo" ?
      true
    : permisoSinGoceMotivoViaComentarios ?
      comentarios.trim().length > 0
    : motivo.trim().length > 0;
  const canSubmit =
    empOk &&
    bothDates &&
    fechasOk &&
    dias > 0 &&
    motivoOk &&
    !(tipo === "vacaciones" && contextoVac != null && dias > contextoVac);

  return {
    resumenState,
    resumenHint,
    diasLabel,
    fechaInInvalid,
    fechaFinInvalid,
    canSubmit,
  };
}

/** Actualiza resumen, hints, bordes de fechas y estado del botón enviar sin re-renderizar el formulario. */
export function applyRhModalLiveFeedback(
  modalHost: HTMLElement,
  tipo:
    | "vacaciones"
    | "home_office"
    | "matrimonio"
    | "incapacidad_interna"
    | "defuncion"
    | "paternidad"
    | "permiso_sin_goce_sueldo",
  contextoVac: number | null,
): void {
  /** Empleado fijo: portal o corrección (hidden sin `<select>`). */
  const selfMode =
    modalHost.querySelector("#rh-nr-form[data-rh-nr-self]") != null ||
    (modalHost.querySelector("#rh-nr-empleado-id") != null &&
      modalHost.querySelector("#rh-nr-empleado") == null);
  const sel = modalHost.querySelector("#rh-nr-empleado") as HTMLSelectElement | null;
  const hid = modalHost.querySelector("#rh-nr-empleado-id") as HTMLInputElement | null;
  const fi = modalHost.querySelector("#rh-nr-inicio") as HTMLInputElement | null;
  const ff = modalHost.querySelector("#rh-nr-fin") as HTMLInputElement | null;
  const motivo = modalHost.querySelector("#rh-nr-motivo") as HTMLTextAreaElement | null;
  const comentariosEl = modalHost.querySelector("#rh-nr-comentarios") as HTMLTextAreaElement | null;
  const formEl = modalHost.querySelector("#rh-nr-form") as HTMLFormElement | null;
  if (!fi || !ff) return;

  const empVal = selfMode ? (hid?.value ?? "") : (sel?.value ?? "");
  const permisoViaComentarios = formEl?.hasAttribute("data-rh-nr-sup-equipo-sin-motivo") === true;

  const ui = computeRhModalFormUi(
    tipo,
    contextoVac,
    empVal,
    fi.value,
    ff.value,
    motivo?.value ?? "",
    selfMode,
    comentariosEl?.value ?? "",
    permisoViaComentarios,
  );

  fi.className = `${CONTROL} font-medium tabular-nums ${ui.fechaInInvalid ? CONTROL_INVALID : ""}`;
  ff.className = `${CONTROL} font-medium tabular-nums ${ui.fechaFinInvalid ? CONTROL_INVALID : ""}`;

  const diasEl = modalHost.querySelector("#rh-nr-dias");
  if (diasEl) {
    diasEl.textContent = ui.diasLabel;
    diasEl.className = `text-2xl font-bold tabular-nums tracking-tight sm:text-3xl ${RESUMEN_VALUE_CLASS[ui.resumenState]}`;
  }

  const resumen = modalHost.querySelector("#rh-nr-resumen") as HTMLElement | null;
  if (resumen) {
    resumen.dataset.state = ui.resumenState;
    resumen.className = `${RESUMEN_BASE} ${RESUMEN_STATE[ui.resumenState]}`;
    resumen.setAttribute("role", "status");
  }

  const hintEl = modalHost.querySelector("#rh-nr-resumen-hint") as HTMLElement | null;
  if (hintEl) {
    if (ui.resumenHint) {
      hintEl.textContent = ui.resumenHint;
      const tone =
        ui.resumenState === "error"
          ? "font-medium text-red-700"
          : ui.resumenState === "exceeded"
            ? "font-medium text-amber-800"
            : "text-slate-600";
      hintEl.className = `mt-2 text-xs leading-relaxed ${tone}`;
    } else {
      hintEl.textContent = "";
      hintEl.className = "mt-2 hidden text-xs leading-relaxed text-slate-600";
    }
  }

  const submit = modalHost.querySelector("#rh-nr-submit") as HTMLButtonElement | null;
  const busyLabel = submit?.textContent === "Enviando…" || submit?.textContent === "Reenviando…";
  if (submit && !busyLabel) {
    submit.disabled = !ui.canSubmit;
  }

  fi.setAttribute("aria-invalid", String(ui.fechaInInvalid));
  ff.setAttribute("aria-invalid", String(ui.fechaFinInvalid));
}
