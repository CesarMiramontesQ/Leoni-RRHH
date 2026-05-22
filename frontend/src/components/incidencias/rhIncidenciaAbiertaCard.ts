/**
 * Tarjeta detallada para incidencias no cerradas (layout tipo referencia RH).
 */

import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import type { RhIncidenciaTablaFila } from "../../incidencias/rh/types.ts";
import { labelTipoIncidenciaUi } from "../../incidencias/rh/tipoIncidenciaDisplay.ts";
import {
  formatNombreEmpleadoIncidenciasUi,
  inicialesDesdeNombreDisplay,
} from "../../utils/nombreEmpleadoDisplay.ts";
import { escapeIncHtml } from "./rhIncidenciasUiUtils.ts";
import { fmtFechaLargaEsMx } from "../../ui/uiUtils.ts";

function dash(s: string | null | undefined): string {
  const t = s?.trim();
  return t && t.length > 0 ? t : "—";
}

function avatarHtml(foto: string | null | undefined, nombreDisplay: string, sizeCls: string): string {
  const ini = inicialesDesdeNombreDisplay(nombreDisplay);
  const fotoT = foto?.trim();
  if (fotoT) {
    return `<img src="${escapeIncHtml(fotoT)}" alt="" class="${sizeCls} shrink-0 rounded-xl object-cover ring-2 ring-white shadow-sm" />`;
  }
  return `<span class="flex ${sizeCls} shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-sm font-bold text-emerald-900 ring-2 ring-white shadow-sm">${escapeIncHtml(ini)}</span>`;
}

function seccionTitulo(iconSvg: string, titulo: string): string {
  return `<div class="mb-4 flex items-center gap-2.5 border-b border-slate-100 pb-3">
    <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-leoni-blue/10 text-leoni-blue" aria-hidden="true">${iconSvg}</span>
    <h3 class="text-xs font-bold uppercase tracking-[0.12em] text-slate-800">${escapeIncHtml(titulo)}</h3>
  </div>`;
}

const ICON_USER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-[1.1rem]"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>`;
const ICON_ALERT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-[1.1rem]"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>`;

function campoEtiqueta(label: string, valor: string, valorExtraCls = ""): string {
  return `<div class="min-w-0">
    <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">${escapeIncHtml(label)}</p>
    <p class="mt-0.5 text-sm font-semibold text-slate-900 ${valorExtraCls}">${valor}</p>
  </div>`;
}

function miniCampoDetalle(label: string, valor: string): string {
  return `<div class="min-w-0 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 ring-1 ring-slate-900/[0.03]">
    <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">${escapeIncHtml(label)}</p>
    <p class="mt-1 break-words text-sm font-bold text-slate-900">${escapeIncHtml(valor)}</p>
  </div>`;
}

function fmtSemanaUi(_row: RhIncidenciaTablaFila): string {
  return "—";
}

/** Contenido scrollable del modal de detalle. */
function buildRhIncidenciaDetalleInnerHtml(row: RhIncidenciaTablaFila): string {
  const nombre = formatNombreEmpleadoIncidenciasUi(row.empleado_nombre_raw) || INC_COPY.sinNombre;
  const noEmpleado = dash(row.no_empleado);
  const areaRep = dash(row.area);
  const subareaRep = dash(row.subarea);
  const puestoRep = dash(row.puesto?.trim() || row.puesto_empleado?.trim());
  const supRaw = row.supervisor_directo?.trim() || row.supervisor_nombre?.trim();
  const supervisorRep = supRaw
    ? formatNombreEmpleadoIncidenciasUi(supRaw) || dash(supRaw)
    : "—";
  const nombreHtml = escapeIncHtml(nombre);
  const noEmpleadoHtml = escapeIncHtml(noEmpleado);

  const gridCamposReportante = `
    <div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
      ${campoEtiqueta(INC_COPY.cardLblNombre, nombreHtml)}
      ${campoEtiqueta(INC_COPY.cardLblNoEmpleado, `<span class="text-leoni-blue">${noEmpleadoHtml}</span>`)}
      ${campoEtiqueta(INC_COPY.cardLblArea, escapeIncHtml(areaRep))}
      ${campoEtiqueta(INC_COPY.cardLblSubarea, escapeIncHtml(subareaRep))}
      ${campoEtiqueta(INC_COPY.cardLblPuesto, escapeIncHtml(puestoRep))}
      ${campoEtiqueta(INC_COPY.cardLblSupervisor, escapeIncHtml(supervisorRep))}
    </div>`;

  const tipoUi = labelTipoIncidenciaUi(row.tipo_texto?.trim() || String(row.tipo));
  const fechaUi = fmtFechaLargaEsMx(row.fecha);
  const semanaUi = fmtSemanaUi(row);
  const areaInc = dash(row.area);
  const subareaInc = dash(row.subarea);

  const gridDetalle = `
    <div class="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
      ${miniCampoDetalle(INC_COPY.cardLblTipo, tipoUi)}
      ${miniCampoDetalle(INC_COPY.colFecha, fechaUi)}
      ${miniCampoDetalle(INC_COPY.cardLblSemana, semanaUi)}
      ${miniCampoDetalle(INC_COPY.cardLblArea, areaInc)}
      ${miniCampoDetalle(INC_COPY.cardLblSubarea, subareaInc)}
    </div>`;

  const detalleTexto = dash(row.detalle?.trim() || row.descripcion?.trim());

  const detalleBloque = `
    <div class="mt-5 w-full min-w-0">
      <p class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">${escapeIncHtml(INC_COPY.colDetalle)}</p>
      <div class="w-full max-w-none rounded-r-xl border-l-4 border-leoni-blue bg-sky-50/50 px-4 py-3.5 text-sm leading-relaxed text-slate-800 ring-1 ring-slate-900/[0.04]">
        ${escapeIncHtml(detalleTexto)}
      </div>
    </div>`;

  return `
        <article class="mx-auto w-full max-w-[1200px] px-2 py-2 sm:px-3 sm:py-3">
          <div class="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.04] sm:p-6">
            <div class="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
              ${seccionTitulo(ICON_USER, INC_COPY.cardReportante)}
              <div class="flex flex-col gap-6 lg:flex-row lg:items-start">
                <div class="flex justify-center lg:justify-start">
                  ${avatarHtml(row.foto_url, nombre, "size-24 sm:size-28")}
                </div>
                ${gridCamposReportante}
              </div>
            </div>

            <div class="mt-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:mt-5 sm:p-5">
              <div class="mb-4 flex w-full min-w-0 border-b border-slate-100 pb-3">
                <div class="flex min-w-0 flex-1 items-center gap-2.5">
                  <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-leoni-blue/10 text-leoni-blue" aria-hidden="true">${ICON_ALERT}</span>
                  <h3 class="min-w-0 text-xs font-bold uppercase tracking-[0.12em] text-slate-800">${escapeIncHtml(INC_COPY.cardDetalle)}</h3>
                </div>
              </div>
              <div class="w-full min-w-0">
                ${gridDetalle}
                ${detalleBloque}
              </div>
            </div>
          </div>
        </article>`;
}

/** HTML del cuerpo del modal de detalle. */
export function renderRhIncidenciaDetalleModalBody(row: RhIncidenciaTablaFila): string {
  return buildRhIncidenciaDetalleInnerHtml(row);
}
