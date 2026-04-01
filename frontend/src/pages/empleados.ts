import {
  getEmpleadosCatalogoFiltros,
  getEmpleadosPage,
  getEmpleadosResumen,
} from "../api/empleados.ts";
import {
  isUsuariosFetchError,
  type CatalogoFiltros,
  type UsuarioListItem,
  type UsuarioPage,
  type UsuarioResumen,
} from "../api/usuarios.ts";
import { canAccessEmpleadosPage, canAccessUsuariosAdmin } from "../auth/jwt.ts";
import { clearAuth } from "../auth/session.ts";
import { renderNuevoEmpleadoButton } from "../components/empleados/nuevoEmpleadoButton.ts";
import { mountNuevoEmpleadoModal } from "../components/empleados/nuevoEmpleadoModal.ts";
import { mountAppShell } from "../layouts/appShell.ts";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function initials(nombre: string, apellido: string): string {
  const a = (nombre[0] ?? "").toUpperCase();
  const b = (apellido[0] ?? "").toUpperCase();
  return (a + b) || "?";
}

type State = {
  page: number;
  page_size: number;
  q: string;
  departamento: string;
  puesto: string;
  activo: "" | "true" | "false";
};

function parseActivo(s: State["activo"]): boolean | undefined {
  if (s === "true") return true;
  if (s === "false") return false;
  return undefined;
}

function paginationRange(totalPages: number, p: number): (number | "ellipsis")[] {
  if (totalPages <= 0) return [];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const out: (number | "ellipsis")[] = [];
  const push = (x: number | "ellipsis"): void => {
    if (out[out.length - 1] !== x) out.push(x);
  };
  push(1);
  if (p > 3) push("ellipsis");
  const start = Math.max(2, p - 1);
  const end = Math.min(totalPages - 1, p + 1);
  for (let i = start; i <= end; i++) push(i);
  if (p < totalPages - 2) push("ellipsis");
  push(totalPages);
  return out;
}

function renderKpis(r: UsuarioResumen, isRh: boolean): string {
  if (!isRh) {
    return `
    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
      <article class="rounded-xl border border-border bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm font-medium text-text-muted">Empleados activos</p>
          <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-leoni-blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true">
              <path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Z" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </div>
        <p class="mt-3 text-3xl font-bold tracking-tight text-text-primary">${escapeHtml(String(r.activos))}</p>
        <p class="mt-2 text-xs font-medium text-text-muted">Directorio de consulta (solo activos)</p>
      </article>
      <article class="rounded-xl border border-border bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm font-medium text-text-muted">Capacitación</p>
          <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true">
              <path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </div>
        <p class="mt-3 text-3xl font-bold tracking-tight text-text-primary">${escapeHtml(String(r.capacitacion_pendiente))}</p>
        <p class="mt-2 text-xs font-medium text-amber-600">Sin integración</p>
      </article>
      <article class="rounded-xl border border-border bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm font-medium text-text-muted">Practicantes</p>
          <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true">
              <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </div>
        <p class="mt-3 text-3xl font-bold tracking-tight text-text-primary">${escapeHtml(String(r.practicantes))}</p>
        <p class="mt-2 text-xs font-medium text-amber-600">N/D · Sin integración</p>
      </article>
    </div>`;
  }

  return `
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article class="rounded-xl border border-border bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm font-medium text-text-muted">Total de plantilla</p>
          <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-leoni-blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true">
              <path d="M18 18.72a9.09 9.09 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m15.53-4.35-3-3m0 0-3 3m3-3v12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </div>
        <p class="mt-3 text-3xl font-bold tracking-tight text-text-primary">${escapeHtml(String(r.total_plantilla))}</p>
        <p class="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-700">
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M12 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm7-5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1-9a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM4 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1-5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd" /></svg>
          Plantilla registrada
        </p>
      </article>
      <article class="rounded-xl border border-border bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm font-medium text-text-muted">Activos</p>
          <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true">
              <path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </div>
        <p class="mt-3 text-3xl font-bold tracking-tight text-text-primary">${escapeHtml(String(r.activos))}</p>
        <p class="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600">
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" /></svg>
          ${escapeHtml(String(r.porcentaje_operatividad))}% operatividad
        </p>
      </article>
      <article class="rounded-xl border border-border bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm font-medium text-text-muted">Capacitación</p>
          <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true">
              <path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </div>
        <p class="mt-3 text-3xl font-bold tracking-tight text-text-primary">${escapeHtml(String(r.capacitacion_pendiente))}</p>
        <p class="mt-2 flex items-center gap-1 text-xs font-medium text-amber-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4" aria-hidden="true"><path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke-linecap="round" stroke-linejoin="round" /></svg>
          Sin integración
        </p>
      </article>
      <article class="rounded-xl border border-border bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm font-medium text-text-muted">Practicantes</p>
          <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true">
              <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </div>
        <p class="mt-3 text-3xl font-bold tracking-tight text-text-primary">${escapeHtml(String(r.practicantes))}</p>
        <p class="mt-2 text-xs font-medium text-amber-600">N/D · Sin integración</p>
      </article>
    </div>`;
}

function optionList(values: string[], selected: string, emptyLabel: string): string {
  const head = `<option value="" ${selected === "" ? "selected" : ""}>${escapeHtml(emptyLabel)}</option>`;
  const rest = values
    .map((v) => `<option value="${escapeHtml(v)}" ${v === selected ? "selected" : ""}>${escapeHtml(v)}</option>`)
    .join("");
  return head + rest;
}

function statusPill(activo: boolean): string {
  if (activo) {
    return `<span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
      <span class="size-1.5 rounded-full bg-emerald-500"></span>Activo</span>`;
  }
  return `<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
    <span class="size-1.5 rounded-full bg-slate-400"></span>Inactivo</span>`;
}

function rowHtml(u: UsuarioListItem): string {
  const name = `${u.nombre} ${u.apellido}`.trim();
  const ini = initials(u.nombre, u.apellido);
  const sup = u.supervisor_nombre?.trim() || "—";
  const area = u.departamento?.trim() || "—";
  const puesto = u.puesto?.trim() || "—";
  return `
    <tr class="border-b border-slate-100 last:border-0 transition-colors hover:bg-surface">
      <td class="px-4 py-3">
        <div class="flex items-center gap-3">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-leoni-blue-light text-xs font-semibold text-white">${escapeHtml(ini)}</span>
          <div>
            <p class="text-sm font-semibold text-text-primary">${escapeHtml(name)}</p>
            <p class="text-xs text-text-muted">${escapeHtml(u.email)}</p>
          </div>
        </div>
      </td>
      <td class="px-4 py-3 text-sm text-text-muted">#${escapeHtml(u.num_empleado)}</td>
      <td class="px-4 py-3 text-sm text-text-primary">${escapeHtml(area)}</td>
      <td class="px-4 py-3 text-sm text-text-primary">${escapeHtml(puesto)}</td>
      <td class="px-4 py-3 text-sm text-text-primary">${escapeHtml(sup)}</td>
      <td class="px-4 py-3">${statusPill(u.activo)}</td>
    </tr>`;
}

function renderPanel(
  state: State,
  catalogo: CatalogoFiltros,
  pg: UsuarioPage,
  isRh: boolean,
): string {
  const totalPages = Math.max(1, Math.ceil(pg.total / pg.page_size) || 1);
  const from = pg.total === 0 ? 0 : (pg.page - 1) * pg.page_size + 1;
  const to = Math.min(pg.page * pg.page_size, pg.total);
  const pages = paginationRange(totalPages, pg.page);

  const rows =
    pg.items.length === 0
      ? `<tr><td colspan="6" class="px-4 py-10 text-center text-sm text-text-muted">No hay empleados con los filtros actuales.</td></tr>`
      : pg.items.map(rowHtml).join("");

  const pageButtons = pages
    .map((x) => {
      if (x === "ellipsis") {
        return `<span class="px-2 py-1 text-sm text-text-muted">…</span>`;
      }
      const active = x === pg.page;
      const cls = active
        ? "min-w-[2.25rem] rounded-md bg-leoni-blue px-3 py-1.5 text-sm font-semibold text-white"
        : "min-w-[2.25rem] rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-surface";
      return `<button type="button" data-emp-page="${x}" class="${cls}">${x}</button>`;
    })
    .join("");

  return `
    <div class="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div class="flex flex-col gap-4 border-b border-slate-100 p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <div class="relative min-w-[min(100%,20rem)] flex-1">
          <svg viewBox="0 0 20 20" fill="currentColor" class="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-text-muted" aria-hidden="true">
            <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd" />
          </svg>
          <input
            id="emp-search"
            type="search"
            autocomplete="off"
            placeholder="Buscar por nombre, ID o número de empleado…"
            value="${escapeHtml(state.q)}"
            class="block w-full rounded-lg border border-border bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-leoni-blue focus:outline-none focus:ring-1 focus:ring-leoni-blue"
          />
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <select id="emp-filter-area" class="rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-leoni-blue focus:outline-none focus:ring-1 focus:ring-leoni-blue">
            ${optionList(catalogo.departamentos, state.departamento, "Área: Todas")}
          </select>
          ${
            isRh
              ? `<select id="emp-filter-status" class="rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-leoni-blue focus:outline-none focus:ring-1 focus:ring-leoni-blue">
            <option value="" ${state.activo === "" ? "selected" : ""}>Estatus: Todos</option>
            <option value="true" ${state.activo === "true" ? "selected" : ""}>Activo</option>
            <option value="false" ${state.activo === "false" ? "selected" : ""}>Inactivo</option>
          </select>`
              : ""
          }
          <select id="emp-filter-puesto" class="rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-leoni-blue focus:outline-none focus:ring-1 focus:ring-leoni-blue">
            ${optionList(catalogo.puestos, state.puesto, "Puesto: Todos")}
          </select>
          <button type="button" id="emp-filter-more" class="inline-flex items-center justify-center rounded-lg border border-border bg-white p-2 text-text-muted hover:bg-surface hover:text-text-primary" aria-label="Más filtros">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true">
              <path d="M3 4.5h18M6 12h12m-9 7.5h6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-left">
          <thead>
            <tr class="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-text-muted">
              <th class="px-4 py-3">Empleado</th>
              <th class="px-4 py-3">Número</th>
              <th class="px-4 py-3">Área</th>
              <th class="px-4 py-3">Puesto</th>
              <th class="px-4 py-3">Supervisor</th>
              <th class="px-4 py-3">Estatus</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm text-text-muted">Mostrando ${from}–${to} de ${pg.total} empleados</p>
        <div class="flex flex-wrap items-center gap-1">
          <button type="button" data-emp-page="${pg.page - 1}" ${pg.page <= 1 ? "disabled" : ""}
            class="rounded-md border border-border bg-white p-2 text-text-muted disabled:cursor-not-allowed disabled:opacity-40 hover:bg-surface">
            <span class="sr-only">Anterior</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-5" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
          </button>
          ${pageButtons}
          <button type="button" data-emp-page="${pg.page + 1}" ${pg.page >= totalPages ? "disabled" : ""}
            class="rounded-md border border-border bg-white p-2 text-text-muted disabled:cursor-not-allowed disabled:opacity-40 hover:bg-surface">
            <span class="sr-only">Siguiente</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-5" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" /></svg>
          </button>
        </div>
      </div>
    </div>`;
}

function forbiddenHtml(): string {
  return `
    <div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
      <p class="font-semibold">Acceso restringido</p>
      <p class="mt-1">Se requiere rol RH, gerente, director o supervisor para el directorio.</p>
      <a href="#/" class="mt-3 inline-block font-semibold text-leoni-blue hover:underline">Volver al dashboard</a>
    </div>`;
}

export function mountEmpleados(container: HTMLElement, signal: AbortSignal): void {
  if (!canAccessEmpleadosPage()) {
    mountAppShell(container, {
      pageTitle: "Empleados",
      activeNav: "empleados",
      mainHtml: forbiddenHtml(),
    });
    return;
  }

  const isRh = canAccessUsuariosAdmin();

  const state: State = {
    page: 1,
    page_size: 10,
    q: "",
    departamento: "",
    puesto: "",
    activo: "",
  };

  let catalogo: CatalogoFiltros = { departamentos: [], puestos: [] };
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  mountAppShell(container, {
    pageTitle: "Empleados",
    activeNav: "empleados",
    mainHtml: `
      <div id="empleados-root" class="space-y-6">
        <div class="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 class="text-2xl font-bold tracking-tight text-slate-800">Empleados</h1>
          ${isRh ? renderNuevoEmpleadoButton() : ""}
        </div>
        <div id="empleados-kpis">
          <div class="flex items-center gap-3 py-4 text-sm text-text-muted">
            <svg class="size-5 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            Cargando indicadores…
          </div>
        </div>
        <div id="empleados-panel">
          <div class="flex items-center gap-3 rounded-xl border border-border bg-white p-6 text-sm text-text-muted">
            <svg class="size-5 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            Cargando tabla…
          </div>
        </div>
      </div>
      ${isRh ? `<div id="nuevo-empleado-modal-host"></div>` : ""}`,
  });

  const empleadosRoot = container.querySelector("#empleados-root") as HTMLElement | null;
  const modalHost = container.querySelector("#nuevo-empleado-modal-host") as HTMLElement | null;
  if (isRh && empleadosRoot && modalHost) {
    const modal = mountNuevoEmpleadoModal(modalHost, {
      getCatalogo: () => catalogo,
      onSuccess: () => void init(),
      onSessionExpired: () => {
        clearAuth();
        void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
          abortAuthenticatedShell();
          void import("./login.ts").then(({ mountLogin }) => mountLogin(container));
        });
      },
      toastContainer: empleadosRoot,
      signal,
    });
    container.addEventListener(
      "click",
      (e) => {
        const t = e.target as HTMLElement;
        if (t.closest("#btn-nuevo-empleado")) void modal.open();
      },
      { signal },
    );
  }

  const kpisEl = (): HTMLElement | null => container.querySelector("#empleados-kpis");
  const panelEl = (): HTMLElement | null => container.querySelector("#empleados-panel");

  function renderError(message: string): string {
    return `<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">${escapeHtml(message)}</div>`;
  }

  async function loadPage(): Promise<void> {
    const panel = panelEl();
    if (!panel) return;
    panel.innerHTML = `<div class="flex items-center gap-3 rounded-xl border border-border bg-white p-6 text-sm text-text-muted"><svg class="size-5 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Cargando tabla…</div>`;
    try {
      const pg = await getEmpleadosPage({
        page: state.page,
        page_size: state.page_size,
        q: state.q,
        departamento: state.departamento || undefined,
        puesto: state.puesto || undefined,
        activo: isRh ? parseActivo(state.activo) : undefined,
      });
      panel.innerHTML = renderPanel(state, catalogo, pg, isRh);
    } catch (e: unknown) {
      if (isUsuariosFetchError(e) && e.status === 401) {
        clearAuth();
        void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
          abortAuthenticatedShell();
          void import("./login.ts").then(({ mountLogin }) => mountLogin(container));
        });
        return;
      }
      const msg =
        isUsuariosFetchError(e) && e.status === 403
          ? e.detail
          : isUsuariosFetchError(e)
            ? e.detail
            : "Error de conexión.";
      panel.innerHTML = `<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">${escapeHtml(msg)}</div>`;
    }
  }

  async function init(): Promise<void> {
    const kpis = kpisEl();
    try {
      const [res, cat, pg] = await Promise.all([
        getEmpleadosResumen(),
        getEmpleadosCatalogoFiltros(),
        getEmpleadosPage({
          page: state.page,
          page_size: state.page_size,
          q: state.q,
          departamento: state.departamento || undefined,
          puesto: state.puesto || undefined,
          activo: isRh ? parseActivo(state.activo) : undefined,
        }),
      ]);
      catalogo = cat;
      if (kpis) kpis.innerHTML = renderKpis(res, isRh);
      const panel = panelEl();
      if (panel) panel.innerHTML = renderPanel(state, catalogo, pg, isRh);
    } catch (e: unknown) {
      if (isUsuariosFetchError(e) && e.status === 401) {
        clearAuth();
        void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
          abortAuthenticatedShell();
          void import("./login.ts").then(({ mountLogin }) => mountLogin(container));
        });
        return;
      }
      const msg = isUsuariosFetchError(e) ? e.detail : "Error de conexión.";
      if (kpis) kpis.innerHTML = renderError(msg);
      const panel = panelEl();
      if (panel) panel.innerHTML = "";
    }
  }

  container.addEventListener(
    "click",
    (e) => {
      const t = e.target as HTMLElement;
      const btn = t.closest<HTMLButtonElement>("[data-emp-page]");
      if (!btn || btn.disabled) return;
      const raw = btn.getAttribute("data-emp-page");
      if (raw == null) return;
      const next = Number.parseInt(raw, 10);
      if (Number.isNaN(next) || next < 1) return;
      state.page = next;
      void loadPage();
    },
    { signal },
  );

  container.addEventListener(
    "change",
    (e) => {
      const t = e.target as HTMLElement;
      if (t.id === "emp-filter-area") {
        state.departamento = (t as HTMLSelectElement).value;
        state.page = 1;
        void loadPage();
        return;
      }
      if (isRh && t.id === "emp-filter-status") {
        const v = (t as HTMLSelectElement).value;
        state.activo = v === "true" ? "true" : v === "false" ? "false" : "";
        state.page = 1;
        void loadPage();
        return;
      }
      if (t.id === "emp-filter-puesto") {
        state.puesto = (t as HTMLSelectElement).value;
        state.page = 1;
        void loadPage();
      }
    },
    { signal },
  );

  container.addEventListener(
    "input",
    (e) => {
      const t = e.target as HTMLElement;
      if (t.id !== "emp-search") return;
      clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        state.q = (t as HTMLInputElement).value;
        state.page = 1;
        void loadPage();
      }, 400);
    },
    { signal },
  );

  void init();
}
