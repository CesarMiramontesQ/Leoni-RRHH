import { mountAppShell } from "../layouts/appShell.ts";
import {
  getPerfilesList,
  getAreasOptions,
  getResumenTarjetas,
  createPerfil,
  updatePerfil,
  deletePerfil,
  type PuestosFetchError,
  type AreaOption,
  type PerfilTarjetaItem,
} from "../api/puestos.ts";
import type {
  PerfilPuestoListItem,
  PerfilPuestoCreatePayload,
  PuestosFilterState,
} from "../dashboard/puestos/types.ts";
import { clearAuth } from "../auth/session.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_DANGER,
  BTN_GHOST,
  FIELD_FOCUS,
  SELECT_CHEVRON,
  FILTER_FIELD_WRAP,
} from "../ui/uiTokens.ts";

// ── Card view helpers ────────────────────────────────────────────────────

function cumplimientoBadge(pct: number): string {
  if (pct >= 90) {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-bold tabular-nums text-emerald-800"><span class="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true"></span>${pct}%</span>`;
  }
  if (pct >= 80) {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-bold tabular-nums text-amber-800"><span class="size-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true"></span>${pct}%</span>`;
  }
  return `<span class="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-bold tabular-nums text-red-800"><span class="size-1.5 shrink-0 rounded-full bg-red-400" aria-hidden="true"></span>${pct}%</span>`;
}

function brechasBar(brechas: number): string {
  const max = 15;
  const pct = Math.min(100, Math.round((brechas / max) * 100));
  const tone = brechas > 8 ? "bg-red-500" : brechas > 4 ? "bg-amber-400" : "bg-emerald-500";
  return `<div class="h-1.5 w-full rounded-full bg-slate-100"><div class="${tone} h-1.5 rounded-full" style="width:${pct}%"></div></div>`;
}

function renderKpiStrip(tarjetas: PerfilTarjetaItem[]): string {
  const totalPersonas = tarjetas.reduce((s, p) => s + p.personas, 0);
  const totalBrechas = tarjetas.reduce((s, p) => s + p.brechas, 0);
  const avgCumplimiento = tarjetas.length > 0
    ? Math.round(tarjetas.reduce((s, p) => s + p.cumplimiento_pct, 0) / tarjetas.length)
    : 0;
  const areas = new Set(tarjetas.map(p => p.area_nombre).filter(Boolean));

  const kpis = [
    { label: "Perfiles activos", value: String(tarjetas.length), sub: `En ${areas.size} areas` },
    { label: "Personas vinculadas", value: String(totalPersonas), sub: `${areas.size} areas operativas` },
    { label: "Cumplimiento promedio", value: `${avgCumplimiento}%`, sub: "Evaluaciones completadas" },
    { label: "Brechas totales", value: String(totalBrechas), sub: "Evaluaciones pendientes" },
  ];

  return `
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    ${kpis.map(k => `
      <div class="rounded-xl border border-border bg-white p-4 shadow-sm">
        <p class="text-xs font-medium text-text-muted">${k.label}</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-text-primary">${k.value}</p>
        <p class="mt-0.5 text-[11px] text-slate-500">${k.sub}</p>
      </div>
    `).join("")}
  </div>`;
}

function renderCardGrid(tarjetas: PerfilTarjetaItem[]): string {
  if (tarjetas.length === 0) {
    return `
    <div class="rounded-xl border border-dashed border-border/90 bg-slate-50/40 py-12 text-center">
      <p class="text-sm font-semibold text-text-primary">Sin perfiles de puesto</p>
      <p class="mt-1.5 text-xs text-text-muted">Crea un nuevo perfil para comenzar a gestionar competencias.</p>
    </div>`;
  }

  const cards = tarjetas.map(p => `
    <div class="flex flex-col gap-3 rounded-xl border border-border bg-white p-4 shadow-sm transition hover:shadow-md">
      <div class="flex items-center justify-between">
        <span class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-600">${escapeHtml(p.codigo)}</span>
        ${cumplimientoBadge(p.cumplimiento_pct)}
      </div>
      <div>
        <p class="text-sm font-semibold text-text-primary leading-tight">${escapeHtml(p.nombre)}</p>
        <p class="mt-0.5 text-xs text-text-muted">${escapeHtml(p.area_nombre ?? "")}</p>
      </div>
      <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px]">
        <div class="flex items-center gap-1.5">
          <svg class="size-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span><b class="font-semibold tabular-nums">${p.personas}</b> <span class="text-slate-500">personas</span></span>
        </div>
        <div class="flex items-center gap-1.5">
          <svg class="size-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          <span><b class="font-semibold tabular-nums">${p.cursos}</b> <span class="text-slate-500">cursos</span></span>
        </div>
        <div class="flex items-center gap-1.5">
          <svg class="size-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span><b class="font-semibold tabular-nums">${p.evidencias}</b> <span class="text-slate-500">evidencias</span></span>
        </div>
      </div>
      <div>
        <div class="flex items-center justify-between mb-1">
          <span class="text-[11px] text-slate-500">Brechas activas</span>
          <span class="font-mono text-xs font-semibold ${p.brechas > 5 ? "text-red-600" : "text-slate-700"}">${p.brechas}</span>
        </div>
        ${brechasBar(p.brechas)}
      </div>
      <div class="mt-auto flex items-stretch gap-2 border-t border-slate-100 pt-3">
        <a href="#/puestos/${p.id}" class="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-leoni-blue/20 bg-leoni-blue/5 px-3 py-1.5 text-center text-xs font-semibold text-leoni-blue hover:bg-leoni-blue/10 transition">Ver puesto</a>
        <a href="#/puestos/${p.id}/empleados" class="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-center text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">Ver empleados</a>
      </div>
    </div>
  `).join("");

  return `
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    ${cards}
  </div>`;
}

function renderViewToggle(active: "tabla" | "tarjetas"): string {
  const tabCls = (isActive: boolean) =>
    isActive
      ? "rounded-lg bg-leoni-blue px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
      : "rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition";
  return `
  <div class="inline-flex items-center gap-0.5 rounded-lg border border-border bg-slate-50 p-0.5" role="group" aria-label="Vista">
    <button type="button" data-action="view-tarjetas" aria-pressed="${active === "tarjetas"}" class="${tabCls(active === "tarjetas")}">Tarjetas</button>
    <button type="button" data-action="view-tabla" aria-pressed="${active === "tabla"}" class="${tabCls(active === "tabla")}">Tabla</button>
  </div>`;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function nivelLabel(nivel: string): string {
  const map: Record<string, string> = {
    operativo: "Operativo",
    mando_medio: "Mando Medio",
    gerencial: "Gerencial",
    directivo: "Directivo",
  };
  return map[nivel] ?? nivel;
}

function filterItems(
  items: PerfilPuestoListItem[],
  filters: PuestosFilterState,
): PerfilPuestoListItem[] {
  let result = items;

  if (filters.q.trim()) {
    const q = filters.q.trim().toLowerCase();
    result = result.filter(
      (p) =>
        p.codigo.toLowerCase().includes(q) ||
        p.nombre_puesto.toLowerCase().includes(q) ||
        p.area.toLowerCase().includes(q),
    );
  }

  if (filters.area) {
    result = result.filter((p) => p.area === filters.area);
  }

  if (filters.nivel) {
    result = result.filter((p) => p.nivel === filters.nivel);
  }

  return result;
}

function uniqueNiveles(items: PerfilPuestoListItem[]): string[] {
  return [...new Set(items.map((p) => p.nivel).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
}

function filterTarjetas(
  items: PerfilTarjetaItem[],
  filters: PuestosFilterState,
): PerfilTarjetaItem[] {
  let result = items;

  if (filters.q.trim()) {
    const q = filters.q.trim().toLowerCase();
    result = result.filter(
      (p) =>
        p.codigo.toLowerCase().includes(q) ||
        p.nombre.toLowerCase().includes(q) ||
        (p.area_nombre ?? "").toLowerCase().includes(q),
    );
  }

  if (filters.area) {
    result = result.filter((p) => p.area_nombre === filters.area);
  }

  if (filters.nivel) {
    result = result.filter((p) => p.nivel === filters.nivel);
  }

  return result;
}

function uniqueNivelesTarjetas(items: PerfilTarjetaItem[]): string[] {
  return [...new Set(items.map((p) => p.nivel).filter((n): n is string => n != null))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
}

// ── Render functions ─────────────────────────────────────────────────────

function renderFilterBar(filters: PuestosFilterState, areas: AreaOption[], niveles: string[]): string {
  const areaOpts = areas
    .map(
      (a) =>
        `<option value="${escapeHtml(a.label)}" ${filters.area === a.label ? "selected" : ""}>${escapeHtml(a.label)}</option>`,
    )
    .join("");
  const nivelOpts = niveles
    .map(
      (n) =>
        `<option value="${escapeHtml(n)}" ${filters.nivel === n ? "selected" : ""}>${escapeHtml(nivelLabel(n))}</option>`,
    )
    .join("");

  return `
  <section class="rounded-xl border border-border bg-white p-3 shadow-sm ring-1 ring-slate-900/5 sm:p-4" aria-label="Filtros de perfiles">
    <div class="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-2 sm:gap-x-3 xl:flex-nowrap">

      <!-- Busqueda -->
      <div class="${FILTER_FIELD_WRAP}">
        <label for="puestos-search" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Buscar</label>
        <input
          id="puestos-search"
          data-action="search"
          type="text"
          autocomplete="off"
          placeholder="Codigo, nombre o area..."
          value="${escapeHtml(filters.q)}"
          class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-muted ${FIELD_FOCUS}"
        />
      </div>

      <!-- Area -->
      <div class="${FILTER_FIELD_WRAP}">
        <label for="puestos-filter-area" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Area</label>
        <div class="relative grid grid-cols-1">
          <select
            id="puestos-filter-area"
            data-action="filter-area"
            class="col-start-1 row-start-1 w-full appearance-none rounded-lg border border-border bg-white py-2 pl-3 pr-8 text-sm ${FIELD_FOCUS}">
            <option value="" ${filters.area === "" ? "selected" : ""}>Todas las areas</option>
            ${areaOpts}
          </select>
          ${SELECT_CHEVRON}
        </div>
      </div>

      <!-- Nivel -->
      <div class="${FILTER_FIELD_WRAP}">
        <label for="puestos-filter-nivel" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Nivel</label>
        <div class="relative grid grid-cols-1">
          <select
            id="puestos-filter-nivel"
            data-action="filter-nivel"
            class="col-start-1 row-start-1 w-full appearance-none rounded-lg border border-border bg-white py-2 pl-3 pr-8 text-sm ${FIELD_FOCUS}">
            <option value="" ${filters.nivel === "" ? "selected" : ""}>Todos los niveles</option>
            ${nivelOpts}
          </select>
          ${SELECT_CHEVRON}
        </div>
      </div>

    </div>
  </section>`;
}

function renderTable(items: PerfilPuestoListItem[]): string {
  if (items.length === 0) {
    return `
    <div class="rounded-xl border border-dashed border-border/90 bg-slate-50/40 py-8 text-center">
      <p class="text-sm font-semibold text-text-primary">Sin perfiles encontrados</p>
      <p class="mt-1.5 text-xs text-text-muted">Ajusta los filtros o crea un nuevo perfil de puesto.</p>
    </div>`;
  }

  const rows = items
    .map(
      (p) => `
    <tr class="border-b border-slate-100/80 transition-colors hover:bg-slate-50/90">
      <td class="whitespace-nowrap px-4 py-3 text-sm font-medium tabular-nums text-text-primary">${escapeHtml(p.codigo)}</td>
      <td class="px-4 py-3 text-sm text-text-primary">${escapeHtml(p.nombre_puesto)}</td>
      <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(p.area)}</td>
      <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(nivelLabel(p.nivel))}</td>
      <td class="whitespace-nowrap px-4 py-3 text-sm tabular-nums text-slate-500">${escapeHtml(p.version)}</td>
      <td class="px-4 py-3 text-right align-middle">
        <div class="flex items-center justify-end gap-1">
          <button
            type="button"
            data-action="edit"
            data-id="${p.id}"
            title="Editar perfil"
            class="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-leoni-blue/10 hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue"
            aria-label="Editar ${escapeHtml(p.nombre_puesto)}"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true">
              <path d="M5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
              <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
            </svg>
          </button>
          <button
            type="button"
            data-action="delete"
            data-id="${p.id}"
            title="Eliminar perfil"
            class="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            aria-label="Eliminar ${escapeHtml(p.nombre_puesto)}"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true">
              <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 1 .7.8l-.5 6a.75.75 0 1 1-1.497-.124l.5-6a.75.75 0 0 1 .797-.676Zm3.64.8a.75.75 0 1 0-1.497-.124l-.5 6a.75.75 0 1 0 1.497.124l.5-6Z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </td>
    </tr>`,
    )
    .join("");

  return `
  <section class="overflow-hidden rounded-xl border border-border bg-white shadow-sm ring-1 ring-slate-900/5" aria-label="Tabla de perfiles de puesto">
    <div class="overflow-x-auto">
      <table class="min-w-[700px] w-full text-left">
        <thead class="border-b border-leoni-blue-light shadow-sm">
          <tr class="text-white">
            <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-left text-sm font-semibold">Codigo</th>
            <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-left text-sm font-semibold">Nombre</th>
            <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-left text-sm font-semibold">Area</th>
            <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-left text-sm font-semibold">Nivel</th>
            <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-left text-sm font-semibold">Version</th>
            <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-right text-sm font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100/90">${rows}</tbody>
      </table>
    </div>
  </section>`;
}

function renderModal(
  mode: "create" | "edit",
  values: { codigo: string; nombre_puesto: string; area: string; nivel: string },
  saving: boolean,
  areas: AreaOption[] = [],
): string {
  const title = mode === "create" ? "Nuevo Perfil de Puesto" : "Editar Perfil de Puesto";
  const submitLabel = saving ? "Guardando..." : mode === "create" ? "Crear Perfil" : "Guardar Cambios";

  return `
  <div data-action="modal-backdrop" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div class="w-full max-w-lg rounded-xl border border-border bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="puestos-modal-title">
      <h2 id="puestos-modal-title" class="text-lg font-semibold text-text-primary">${title}</h2>

      <form data-action="modal-form" class="mt-4 flex flex-col gap-4">
        <!-- Codigo -->
        <div>
          <label for="puestos-modal-codigo" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Codigo</label>
          <input
            id="puestos-modal-codigo"
            name="codigo"
            type="text"
            placeholder="Se genera automaticamente"
            value="${escapeHtml(values.codigo)}"
            readonly
            class="block w-full rounded-lg border border-border bg-gray-50 px-3 py-2 text-sm text-text-muted placeholder:text-text-muted ${FIELD_FOCUS}"
          />
        </div>

        <!-- Nombre del puesto -->
        <div>
          <label for="puestos-modal-nombre" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Nombre del Puesto</label>
          <input
            id="puestos-modal-nombre"
            name="nombre_puesto"
            type="text"
            required
            placeholder="Operador de Produccion N1"
            value="${escapeHtml(values.nombre_puesto)}"
            class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-muted ${FIELD_FOCUS}"
          />
        </div>

        <!-- Area -->
        <div>
          <label for="puestos-modal-area" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Area</label>
          <div class="relative grid grid-cols-1">
            <select
              id="puestos-modal-area"
              name="area"
              required
              class="col-start-1 row-start-1 w-full appearance-none rounded-lg border border-border bg-white py-2 pl-3 pr-8 text-sm text-text-primary ${FIELD_FOCUS}">
              <option value="">Seleccionar area...</option>
              ${areas.map((a) => `<option value="${a.id}" ${values.area === a.label ? "selected" : ""}>${escapeHtml(a.label)}</option>`).join("")}
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>

        <!-- Nivel -->
        <div>
          <label for="puestos-modal-nivel" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Nivel</label>
          <div class="relative grid grid-cols-1">
            <select
              id="puestos-modal-nivel"
              name="nivel"
              required
              class="col-start-1 row-start-1 w-full appearance-none rounded-lg border border-border bg-white py-2 pl-3 pr-8 text-sm text-text-primary ${FIELD_FOCUS}">
              <option value="operativo" ${values.nivel === "operativo" ? "selected" : ""}>Operativo</option>
              <option value="mando_medio" ${values.nivel === "mando_medio" ? "selected" : ""}>Mando Medio</option>
              <option value="gerencial" ${values.nivel === "gerencial" ? "selected" : ""}>Gerencial</option>
              <option value="directivo" ${values.nivel === "directivo" ? "selected" : ""}>Directivo</option>
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>

        <!-- Botones -->
        <div class="mt-2 flex items-center justify-end gap-2">
          <button type="button" data-action="modal-cancel" class="${BTN_SECONDARY}">Cancelar</button>
          <button type="submit" class="${BTN_PRIMARY}" ${saving ? "disabled" : ""}>${submitLabel}</button>
        </div>
      </form>
    </div>
  </div>`;
}

function renderDeleteConfirm(nombre: string, saving: boolean): string {
  return `
  <div data-action="modal-backdrop" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div class="w-full max-w-sm rounded-xl border border-border bg-white p-6 shadow-xl" role="alertdialog" aria-modal="true" aria-labelledby="puestos-delete-title">
      <h2 id="puestos-delete-title" class="text-lg font-semibold text-text-primary">Eliminar Perfil</h2>
      <p class="mt-2 text-sm text-text-secondary">
        Esta accion eliminara permanentemente el perfil <strong class="text-text-primary">${escapeHtml(nombre)}</strong>. No se puede deshacer.
      </p>
      <div class="mt-5 flex items-center justify-end gap-2">
        <button type="button" data-action="modal-cancel" class="${BTN_SECONDARY}">Cancelar</button>
        <button type="button" data-action="confirm-delete" class="${BTN_DANGER}" ${saving ? "disabled" : ""}>
          ${saving ? "Eliminando..." : "Eliminar"}
        </button>
      </div>
    </div>
  </div>`;
}

function renderLoading(): string {
  return `
  <div class="flex flex-col gap-4">
    <div class="h-12 w-full animate-pulse rounded-xl bg-slate-100"></div>
    <div class="h-64 w-full animate-pulse rounded-xl bg-slate-100"></div>
  </div>`;
}

function renderError(message: string): string {
  return `
  <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
    <p class="font-semibold">Error al cargar perfiles</p>
    <p class="mt-1">${escapeHtml(message)}</p>
    <button data-action="retry" type="button" class="${BTN_GHOST} mt-3">Reintentar</button>
  </div>`;
}

// ── Page mount ───────────────────────────────────────────────────────────

export function mountPuestos(container: HTMLElement, signal: AbortSignal): void {
  // State
  let allItems: PerfilPuestoListItem[] = [];
  let tarjetasData: PerfilTarjetaItem[] = [];
  let areasOptions: AreaOption[] = [];
  let status: "loading" | "ready" | "error" = "loading";
  let errorMessage = "";
  const filters: PuestosFilterState = { q: "", area: "", nivel: "" };
  let viewMode: "tabla" | "tarjetas" = "tarjetas";

  // Modal state
  let modalMode: "create" | "edit" | "delete" | null = null;
  let modalSaving = false;
  let editingId: number | null = null;
  let editingValues = { codigo: "", nombre_puesto: "", area: "", nivel: "operativo" };
  let deletingItem: PerfilPuestoListItem | null = null;

  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  // Mount shell
  mountAppShell(container, {
    pageTitle: "Perfiles de Puesto",
    activeNav: "puestos",
    mainHtml: `
      <div id="puestos-page-root" class="flex min-h-0 flex-1 flex-col gap-4 py-5 sm:gap-5 sm:py-6">
        <!-- Header -->
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 class="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">Perfiles de Puesto</h1>
            <p class="mt-0.5 text-sm text-text-muted">Catalogo de perfiles y competencias por posicion</p>
          </div>
          <button type="button" data-action="create" class="${BTN_PRIMARY}">
            <span aria-hidden="true">+</span> Nuevo Perfil
          </button>
        </div>
        <!-- Content area -->
        <div id="puestos-content">${renderLoading()}</div>
        <!-- Modal host -->
        <div id="puestos-modal-host"></div>
      </div>`,
  });

  const pageRoot = container.querySelector("#puestos-page-root") as HTMLElement | null;
  const contentEl = (): HTMLElement | null => container.querySelector("#puestos-content");
  const modalHost = (): HTMLElement | null => container.querySelector("#puestos-modal-host");

  // ── Paint ──────────────────────────────────────────────────────────────

  function paint(): void {
    const content = contentEl();
    if (!content) return;

    if (status === "loading") {
      content.innerHTML = renderLoading();
      return;
    }
    if (status === "error") {
      content.innerHTML = renderError(errorMessage);
      return;
    }

    if (viewMode === "tarjetas") {
      const niveles = uniqueNivelesTarjetas(tarjetasData);
      const filtered = filterTarjetas(tarjetasData, filters);

      const viewToggleHtml = `
        <div class="flex items-center justify-between">
          ${renderViewToggle(viewMode)}
          <span class="text-xs text-slate-500">${filtered.length} perfiles</span>
        </div>`;

      content.innerHTML = `
        ${renderFilterBar(filters, areasOptions, niveles)}
        <div class="mt-4">${renderKpiStrip(filtered)}</div>
        <div class="mt-4">${viewToggleHtml}</div>
        <div class="mt-4">${renderCardGrid(filtered)}</div>`;
    } else {
      const niveles = uniqueNiveles(allItems);
      const filtered = filterItems(allItems, filters);

      const viewToggleHtml = `
        <div class="flex items-center justify-between">
          ${renderViewToggle(viewMode)}
          <span class="text-xs text-slate-500">${filtered.length} perfiles</span>
        </div>`;

      content.innerHTML = `
        ${renderFilterBar(filters, areasOptions, niveles)}
        <div class="mt-4">${viewToggleHtml}</div>
        <div class="mt-4">${renderTable(filtered)}</div>`;
    }
  }

  function paintModal(): void {
    const host = modalHost();
    if (!host) return;

    if (modalMode === "create" || modalMode === "edit") {
      host.innerHTML = renderModal(modalMode, editingValues, modalSaving, areasOptions);
    } else if (modalMode === "delete" && deletingItem) {
      host.innerHTML = renderDeleteConfirm(deletingItem.nombre_puesto, modalSaving);
    } else {
      host.innerHTML = "";
    }
  }

  function closeModal(): void {
    modalMode = null;
    modalSaving = false;
    editingId = null;
    deletingItem = null;
    editingValues = { codigo: "", nombre_puesto: "", area: "", nivel: "operativo" };
    paintModal();
  }

  // ── Data loading ───────────────────────────────────────────────────────

  async function loadData(): Promise<void> {
    status = "loading";
    paint();
    try {
      const [items, areas, tarjetas] = await Promise.all([
        getPerfilesList(),
        getAreasOptions(),
        getResumenTarjetas(),
      ]);
      allItems = items;
      areasOptions = areas;
      tarjetasData = tarjetas;
      status = "ready";
      paint();
    } catch (e: unknown) {
      const err = e as PuestosFetchError;
      if (err.status === 401) {
        clearAuth();
        void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
          abortAuthenticatedShell();
          void import("./login.ts").then(({ mountLogin }) => mountLogin(container));
        });
        return;
      }
      status = "error";
      errorMessage = err.detail || "Error de conexion.";
      paint();
    }
  }

  // ── Event delegation ───────────────────────────────────────────────────

  if (pageRoot) {
    // Click events
    pageRoot.addEventListener(
      "click",
      (e) => {
        const t = e.target as HTMLElement;
        const actionEl = t.closest<HTMLElement>("[data-action]");
        if (!actionEl) return;
        const action = actionEl.getAttribute("data-action");

        switch (action) {
          case "create":
            modalMode = "create";
            editingId = null;
            editingValues = { codigo: "", nombre_puesto: "", area: "", nivel: "operativo" };
            paintModal();
            break;

          case "edit": {
            const id = Number.parseInt(actionEl.getAttribute("data-id") ?? "", 10);
            if (Number.isNaN(id)) return;
            const item = allItems.find((p) => p.id === id);
            if (!item) return;
            modalMode = "edit";
            editingId = id;
            editingValues = {
              codigo: item.codigo,
              nombre_puesto: item.nombre_puesto,
              area: item.area,
              nivel: item.nivel,
            };
            paintModal();
            break;
          }

          case "delete": {
            const id = Number.parseInt(actionEl.getAttribute("data-id") ?? "", 10);
            if (Number.isNaN(id)) return;
            const item = allItems.find((p) => p.id === id);
            if (!item) return;
            modalMode = "delete";
            deletingItem = item;
            paintModal();
            break;
          }

          case "modal-cancel":
            closeModal();
            break;

          case "modal-backdrop":
            if (t === actionEl) closeModal();
            break;

          case "confirm-delete":
            if (!deletingItem || modalSaving) return;
            void handleDelete();
            break;

          case "view-tarjetas":
            viewMode = "tarjetas";
            paint();
            break;

          case "view-tabla":
            viewMode = "tabla";
            paint();
            break;

          case "retry":
            void loadData();
            break;
        }
      },
      { signal },
    );

    // Form submit
    pageRoot.addEventListener(
      "submit",
      (e) => {
        const form = (e.target as HTMLElement).closest<HTMLFormElement>("[data-action='modal-form']");
        if (!form) return;
        e.preventDefault();
        if (modalSaving) return;
        void handleSave(form);
      },
      { signal },
    );

    // Input events for search (debounced)
    pageRoot.addEventListener(
      "input",
      (e) => {
        const t = e.target as HTMLElement;
        if (t.getAttribute("data-action") !== "search") return;
        clearTimeout(searchTimer);
        searchTimer = window.setTimeout(() => {
          filters.q = (t as HTMLInputElement).value;
          paint();
        }, 250);
      },
      { signal },
    );

    // Change events for select filters
    pageRoot.addEventListener(
      "change",
      (e) => {
        const t = e.target as HTMLElement;
        const action = t.getAttribute("data-action");
        if (action === "filter-area") {
          filters.area = (t as HTMLSelectElement).value;
          paint();
        } else if (action === "filter-nivel") {
          filters.nivel = (t as HTMLSelectElement).value;
          paint();
        }
      },
      { signal },
    );

    // Keyboard: Escape to close modal
    pageRoot.addEventListener(
      "keydown",
      (e) => {
        if ((e as KeyboardEvent).key === "Escape" && modalMode) {
          closeModal();
        }
      },
      { signal },
    );
  }

  // ── Handlers ───────────────────────────────────────────────────────────

  async function handleSave(form: HTMLFormElement): Promise<void> {
    const data = new FormData(form);
    const areaValue = (data.get("area") as string).trim();
    const areaId = areaValue ? Number(areaValue) : null;
    const areaLabel = areasOptions.find((a) => a.id === areaId)?.label ?? "";
    const payload: PerfilPuestoCreatePayload = {
      codigo: (data.get("codigo") as string).trim(),
      nombre_puesto: (data.get("nombre_puesto") as string).trim(),
      area: areaLabel,
      area_id: areaId,
      nivel: (data.get("nivel") as string).trim(),
    };

    if (!payload.nombre_puesto) return;

    modalSaving = true;
    paintModal();

    try {
      if (modalMode === "create") {
        await createPerfil(payload);
      } else if (modalMode === "edit" && editingId != null) {
        await updatePerfil(editingId, payload);
      }
      closeModal();
      await loadData();
    } catch (e: unknown) {
      const err = e as PuestosFetchError;
      modalSaving = false;
      paintModal();
      // Simple inline error — could enhance with toast in the future
      const titleEl = container.querySelector("#puestos-modal-title");
      if (titleEl) {
        const existing = titleEl.parentElement?.querySelector("[data-modal-error]");
        if (existing) existing.remove();
        titleEl.insertAdjacentHTML(
          "afterend",
          `<p data-modal-error class="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">${escapeHtml(err.detail || "Error al guardar")}</p>`,
        );
      }
    }
  }

  async function handleDelete(): Promise<void> {
    if (!deletingItem) return;
    modalSaving = true;
    paintModal();

    try {
      await deletePerfil(deletingItem.id);
      closeModal();
      await loadData();
    } catch (e: unknown) {
      const err = e as PuestosFetchError;
      modalSaving = false;
      paintModal();
      const titleEl = container.querySelector("#puestos-delete-title");
      if (titleEl) {
        const existing = titleEl.parentElement?.querySelector("[data-modal-error]");
        if (existing) existing.remove();
        titleEl.insertAdjacentHTML(
          "afterend",
          `<p data-modal-error class="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">${escapeHtml(err.detail || "Error al eliminar")}</p>`,
        );
      }
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────

  signal.addEventListener("abort", () => {
    clearTimeout(searchTimer);
  });

  // ── Init ───────────────────────────────────────────────────────────────

  void loadData();
}
