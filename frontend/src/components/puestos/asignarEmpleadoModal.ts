import { getEmpleadosPage } from "../../api/empleados.ts";
import { createPerfilAsignacion } from "../../api/puestos.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { BTN_PRIMARY, BTN_GHOST, FIELD_FOCUS } from "../../ui/uiTokens.ts";

export type AsignarEmpleadoModalHandle = {
  open: () => void;
  close: () => void;
};

export type AsignarEmpleadoModalOptions = {
  perfilId: number;
  onSuccess: () => void;
};

type EmpleadoResult = {
  empleado_id: number;
  no_empleado: string;
  nombre: string;
  area: string | null;
};

function overlayHtml(): string {
  return `
    <div
      id="asignar-empleado-overlay"
      class="fixed inset-0 z-50 hidden items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <div
        class="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="asignar-empleado-title"
      >
        <div class="flex items-start justify-between gap-3 mb-4">
          <h2 id="asignar-empleado-title" class="text-lg font-semibold text-text-primary">Asignar empleado</h2>
          <button
            type="button"
            data-close-asignar-modal
            class="rounded-lg p-1 text-text-muted hover:bg-surface hover:text-text-primary"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <div id="asignar-empleado-body">
          <form id="form-asignar-empleado" class="space-y-4">
            <div>
              <label for="asignar-search" class="mb-1 block text-xs font-medium text-slate-600">Buscar empleado</label>
              <input id="asignar-search" type="text" autocomplete="off"
                class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}"
                placeholder="Nombre o numero de empleado..." />
            </div>
            <div id="asignar-resultados" class="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-1 hidden"></div>
            <div id="asignar-seleccion" class="hidden rounded-lg border border-leoni-blue/30 bg-leoni-blue/5 px-3 py-2.5"></div>
            <p id="asignar-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert"></p>
            <div class="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <button type="button" data-close-asignar-modal class="${BTN_GHOST} text-sm">Cancelar</button>
              <button type="submit" id="asignar-submit" disabled class="${BTN_PRIMARY} text-sm opacity-50 cursor-not-allowed">Asignar</button>
            </div>
          </form>
        </div>
      </div>
    </div>`;
}

export function mountAsignarEmpleadoModal(
  host: HTMLElement,
  options: AsignarEmpleadoModalOptions,
): AsignarEmpleadoModalHandle {
  host.innerHTML = overlayHtml();

  const overlay = host.querySelector("#asignar-empleado-overlay") as HTMLElement;
  const searchInput = host.querySelector("#asignar-search") as HTMLInputElement;
  const resultadosEl = host.querySelector("#asignar-resultados") as HTMLElement;
  const seleccionEl = host.querySelector("#asignar-seleccion") as HTMLElement;
  const errorEl = host.querySelector("#asignar-error") as HTMLElement;
  const submitBtn = host.querySelector("#asignar-submit") as HTMLButtonElement;
  const form = host.querySelector("#form-asignar-empleado") as HTMLFormElement;

  let selectedEmpleado: EmpleadoResult | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let loading = false;

  function close(): void {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", escHandler);
    resetState();
  }

  function resetState(): void {
    selectedEmpleado = null;
    searchInput.value = "";
    resultadosEl.innerHTML = "";
    resultadosEl.classList.add("hidden");
    seleccionEl.innerHTML = "";
    seleccionEl.classList.add("hidden");
    errorEl.classList.add("hidden");
    submitBtn.disabled = true;
    submitBtn.classList.add("opacity-50", "cursor-not-allowed");
  }

  function selectEmpleado(emp: EmpleadoResult): void {
    selectedEmpleado = emp;
    resultadosEl.classList.add("hidden");
    seleccionEl.classList.remove("hidden");
    seleccionEl.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <span class="text-sm font-medium text-text-primary">${escapeHtml(emp.nombre)}</span>
          <span class="ml-2 text-xs text-slate-500 tabular-nums">${escapeHtml(emp.no_empleado)}</span>
          ${emp.area ? `<span class="ml-2 text-xs text-slate-400">${escapeHtml(emp.area)}</span>` : ""}
        </div>
        <button type="button" id="asignar-deselect" class="text-xs text-red-600 hover:underline">Quitar</button>
      </div>`;
    submitBtn.disabled = false;
    submitBtn.classList.remove("opacity-50", "cursor-not-allowed");
    searchInput.value = "";
  }

  async function doSearch(q: string): Promise<void> {
    if (q.length < 2) {
      resultadosEl.classList.add("hidden");
      return;
    }

    try {
      const page = await getEmpleadosPage({ page: 1, page_size: 10, q, activo: true });
      const items: EmpleadoResult[] = page.items.map(i => ({
        empleado_id: i.id,
        no_empleado: i.no_empleado,
        nombre: i.nombre,
        area: i.area?.descripcion ?? null,
      }));

      if (items.length === 0) {
        resultadosEl.innerHTML = `<p class="px-2 py-3 text-xs text-slate-500 text-center">Sin resultados</p>`;
      } else {
        resultadosEl.innerHTML = items.map(emp => `
          <button type="button" data-select-empleado="${escapeHtml(JSON.stringify(emp))}"
            class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-leoni-blue/10">
            <span class="text-sm font-medium text-text-primary">${escapeHtml(emp.nombre)}</span>
            <span class="text-xs text-slate-500 tabular-nums">${escapeHtml(emp.no_empleado)}</span>
            ${emp.area ? `<span class="ml-auto text-xs text-slate-400">${escapeHtml(emp.area)}</span>` : ""}
          </button>
        `).join("");
      }
      resultadosEl.classList.remove("hidden");
    } catch {
      resultadosEl.innerHTML = `<p class="px-2 py-3 text-xs text-red-600 text-center">Error buscando</p>`;
      resultadosEl.classList.remove("hidden");
    }
  }

  // Search with debounce
  searchInput.addEventListener("input", () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      doSearch(searchInput.value.trim());
    }, 320);
  });

  // Select empleado from results
  resultadosEl.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-select-empleado]");
    if (!btn) return;
    const emp = JSON.parse(btn.dataset.selectEmpleado!) as EmpleadoResult;
    selectEmpleado(emp);
  });

  // Deselect
  seleccionEl.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).id === "asignar-deselect") {
      selectedEmpleado = null;
      seleccionEl.classList.add("hidden");
      submitBtn.disabled = true;
      submitBtn.classList.add("opacity-50", "cursor-not-allowed");
    }
  });

  // Submit
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!selectedEmpleado || loading) return;
    loading = true;
    errorEl.classList.add("hidden");
    submitBtn.disabled = true;
    submitBtn.textContent = "Asignando...";

    try {
      await createPerfilAsignacion(options.perfilId, {
        puesto_perfil_id: options.perfilId,
        empleado_id: selectedEmpleado.empleado_id,
      });
      close();
      options.onSuccess();
    } catch (err: unknown) {
      const detail = (err as { detail?: string })?.detail ?? "Error al asignar empleado.";
      errorEl.textContent = detail;
      errorEl.classList.remove("hidden");
      submitBtn.disabled = false;
      submitBtn.textContent = "Asignar";
    } finally {
      loading = false;
    }
  });

  // Close handlers
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  host.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("[data-close-asignar-modal]")) close();
  });

  function escHandler(e: KeyboardEvent): void {
    if (e.key === "Escape" && !overlay.classList.contains("hidden")) {
      e.preventDefault();
      close();
    }
  }

  return {
    open: () => {
      overlay.classList.remove("hidden");
      overlay.classList.add("flex");
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", escHandler);
      resetState();
      setTimeout(() => searchInput.focus(), 100);
    },
    close,
  };
}
