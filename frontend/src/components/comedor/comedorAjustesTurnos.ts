import type { ComedorTurnoHorarioApi } from "../../api/comedor.ts";
import { FIELD_FOCUS } from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

export type ComedorAjustesTurnosViewState = {
  panelState: "loading" | "ready" | "empty" | "error";
  items: readonly ComedorTurnoHorarioApi[];
  incluirInactivos: boolean;
  /** `tu_codigo` de la fila que se está guardando, si hay alguna. */
  guardandoCodigo: string | null;
  errorMessage: string | null;
};

const TIME_INPUT_CLS = `w-32 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-text-primary ${FIELD_FOCUS}`;

/** `HH:MM:SS` del backend → `HH:MM` que espera un `<input type="time">`. */
function toInputTime(value: string | null): string {
  return value ? value.slice(0, 5) : "";
}

function renderTableRows(state: ComedorAjustesTurnosViewState): string {
  if (state.items.length === 0) {
    return `<tr><td colspan="4" class="px-4 py-8 text-center text-sm text-text-muted">No hay turnos en el catálogo.</td></tr>`;
  }
  return state.items
    .map((item) => {
      const codigo = escapeHtml(item.tu_codigo);
      const guardando = state.guardandoCodigo === item.tu_codigo;
      const estadoBadge = item.activo
        ? ""
        : `<span class="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">Inactivo</span>`;
      return `
        <tr class="border-t border-border" data-turno-row="${codigo}">
          <td class="px-4 py-3 text-sm text-text-primary">
            <span class="font-medium">${codigo}</span>
            <span class="text-text-secondary"> · ${escapeHtml(item.descripcion)}</span>
            ${estadoBadge}
          </td>
          <td class="px-4 py-3 text-sm">
            <input
              type="time"
              step="60"
              aria-label="Hora inicio comida del turno ${codigo}"
              data-turno-hora-inicio="${codigo}"
              value="${toInputTime(item.hora_inicio_comida)}"
              class="${TIME_INPUT_CLS}"
            />
          </td>
          <td class="px-4 py-3 text-sm">
            <input
              type="time"
              step="60"
              aria-label="Hora fin comida del turno ${codigo}"
              data-turno-hora-fin="${codigo}"
              value="${toInputTime(item.hora_fin_comida)}"
              class="${TIME_INPUT_CLS}"
            />
          </td>
          <td class="px-4 py-3 text-right text-sm">
            <button
              type="button"
              data-turno-guardar="${codigo}"
              ${guardando ? "disabled" : ""}
              class="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              ${guardando ? "Guardando…" : "Guardar"}
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

export function renderComedorAjustesTurnos(state: ComedorAjustesTurnosViewState): string {
  const content =
    state.panelState === "loading"
      ? `<div class="rounded-xl border border-border bg-white p-6 text-sm text-text-muted">Cargando turnos...</div>`
      : state.panelState === "error"
        ? `<div class="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            <p class="font-semibold">No se pudo cargar la lista de turnos.</p>
            <p class="mt-1">${escapeHtml(state.errorMessage ?? "Intenta de nuevo.")}</p>
            <button type="button" data-turnos-retry class="mt-4 inline-flex items-center rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500">Reintentar</button>
          </div>`
        : `<div class="overflow-x-auto rounded-xl border border-border bg-white">
            <table class="min-w-full divide-y divide-border">
              <thead class="bg-surface">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Turno</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Hora inicio comida</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Hora fin comida</th>
                  <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">Acciones</th>
                </tr>
              </thead>
              <tbody class="bg-white">
                ${renderTableRows(state)}
              </tbody>
            </table>
          </div>`;
  return `
    <div class="flex min-h-[calc(100dvh-11rem)] flex-col gap-4 sm:gap-5">
      <section class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 class="text-lg font-semibold text-text-primary">Horario de comida por turno</h2>
          <p class="mt-1 text-sm text-text-muted">Asigna a cada turno la franja en la que su personal come. Formato de 24 horas.</p>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <label class="inline-flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              data-turnos-incluir-inactivos
              ${state.incluirInactivos ? "checked" : ""}
              class="h-4 w-4 rounded border-slate-300 text-leoni-blue focus:ring-leoni-blue"
            />
            Mostrar inactivos
          </label>
        </div>
      </section>
      ${content}
    </div>
  `;
}
