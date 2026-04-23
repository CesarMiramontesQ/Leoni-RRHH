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

const TAB_BASE =
  "flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2";

const TAB_ACTIVE = `${TAB_BASE} bg-white text-leoni-blue shadow-md shadow-slate-900/10 ring-1 ring-slate-200/80`;

const TAB_INACTIVE = `${TAB_BASE} text-slate-500 hover:bg-white/70 hover:text-slate-800`;

export function shellHtml(): string {
  return `
    <div
      id="rh-nr-overlay"
      class="fixed inset-0 z-[60] hidden items-center justify-center bg-slate-900/40 p-4 sm:p-5 backdrop-blur-[3px]"
      role="presentation"
    >
      <div
        class="flex max-h-[min(92vh,880px)] w-full max-w-[26rem] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_20px_50px_-16px_rgba(15,23,42,0.18)] [color-scheme:light] sm:max-w-lg"
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

function iconVacaciones(active: boolean): string {
  const cls = active ? "text-leoni-blue" : "text-slate-400";
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-[1.15rem] shrink-0 ${cls}" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Z" />
  </svg>`;
}

function iconHome(active: boolean): string {
  const cls = active ? "text-leoni-blue" : "text-slate-400";
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-[1.15rem] shrink-0 ${cls}" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125h4.125v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
  </svg>`;
}

export type RhNewRequestFormParams = {
  tipo: "vacaciones" | "home_office";
  items: UsuarioListItem[];
  selectedEmpleadoId: string;
  empleadoSearchQ: string;
  fechaInicio: string;
  fechaFin: string;
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
  const selfMode = Boolean(p.fixedEmpleado);
  const revision = Boolean(p.modoRevision);
  const formSelfAttr = Boolean(p.fixedEmpleado) ? ` data-rh-nr-self="1"` : "";
  const formRevisionAttr = revision ? ` data-rh-nr-revision="1"` : "";
  const tipoEtiquetaLectura = vacActive ? "Vacaciones" : "Home office";
  const submitLabel = p.submitLabel ?? "Enviar solicitud";
  const searchIcon = `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400">
    <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd" />
  </svg>`;

  const fiClass = `${CONTROL} font-medium tabular-nums ${p.fechaInInvalid ? CONTROL_INVALID : ""}`;
  const ffClass = `${CONTROL} font-medium tabular-nums ${p.fechaFinInvalid ? CONTROL_INVALID : ""}`;

  const empleadoAyudaFija =
    revision ?
      "El colaborador de la solicitud no puede cambiarse al corregir. Solo puedes ajustar fechas y comentarios."
    : "La solicitud queda registrada para tu usuario. No está permitido elegir otro colaborador.";
  const empleadoTituloSeccion = revision ? "Colaborador de la solicitud" : "Solicitante";

  const empleadoBlock = selfMode
    ? `<section class="${SEC_BOX} space-y-3" aria-labelledby="rh-nr-sec-empleado">
        <h3 id="rh-nr-sec-empleado" class="${SEC_TITLE}">${escapeHtml(empleadoTituloSeccion)}</h3>
        <p class="text-sm font-medium text-slate-800">${escapeHtml(p.fixedEmpleado!.displayLine)}</p>
        <p class="text-xs text-slate-500">${escapeHtml(empleadoAyudaFija)}</p>
        <input type="hidden" name="empleado_id" id="rh-nr-empleado-id" value="${escapeHtml(p.fixedEmpleado!.directoryId)}" />
      </section>`
    : `<section class="${SEC_BOX} space-y-4" aria-labelledby="rh-nr-sec-empleado" data-rh-nr-empleado-section>
        <h3 id="rh-nr-sec-empleado" class="${SEC_TITLE}">Empleado</h3>
        <p class="text-xs text-slate-500">Busca y selecciona la persona para la que registras la solicitud.</p>
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

  return `
    <form id="rh-nr-form" class="space-y-8" novalidate${formSelfAttr}${formRevisionAttr}>
    <p id="rh-nr-error" class="hidden rounded-xl border border-red-200/90 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert" aria-live="assertive"></p>
    ${revisionCallout}

      <section class="space-y-3" aria-labelledby="rh-nr-sec-tipo">
        <h3 id="rh-nr-sec-tipo" class="${SEC_TITLE}">Tipo de solicitud</h3>
        ${
          revision ?
            `<div class="rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-3.5 shadow-sm">
          <p class="text-sm font-semibold text-slate-900">${escapeHtml(tipoEtiquetaLectura)}</p>
          <p class="mt-1 text-xs text-slate-500">No se puede modificar el tipo al corregir una solicitud existente.</p>
        </div>`
          : `<div class="flex gap-1.5 rounded-2xl bg-slate-100/95 p-1.5 ring-1 ring-slate-200/60" role="tablist">
          <button type="button" role="tab" aria-selected="${vacActive}" data-rh-nr-tipo="vacaciones" class="${vacActive ? TAB_ACTIVE : TAB_INACTIVE}">
            ${iconVacaciones(vacActive)}
            <span>Vacaciones</span>
          </button>
          <button type="button" role="tab" aria-selected="${hoActive}" data-rh-nr-tipo="home_office" class="${hoActive ? TAB_ACTIVE : TAB_INACTIVE}">
            ${iconHome(hoActive)}
            <span>Home Office</span>
          </button>
        </div>`
        }
      </section>

      <section class="space-y-3" aria-labelledby="rh-nr-sec-disponibilidad">
        <h3 id="rh-nr-sec-disponibilidad" class="${SEC_TITLE}">Disponibilidad</h3>
        <div id="rh-nr-info-card">${p.infoHtml}</div>
      </section>

      ${empleadoBlock}

      <section class="${SEC_BOX} space-y-4" aria-labelledby="rh-nr-sec-fechas">
        <h3 id="rh-nr-sec-fechas" class="${SEC_TITLE}">Rango de fechas</h3>
        <p class="text-xs text-slate-500">Define el periodo cubierto por la solicitud. Ambas fechas forman un solo rango.</p>
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
          <div>
            <label for="rh-nr-inicio" class="${LABEL}">Fecha de inicio</label>
            <input id="rh-nr-inicio" name="fecha_inicio" type="date" required class="${fiClass}" value="${escapeHtml(p.fechaInicio)}" aria-invalid="${p.fechaInInvalid}" />
          </div>
          <div>
            <label for="rh-nr-fin" class="${LABEL}">Fecha de fin</label>
            <input id="rh-nr-fin" name="fecha_fin" type="date" required class="${ffClass}" value="${escapeHtml(p.fechaFin)}" aria-invalid="${p.fechaFinInvalid}" />
          </div>
        </div>
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

      <section class="space-y-2" aria-labelledby="rh-nr-sec-comentarios">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="rh-nr-sec-comentarios" class="${SEC_TITLE} !mb-0">Comentarios</h3>
          <span class="text-[10px] font-medium uppercase tracking-wide text-slate-400">Opcional</span>
        </div>
        <textarea
          id="rh-nr-comentarios"
          name="comentarios"
          rows="5"
          placeholder="Agrega notas adicionales sobre esta solicitud…"
          aria-describedby="rh-nr-comentarios-help"
          class="min-h-[7.5rem] w-full resize-y rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-900 shadow-sm shadow-slate-900/[0.03] transition-[border-color,box-shadow] duration-200 placeholder:text-slate-400/65 hover:border-slate-300 focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/20"
        >${escapeHtml(p.comentarios)}</textarea>
        <p id="rh-nr-comentarios-help" class="text-xs text-slate-500">Agrega notas adicionales sobre esta solicitud si el contexto lo requiere.</p>
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
  tipo: "vacaciones" | "home_office",
  contextoVac: number | null,
  selectedEmpleadoId: string,
  fechaInicio: string,
  fechaFin: string,
  empleadoSelectorOmitted = false,
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
  const canSubmit =
    empOk &&
    bothDates &&
    fechasOk &&
    dias > 0 &&
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
  tipo: "vacaciones" | "home_office",
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
  if (!fi || !ff) return;

  const empVal = selfMode ? (hid?.value ?? "") : (sel?.value ?? "");

  const ui = computeRhModalFormUi(tipo, contextoVac, empVal, fi.value, ff.value, selfMode);

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
