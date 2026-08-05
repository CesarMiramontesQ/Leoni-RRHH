/**
 * Modal RH: listado de empleados sin comedor en turnos y asignación por fila.
 */
import {
  asignarComedorRhTurnos,
  buscarComedorRhEmpleados,
  comedorErrorMessage,
  getComedorRhEmpleadosSinComedorAsignado,
  getComedoresActivos,
  type ComedorApiItem,
  type ComedorRhEmpleadoBusquedaApi,
} from "../../api/comedor.ts";
import { BTN_PRIMARY, BTN_SECONDARY, SELECT_CHEVRON } from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { showEmpleadosToast } from "../empleados/toast.ts";

export type ComedorAsignarComedorModalOptions = {
  toastContainer: HTMLElement;
  onSaved: () => void | Promise<void>;
};

export type ComedorAsignarComedorModalHandle = {
  open: () => Promise<void>;
  close: () => void;
  destroy: () => void;
};

type RowState = {
  empleado: ComedorRhEmpleadoBusquedaApi;
  /** Valor del selector; arranca en el comedor actual para no perderlo al guardar. */
  comedorId: string;
};

/** Tope de resultados: la lista completa son cientos de empleados. */
const LIMITE_RESULTADOS = 25;

function shellHtml(): string {
  return `
    <div
      id="comedor-asignar-comedor-overlay"
      class="fixed inset-0 z-90 hidden items-center justify-center bg-slate-900/45 p-4 sm:p-6 backdrop-blur-[2px]"
      role="presentation"
    >
      <div
        id="comedor-asignar-comedor-panel"
        class="scheme-light flex max-h-[min(94vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_26px_70px_-22px_rgba(15,23,42,0.35)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="comedor-asignar-comedor-titulo"
      >
        <header class="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div class="min-w-0">
            <h2 id="comedor-asignar-comedor-titulo" class="text-lg font-semibold leading-snug tracking-tight text-[#0A1628]">
              Asignar comedor
            </h2>
            <p class="mt-1 text-xs text-slate-500">Empleados activos sin comedor en turnos.</p>
          </div>
          <button
            type="button"
            data-comedor-asignar-comedor-cerrar
            class="-m-1 flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-5" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </header>
        <div id="comedor-asignar-comedor-body" class="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/35 px-5 py-5 sm:px-6"></div>
      </div>
    </div>`;
}

function renderComedorOptions(comedores: readonly ComedorApiItem[], selectedId: string): string {
  const first = `<option value="">Selecciona comedor…</option>`;
  const rest = comedores
    .filter((c) => c.activo)
    .map(
      (c) =>
        `<option value="${String(c.id)}" ${selectedId === String(c.id) ? "selected" : ""}>${escapeHtml(c.nombre)}</option>`,
    )
    .join("");
  return `${first}${rest}`;
}

function renderSearchBar(query: string): string {
  return `
    <div class="mb-4">
      <label for="comedor-asignar-buscar" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        Buscar empleado
      </label>
      <input
        id="comedor-asignar-buscar"
        type="search"
        value="${escapeHtml(query)}"
        data-comedor-asignar-buscar
        placeholder="Nombre o número de empleado"
        class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/25" />
    </div>`;
}

function renderComedorActual(
  comedores: readonly ComedorApiItem[],
  comedorId: number | null,
): string {
  if (comedorId == null) {
    return `<span class="text-xs text-amber-700">Sin comedor asignado</span>`;
  }
  const nombre = comedores.find((c) => c.id === comedorId)?.nombre ?? `#${String(comedorId)}`;
  return `<span class="text-xs text-slate-500">Comedor actual: <strong class="font-semibold text-slate-700">${escapeHtml(nombre)}</strong></span>`;
}

function renderBody(
  rows: readonly RowState[],
  comedores: readonly ComedorApiItem[],
  state: "loading" | "ready" | "idle" | "sin-resultados" | "error",
  errorMessage: string | null,
  isSubmitting: boolean,
  query: string,
  totalSinComedor: number | null,
): string {
  if (state === "error") {
    return `<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
      <p class="font-semibold">No fue posible completar la búsqueda.</p>
      <p class="mt-1">${escapeHtml(errorMessage ?? "Error inesperado.")}</p>
      <button type="button" data-comedor-asignar-comedor-retry class="mt-3 inline-flex min-h-10 items-center rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-50">Reintentar</button>
    </div>`;
  }

  const buscador = renderSearchBar(query);

  if (state === "loading") {
    return `${buscador}<div class="flex items-center gap-3 py-10 text-sm text-slate-500">
      <svg class="size-5 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
      Buscando empleados…
    </div>`;
  }

  if (state === "idle") {
    const pendientes =
      totalSinComedor != null && totalSinComedor > 0
        ? `<p class="mt-1 text-sm text-slate-600">Hay <strong class="font-semibold text-slate-800">${String(totalSinComedor)}</strong> empleados activos sin comedor asignado.</p>`
        : "";
    return `${buscador}<div class="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center" role="status">
      <p class="font-medium text-slate-800">Busca al empleado por nombre o número.</p>
      ${pendientes}
      <p class="mt-2 text-xs text-slate-500">Puedes asignarle un comedor o cambiar el que ya tiene.</p>
    </div>`;
  }

  if (state === "sin-resultados") {
    return `${buscador}<div class="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-600" role="status">
      No se encontraron empleados con «${escapeHtml(query)}».
    </div>`;
  }

  const fieldClass =
    "h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/25";

  const aviso =
    rows.length >= LIMITE_RESULTADOS
      ? `<p class="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Se muestran los primeros ${String(LIMITE_RESULTADOS)} resultados. Afina la búsqueda si no ves a quien buscas.</p>`
      : "";

  return `
    ${buscador}
    ${aviso}
    <form id="comedor-asignar-comedor-form" class="flex min-h-0 flex-1 flex-col gap-4">
      <ul class="space-y-3">
        ${rows
          .map((row) => {
            const emp = row.empleado;
            return `
            <li class="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] sm:p-4">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold text-slate-900">${escapeHtml(emp.nombre)}</p>
                  <p class="mt-0.5 text-xs text-slate-500">${escapeHtml(emp.no_empleado)}${emp.area ? ` · ${escapeHtml(emp.area)}` : ""}</p>
                  <p class="mt-1">${renderComedorActual(comedores, emp.comedor_id)}</p>
                </div>
                <div class="relative w-full sm:max-w-[14rem]">
                  <select
                    data-comedor-asignar-empleado-id="${emp.empleado_id}"
                    class="${fieldClass} appearance-none pr-9"
                    aria-label="Comedor para ${escapeHtml(emp.nombre)}"
                  >
                    ${renderComedorOptions(comedores, row.comedorId)}
                  </select>
                  ${SELECT_CHEVRON}
                </div>
              </div>
            </li>`;
          })
          .join("")}
      </ul>
      <footer class="sticky bottom-0 -mx-1 flex flex-col-reverse gap-2 border-t border-slate-100 bg-white/95 px-1 pt-4 pb-1 backdrop-blur-[2px] sm:flex-row sm:justify-end">
        <button type="button" data-comedor-asignar-comedor-cancelar class="${BTN_SECONDARY} min-h-11 w-full justify-center sm:w-auto">Cancelar</button>
        <button type="submit" ${isSubmitting ? "disabled" : ""} class="${BTN_PRIMARY} min-h-11 w-full justify-center px-6 shadow-md disabled:cursor-not-allowed disabled:opacity-70 sm:min-w-[10rem] sm:w-auto">
          ${isSubmitting ? "Guardando…" : "Guardar asignaciones"}
        </button>
      </footer>
    </form>`;
}

export function mountComedorAsignarComedorModal(
  host: HTMLElement,
  options: ComedorAsignarComedorModalOptions,
): ComedorAsignarComedorModalHandle {
  host.innerHTML = shellHtml();
  const overlay = host.querySelector("#comedor-asignar-comedor-overlay");
  const body = host.querySelector("#comedor-asignar-comedor-body");
  if (!(overlay instanceof HTMLElement) || !(body instanceof HTMLElement)) {
    return { open: async () => {}, close: () => {}, destroy: () => { host.innerHTML = ""; } };
  }

  const overlayEl = overlay;
  const bodyEl = body;
  let comedores: ComedorApiItem[] = [];
  let rows: RowState[] = [];
  let panelState: "loading" | "ready" | "idle" | "sin-resultados" | "error" = "idle";
  let errorMessage: string | null = null;
  let isSubmitting = false;
  let query = "";
  let totalSinComedor: number | null = null;
  let searchTimer: number | null = null;
  /** Descarta respuestas de búsquedas que ya quedaron obsoletas. */
  let searchToken = 0;

  function close(): void {
    overlayEl.classList.add("hidden");
    overlayEl.classList.remove("flex");
    document.body.style.overflow = "";
    rows = [];
    panelState = "idle";
    errorMessage = null;
    isSubmitting = false;
    query = "";
    if (searchTimer !== null) window.clearTimeout(searchTimer);
    searchTimer = null;
    searchToken += 1;
    bodyEl.innerHTML = "";
  }

  function paint(opts?: { keepFocus?: boolean }): void {
    const seleccion = opts?.keepFocus
      ? bodyEl.querySelector<HTMLInputElement>("[data-comedor-asignar-buscar]")?.selectionStart ?? null
      : null;
    bodyEl.innerHTML = renderBody(
      rows, comedores, panelState, errorMessage, isSubmitting, query, totalSinComedor,
    );
    bindBody();
    if (opts?.keepFocus) {
      const input = bodyEl.querySelector<HTMLInputElement>("[data-comedor-asignar-buscar]");
      input?.focus();
      if (input && seleccion !== null) input.setSelectionRange(seleccion, seleccion);
    }
  }

  async function loadData(): Promise<void> {
    panelState = "loading";
    errorMessage = null;
    paint();
    try {
      // Solo el catálogo y el contador: la lista completa son cientos de filas y ya no
      // se pinta de golpe — se busca. El contador orienta sobre cuánto queda pendiente.
      const [catalogo, listado] = await Promise.all([
        getComedoresActivos(),
        getComedorRhEmpleadosSinComedorAsignado().catch(() => null),
      ]);
      comedores = catalogo;
      totalSinComedor = listado?.total ?? null;
      rows = [];
      panelState = "idle";
    } catch (error) {
      panelState = "error";
      errorMessage = comedorErrorMessage(error, "Error al cargar el catálogo de comedores.");
      rows = [];
    }
    paint();
  }

  async function runSearch(texto: string): Promise<void> {
    const q = texto.trim();
    query = texto;
    if (q.length < 2) {
      searchToken += 1;
      rows = [];
      panelState = "idle";
      paint({ keepFocus: true });
      return;
    }
    searchToken += 1;
    const token = searchToken;
    panelState = "loading";
    paint({ keepFocus: true });
    try {
      const resultado = await buscarComedorRhEmpleados(q, LIMITE_RESULTADOS);
      if (token !== searchToken) return;
      rows = resultado.items.map((empleado) => ({
        empleado,
        // Arranca en el comedor actual: si el usuario no toca el selector, guardar no
        // se lo cambia por accidente.
        comedorId: empleado.comedor_id != null ? String(empleado.comedor_id) : "",
      }));
      panelState = rows.length > 0 ? "ready" : "sin-resultados";
    } catch (error) {
      if (token !== searchToken) return;
      panelState = "error";
      errorMessage = comedorErrorMessage(error, "No fue posible buscar empleados.");
      rows = [];
    }
    paint({ keepFocus: true });
  }

  function bindBody(): void {
    const buscador = bodyEl.querySelector<HTMLInputElement>("[data-comedor-asignar-buscar]");
    buscador?.addEventListener("input", () => {
      if (searchTimer !== null) window.clearTimeout(searchTimer);
      const valor = buscador.value;
      query = valor;
      searchTimer = window.setTimeout(() => {
        void runSearch(valor);
      }, 300);
    });

    bodyEl.querySelector("[data-comedor-asignar-comedor-retry]")?.addEventListener("click", () => {
      void loadData();
    });
    bodyEl.querySelector("[data-comedor-asignar-comedor-cerrar-inline]")?.addEventListener("click", () => {
      close();
    });
    bodyEl.querySelector("[data-comedor-asignar-comedor-cancelar]")?.addEventListener("click", () => {
      close();
    });

    bodyEl.querySelectorAll<HTMLSelectElement>("[data-comedor-asignar-empleado-id]").forEach((select) => {
      select.addEventListener("change", () => {
        const raw = select.getAttribute("data-comedor-asignar-empleado-id");
        const empleadoId = Number.parseInt(raw ?? "", 10);
        if (!Number.isFinite(empleadoId)) return;
        const row = rows.find((r) => r.empleado.empleado_id === empleadoId);
        if (row) row.comedorId = select.value;
      });
    });

    const form = bodyEl.querySelector("#comedor-asignar-comedor-form");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      // Solo se envía lo que cambió respecto al comedor actual: así reasignar a uno no
      // reescribe de paso a los demás resultados de la búsqueda.
      const asignaciones = rows
        .map((row) => ({
          empleadoId: row.empleado.empleado_id,
          comedorId: Number.parseInt(row.comedorId, 10),
          actual: row.empleado.comedor_id,
        }))
        .filter(
          (row) =>
            Number.isFinite(row.comedorId) && row.comedorId > 0 && row.comedorId !== row.actual,
        )
        .map(({ empleadoId, comedorId }) => ({ empleadoId, comedorId }));
      if (asignaciones.length === 0) {
        showEmpleadosToast(
          options.toastContainer,
          "Cambia el comedor de al menos un empleado.",
          "error",
        );
        return;
      }
      isSubmitting = true;
      paint();
      try {
        const result = await asignarComedorRhTurnos(asignaciones);
        showEmpleadosToast(
          options.toastContainer,
          `Comedor asignado a ${result.actualizados} empleado${result.actualizados === 1 ? "" : "s"}.`,
          "success",
        );
        await Promise.resolve(options.onSaved());
        close();
      } catch (error) {
        isSubmitting = false;
        showEmpleadosToast(
          options.toastContainer,
          comedorErrorMessage(error, "No se pudo guardar la asignación."),
          "error",
        );
        paint();
      }
    });
  }

  overlayEl.addEventListener("click", (event) => {
    if (event.target === overlayEl) close();
  });

  host.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (
      target.closest("[data-comedor-asignar-comedor-cerrar]") ||
      target.closest("[data-comedor-asignar-comedor-cancelar]")
    ) {
      close();
    }
  });

  overlayEl.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlayEl.classList.contains("hidden")) {
      event.preventDefault();
      close();
    }
  });

  return {
    open: async () => {
      overlayEl.classList.remove("hidden");
      overlayEl.classList.add("flex");
      document.body.style.overflow = "hidden";
      await loadData();
    },
    close,
    destroy: () => {
      close();
      host.innerHTML = "";
    },
  };
}
