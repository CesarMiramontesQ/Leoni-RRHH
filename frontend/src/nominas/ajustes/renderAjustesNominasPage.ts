/**
 * Página Ajustes de Nóminas (solo RH): administración de empleados
 * autorizados para registrar horas extra.
 */

import {
  badgeApproved,
  badgeCancelled,
  BTN_GHOST,
  BTN_PRIMARY,
  BTN_SECONDARY,
  FIELD_FOCUS,
  RH_DASHBOARD_PAGE_SHELL,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_LISTADO_SURFACE,
} from "../../ui/uiTokens.ts";
import { escapeHtml, paginationRange } from "../../ui/uiUtils.ts";
import type {
  AjustesNominasModalState,
  AjustesNominasState,
  AprobadorItem,
  AprobadoresModalState,
  AprobadoresState,
  AprobadorTipo,
} from "./types.ts";

const TABLE_COLUMNS = [
  "Empleado",
  "Área / Puesto",
  "Fecha de autorización",
  "Autorizado por",
  "Estado",
  "Acciones",
] as const;

const CHECKBOX_CLS =
  "size-4 rounded border-slate-300 text-leoni-blue focus:ring-2 focus:ring-leoni-blue/40";

const AJUSTES_SECTION_STACK = "grid gap-4 sm:gap-6";
const AJUSTES_SURFACE_PAD = "p-5 sm:p-6";

const SEARCH_INPUT_CLS =
  "w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm";

function formatFechaAutorizacion(iso: string | null): string {
  if (!iso) return "—";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function initials(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function avatarHtml(nombre: string, sizeCls = "size-9 text-xs"): string {
  return `<span class="inline-flex ${sizeCls} shrink-0 items-center justify-center rounded-full bg-leoni-blue font-bold text-white" aria-hidden="true">${escapeHtml(initials(nombre))}</span>`;
}

function countGerentesActivos(aprobadores: AprobadoresState): number {
  return aprobadores.gerentes.filter((g) => g.activo).length;
}

function directorActivo(aprobadores: AprobadoresState): AprobadorItem | undefined {
  return aprobadores.directores.find((d) => d.activo);
}

function renderStatCard(opts: {
  label: string;
  value: number | null;
  hint?: string;
  tone: "default" | "success" | "muted" | "info";
}): string {
  const tones: Record<typeof opts.tone, string> = {
    default: "border-[rgba(148,163,184,0.22)] from-white to-[#f8fbff]",
    success: "border-emerald-200/80 from-emerald-50/40 to-white",
    muted: "border-slate-200/80 from-slate-50/60 to-white",
    info: "border-blue-200/80 from-blue-50/40 to-white",
  };
  const value =
    opts.value === null
      ? `<span class="text-text-muted">…</span>`
      : `${opts.value}`;
  return `
    <div class="rounded-[14px] border bg-linear-to-br p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] ${tones[opts.tone]}">
      <p class="text-xs font-semibold uppercase tracking-wide text-[#64748b]">${escapeHtml(opts.label)}</p>
      <p class="mt-2 text-2xl font-bold tabular-nums text-[#0f172a]">${value}</p>
      ${opts.hint ? `<p class="mt-1 text-[11px] text-text-muted">${escapeHtml(opts.hint)}</p>` : ""}
    </div>`;
}

function renderPageStats(state: AjustesNominasState): string {
  const stats = state.stats;
  const aprobadoresListos = !state.aprobadores.loading;
  const director = directorActivo(state.aprobadores);
  return `
    <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores del proceso de horas extra">
      ${renderStatCard({
        label: "Empleados autorizados",
        value: stats?.autorizaciones_activas ?? null,
        hint: "Autorizados para registrar horas extra",
        tone: "info",
      })}
      ${renderStatCard({
        label: "Solicitudes pendientes",
        value: stats?.solicitudes_pendientes ?? null,
        hint: "Pendientes de aprobación",
        tone: "default",
      })}
      ${renderStatCard({
        label: "Gerentes regionales",
        value: aprobadoresListos ? countGerentesActivos(state.aprobadores) : null,
        hint: "Aprobadores activos",
        tone: "success",
      })}
      ${renderStatCard({
        label: "Director",
        value: aprobadoresListos ? (director ? 1 : 0) : null,
        hint: director ? "Director configurado" : "Sin director activo",
        tone: director || !aprobadoresListos ? "success" : "muted",
      })}
    </section>`;
}

// ── Estado del flujo de horas extra ──

const FLUJO_ICONS: Record<string, string> = {
  empleado: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.1a7.5 7.5 0 0 1 15 0v.15H4.5v-.15Z"/></svg>`,
  gerente: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M18 18.7a3.75 3.75 0 1 0-3-6.7m3 6.7a8.97 8.97 0 0 1-6 2.3 8.97 8.97 0 0 1-6-2.3m12 0v-.2c0-1-.27-1.9-.75-2.7M6 18.7a3.75 3.75 0 1 1 3-6.7m-3 6.7v-.2c0-1 .27-1.9.75-2.7m0 0a5.25 5.25 0 0 1 8.5 0M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>`,
  director: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>`,
  nomina: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60 60 0 0 1 15.8 2.1 2.25 2.25 0 0 0 2.7-2.2V6a2.25 2.25 0 0 0-2.7-2.2 60 60 0 0 1-15.8 2.1m0 12.85V5.9m0 12.85v.4a2.25 2.25 0 0 0 2.25 2.25h.4M2.25 5.9v-.4A2.25 2.25 0 0 1 4.5 3.25h.4m10.6 8.75a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"/></svg>`,
};

function renderFlujoPaso(opts: {
  icon: string;
  titulo: string;
  descripcion: string;
  ok: boolean | null;
}): string {
  const tone =
    opts.ok === null
      ? "border-blue-200/80 bg-blue-50/50 text-blue-800"
      : opts.ok
        ? "border-emerald-200/80 bg-emerald-50/50 text-emerald-800"
        : "border-amber-200/90 bg-amber-50/60 text-amber-800";
  return `
    <li class="flex min-w-0 flex-1 items-center gap-3 rounded-lg border px-3 py-2.5 ${tone}">
      ${opts.icon}
      <span class="min-w-0">
        <span class="block truncate text-xs font-semibold">${opts.titulo}</span>
        <span class="block truncate text-[11px] opacity-80">${opts.descripcion}</span>
      </span>
    </li>`;
}

const FLUJO_FLECHA = `<li class="flex shrink-0 items-center justify-center text-text-muted" aria-hidden="true"><svg class="size-4 rotate-90 sm:rotate-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12l-7.5 7.5M21 12H3"/></svg></li>`;

function renderEstadoFlujo(state: AjustesNominasState): string {
  const cargando = state.stats === null || state.aprobadores.loading;
  const tieneAutorizados = state.stats ? state.stats.autorizaciones_activas > 0 : null;
  const tieneGerentes = state.aprobadores.loading
    ? null
    : countGerentesActivos(state.aprobadores) > 0;
  const tieneDirector = state.aprobadores.loading
    ? null
    : directorActivo(state.aprobadores) !== undefined;

  const operativo = tieneAutorizados === true && tieneGerentes === true && tieneDirector === true;
  const estadoBadge = cargando
    ? `<span class="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-bold text-blue-900">Verificando…</span>`
    : operativo
      ? `<span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-900"><span class="size-2 rounded-full bg-emerald-500" aria-hidden="true"></span>OPERATIVO</span>`
      : `<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-bold text-amber-900"><span class="size-2 rounded-full bg-amber-500" aria-hidden="true"></span>CONFIGURACIÓN INCOMPLETA</span>`;

  const checkItem = (ok: boolean | null, label: string, pendiente: string): string => {
    if (ok === null) {
      return `<li class="flex items-center gap-2 text-sm text-text-muted"><span class="inline-block size-4 shrink-0 animate-pulse rounded-full bg-slate-200" aria-hidden="true"></span>${label}</li>`;
    }
    return ok
      ? `<li class="flex items-center gap-2 text-sm text-text-secondary"><svg class="size-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>${label}</li>`
      : `<li class="flex items-center gap-2 text-sm text-amber-800"><svg class="size-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.3 3.4c-.87 1.5.22 3.35 1.95 3.35h14.7c1.73 0 2.82-1.85 1.95-3.35L13.95 3.4c-.87-1.5-3.03-1.5-3.9 0L2.7 16.15ZM12 15.75h.01v.01H12v-.01Z"/></svg>${pendiente}</li>`;
  };

  return `
    <section class="${RH_LISTADO_SURFACE} ${AJUSTES_SURFACE_PAD}" aria-labelledby="aj-flujo-titulo">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <h2 id="aj-flujo-titulo" class="text-base font-semibold text-text-primary">Estado del flujo de horas extra</h2>
          <p class="mt-1.5 text-sm leading-relaxed text-text-secondary">
            Cadena de aprobación configurada para las solicitudes de horas extra.
          </p>
        </div>
        ${estadoBadge}
      </div>
      <ol class="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center" aria-label="Flujo de aprobación">
        ${renderFlujoPaso({ icon: FLUJO_ICONS.empleado, titulo: "Empleado autorizado", descripcion: "Registra la solicitud", ok: tieneAutorizados })}
        ${FLUJO_FLECHA}
        ${renderFlujoPaso({ icon: FLUJO_ICONS.gerente, titulo: "Gerente Regional", descripcion: "Aprobación inicial", ok: tieneGerentes })}
        ${FLUJO_FLECHA}
        ${renderFlujoPaso({ icon: FLUJO_ICONS.director, titulo: "Director", descripcion: "Autorización final", ok: tieneDirector })}
        ${FLUJO_FLECHA}
        ${renderFlujoPaso({ icon: FLUJO_ICONS.nomina, titulo: "Nómina", descripcion: "Procesa el pago", ok: null })}
      </ol>
      <ul class="mt-6 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-3">
        ${checkItem(tieneAutorizados, "Empleados autorizados", "Sin empleados autorizados")}
        ${checkItem(tieneGerentes, "Gerentes configurados", "Sin gerentes regionales activos")}
        ${checkItem(tieneDirector, "Director configurado", "Sin director activo")}
      </ul>
    </section>`;
}

function renderMensajes(state: AjustesNominasState): string {
  const success = state.successMessage
    ? `<p class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-900" role="status">${escapeHtml(state.successMessage)}</p>`
    : "";
  const error =
    state.status === "ready" && state.errorMessage
      ? `<p class="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-800" role="alert">${escapeHtml(state.errorMessage)}</p>`
      : "";
  return success || error ? `<div class="grid gap-2">${success}${error}</div>` : "";
}

function renderRows(state: AjustesNominasState): string {
  return state.items
    .map((item) => {
      const revoking = state.revokingId === item.id;
      const areaPuesto = [item.area_descripcion, item.puesto_descripcion]
        .filter(Boolean)
        .join(" · ");
      return `
      <tr class="border-b border-slate-100 transition hover:bg-slate-50/70" data-aj-he-row="${item.id}">
        <td class="px-3 py-3">
          <div class="flex items-center gap-3">
            ${avatarHtml(item.nombre)}
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-text-primary">${escapeHtml(item.nombre)}</p>
              <p class="mt-0.5 text-xs tabular-nums text-text-muted">${escapeHtml(item.no_empleado)}</p>
            </div>
          </div>
        </td>
        <td class="px-3 py-3 text-sm text-text-secondary">${escapeHtml(areaPuesto || "—")}</td>
        <td class="px-3 py-3 text-sm tabular-nums text-text-secondary">${escapeHtml(formatFechaAutorizacion(item.fecha_autorizacion))}</td>
        <td class="px-3 py-3 text-sm text-text-secondary">${escapeHtml(item.autorizado_por ?? "—")}</td>
        <td class="px-3 py-3">${badgeApproved("Activa")}</td>
        <td class="px-3 py-3">
          <button
            type="button"
            data-aj-he-revocar="${item.id}"
            class="${BTN_GHOST} px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            ${state.revokingId !== null ? "disabled" : ""}
          >
            ${revoking ? "Retirando…" : "Retirar autorización"}
          </button>
        </td>
      </tr>`;
    })
    .join("");
}

function renderPagination(state: AjustesNominasState): string {
  if (state.status !== "ready" || state.items.length === 0) return "";
  const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
  const start = (state.page - 1) * state.pageSize + 1;
  const end = start + state.items.length - 1;
  const pages = paginationRange(totalPages, state.page);

  const pageButtons = pages
    .map((entry) => {
      if (entry === "ellipsis") {
        return `<span class="inline-flex size-8 items-center justify-center text-xs text-text-muted">…</span>`;
      }
      const isActive = entry === state.page;
      const cls = isActive
        ? "border-leoni-blue bg-leoni-blue text-white"
        : "cursor-pointer border-slate-200 bg-white text-text-secondary transition hover:border-leoni-blue/40 hover:bg-slate-50 hover:text-leoni-blue";
      return `<button type="button" data-aj-he-page="${entry}" class="inline-flex size-8 items-center justify-center rounded-lg border text-xs font-semibold tabular-nums ${cls}" aria-label="Página ${entry}" ${isActive ? 'aria-current="page"' : ""}>${entry}</button>`;
    })
    .join("");

  return `
    <div class="flex flex-col gap-4 border-t border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p class="text-xs text-text-secondary">
        Mostrando <span class="font-semibold tabular-nums text-text-primary">${start}-${end}</span> de
        <span class="font-semibold tabular-nums text-text-primary">${state.total}</span> empleados autorizados
      </p>
      <nav class="flex items-center gap-1" aria-label="Paginación">
        <button type="button" data-aj-he-page="${state.page - 1}" class="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-text-secondary transition hover:border-leoni-blue/40 hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40" aria-label="Página anterior" ${state.page <= 1 ? "disabled" : ""}>‹</button>
        ${pageButtons}
        <button type="button" data-aj-he-page="${state.page + 1}" class="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-text-secondary transition hover:border-leoni-blue/40 hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40" aria-label="Página siguiente" ${state.page >= totalPages ? "disabled" : ""}>›</button>
      </nav>
    </div>`;
}

function renderAutorizadosEmptyState(state: AjustesNominasState): string {
  const disabled = state.status === "loading" || state.revokingId !== null;
  return `
    <div class="m-5 rounded-xl border border-dashed border-[var(--color-border)]/90 bg-slate-50/40 px-5 py-8 text-center sm:m-6">
      <span class="mx-auto flex size-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">${FLUJO_ICONS.empleado}</span>
      <p class="mt-4 text-sm font-semibold text-text-primary">No hay empleados autorizados</p>
      <p class="mt-1.5 text-xs text-text-muted">Autoriza empleados para que puedan registrar las horas extra de sus equipos.</p>
      <button
        type="button"
        data-aj-he-abrir-modal
        class="${BTN_SECONDARY} mt-4 disabled:cursor-not-allowed disabled:opacity-50"
        ${disabled ? "disabled" : ""}
      >+ Autorizar empleados</button>
    </div>`;
}

function renderAutorizadosBody(state: AjustesNominasState): string {
  if (state.status === "loading") {
    return `<p class="px-5 py-10 text-center text-sm text-text-secondary sm:px-6">Cargando empleados autorizados…</p>`;
  }
  if (state.status === "error") {
    return `<p class="px-5 py-10 text-center text-sm text-red-700 sm:px-6">${escapeHtml(state.errorMessage ?? "No se pudo cargar el listado.")}</p>`;
  }
  if (state.items.length === 0) {
    if (state.q.trim()) {
      return `<p class="px-5 py-10 text-center text-sm text-text-secondary sm:px-6">Sin empleados autorizados que coincidan con la búsqueda.</p>`;
    }
    return renderAutorizadosEmptyState(state);
  }
  return `
    <div class="overflow-x-auto">
      <table class="min-w-full border-collapse text-left">
        <thead>
          <tr class="border-b border-slate-100 bg-[var(--color-grid-header-bg)]">
            ${TABLE_COLUMNS.map(
              (col) =>
                `<th scope="col" class="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-grid-header-text)] whitespace-nowrap">${col}</th>`,
            ).join("")}
          </tr>
        </thead>
        <tbody id="aj-he-table-body">
          ${renderRows(state)}
        </tbody>
      </table>
    </div>
    ${renderPagination(state)}`;
}

function autorizadosSinRegistros(state: AjustesNominasState): boolean {
  return state.status === "ready" && state.items.length === 0 && state.q.trim() === "";
}

function renderAutorizadosToolbar(state: AjustesNominasState): string {
  const disabled = state.status === "loading";
  const sinRegistros = autorizadosSinRegistros(state);
  if (sinRegistros) return "";
  return `
    <div class="flex justify-end">
      <button
        type="button"
        data-aj-he-abrir-modal
        class="${BTN_PRIMARY} w-full shrink-0 sm:w-auto disabled:cursor-not-allowed disabled:opacity-50"
        ${disabled || state.revokingId !== null ? "disabled" : ""}
      >Autorizar empleados</button>
    </div>`;
}

function renderAutorizadosFiltros(state: AjustesNominasState): string {
  const disabled = state.status === "loading";
  const mostrarBusqueda = state.status !== "error" && !autorizadosSinRegistros(state);
  if (!mostrarBusqueda) return "";

  return `
    <section class="${RH_LISTADO_SURFACE} ${AJUSTES_SURFACE_PAD}" aria-label="Filtros de empleados autorizados">
      <div class="flex flex-wrap items-center gap-4">
        <div class="min-w-0 w-full flex-1 sm:max-w-md">
          <input
            id="aj-he-busqueda"
            type="search"
            value="${escapeHtml(state.q)}"
            placeholder="Buscar por nombre, no. empleado, correo, área o puesto"
            aria-label="Buscar en empleados autorizados"
            autocomplete="off"
            class="${SEARCH_INPUT_CLS} ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING} w-full"
            ${disabled ? "disabled" : ""}
          />
        </div>
      </div>
    </section>`;
}

function renderAutorizadosTabla(state: AjustesNominasState): string {
  return `
    <section
      class="${RH_LISTADO_SURFACE} flex min-w-0 flex-col overflow-hidden"
      aria-label="Tabla de empleados autorizados"
    >
      ${renderAutorizadosBody(state)}
    </section>`;
}

function renderAutorizacionesContenido(state: AjustesNominasState): string {
  return `
    <div class="${AJUSTES_SECTION_STACK}">
      ${renderMensajes(state)}
      ${renderAutorizadosToolbar(state)}
      ${renderAutorizadosFiltros(state)}
      ${renderAutorizadosTabla(state)}
    </div>`;
}

function renderAprobadoresContenido(state: AjustesNominasState): string {
  const aprobadores = state.aprobadores;
  const busy =
    (aprobadores.modal?.submitting ?? false) ||
    aprobadores.mutatingId !== null ||
    aprobadores.loading;
  return `
    <div class="${AJUSTES_SECTION_STACK}">
      ${renderAprobadoresMensajes(aprobadores)}
      <div class="flex w-full flex-col gap-8 sm:gap-10">
        ${renderAprobadorCard("gerente_regional", aprobadores, aprobadores.gerentes, busy)}
        ${renderAprobadorCard("director", aprobadores, aprobadores.directores, busy)}
      </div>
    </div>`;
}

function renderModalResultados(modal: AjustesNominasModalState): string {
  if (modal.searching) {
    return `<p class="px-1 py-6 text-center text-sm text-text-secondary">Buscando empleados…</p>`;
  }
  if (!modal.searched) {
    return `<p class="px-1 py-6 text-center text-sm text-text-muted">Escribe un nombre, no. de empleado, correo, área o puesto para buscar empleados disponibles.</p>`;
  }
  if (modal.results.length === 0) {
    return `<p class="px-1 py-6 text-center text-sm text-text-secondary">Sin empleados disponibles que coincidan con la búsqueda.</p>`;
  }

  const rows = modal.results
    .map((emp) => {
      const checked = modal.seleccionados.has(emp.id);
      const detalle = [emp.no_empleado, emp.puesto_descripcion, emp.area_descripcion, emp.email]
        .filter(Boolean)
        .join(" · ");
      return `
      <label class="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${checked ? "border-leoni-blue/50 bg-blue-50/60" : "border-slate-200 bg-white hover:border-leoni-blue/30 hover:bg-slate-50"}">
        <input
          type="checkbox"
          data-aj-he-modal-check="${emp.id}"
          class="${CHECKBOX_CLS}"
          ${checked ? "checked" : ""}
          ${modal.submitting ? "disabled" : ""}
        />
        ${avatarHtml(emp.nombre)}
        <span class="min-w-0">
          <span class="block truncate text-sm font-medium text-text-primary">${escapeHtml(emp.nombre)}</span>
          <span class="block truncate text-xs text-text-muted">${escapeHtml(detalle)}</span>
        </span>
      </label>`;
    })
    .join("");

  return `<div class="grid gap-2" role="listbox" aria-label="Resultados de búsqueda">${rows}</div>`;
}

function renderModalSeleccionados(modal: AjustesNominasModalState): string {
  if (modal.seleccionados.size === 0) {
    return `<p class="text-xs text-text-muted">Aún no has seleccionado empleados.</p>`;
  }
  const chips = [...modal.seleccionados.values()]
    .map(
      (emp) => `
      <span class="inline-flex max-w-full items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 py-1 pl-3 pr-1.5 text-xs font-semibold text-blue-900">
        <span class="truncate">${escapeHtml(emp.nombre)}</span>
        <button
          type="button"
          data-aj-he-modal-quitar="${emp.id}"
          class="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-blue-700 transition hover:bg-blue-200/70"
          aria-label="Quitar a ${escapeHtml(emp.nombre)}"
          ${modal.submitting ? "disabled" : ""}
        >×</button>
      </span>`,
    )
    .join("");
  return `<div class="flex flex-wrap gap-1.5">${chips}</div>`;
}

function renderModal(state: AjustesNominasState): string {
  const modal = state.modal;
  if (!modal) return "";
  const count = modal.seleccionados.size;
  const confirmDisabled = count === 0 || modal.submitting;

  return `
    <div id="aj-he-modal-backdrop" class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]" role="presentation">
      <div
        class="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="aj-he-modal-titulo"
      >
        <header class="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div class="min-w-0">
            <h2 id="aj-he-modal-titulo" class="text-lg font-semibold text-text-primary">Autorizar empleados</h2>
            <p class="mt-1 text-sm text-text-secondary">
              Busca y selecciona a los empleados que podrán registrar horas extra. Los empleados ya autorizados no aparecen en los resultados.
            </p>
          </div>
          <button type="button" id="aj-he-modal-cerrar" class="${BTN_GHOST} shrink-0 px-2 py-1.5 text-xs" aria-label="Cerrar" ${modal.submitting ? "disabled" : ""}>
            <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <label for="aj-he-modal-busqueda" class="${RH_LISTADO_LABEL}">Buscar empleados disponibles</label>
          <input
            id="aj-he-modal-busqueda"
            type="search"
            value="${escapeHtml(modal.q)}"
            placeholder="Nombre, no. empleado, correo, área o puesto"
            autocomplete="off"
            class="${SEARCH_INPUT_CLS} ${FIELD_FOCUS}"
            ${modal.submitting ? "disabled" : ""}
          />
          ${
            modal.errorMessage
              ? `<p class="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800" role="alert">${escapeHtml(modal.errorMessage)}</p>`
              : ""
          }
          <div class="mt-4">
            ${renderModalResultados(modal)}
          </div>
          <div class="mt-5 border-t border-slate-100 pt-4">
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted" aria-live="polite">
              Seleccionados (${count})
            </p>
            ${renderModalSeleccionados(modal)}
          </div>
        </div>
        <footer class="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" id="aj-he-modal-cancelar" class="${BTN_SECONDARY}" ${modal.submitting ? "disabled" : ""}>Cancelar</button>
          <button type="button" id="aj-he-modal-confirmar" class="${BTN_PRIMARY} disabled:cursor-not-allowed disabled:opacity-50" ${confirmDisabled ? "disabled" : ""}>
            ${modal.submitting ? "Autorizando…" : "Confirmar autorización"}
          </button>
        </footer>
      </div>
    </div>`;
}

// ── Sección: configuración de aprobadores ──

const APROBADORES_TABLE_COLUMNS = ["Empleado", "Estado", "Acciones"] as const;

const APROBADOR_CARD_COPY: Record<
  AprobadorTipo,
  { titulo: string; descripcion: string; boton: string; vacio: string }
> = {
  gerente_regional: {
    titulo: "Gerentes Regionales",
    descripcion: "Responsables de la aprobación inicial de horas extra.",
    boton: "Agregar gerente regional",
    vacio: "No hay gerentes regionales configurados",
  },
  director: {
    titulo: "Director de aprobación final",
    descripcion:
      "Responsable de la autorización final. Solo puede haber un director activo.",
    boton: "Agregar director",
    vacio: "No hay un director configurado",
  },
};

function renderAprobadorAcciones(
  item: AprobadorItem,
  mutating: boolean,
  busy: boolean,
): string {
  return `
    <button
      type="button"
      data-aj-ap-eliminar="${item.id}"
      class="${BTN_GHOST} px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      ${busy ? "disabled" : ""}
    >${mutating ? "Eliminando…" : "Eliminar"}</button>`;
}

function renderAprobadorEmptyState(tipo: AprobadorTipo, busy: boolean): string {
  const copy = APROBADOR_CARD_COPY[tipo];
  return `
    <div class="m-5 rounded-xl border border-dashed border-[var(--color-border)]/90 bg-slate-50/40 px-5 py-8 text-center sm:m-6">
      <span class="mx-auto flex size-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">${tipo === "director" ? FLUJO_ICONS.director : FLUJO_ICONS.gerente}</span>
      <p class="mt-4 text-sm font-semibold text-text-primary">${copy.vacio}</p>
      <p class="mt-1.5 text-xs text-text-muted">${copy.descripcion}</p>
      <button
        type="button"
        data-aj-ap-abrir-modal="${tipo}"
        class="${BTN_SECONDARY} mt-4 disabled:cursor-not-allowed disabled:opacity-50"
        ${busy ? "disabled" : ""}
      >+ ${copy.boton}</button>
    </div>`;
}

function renderAprobadorEmpleadoCell(item: AprobadorItem): string {
  return `
    <div class="flex items-start gap-3">
      ${avatarHtml(item.nombre)}
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium leading-snug text-text-primary">${escapeHtml(item.nombre)}</p>
        <p class="mt-1 text-xs tabular-nums text-text-muted">${escapeHtml(item.noEmpleado)}</p>
        ${
          item.areaPuesto
            ? `<p class="mt-0.5 text-xs leading-relaxed text-text-secondary">${escapeHtml(item.areaPuesto)}</p>`
            : ""
        }
      </div>
    </div>`;
}

function renderAprobadorRows(
  aprobadores: AprobadoresState,
  items: AprobadorItem[],
  busy: boolean,
): string {
  return items
    .map((item) => {
      const mutating = aprobadores.mutatingId === item.id;
      return `
      <tr class="border-b border-slate-100 transition hover:bg-slate-50/70">
        <td class="px-4 py-4 sm:px-5">${renderAprobadorEmpleadoCell(item)}</td>
        <td class="px-4 py-4 align-middle whitespace-nowrap sm:px-5">${item.activo ? badgeApproved("Activo") : badgeCancelled("Inactivo")}</td>
        <td class="px-4 py-4 align-middle sm:px-5">${renderAprobadorAcciones(item, mutating, busy)}</td>
      </tr>`;
    })
    .join("");
}

function renderAprobadorTabla(
  aprobadores: AprobadoresState,
  items: AprobadorItem[],
  busy: boolean,
): string {
  return `
    <div class="overflow-x-auto">
      <table class="min-w-full border-collapse text-left">
        <thead>
          <tr class="border-b border-slate-100 bg-[var(--color-grid-header-bg)]">
            ${APROBADORES_TABLE_COLUMNS.map(
              (col) =>
                `<th scope="col" class="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-grid-header-text)] whitespace-nowrap sm:px-5">${col}</th>`,
            ).join("")}
          </tr>
        </thead>
        <tbody>
          ${renderAprobadorRows(aprobadores, items, busy)}
        </tbody>
      </table>
    </div>`;
}

function renderAprobadorCardBody(
  tipo: AprobadorTipo,
  aprobadores: AprobadoresState,
  items: AprobadorItem[],
  busy: boolean,
): string {
  if (aprobadores.loading) {
    return `<p class="px-5 py-10 text-center text-sm text-text-secondary sm:px-6">Cargando aprobadores…</p>`;
  }
  if (items.length === 0) {
    return renderAprobadorEmptyState(tipo, busy);
  }
  return renderAprobadorTabla(aprobadores, items, busy);
}

function aprobadorHeadingId(tipo: AprobadorTipo): string {
  return tipo === "director" ? "aj-ap-director-titulo" : "aj-ap-gerentes-titulo";
}

function renderAprobadorEncabezado(
  tipo: AprobadorTipo,
  aprobadores: AprobadoresState,
  items: AprobadorItem[],
  busy: boolean,
): string {
  const copy = APROBADOR_CARD_COPY[tipo];
  const conRegistros = !aprobadores.loading && items.length > 0;
  return `
    <header class="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <h3 id="${aprobadorHeadingId(tipo)}" class="text-base font-semibold text-text-primary">${copy.titulo}</h3>
        <p class="mt-1.5 text-sm leading-relaxed text-text-secondary">${copy.descripcion}</p>
      </div>
      ${
        conRegistros
          ? `<button
              type="button"
              data-aj-ap-abrir-modal="${tipo}"
              class="${BTN_PRIMARY} w-full shrink-0 sm:w-auto disabled:cursor-not-allowed disabled:opacity-50"
              ${busy ? "disabled" : ""}
            >${copy.boton}</button>`
          : ""
      }
    </header>`;
}

function renderAprobadorContenedor(
  tipo: AprobadorTipo,
  aprobadores: AprobadoresState,
  items: AprobadorItem[],
  busy: boolean,
): string {
  const copy = APROBADOR_CARD_COPY[tipo];
  return `
    <section
      class="${RH_LISTADO_SURFACE} flex w-full min-w-0 flex-col overflow-hidden"
      aria-label="Datos de ${copy.titulo}"
    >
      ${renderAprobadorCardBody(tipo, aprobadores, items, busy)}
    </section>`;
}

function renderAprobadorCard(
  tipo: AprobadorTipo,
  aprobadores: AprobadoresState,
  items: AprobadorItem[],
  busy: boolean,
): string {
  const headingId = aprobadorHeadingId(tipo);
  return `
    <div class="grid w-full min-w-0 gap-4 sm:gap-6" aria-labelledby="${headingId}">
      ${renderAprobadorEncabezado(tipo, aprobadores, items, busy)}
      ${renderAprobadorContenedor(tipo, aprobadores, items, busy)}
    </div>`;
}

function renderAprobadoresMensajes(aprobadores: AprobadoresState): string {
  const success = aprobadores.successMessage
    ? `<p class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-900" role="status">${escapeHtml(aprobadores.successMessage)}</p>`
    : "";
  const error = aprobadores.errorMessage
    ? `<p class="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-800" role="alert">${escapeHtml(aprobadores.errorMessage)}</p>`
    : "";
  return success || error ? `<div class="grid gap-2">${success}${error}</div>` : "";
}

type AjustesScopedSectionCopy = {
  title: string;
  subtitle: string;
  chip: string;
  sectionId: string;
};

const AUTORIZACIONES_SECTION_COPY: AjustesScopedSectionCopy = {
  title: "Autorizaciones",
  subtitle: "Empleados autorizados para registrar horas extra y su administración.",
  chip: "Autorizaciones",
  sectionId: "aj-seccion-autorizaciones",
};

const APROBADORES_SECTION_COPY: AjustesScopedSectionCopy = {
  title: "Aprobadores",
  subtitle: "Gerentes regionales y director del flujo de aprobación de horas extra.",
  chip: "Aprobadores",
  sectionId: "aj-seccion-aprobadores",
};

function renderAutorizacionesSection(state: AjustesNominasState): string {
  const copy = AUTORIZACIONES_SECTION_COPY;
  return `
    <section
      id="${copy.sectionId}"
      class="${RH_LISTADO_SURFACE} border-l-[6px] border-l-[#1e40af] p-4 sm:p-5"
      aria-labelledby="${copy.sectionId}-titulo"
    >
      <header class="mb-4 border-b border-slate-200/90 pb-3">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 id="${copy.sectionId}-titulo" class="text-base font-semibold text-text-primary sm:text-lg">${escapeHtml(copy.title)}<span class="ml-2 inline-flex shrink-0 rounded-full border border-[#1e40af]/20 bg-[#eff6ff] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#1e40af]">${copy.chip}</span></h2>
        </div>
        <p class="mt-1.5 text-xs leading-snug text-text-muted sm:text-sm">${escapeHtml(copy.subtitle)}</p>
      </header>
      <div class="flex min-h-0 flex-1 flex-col gap-4 sm:gap-5">
        ${renderAutorizacionesContenido(state)}
      </div>
    </section>`;
}

function renderAprobadoresSection(state: AjustesNominasState): string {
  const copy = APROBADORES_SECTION_COPY;
  return `
    <section
      id="${copy.sectionId}"
      class="${RH_LISTADO_SURFACE} border-emerald-200/80 border-l-[6px] border-l-emerald-600 bg-linear-to-br from-emerald-50/40 via-white to-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] sm:p-5"
      aria-labelledby="${copy.sectionId}-titulo"
    >
      <header class="mb-4 border-b border-slate-200/90 pb-3">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 id="${copy.sectionId}-titulo" class="text-base font-semibold text-text-primary sm:text-lg">${escapeHtml(copy.title)}<span class="ml-2 inline-flex shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-900">${copy.chip}</span></h2>
        </div>
        <p class="mt-1.5 text-xs leading-snug text-text-muted sm:text-sm">${escapeHtml(copy.subtitle)}</p>
      </header>
      <div class="flex min-h-0 flex-1 flex-col gap-4 sm:gap-5">
        ${renderAprobadoresContenido(state)}
      </div>
    </section>`;
}

function renderAprobadoresModalResultados(modal: AprobadoresModalState): string {
  if (modal.searching) {
    return `<p class="px-1 py-6 text-center text-sm text-text-secondary">Buscando empleados…</p>`;
  }
  if (!modal.searched) {
    return `<p class="px-1 py-6 text-center text-sm text-text-muted">Escribe un nombre, número de empleado o correo para buscar empleados.</p>`;
  }
  if (modal.results.length === 0) {
    return `<p class="px-1 py-6 text-center text-sm text-text-secondary">Sin empleados disponibles que coincidan con la búsqueda.</p>`;
  }

  const single = modal.tipo === "director";
  const rows = modal.results
    .map((emp) => {
      const checked = modal.seleccionados.has(emp.empleadoId);
      const detalle = [emp.noEmpleado, emp.email, emp.areaPuesto].filter(Boolean).join(" · ");
      return `
      <label class="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${checked ? "border-leoni-blue/50 bg-blue-50/60" : "border-slate-200 bg-white hover:border-leoni-blue/30 hover:bg-slate-50"}">
        <input
          type="${single ? "radio" : "checkbox"}"
          ${single ? 'name="aj-ap-modal-director"' : ""}
          data-aj-ap-modal-check="${emp.empleadoId}"
          class="${CHECKBOX_CLS}"
          ${checked ? "checked" : ""}
          ${modal.submitting ? "disabled" : ""}
        />
        ${avatarHtml(emp.nombre)}
        <span class="min-w-0">
          <span class="block truncate text-sm font-medium text-text-primary">${escapeHtml(emp.nombre)}</span>
          <span class="block truncate text-xs text-text-muted">${escapeHtml(detalle)}</span>
        </span>
      </label>`;
    })
    .join("");

  return `<div class="grid gap-2" role="listbox" aria-label="Resultados de búsqueda">${rows}</div>`;
}

function renderAprobadoresModalSeleccionados(modal: AprobadoresModalState): string {
  if (modal.seleccionados.size === 0) {
    return `<p class="text-xs text-text-muted">${modal.tipo === "director" ? "Aún no has seleccionado un director." : "Aún no has seleccionado empleados."}</p>`;
  }
  const chips = [...modal.seleccionados.values()]
    .map(
      (emp) => `
      <span class="inline-flex max-w-full items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 py-1 pl-3 pr-1.5 text-xs font-semibold text-blue-900">
        <span class="truncate">${escapeHtml(emp.nombre)}</span>
        <button
          type="button"
          data-aj-ap-modal-quitar="${emp.empleadoId}"
          class="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-blue-700 transition hover:bg-blue-200/70"
          aria-label="Quitar a ${escapeHtml(emp.nombre)}"
          ${modal.submitting ? "disabled" : ""}
        >×</button>
      </span>`,
    )
    .join("");
  return `<div class="flex flex-wrap gap-1.5">${chips}</div>`;
}

function renderAprobadoresModal(aprobadores: AprobadoresState): string {
  const modal = aprobadores.modal;
  if (!modal) return "";
  const single = modal.tipo === "director";
  const count = modal.seleccionados.size;
  const confirmDisabled = count === 0 || modal.submitting;
  const titulo = single ? "Agregar director" : "Agregar gerente regional";
  const descripcion = single
    ? "Busca y selecciona al director que aprobará las horas extra. Solo puede haber un director activo."
    : "Busca y selecciona a los gerentes regionales que podrán aprobar horas extra. Los empleados ya registrados no aparecen en los resultados.";
  const confirmLabel = single ? "Guardar director" : "Guardar aprobadores";

  return `
    <div id="aj-ap-modal-backdrop" class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]" role="presentation">
      <div
        class="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="aj-ap-modal-titulo"
      >
        <header class="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div class="min-w-0">
            <h2 id="aj-ap-modal-titulo" class="text-lg font-semibold text-text-primary">${titulo}</h2>
            <p class="mt-1 text-sm text-text-secondary">${descripcion}</p>
          </div>
          <button type="button" id="aj-ap-modal-cerrar" class="${BTN_GHOST} shrink-0 px-2 py-1.5 text-xs" aria-label="Cerrar" ${modal.submitting ? "disabled" : ""}>
            <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <label for="aj-ap-modal-busqueda" class="${RH_LISTADO_LABEL}">Buscar empleado</label>
          <input
            id="aj-ap-modal-busqueda"
            type="search"
            value="${escapeHtml(modal.q)}"
            placeholder="Nombre, número de empleado o correo"
            autocomplete="off"
            class="${SEARCH_INPUT_CLS} ${FIELD_FOCUS}"
            ${modal.submitting ? "disabled" : ""}
          />
          ${
            modal.errorMessage
              ? `<p class="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800" role="alert">${escapeHtml(modal.errorMessage)}</p>`
              : ""
          }
          <div class="mt-4">
            ${renderAprobadoresModalResultados(modal)}
          </div>
          <div class="mt-5 border-t border-slate-100 pt-4">
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted" aria-live="polite">
              ${single ? "Director seleccionado" : `Seleccionados (${count})`}
            </p>
            ${renderAprobadoresModalSeleccionados(modal)}
          </div>
        </div>
        <footer class="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" id="aj-ap-modal-cancelar" class="${BTN_SECONDARY}" ${modal.submitting ? "disabled" : ""}>Cancelar</button>
          <button type="button" id="aj-ap-modal-confirmar" class="${BTN_PRIMARY} disabled:cursor-not-allowed disabled:opacity-50" ${confirmDisabled ? "disabled" : ""}>
            ${modal.submitting ? "Guardando…" : confirmLabel}
          </button>
        </footer>
      </div>
    </div>`;
}

export function renderAjustesNominasPage(state: AjustesNominasState): string {
  return `
    <div id="ajustes-nominas-page" class="${RH_DASHBOARD_PAGE_SHELL}">
      <div id="ajustes-nominas-root" class="rh-ajustes-module ${RH_LISTADO_PAGE_OUTER_GRADIENT} grid gap-4 sm:gap-6">
        ${renderPageStats(state)}
        ${renderEstadoFlujo(state)}
        ${renderAutorizacionesSection(state)}
        ${renderAprobadoresSection(state)}
      </div>
      ${renderModal(state)}
      ${renderAprobadoresModal(state.aprobadores)}
    </div>`;
}
