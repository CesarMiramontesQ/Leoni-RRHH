import {
  getCursosExtra,
  asignarCursoExtra,
  eliminarCursoExtra,
  getCursos,
  type CursoEmpleadoItem,
} from "../../api/cursos.ts";
import type { Curso } from "../../dashboard/cursos/types.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { BTN_PRIMARY, BTN_DANGER, FIELD_FOCUS } from "../../ui/uiTokens.ts";

export type CursosExtraModalHandle = {
  open: () => void;
  close: () => void;
};

export type CursosExtraModalOptions = {
  perfilId: number;
  asignacionId: number;
  nombreEmpleado: string;
};

function overlayHtml(nombreEmpleado: string): string {
  return `
    <div
      id="cursos-extra-overlay"
      class="fixed inset-0 z-50 hidden items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <div
        class="w-full max-w-lg rounded-xl border border-border bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cursos-extra-title"
      >
        <div class="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 id="cursos-extra-title" class="text-lg font-semibold text-text-primary">Cursos extra</h2>
            <p class="text-xs text-text-muted mt-0.5">${escapeHtml(nombreEmpleado)}</p>
          </div>
          <button
            type="button"
            data-close-cursos-extra
            class="rounded-lg p-1 text-text-muted hover:bg-surface hover:text-text-primary"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <div id="cursos-extra-body">
          <p class="text-sm text-text-muted">Cargando...</p>
        </div>
      </div>
    </div>`;
}

function renderExtraList(extras: CursoEmpleadoItem[]): string {
  if (extras.length === 0) {
    return `<p class="text-sm text-slate-500 italic py-2">Sin cursos extra asignados.</p>`;
  }
  return `
    <div class="divide-y divide-slate-100 mb-4 max-h-56 overflow-y-auto">
      ${extras.map(c => `
        <div class="flex items-center justify-between gap-2 py-2">
          <span class="text-sm text-text-primary truncate">${escapeHtml(c.curso_nombre ?? `Curso #${c.curso_id}`)}</span>
          <button type="button" data-delete-curso-extra="${c.id}" class="${BTN_DANGER} !px-2 !py-1 text-xs shrink-0" title="Quitar">
            <svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      `).join("")}
    </div>`;
}

function renderSearchForm(): string {
  return `
    <div class="border-t border-slate-200 pt-4 space-y-3">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Agregar curso extra</p>
      <div>
        <input id="curso-extra-search" type="text" autocomplete="off"
          class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}"
          placeholder="Buscar curso por nombre..." />
      </div>
      <div id="curso-extra-search-results" class="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-1 hidden"></div>
      <div id="curso-extra-selected-row" class="hidden rounded-lg border border-leoni-blue/30 bg-leoni-blue/5 p-3">
        <div id="curso-extra-selected-info" class="flex items-center justify-between"></div>
        <div class="flex justify-end mt-2">
          <button type="button" id="curso-extra-submit-assign" class="${BTN_PRIMARY} text-sm">Agregar</button>
        </div>
      </div>
    </div>`;
}

export function mountCursosExtraModal(
  host: HTMLElement,
  options: CursosExtraModalOptions,
): CursosExtraModalHandle {
  host.innerHTML = overlayHtml(options.nombreEmpleado);

  const overlay = host.querySelector("#cursos-extra-overlay") as HTMLElement;
  const body = host.querySelector("#cursos-extra-body") as HTMLElement;

  let loading = false;
  let selectedCurso: Curso | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let extras: CursoEmpleadoItem[] = [];
  let extrasIds: Set<number> = new Set();

  function close(): void {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", escHandler);
  }

  function escHandler(e: KeyboardEvent): void {
    if (e.key === "Escape") close();
  }

  async function refreshList(): Promise<void> {
    try {
      extras = await getCursosExtra(options.perfilId, options.asignacionId);
      extrasIds = new Set(extras.map(c => c.curso_id));
      selectedCurso = null;
      body.innerHTML = renderExtraList(extras) + renderSearchForm();
      bindDeleteButtons();
      bindSearch();
    } catch {
      body.innerHTML = `<p class="text-sm text-red-600">Error al cargar cursos extra.</p>`;
    }
  }

  function bindDeleteButtons(): void {
    body.querySelectorAll<HTMLButtonElement>("[data-delete-curso-extra]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const extraId = Number(btn.dataset.deleteCursoExtra);
        if (loading) return;
        loading = true;
        btn.disabled = true;
        try {
          await eliminarCursoExtra(options.perfilId, options.asignacionId, extraId);
          await refreshList();
        } catch {
          btn.disabled = false;
          alert("Error al eliminar curso extra.");
        } finally {
          loading = false;
        }
      });
    });
  }

  function bindSearch(): void {
    const searchInput = body.querySelector("#curso-extra-search") as HTMLInputElement | null;
    if (!searchInput) return;

    searchInput.addEventListener("input", () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const q = searchInput.value.trim();
        if (q.length < 2) {
          const rc = body.querySelector("#curso-extra-search-results") as HTMLElement;
          if (rc) { rc.classList.add("hidden"); rc.innerHTML = ""; }
          return;
        }
        void showResults(q);
      }, 320);
    });

    const submitBtn = body.querySelector("#curso-extra-submit-assign") as HTMLButtonElement | null;
    if (submitBtn) {
      submitBtn.addEventListener("click", async () => {
        if (!selectedCurso || loading) return;
        loading = true;
        submitBtn.disabled = true;
        submitBtn.textContent = "...";
        try {
          await asignarCursoExtra(options.perfilId, options.asignacionId, selectedCurso.id);
          await refreshList();
        } catch {
          alert("Error al agregar curso extra.");
          submitBtn.disabled = false;
          submitBtn.textContent = "Agregar";
        } finally {
          loading = false;
        }
      });
    }
  }

  async function showResults(q: string): Promise<void> {
    const resultsContainer = body.querySelector("#curso-extra-search-results") as HTMLElement | null;
    if (!resultsContainer) return;

    try {
      const resp = await getCursos({ busqueda: q, page_size: 15 });
      const available = resp.items.filter(c => c.activo && !extrasIds.has(c.id));

      if (available.length === 0) {
        resultsContainer.innerHTML = `<p class="text-xs text-slate-500 px-2 py-2">Sin resultados</p>`;
        resultsContainer.classList.remove("hidden");
        return;
      }

      resultsContainer.innerHTML = available
        .map(c => `
          <button type="button" data-select-curso='${JSON.stringify({ id: c.id, nombre: c.nombre })}' class="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm rounded hover:bg-white transition">
            <span class="truncate flex-1">${escapeHtml(c.nombre)}</span>
          </button>`)
        .join("");
      resultsContainer.classList.remove("hidden");

      resultsContainer.querySelectorAll<HTMLButtonElement>("[data-select-curso]").forEach(btn => {
        btn.addEventListener("click", () => {
          const data = JSON.parse(btn.dataset.selectCurso!) as { id: number; nombre: string };
          selectedCurso = { id: data.id, nombre: data.nombre } as Curso;
          resultsContainer.classList.add("hidden");

          const selectedRow = body.querySelector("#curso-extra-selected-row") as HTMLElement;
          const selectedInfo = body.querySelector("#curso-extra-selected-info") as HTMLElement;
          selectedInfo.innerHTML = `
            <span class="text-sm font-medium text-text-primary truncate">${escapeHtml(data.nombre)}</span>
            <button type="button" id="curso-extra-deselect" class="text-xs text-slate-500 hover:text-red-600">✕</button>`;
          selectedRow.classList.remove("hidden");

          selectedInfo.querySelector("#curso-extra-deselect")?.addEventListener("click", () => {
            selectedCurso = null;
            selectedRow.classList.add("hidden");
          });
        });
      });
    } catch {
      resultsContainer.innerHTML = `<p class="text-xs text-red-500 px-2 py-2">Error al buscar</p>`;
      resultsContainer.classList.remove("hidden");
    }
  }

  // Close button
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  host.querySelector("[data-close-cursos-extra]")!.addEventListener("click", close);

  return {
    open() {
      overlay.classList.remove("hidden");
      overlay.classList.add("flex");
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", escHandler);
      void refreshList();
    },
    close,
  };
}
