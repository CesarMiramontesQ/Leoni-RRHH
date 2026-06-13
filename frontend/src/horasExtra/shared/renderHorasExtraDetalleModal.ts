import type { HorasExtraSolicitudResponse } from "../../api/horasExtraSolicitud.ts";
import {
  badgeApproved,
  badgeCancelled,
  badgePending,
  badgeRejected,
  BTN_SECONDARY,
} from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import {
  buildDiasColumnasHoras,
  formatHorasCaptura,
  tipoLabel,
  type DiaColumnaHoras,
} from "../supervisor/renderHorasExtraSolicitudPage.ts";

export type HorasExtraDetalleModalState = {
  detalle: HorasExtraSolicitudResponse | null;
  status: "idle" | "loading" | "error";
  error?: string;
};

export type HorasExtraDetalleModalConfig = {
  backdropId: string;
  titleId: string;
  closeDataAttr: string;
};

const DETALLE_RESUMEN_CARD =
  "rounded-xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50/70 px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-5";
const DETALLE_SECTION_CARD =
  "rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-5";
const DETALLE_META_LABEL =
  "text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500";
const DETALLE_HORA_BADGE_ACTIVE =
  "inline-flex min-w-[2.5rem] items-center justify-center rounded px-2 py-1 text-sm font-semibold tabular-nums bg-[rgba(37,99,235,0.10)] text-[#2563EB]";
const DETALLE_HORA_BADGE_EMPTY =
  "inline-flex min-w-[2.5rem] items-center justify-center rounded px-2 py-1 text-sm font-medium tabular-nums bg-slate-50 text-slate-400";
const DETALLE_HORAS_TABLE =
  "w-full min-w-0 table-fixed divide-y divide-slate-100 text-center";
const HORAS_GRID_SCROLL =
  "max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-slate-200/90 bg-white";
const HORAS_GRID_TOTAL_COL = "bg-slate-100/90";

type DetalleFilaHoras = {
  lunes: string;
  martes: string;
  miercoles: string;
  jueves: string;
  viernes: string;
  sabado: string;
  domingo: string;
};

const DIAS_KEYS = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
] as const;

function estadoBadge(estado: string): string {
  if (estado === "aprobado") return badgeApproved("Aprobado");
  if (estado === "rechazado") return badgeRejected("Rechazado");
  if (estado === "cancelado") return badgeCancelled("Cancelado");
  if (estado === "borrador") return badgePending("Borrador");
  return badgePending("Pendiente");
}

function estadoLabel(estado: string): string {
  if (estado === "aprobado") return "Aprobado";
  if (estado === "rechazado") return "Rechazado";
  if (estado === "cancelado") return "Cancelado";
  if (estado === "borrador") return "Borrador";
  return "Pendiente";
}

function formatFecha(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function semanaLabel(numero: number): string {
  return `Semana ${numero}`;
}

function sumFila(fila: DetalleFilaHoras): number {
  return DIAS_KEYS.reduce((acc, key) => acc + (Number.parseFloat(fila[key]) || 0), 0);
}

function renderDetalleDiaHeader({ abrev, diaMes, label }: DiaColumnaHoras): string {
  return `
    <th class="px-1 py-2 text-center font-normal" title="${escapeHtml(label)}">
      <span class="block text-[10px] font-bold uppercase tracking-wide text-slate-600">${escapeHtml(abrev.toUpperCase())}</span>
      <span class="mt-0.5 block text-[10px] font-medium tabular-nums text-slate-400">${escapeHtml(diaMes)}</span>
    </th>`;
}

function renderDetalleHoraBadge(value: number): string {
  const cls = value > 0 ? DETALLE_HORA_BADGE_ACTIVE : DETALLE_HORA_BADGE_EMPTY;
  return `<span class="${cls}">${formatHorasCaptura(value)}</span>`;
}

function renderDetalleColaboradores(det: HorasExtraSolicitudResponse): string {
  if (!det.detalle.length) {
    return `<p class="text-sm text-text-secondary">Sin colaboradores registrados.</p>`;
  }
  return det.detalle
    .map(
      (row) => `
      <div class="${det.detalle.length > 1 ? "border-t border-slate-100 pt-2.5 first:border-t-0 first:pt-0" : ""}">
        <p class="text-sm font-semibold leading-snug text-[#0A1628]">${escapeHtml(row.nombre_empleado)}</p>
        <p class="mt-0.5 text-xs font-medium text-text-secondary">Empleado #${escapeHtml(row.no_empleado)}</p>
      </div>`,
    )
    .join("");
}

export function renderDetalleResumenCard(det: HorasExtraSolicitudResponse): string {
  return `
    <section class="${DETALLE_RESUMEN_CARD}">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="text-base font-bold text-[#0A1628]">Solicitud #${det.id}</h3>
          <div class="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
            <span class="${DETALLE_META_LABEL}">Estado:</span>
            ${estadoBadge(det.estado)}
            <span class="sr-only">${escapeHtml(estadoLabel(det.estado))}</span>
          </div>
        </div>
        <div class="text-right">
          <p class="${DETALLE_META_LABEL}">Total</p>
          <p class="mt-0.5 text-lg font-bold tabular-nums text-[#2563EB]">
            ${formatHorasCaptura(det.total_horas_general)}
            <span class="ml-1 text-sm font-semibold text-slate-500">horas</span>
          </p>
        </div>
      </div>

      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <div class="rounded-lg border border-slate-200/80 bg-white/80 px-3.5 py-3">
          <p class="${DETALLE_META_LABEL}">Colaborador</p>
          <div class="mt-2 space-y-2">${renderDetalleColaboradores(det)}</div>
        </div>
        <div class="rounded-lg border border-slate-200/80 bg-white/80 px-3.5 py-3">
          <dl class="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <div>
              <dt class="${DETALLE_META_LABEL}">Fecha</dt>
              <dd class="mt-0.5 font-medium text-[#0A1628]">${formatFecha(det.fecha_solicitud)}</dd>
            </div>
            <div>
              <dt class="${DETALLE_META_LABEL}">Semana</dt>
              <dd class="mt-0.5 font-medium text-[#0A1628]">${semanaLabel(det.semana)}</dd>
            </div>
            <div>
              <dt class="${DETALLE_META_LABEL}">Tipo</dt>
              <dd class="mt-0.5 font-medium text-[#0A1628]">${tipoLabel(det.tipo)}</dd>
            </div>
            <div>
              <dt class="${DETALLE_META_LABEL}">Área</dt>
              <dd class="mt-0.5 font-medium text-[#0A1628]">${escapeHtml(det.area_descripcion)}</dd>
            </div>
            <div class="col-span-2">
              <dt class="${DETALLE_META_LABEL}">Centro de costo</dt>
              <dd class="mt-0.5 font-medium text-[#0A1628]">${escapeHtml(det.centrocosto_descripcion)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div class="mt-3 rounded-lg border border-slate-200/80 bg-white/80 px-3.5 py-3">
        <p class="${DETALLE_META_LABEL}">Motivo</p>
        <p class="mt-1.5 text-sm font-medium leading-relaxed text-[#0A1628]">${escapeHtml(det.motivo_descripcion)}</p>
      </div>
    </section>`;
}

export function renderDetalleHorasGrid(filas: DetalleFilaHoras[], diasColumnas: DiaColumnaHoras[]): string {
  if (!filas.length) return "";

  const body = filas
    .map((fila) => {
      const total = sumFila(fila);
      return `
      <tr>
        ${diasColumnas
          .map(({ key }) => {
            const value = Number.parseFloat(fila[key]) || 0;
            return `<td class="px-1 py-2 align-middle">${renderDetalleHoraBadge(value)}</td>`;
          })
          .join("")}
        <td class="bg-slate-100/90 px-2 py-2 align-middle">
          <span class="text-sm font-bold tabular-nums text-[#0A1628]">${formatHorasCaptura(total)}</span>
        </td>
      </tr>`;
    })
    .join("");

  return `
    <div class="${HORAS_GRID_SCROLL}">
      <table class="${DETALLE_HORAS_TABLE}">
        <colgroup>
          ${diasColumnas.map(() => `<col class="w-[3rem] sm:w-[3.25rem]" />`).join("")}
          <col class="w-[4rem]" />
        </colgroup>
        <thead class="bg-[#f8fafc]">
          <tr>
            ${diasColumnas.map((col) => renderDetalleDiaHeader(col)).join("")}
            <th class="${HORAS_GRID_TOTAL_COL} px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-700">Total</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

export function renderDetalleHorasSection(det: HorasExtraSolicitudResponse): string {
  const filas = det.detalle.map((d) => ({
    lunes: String(d.lunes),
    martes: String(d.martes),
    miercoles: String(d.miercoles),
    jueves: String(d.jueves),
    viernes: String(d.viernes),
    sabado: String(d.sabado),
    domingo: String(d.domingo),
  }));

  return `
    <section class="${DETALLE_SECTION_CARD}">
      <div class="mb-3 flex items-end justify-between gap-2">
        <div>
          <h3 class="text-sm font-semibold text-[#0A1628]">Captura de horas</h3>
          <p class="mt-0.5 text-xs text-text-secondary">Horas registradas por día de la semana.</p>
        </div>
      </div>
      ${renderDetalleHorasGrid(filas, buildDiasColumnasHoras({ semanaInicio: det.semana_inicio }))}
    </section>`;
}

function renderDetalleModalBody(state: HorasExtraDetalleModalState): string {
  if (state.status === "loading") {
    return `<p class="text-sm text-text-secondary">Cargando detalle…</p>`;
  }
  if (state.status === "error") {
    return `<p class="text-sm text-red-700">${escapeHtml(state.error ?? "No se pudo cargar el detalle.")}</p>`;
  }
  const det = state.detalle;
  if (!det) return "";
  return `
    <div class="space-y-4">
      ${renderDetalleResumenCard(det)}
      ${renderDetalleHorasSection(det)}
    </div>`;
}

export function renderHorasExtraDetalleModal(
  state: HorasExtraDetalleModalState,
  config: HorasExtraDetalleModalConfig,
): string {
  if (!state.detalle && state.status !== "loading") return "";
  const det = state.detalle;
  const showFooter = state.status === "idle" && Boolean(det);

  return `
    <div id="${config.backdropId}" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="presentation">
      <div
        class="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="${config.titleId}"
      >
        <header class="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 id="${config.titleId}" class="text-lg font-semibold text-[#0A1628]">
            ${det ? `Solicitud #${det.id}` : "Detalle de solicitud"}
          </h2>
          <button
            type="button"
            data-${config.closeDataAttr}
            class="-m-1 flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
            aria-label="Cerrar modal"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-5" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-slate-50/35 px-5 py-4">
          ${renderDetalleModalBody(state)}
        </div>
        ${
          showFooter
            ? `
        <footer class="flex shrink-0 justify-end border-t border-slate-100 px-5 py-4">
          <button type="button" data-${config.closeDataAttr} class="${BTN_SECONDARY} min-h-10 px-5">Cerrar</button>
        </footer>`
            : ""
        }
      </div>
    </div>`;
}
