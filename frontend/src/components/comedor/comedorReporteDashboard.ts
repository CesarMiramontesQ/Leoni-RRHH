import type { ReporteComedorEmpleadoRow, ReporteComedorKpi, ReporteComedorViewState } from "../../comedor/reportes/types.ts";
import { escapeComedorHtml, renderEmpleadoAvatarCell } from "./comedorUiUtils.ts";

const SELECT_CHEVRON = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-500 sm:size-4">
  <path fill-rule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
</svg>`;

function iconForKpi(id: ReporteComedorKpi["icono"]): string {
  if (id === "empleados") {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="size-5"><path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  if (id === "asistencia") {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="size-5"><path d="M3 13.5h3l1.5-3 3 6 2.5-5 1.5 2H21" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 4.5h15A1.5 1.5 0 0 1 21 6v12a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V6a1.5 1.5 0 0 1 1.5-1.5Z" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  if (id === "consumo") {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="size-5"><path d="M15.75 6.75v10.5m-4.5-7.5v7.5m-4.5-4.5v4.5m13.5 2.25H3.75V4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="size-5"><path d="M12 6v12m6-6H6" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 3.75a8.25 8.25 0 1 0 0 16.5 8.25 8.25 0 0 0 0-16.5Z" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function renderHeader(): string {
  return `
    <header>
      <h1 class="text-2xl font-semibold tracking-tight text-text-primary">Reporte comedor</h1>
      <p class="mt-1 text-sm text-text-muted">Tablero analítico para monitoreo de asistencia, consumo y costos de comedor.</p>
    </header>`;
}

function renderFilterSelect(
  id: string,
  label: string,
  value: string,
  options: readonly { id: string; label: string }[],
  dataAttr: string,
): string {
  const optionsHtml = options
    .map(
      (option) =>
        `<option value="${escapeComedorHtml(option.id)}" ${value === option.id ? "selected" : ""}>${escapeComedorHtml(option.label)}</option>`,
    )
    .join("");
  return `
    <div class="min-w-0">
      <label for="${id}" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeComedorHtml(label)}</label>
      <div class="grid grid-cols-1">
        <select id="${id}" data-comedor-reporte-filter="${dataAttr}" class="col-start-1 row-start-1 w-full appearance-none rounded-lg border border-slate-300 bg-white py-2 pr-8 pl-3 text-sm text-slate-900 shadow-sm focus:border-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2">
          ${optionsHtml}
        </select>
        ${SELECT_CHEVRON}
      </div>
    </div>`;
}

function renderFilters(state: ReporteComedorViewState): string {
  return `
    <section class="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
        ${renderFilterSelect(
          "reporte-comedor-departamento",
          "Departamento",
          state.selectedDepartamentoId,
          state.filtersDataset.departamentos,
          "departamento",
        )}
        ${renderFilterSelect(
          "reporte-comedor-turno",
          "Turno",
          state.selectedTurnoId,
          state.filtersDataset.turnos,
          "turno",
        )}
        <div class="min-w-0">
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Rango de fecha</label>
          <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <input
              type="date"
              data-comedor-reporte-filter="fecha_inicio"
              value="${escapeComedorHtml(state.selectedFechaInicioIso)}"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
            />
            <span class="text-xs font-semibold text-slate-500">a</span>
            <input
              type="date"
              data-comedor-reporte-filter="fecha_fin"
              value="${escapeComedorHtml(state.selectedFechaFinIso)}"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
            />
          </div>
        </div>
      </div>
    </section>`;
}

function renderKpis(state: ReporteComedorViewState): string {
  if (state.kpisState === "loading") {
    return `<section class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      ${Array.from({ length: 4 })
        .map(
          () => `<article class="animate-pulse rounded-xl border border-border bg-white p-4 shadow-sm">
            <div class="h-8 w-8 rounded-lg bg-slate-100"></div>
            <div class="mt-3 h-3 w-36 rounded bg-slate-100"></div>
            <div class="mt-2 h-7 w-24 rounded bg-slate-200"></div>
            <div class="mt-2 h-3 w-40 rounded bg-slate-100"></div>
          </article>`,
        )
        .join("")}
    </section>`;
  }

  if (state.kpisState === "error") {
    return `
      <section class="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
        <p class="font-semibold">No fue posible cargar las métricas del reporte.</p>
        <p class="mt-1">${escapeComedorHtml(state.kpisError ?? "Error inesperado.")}</p>
        <button type="button" data-comedor-reporte-retry-kpis class="mt-3 inline-flex items-center rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">
          Reintentar
        </button>
      </section>`;
  }

  if (state.kpisState === "empty" || !state.kpis || state.kpis.length === 0) {
    return `<section class="rounded-xl border border-border bg-white px-4 py-6 text-sm text-text-muted">No hay métricas disponibles para los filtros seleccionados.</section>`;
  }

  return `<section class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
    ${state.kpis
      .map(
        (kpi) => `
          <article class="rounded-xl border border-border bg-white p-4 shadow-sm">
            <div class="inline-flex size-9 items-center justify-center rounded-lg bg-leoni-blue/10 text-leoni-blue">${iconForKpi(kpi.icono)}</div>
            <p class="mt-3 text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeComedorHtml(kpi.label)}</p>
            <p class="mt-1 text-3xl font-bold tracking-tight text-text-primary">${escapeComedorHtml(kpi.valor)}</p>
            <p class="mt-2 text-xs text-text-muted">${escapeComedorHtml(kpi.secundario)}</p>
          </article>`,
      )
      .join("")}
  </section>`;
}

function menuBadge(menu: ReporteComedorEmpleadoRow["menu"]): string {
  if (menu === "dieta") {
    return '<span class="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">Dieta</span>';
  }
  return '<span class="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Normal</span>';
}

function renderTable(state: ReporteComedorViewState): string {
  if (state.tableState === "loading") {
    return `
      <section class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5">
        <div class="animate-pulse p-4">
          <div class="h-10 rounded bg-slate-100"></div>
          <div class="mt-3 h-10 rounded bg-slate-100"></div>
          <div class="mt-3 h-10 rounded bg-slate-100"></div>
        </div>
      </section>`;
  }

  if (state.tableState === "error") {
    return `
      <section class="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700 shadow-sm">
        <p class="font-semibold">No fue posible cargar la tabla de empleados.</p>
        <p class="mt-1">${escapeComedorHtml(state.tableError ?? "Error inesperado.")}</p>
        <button type="button" data-comedor-reporte-retry-table class="mt-3 inline-flex rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">
          Reintentar
        </button>
      </section>`;
  }

  const rows = state.table?.empleados ?? [];
  if (state.tableState === "empty" || rows.length === 0) {
    return `
      <section class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5">
        <p class="px-4 py-14 text-center text-sm text-slate-500">No hay empleados para los filtros actuales.</p>
      </section>`;
  }

  return `
    <section class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5">
      <div class="overflow-x-auto">
        <table class="min-w-[860px] w-full text-left">
          <thead class="border-b border-leoni-blue-light bg-white">
            <tr>
              <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Empleado</th>
              <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Días (mes)</th>
              <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Menú</th>
              <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Acción</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100/90">
            ${rows
              .map((row) => {
                const isSelected = row.id === state.selectedEmpleadoId;
                return `
                  <tr data-comedor-reporte-row="${escapeComedorHtml(row.id)}" class="cursor-pointer ${isSelected ? "bg-leoni-blue/5" : "hover:bg-slate-50"}">
                    <td class="px-4 py-3">
                      ${renderEmpleadoAvatarCell(row.nombre, row.noEmpleado, row.avatarUrl)}
                      <p class="mt-1 pl-11 text-xs text-slate-500">${escapeComedorHtml(row.area)}</p>
                    </td>
                    <td class="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-900">${escapeComedorHtml(row.diasMes)}</td>
                    <td class="whitespace-nowrap px-4 py-3">${menuBadge(row.menu)}</td>
                    <td class="whitespace-nowrap px-4 py-3">
                      <div class="flex items-center gap-2">
                        <button type="button" data-comedor-reporte-row="${escapeComedorHtml(row.id)}" class="text-sm font-semibold text-leoni-blue hover:underline">Ver análisis</button>
                        ${
                          row.activo ?
                            '<span class="inline-flex items-center rounded-full bg-leoni-blue px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Activo</span>'
                          : '<span class="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700">Inactivo</span>'
                        }
                      </div>
                    </td>
                  </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </section>`;
}

function renderWeeklyBars(values: readonly number[]): string {
  const labels = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
  return `<div class="rounded-xl border border-slate-200 bg-white p-4">
    <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Asistencia semanal</p>
    <div class="mt-3 flex h-28 items-end gap-2">
      ${values
        .map((value, index) => {
          const height = Math.max(8, Math.min(100, Math.round(value)));
          return `<div class="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div class="w-full rounded bg-leoni-blue/15">
              <div class="w-full rounded bg-leoni-blue" style="height:${height}px"></div>
            </div>
            <span class="text-[10px] font-semibold text-slate-500">${labels[index] ?? "-"}</span>
          </div>`;
        })
        .join("")}
    </div>
  </div>`;
}

function renderMenuPreference(percent: number): string {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  return `<div class="rounded-xl border border-slate-200 bg-white p-4">
    <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Preferencia menú</p>
    <div class="mt-3 flex items-center gap-3">
      <div class="grid size-16 place-items-center rounded-full" style="background:conic-gradient(#3b82f6 ${safePercent}%, #e2e8f0 0);">
        <div class="grid size-12 place-items-center rounded-full bg-white text-xs font-bold text-slate-700">${safePercent}%</div>
      </div>
      <p class="text-sm text-slate-600">Dieta especial elegida en ${safePercent}% de asistencias.</p>
    </div>
  </div>`;
}

function renderComments(comments: readonly ReporteComedorEmpleadoRow["comentarios"][number][]): string {
  if (comments.length === 0) {
    return `<div class="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Sin comentarios o alergias registradas.</div>`;
  }
  return comments
    .map((comment) => {
      const toneClass =
        comment.tono === "alerta" ?
          "border-amber-200 bg-amber-50 text-amber-800"
        : "border-blue-200 bg-blue-50 text-blue-800";
      const icon = comment.tono === "alerta" ? "!" : "i";
      return `<article class="rounded-xl border px-3 py-2 ${toneClass}">
        <p class="text-xs font-semibold uppercase tracking-wide">${icon} ${escapeComedorHtml(comment.titulo)}</p>
        <p class="mt-1 text-xs">${escapeComedorHtml(comment.detalle)}</p>
      </article>`;
    })
    .join("");
}

function renderProfileContent(state: ReporteComedorViewState): string {
  if (state.tableState === "loading") {
    return `<div class="animate-pulse space-y-3">
      <div class="h-4 w-44 rounded bg-slate-100"></div>
      <div class="h-24 rounded bg-slate-100"></div>
      <div class="h-20 rounded bg-slate-100"></div>
    </div>`;
  }
  if (state.tableState === "error") {
    return `<p class="text-sm text-slate-500">No se puede mostrar perfil individual hasta recuperar la tabla.</p>`;
  }
  const selected = (state.table?.empleados ?? []).find((item) => item.id === state.selectedEmpleadoId) ?? null;
  if (!selected) {
    return `<p class="text-sm text-slate-500">Selecciona un empleado para ver su perfil individual.</p>`;
  }
  return `
    <div>
      <h3 class="text-2xl font-semibold text-text-primary">${escapeComedorHtml(selected.nombre)}</h3>
      <p class="mt-1 text-sm text-slate-500">Ultima asistencia: ${escapeComedorHtml(selected.ultimaAsistencia)}</p>
    </div>
    ${renderWeeklyBars(selected.asistenciaSemanal)}
    ${renderMenuPreference(selected.preferenciaDietaPercent)}
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Comentarios / alergias</p>
      ${renderComments(selected.comentarios)}
    </section>
    <button type="button" class="inline-flex w-full items-center justify-center rounded-lg bg-leoni-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-leoni-blue-light">
      Descargar reporte full
    </button>`;
}

function renderSidebar(state: ReporteComedorViewState): string {
  const content = renderProfileContent(state);
  return `
    <aside class="space-y-3">
      <section class="hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:block">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-leoni-blue">Perfil individual</h2>
        <div class="mt-3 space-y-3">${content}</div>
      </section>
      <details class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:hidden" open>
        <summary class="cursor-pointer text-xs font-semibold uppercase tracking-wide text-leoni-blue">Perfil individual</summary>
        <div class="mt-3 space-y-3">${content}</div>
      </details>
    </aside>`;
}

function renderHelpFooter(): string {
  return `
    <section class="rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm ring-1 ring-slate-900/5">
      ¿Necesitas ayuda con los datos?
    </section>`;
}

export function renderComedorReporteDashboard(state: ReporteComedorViewState): string {
  return `
    <div class="flex min-h-[calc(100dvh-11rem)] flex-col gap-4 sm:gap-5">
      ${renderHeader()}
      ${renderFilters(state)}
      ${renderKpis(state)}
      <section class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <div class="space-y-4">
          ${renderTable(state)}
        </div>
        ${renderSidebar(state)}
      </section>
      ${renderHelpFooter()}
    </div>`;
}
