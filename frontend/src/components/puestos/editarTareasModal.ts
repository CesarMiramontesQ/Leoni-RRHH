/**
 * Modal para editar tareas de un perfil de puesto (solo RH).
 * Permite agregar y eliminar tareas inmediatamente.
 */

import {
  getPerfilTareas,
  createPerfilTarea,
  deletePerfilTarea,
  type PerfilTarea,
} from "../../api/puestos.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { BTN_PRIMARY, BTN_DANGER, FIELD_FOCUS } from "../../ui/uiTokens.ts";

export type EditarTareasModalHandle = {
  open: () => void;
  close: () => void;
};

export type EditarTareasModalOptions = {
  perfilId: number;
  onSuccess: () => void;
};

function overlayHtml(): string {
  return `
    <div
      id="editar-tareas-overlay"
      class="fixed inset-0 z-50 hidden items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <div
        class="w-full max-w-lg rounded-xl border border-border bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-tareas-title"
      >
        <div class="flex items-start justify-between gap-3 mb-4">
          <h2 id="editar-tareas-title" class="text-lg font-semibold text-text-primary">Editar tareas</h2>
          <button
            type="button"
            data-close-tareas-modal
            class="rounded-lg p-1 text-text-muted hover:bg-surface hover:text-text-primary"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <div id="editar-tareas-body">
          <p class="text-sm text-text-muted">Cargando...</p>
        </div>
      </div>
    </div>`;
}

function renderTareasList(tareas: PerfilTarea[]): string {
  if (tareas.length === 0) {
    return `<p class="text-sm text-slate-500 italic py-2">Sin tareas registradas.</p>`;
  }
  return `
    <div class="max-h-60 overflow-y-auto divide-y divide-slate-100 mb-4">
      ${tareas.map(t => `
        <div class="flex items-center justify-between gap-2 py-2">
          <div class="flex items-center gap-2 min-w-0">
            <span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-leoni-blue/10 font-mono text-[10px] font-bold text-leoni-blue">${t.orden}</span>
            <span class="text-sm text-text-primary truncate">${escapeHtml(t.descripcion)}</span>
            ${t.es_complemento ? `<span class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">Comp.</span>` : ""}
          </div>
          <button type="button" data-delete-tarea="${t.id}" class="${BTN_DANGER} !px-2 !py-1 text-xs" title="Eliminar">
            <svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      `).join("")}
    </div>`;
}

function renderForm(): string {
  return `
    <form id="form-agregar-tarea" class="border-t border-slate-200 pt-4 space-y-3">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Agregar tarea</p>
      <div>
        <label for="tarea-descripcion" class="mb-1 block text-xs font-medium text-slate-600">Descripcion</label>
        <input id="tarea-descripcion" name="descripcion" type="text" required
          class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}"
          placeholder="Descripcion de la tarea" />
      </div>
      <div class="flex gap-3">
        <div class="flex-1">
          <label for="tarea-orden" class="mb-1 block text-xs font-medium text-slate-600">Orden</label>
          <input id="tarea-orden" name="orden" type="number" min="1" required value="1"
            class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}" />
        </div>
        <div class="flex items-end pb-1">
          <label class="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input id="tarea-complemento" name="es_complemento" type="checkbox"
              class="size-4 rounded border-slate-300 text-leoni-blue focus:ring-leoni-blue" />
            Complementaria
          </label>
        </div>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="submit" class="${BTN_PRIMARY} text-sm">Agregar</button>
      </div>
    </form>`;
}

export function mountEditarTareasModal(
  host: HTMLElement,
  options: EditarTareasModalOptions,
): EditarTareasModalHandle {
  host.innerHTML = overlayHtml();

  const overlay = host.querySelector("#editar-tareas-overlay") as HTMLElement;
  const body = host.querySelector("#editar-tareas-body") as HTMLElement;

  let loading = false;

  function close(): void {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
  }

  async function refreshList(): Promise<void> {
    try {
      const tareas = await getPerfilTareas(options.perfilId);
      body.innerHTML = renderTareasList(tareas) + renderForm();
      bindForm();
      bindDeleteButtons();
    } catch {
      body.innerHTML = `<p class="text-sm text-red-600">Error al cargar tareas.</p>`;
    }
  }

  function bindDeleteButtons(): void {
    body.querySelectorAll<HTMLButtonElement>("[data-delete-tarea]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const tareaId = Number(btn.dataset.deleteTarea);
        if (loading) return;
        loading = true;
        btn.disabled = true;
        try {
          await deletePerfilTarea(options.perfilId, tareaId);
          options.onSuccess();
          await refreshList();
        } catch {
          // silently fail, list will stay as is
        } finally {
          loading = false;
        }
      });
    });
  }

  function bindForm(): void {
    const form = body.querySelector("#form-agregar-tarea") as HTMLFormElement | null;
    if (!form) return;
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (loading) return;
      loading = true;

      const fd = new FormData(form);
      const descripcion = String(fd.get("descripcion") ?? "").trim();
      const orden = Number(fd.get("orden") ?? 1);
      const es_complemento = !!(fd.get("es_complemento"));

      if (!descripcion) { loading = false; return; }

      const submitBtn = form.querySelector<HTMLButtonElement>("button[type=submit]");
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Agregando..."; }

      try {
        await createPerfilTarea(options.perfilId, { orden, descripcion, es_complemento });
        options.onSuccess();
        await refreshList();
      } catch {
        // keep form as is
      } finally {
        loading = false;
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Agregar"; }
      }
    });
  }

  // Close handlers
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  host.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("[data-close-tareas-modal]")) close();
  });

  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape" && !overlay.classList.contains("hidden")) {
      e.preventDefault();
      close();
    }
  });

  return {
    open: () => {
      overlay.classList.remove("hidden");
      overlay.classList.add("flex");
      document.body.style.overflow = "hidden";
      body.innerHTML = `<p class="text-sm text-text-muted">Cargando...</p>`;
      refreshList();
    },
    close,
  };
}
