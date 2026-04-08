/**
 * Tarjeta detallada para incidencias no cerradas (layout tipo referencia RH).
 */

import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import type {
  RhIncidenciaEvidenciaItem,
  RhIncidenciaEstadoCodigo,
  RhIncidenciaPersonaInvolucrada,
  RhIncidenciaPrioridadCodigo,
  RhIncidenciaTablaFila,
  RhIncidenciaTipoCodigo,
} from "../../incidencias/rh/types.ts";
import { formatNombreEmpleadoUi, inicialesDesdeNombreDisplay } from "../../utils/nombreEmpleadoDisplay.ts";
import { escapeIncHtml } from "./rhIncidenciasUiUtils.ts";

function fmtFechaCorta(iso: string): string {
  const p = iso.trim().split("-");
  if (p.length !== 3) return iso;
  const y = Number(p[0]);
  const m = Number(p[1]);
  const d = Number(p[2]);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

function fmtFechaHora(row: RhIncidenciaTablaFila): string {
  const raw = row.fecha_hora_iso?.trim();
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
    }
  }
  return fmtFechaCorta(row.fecha);
}

function labelTipo(t: RhIncidenciaTipoCodigo): string {
  switch (t) {
    case "falta_injustificada":
      return "Falta injustificada";
    case "retardo":
      return "Retardo";
    case "indisciplina":
      return "Indisciplina";
    case "dano_equipo":
      return "Daño a equipo";
    default:
      return t;
  }
}

function labelEstadoCard(e: RhIncidenciaEstadoCodigo): string {
  switch (e) {
    case "abierto":
      return "Abierto";
    case "en_investigacion":
      return "En proceso de revisión";
    case "cerrado":
      return INC_COPY.estadoCerrada;
    default:
      return e;
  }
}

function badgePrioridadCard(p: RhIncidenciaPrioridadCodigo): string {
  const text = escapeIncHtml(
    p === "critica"
      ? "CRÍTICA"
      : p === "alta"
        ? "ALTA"
        : p === "media"
          ? "MEDIA"
          : "BAJA",
  );
  if (p === "critica") {
    return `<span class="inline-flex items-center rounded-full bg-red-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm">${text}</span>`;
  }
  if (p === "alta") {
    return `<span class="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-red-800 ring-1 ring-red-100">${text}</span>`;
  }
  if (p === "media") {
    return `<span class="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-900 ring-1 ring-amber-100">${text}</span>`;
  }
  return `<span class="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-700 ring-1 ring-slate-200">${text}</span>`;
}

function badgeEstadoCard(e: RhIncidenciaEstadoCodigo): string {
  const text = escapeIncHtml(labelEstadoCard(e).toUpperCase());
  if (e === "en_investigacion") {
    return `<span class="inline-flex items-center rounded-md bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-950 ring-1 ring-amber-200/80">${text}</span>`;
  }
  if (e === "abierto") {
    return `<span class="inline-flex items-center rounded-md bg-sky-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-sky-950 ring-1 ring-sky-200/80">${text}</span>`;
  }
  if (e === "cerrado") {
    return `<span class="inline-flex items-center rounded-md bg-emerald-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-950 ring-1 ring-emerald-200/90">${text}</span>`;
  }
  return `<span class="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-800 ring-1 ring-slate-200">${text}</span>`;
}

function fmtSlaHhMmSs(seg: number): string {
  const s = Math.max(0, Math.floor(seg));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function avatarHtml(foto: string | null | undefined, nombreDisplay: string, sizeCls: string): string {
  const ini = inicialesDesdeNombreDisplay(nombreDisplay);
  const fotoT = foto?.trim();
  if (fotoT) {
    return `<img src="${escapeIncHtml(fotoT)}" alt="" class="${sizeCls} shrink-0 rounded-xl object-cover ring-2 ring-white shadow-sm" />`;
  }
  return `<span class="flex ${sizeCls} shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-sm font-bold text-emerald-900 ring-2 ring-white shadow-sm">${escapeIncHtml(ini)}</span>`;
}

function labelRolPersona(r: RhIncidenciaPersonaInvolucrada["rol"]): string {
  if (r === "testigo") return INC_COPY.badgeRolTestigo;
  if (r === "afectado") return INC_COPY.badgeRolAfectado;
  return INC_COPY.badgeRolInvolucrado;
}

function badgeRolPersona(r: RhIncidenciaPersonaInvolucrada["rol"]): string {
  const t = escapeIncHtml(labelRolPersona(r));
  if (r === "afectado") {
    return `<span class="rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-800 ring-1 ring-red-100">${t}</span>`;
  }
  if (r === "testigo") {
    return `<span class="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700 ring-1 ring-slate-200">${t}</span>`;
  }
  return `<span class="rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-900 ring-1 ring-sky-100">${t}</span>`;
}

function renderEvidenciaItem(incId: number, ev: RhIncidenciaEvidenciaItem): string {
  if (ev.kind === "imagen") {
    const thumb = ev.thumb_url?.trim();
    const inner = thumb
      ? `<img src="${escapeIncHtml(thumb)}" alt="" class="h-full w-full object-cover" loading="lazy" />`
      : `<div class="flex h-full min-h-[5.5rem] items-center justify-center bg-slate-200/80 text-xs font-medium text-slate-500">IMG</div>`;
    return `<div class="overflow-hidden rounded-lg border border-slate-200/90 bg-slate-50 shadow-sm ring-1 ring-slate-900/5">${inner}</div>`;
  }
  const mb = ev.tamano_mb != null ? `${ev.tamano_mb.toFixed(1)} MB` : "—";
  return `<div class="flex items-center gap-3 rounded-lg border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-900/5">
    <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="currentColor" class="size-6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2 5 5h-5V4zM8.5 18a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3.5 2.5-2.75-3.7-2 2.2L6 15h12l-3.5-4.5L11.5 20.5z"/></svg>
    </span>
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-semibold text-slate-900">${escapeIncHtml(ev.nombre)}</p>
      <p class="text-xs text-slate-500">${escapeIncHtml(mb)}</p>
    </div>
    <button type="button" data-rh-inc-ev-descarga data-rh-inc-id="${incId}" data-rh-inc-ev-id="${escapeIncHtml(ev.id)}"
      class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-leoni-blue/30 hover:bg-white hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue/40"
      aria-label="${escapeIncHtml(INC_COPY.cardDescargaAria)}">
      <svg viewBox="0 0 20 20" fill="currentColor" class="size-5" aria-hidden="true"><path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.69L6.53 8.22a.75.75 0 0 0-1.06 1.06l3.25 3.25c.3.3.79.3 1.09 0l3.25-3.25a.75.75 0 1 0-1.06-1.06l-2.22 2.22V2.75Z"/><path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5a2.75 2.75 0 0 0 2.75-2.75v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z"/></svg>
    </button>
  </div>`;
}

function seccionTitulo(iconSvg: string, titulo: string): string {
  return `<div class="mb-4 flex items-center gap-2.5 border-b border-slate-100 pb-3">
    <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-leoni-blue/10 text-leoni-blue" aria-hidden="true">${iconSvg}</span>
    <h3 class="text-xs font-bold uppercase tracking-[0.12em] text-slate-800">${escapeIncHtml(titulo)}</h3>
  </div>`;
}

const ICON_USER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-[1.1rem]"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>`;
const ICON_ALERT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-[1.1rem]"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>`;
const ICON_IMG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-[1.1rem]"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3A1.5 1.5 0 0 0 1.5 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008H12V8.25Z" /></svg>`;
const ICON_GROUP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-[1.1rem]"><path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.09 9.09 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.645-5.886-1.754a3 3 0 0 1-.037-.666 9.09 9.09 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m0 0a3 3 0 0 1 4.682-2.72M6.75 9a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0Z" /></svg>`;
const ICON_CLOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5 text-white/90"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`;

function campoEtiqueta(label: string, valor: string, valorExtraCls = ""): string {
  return `<div class="min-w-0">
    <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">${escapeIncHtml(label)}</p>
    <p class="mt-0.5 text-sm font-semibold text-slate-900 ${valorExtraCls}">${valor}</p>
  </div>`;
}

function buildSlaActivoBar(row: RhIncidenciaTablaFila): string {
  const slaH = row.sla_horas_objetivo ?? 24;
  const slaMaxSeg = slaH * 3600;
  const trans = row.sla_segundos_transcurridos ?? 0;
  const pct = Math.min(100, Math.round((trans / Math.max(1, slaMaxSeg)) * 100));
  const dentro = trans < slaMaxSeg;
  return `
    <div class="mt-4 overflow-hidden rounded-2xl bg-[#002147] px-4 py-4 text-white shadow-lg shadow-slate-900/15 sm:px-6 sm:py-5">
      <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/80">
            ${ICON_CLOCK}
            <span>${escapeIncHtml(INC_COPY.cardSlaTiempo)}</span>
            <span class="font-normal text-sky-200/90">${escapeIncHtml(INC_COPY.cardSlaObjetivo(slaH))}</span>
          </div>
          <p class="mt-2 font-mono text-3xl font-bold tracking-tight sm:text-4xl">${escapeIncHtml(fmtSlaHhMmSs(trans))}</p>
          <p class="mt-1 text-sm font-semibold ${dentro ? "text-sky-200" : "text-amber-200"}">${escapeIncHtml(dentro ? INC_COPY.cardSlaDentro : INC_COPY.cardSlaFuera)}</p>
        </div>
        <div class="w-full min-w-0 lg:max-w-md lg:flex-1">
          <p class="text-right text-[10px] font-bold uppercase tracking-wider text-white/70">${escapeIncHtml(INC_COPY.cardSlaProgreso)}</p>
          <div class="mt-2 h-2.5 overflow-hidden rounded-full bg-white/15">
            <div class="h-full rounded-full bg-white transition-all" style="width: ${pct}%" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div>
          </div>
          <p class="mt-2 text-right text-lg font-bold">${pct}%</p>
        </div>
      </div>
    </div>`;
}

function buildSlaHistoricoBar(row: RhIncidenciaTablaFila): string {
  const slaH = row.sla_horas_objetivo ?? 24;
  const slaMaxSeg = slaH * 3600;
  const trans = row.sla_segundos_transcurridos ?? slaMaxSeg;
  const tiempoFmt = fmtSlaHhMmSs(trans);
  return `
    <div class="mt-4 overflow-hidden rounded-2xl bg-slate-700 px-4 py-4 text-white shadow-lg shadow-slate-900/20 sm:px-6 sm:py-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/75">
            ${ICON_CLOCK}
            <span>${escapeIncHtml(INC_COPY.cardSlaHistoricoTitulo)}</span>
            <span class="rounded-md bg-emerald-500/25 px-2 py-0.5 text-[10px] font-bold tracking-wide text-emerald-100 ring-1 ring-emerald-400/40">${escapeIncHtml(INC_COPY.cardSlaHistoricoFinalizado)}</span>
          </div>
          <p class="mt-2 max-w-xl text-sm leading-relaxed text-white/85">${escapeIncHtml(INC_COPY.cardSlaHistoricoDescripcion)}</p>
          <p class="mt-3 font-mono text-2xl font-bold tracking-tight text-white sm:text-3xl">${escapeIncHtml(tiempoFmt)}</p>
          <p class="mt-1 text-xs font-medium text-white/60">${escapeIncHtml(INC_COPY.cardSlaTiempoTotal)} · ${escapeIncHtml(INC_COPY.cardSlaObjetivo(slaH))}</p>
        </div>
        <div class="w-full min-w-0 lg:max-w-sm">
          <p class="text-[10px] font-bold uppercase tracking-wider text-white/55">${escapeIncHtml(INC_COPY.cardSlaProgreso)}</p>
          <div class="mt-2 h-2.5 overflow-hidden rounded-full bg-white/15">
            <div class="h-full w-full rounded-full bg-emerald-400/90" aria-hidden="true"></div>
          </div>
        </div>
      </div>
    </div>`;
}

/**
 * Contenido scrollable del modal de detalle.
 * `soloLectura`: incidencias cerradas — mismo layout que activas, sin acciones de seguimiento y SLA histórico.
 */
function buildRhIncidenciaDetalleInnerHtml(row: RhIncidenciaTablaFila, soloLectura: boolean): string {
  const nombre = formatNombreEmpleadoUi(row.empleado_nombre_raw) || INC_COPY.sinNombre;
  const idEmp = row.id_empleado_display?.trim() || row.empleado_id;
  const areaDept = row.area.trim() || "—";
  const puesto = row.puesto_empleado?.trim() || "—";
  const supervisor = formatNombreEmpleadoUi(row.supervisor_nombre) || row.supervisor_nombre || "—";
  const descripcion = row.descripcion?.trim() || "Sin descripción registrada.";
  const lugar = row.lugar?.trim() || "—";
  const folio = row.numero_folio.startsWith("INC-") ? row.numero_folio : `INC-${row.numero_folio}`;
  const evidencias = row.evidencias ?? [];
  const imagenes = evidencias.filter((e) => e.kind === "imagen");
  const adjuntos = evidencias.filter((e) => e.kind !== "imagen");
  const personas = row.personal_involucrado ?? [];
  const idEmpHtml = escapeIncHtml(idEmp);
  const nombreHtml = escapeIncHtml(nombre);

  const gridCamposReportante = `
    <div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
      ${campoEtiqueta(INC_COPY.cardLblNombre, nombreHtml)}
      ${campoEtiqueta(INC_COPY.cardLblIdEmpleado, `<span class="text-leoni-blue">${idEmpHtml}</span>`)}
      ${campoEtiqueta(INC_COPY.cardLblArea, escapeIncHtml(areaDept))}
      ${campoEtiqueta(INC_COPY.cardLblPuesto, escapeIncHtml(puesto))}
      ${campoEtiqueta(INC_COPY.cardLblSupervisor, escapeIncHtml(supervisor))}
    </div>`;

  const miniBoxes = `
    <div class="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      <div class="min-w-0 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 ring-1 ring-slate-900/[0.03]">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">${escapeIncHtml(INC_COPY.cardLblTipo)}</p>
        <p class="mt-1 text-sm font-bold text-slate-900">${escapeIncHtml(labelTipo(row.tipo))}</p>
      </div>
      <div class="min-w-0 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 ring-1 ring-slate-900/[0.03]">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">${escapeIncHtml(INC_COPY.cardLblFechaHora)}</p>
        <p class="mt-1 text-sm font-bold text-slate-900">${escapeIncHtml(fmtFechaHora(row))}</p>
      </div>
      <div class="min-w-0 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 ring-1 ring-slate-900/[0.03]">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">${escapeIncHtml(INC_COPY.cardLblUbicacion)}</p>
        <p class="mt-1 break-words text-sm font-bold leading-snug text-slate-900">${escapeIncHtml(lugar)}</p>
      </div>
    </div>`;

  const descBlock = `
    <div class="mt-5 w-full min-w-0">
      <p class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">${escapeIncHtml(INC_COPY.cardDescCompleta)}</p>
      <div class="w-full max-w-none rounded-r-xl border-l-4 border-leoni-blue bg-sky-50/50 px-4 py-3.5 text-sm leading-relaxed text-slate-800 ring-1 ring-slate-900/[0.04]">
        ${escapeIncHtml(descripcion)}
      </div>
    </div>`;

  const footerDetalle = `
    <div class="mt-6 flex w-full min-w-0 flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs font-medium text-slate-500">${escapeIncHtml(INC_COPY.cardEstado)}</span>
        ${badgeEstadoCard(row.estado)}
      </div>
      <p class="text-xs text-slate-400"><span class="font-medium text-slate-500">${escapeIncHtml(INC_COPY.cardIdReporte)}:</span> ${escapeIncHtml(folio)}</p>
    </div>`;

  const thumbsGrid =
    imagenes.length > 0
      ? `<div class="grid grid-cols-2 gap-2 sm:gap-3">${imagenes.map((ev) => renderEvidenciaItem(row.id, ev)).join("")}</div>`
      : "";

  const listaAdjuntos =
    adjuntos.length > 0
      ? `<div class="mt-3 space-y-2">${adjuntos.map((ev) => renderEvidenciaItem(row.id, ev)).join("")}</div>`
      : "";

  const evidenciaBody =
    evidencias.length === 0
      ? `<p class="py-6 text-center text-sm text-slate-500">${escapeIncHtml(INC_COPY.cardSinEvidencias)}</p>`
      : `${thumbsGrid}${listaAdjuntos}`;

  const personalRows = personas
    .map((p) => {
      const n = formatNombreEmpleadoUi(p.nombre) || p.nombre;
      const pu = p.puesto.trim();
      return `<div class="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/40 px-3 py-2.5 ring-1 ring-slate-900/[0.03]">
        ${avatarHtml(p.foto_url ?? null, n, "size-10")}
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-bold text-slate-900">${escapeIncHtml(n)}</p>
          <p class="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">${escapeIncHtml(pu)}</p>
        </div>
        ${badgeRolPersona(p.rol)}
      </div>`;
    })
    .join("");

  const personalBody =
    personas.length === 0
      ? `<p class="py-6 text-center text-sm text-slate-500">${escapeIncHtml(INC_COPY.cardSinPersonal)}</p>`
      : `<div class="space-y-2">${personalRows}</div>`;

  const botonHistorial = soloLectura
    ? ""
    : `<button type="button" data-rh-inc-historial data-rh-inc-id="${row.id}"
                  class="mt-4 flex h-11 w-full items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-sm font-bold text-slate-800 transition hover:border-leoni-blue/40 hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue/35">
                  ${escapeIncHtml(INC_COPY.cardVerHistorial)}
                </button>`;

  const slaBar = soloLectura ? buildSlaHistoricoBar(row) : buildSlaActivoBar(row);

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
              <div class="mb-4 flex w-full min-w-0 flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div class="flex min-w-0 flex-1 items-center gap-2.5">
                  <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-leoni-blue/10 text-leoni-blue" aria-hidden="true">${ICON_ALERT}</span>
                  <h3 class="min-w-0 text-xs font-bold uppercase tracking-[0.12em] text-slate-800">${escapeIncHtml(INC_COPY.cardDetalle)}</h3>
                </div>
                <div class="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                  <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">${escapeIncHtml(INC_COPY.cardPrioridad)}</span>
                  ${badgePrioridadCard(row.prioridad)}
                </div>
              </div>
              <div class="w-full min-w-0">
                ${miniBoxes}
                ${descBlock}
                ${footerDetalle}
              </div>
            </div>

            <div class="mt-4 grid grid-cols-1 gap-4 lg:mt-5 lg:grid-cols-2 lg:gap-5">
              <div class="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
                ${seccionTitulo(ICON_IMG, INC_COPY.cardEvidencia(evidencias.length))}
                ${evidenciaBody}
              </div>
              <div class="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
                ${seccionTitulo(ICON_GROUP, INC_COPY.cardPersonal)}
                ${personalBody}
                ${botonHistorial}
              </div>
            </div>

            ${slaBar}
          </div>
        </article>`;
}

/** HTML del cuerpo del modal de detalle (cerradas = solo lectura, mismo esquema visual). */
export function renderRhIncidenciaDetalleModalBody(row: RhIncidenciaTablaFila): string {
  const soloLectura = row.estado === "cerrado";
  return buildRhIncidenciaDetalleInnerHtml(row, soloLectura);
}
