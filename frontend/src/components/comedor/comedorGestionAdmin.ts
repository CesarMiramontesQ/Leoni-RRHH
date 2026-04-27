import type { ComedorApiItem } from "../../api/comedor.ts";

export type ComedorGestionAdminViewState = {
  panelState: "loading" | "ready" | "empty" | "error";
  items: readonly ComedorApiItem[];
  errorMessage: string | null;
};

function renderTableRows(items: readonly ComedorApiItem[]): string {
  if (items.length === 0) {
    return `<tr><td colspan="6" class="px-4 py-8 text-center text-sm text-text-muted">No hay comedores registrados.</td></tr>`;
  }
  return items
    .map((item) => {
      const ubicacion = item.ubicacion?.trim() ? item.ubicacion : "Sin ubicación";
      const capacidad = item.capacidad != null ? String(item.capacidad) : "—";
      const estadoClass = item.activo
        ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
        : "bg-slate-100 text-slate-600 ring-slate-200";
      const estadoLabel = item.activo ? "Activo" : "Inactivo";
      return `
        <tr class="border-t border-border">
          <td class="px-4 py-3 text-sm font-medium text-text-primary">${item.nombre}</td>
          <td class="px-4 py-3 text-sm text-text-secondary">${ubicacion}</td>
          <td class="px-4 py-3 text-sm text-text-secondary">${capacidad}</td>
          <td class="px-4 py-3 text-sm text-text-secondary">
            <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${estadoClass}">
              ${estadoLabel}
            </span>
          </td>
          <td class="px-4 py-3 text-right text-sm">
            <button
              type="button"
              data-comedor-admin-edit-id="${item.id}"
              class="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Editar
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

export function renderComedorGestionAdmin(state: ComedorGestionAdminViewState): string {
  const content =
    state.panelState === "loading"
      ? `<div class="rounded-xl border border-border bg-white p-6 text-sm text-text-muted">Cargando comedores...</div>`
      : state.panelState === "error"
        ? `<div class="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            <p class="font-semibold">No se pudo cargar la lista de comedores.</p>
            <p class="mt-1">${state.errorMessage ?? "Intenta de nuevo."}</p>
            <button type="button" data-comedor-admin-retry class="mt-4 inline-flex items-center rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500">Reintentar</button>
          </div>`
        : `<div class="overflow-x-auto rounded-xl border border-border bg-white">
            <table class="min-w-full divide-y divide-border">
              <thead class="bg-surface">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Nombre</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Ubicación</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Capacidad</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Estado</th>
                  <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">Acciones</th>
                </tr>
              </thead>
              <tbody class="bg-white">
                ${renderTableRows(state.items)}
              </tbody>
            </table>
          </div>`;
  return `
    <div class="flex min-h-[calc(100dvh-11rem)] flex-col gap-4 sm:gap-5">
      <section class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 class="text-lg font-semibold text-text-primary">Gestión administrativa de comedores</h2>
          <p class="mt-1 text-sm text-text-muted">Consulta, crea y edita comedores disponibles para la operación.</p>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <button type="button" data-comedor-admin-back class="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            Volver a comedor
          </button>
          <button type="button" data-comedor-admin-add class="inline-flex items-center rounded-lg bg-leoni-blue px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-leoni-blue-light">
            Agregar nuevo comedor
          </button>
        </div>
      </section>
      ${content}
    </div>
  `;
}
