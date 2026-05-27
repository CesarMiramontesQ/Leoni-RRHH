import { mountAppShell } from "../layouts/appShell.ts";
import {
  getTareasCatalogo,
  createTareaCatalogo,
  type TareaCatalogo,
  type TareaCatalogoFetchError,
} from "../api/tareasCatalogo.ts";
import { fetchWithAuth } from "../api/http.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_DANGER,
  FIELD_FOCUS,
} from "../ui/uiTokens.ts";

// ── Helpers ───────────────────────────────────────────────────────────

function categoriaBadge(cat: string | undefined): string {
  if (!cat) return `<span class="text-slate-400">—</span>`;
  return `<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">${escapeHtml(cat)}</span>`;
}

function complementoBadge(es: boolean): string {
  if (!es) return `<span class="text-slate-400">No</span>`;
  return `<span class="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">Complementaria</span>`;
}

function renderLoading(): string {
  return `<div class="flex items-center justify-center py-20"><p class="text-sm text-slate-500">Cargando catalogo de tareas...</p></div>`;
}

function renderError(msg: string | null): string {
  return `<div class="rounded-lg border border-red-200 bg-red-50 p-4"><p class="text-sm text-red-700">${escapeHtml(msg ?? "Error desconocido")}</p></div>`;
}

function renderTable(items: TareaCatalogo[], filterText: string): string {
  const filtered = filterText.trim()
    ? items.filter((t) => t.nombre.toLowerCase().includes(filterText.toLowerCase()))
    : items;

  const rows = filtered.length === 0
    ? `<tr><td colspan="4" class="px-4 py-10 text-center text-sm text-slate-500">No hay tareas registradas.</td></tr>`
    : filtered.map((t) => `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="px-4 py-3 text-sm font-medium text-slate-900">${escapeHtml(t.nombre)}</td>
        <td class="px-4 py-3">${categoriaBadge(t.categoria)}</td>
        <td class="px-4 py-3">${complementoBadge(t.es_complemento)}</td>
        <td class="px-4 py-3 text-right">
          <button type="button" data-action="edit-tarea" data-id="${t.id}" class="mr-2 rounded p-1 text-slate-500 hover:text-leoni-blue" title="Editar">
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4"><path d="M5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" /></svg>
          </button>
          <button type="button" data-action="delete-tarea" data-id="${t.id}" class="rounded p-1 text-slate-500 hover:text-red-600" title="Desactivar">
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clip-rule="evenodd" /></svg>
          </button>
        </td>
      </tr>
    `).join("");

  return `
    <div class="flex flex-col gap-4">
      <!-- Filter bar + Add button -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="relative max-w-sm flex-1">
          <input
            type="text"
            id="tarea-catalogo-search"
            data-action="catalogo-filter"
            placeholder="Buscar tarea..."
            value="${escapeHtml(filterText)}"
            class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-9 text-sm text-slate-900 placeholder:text-slate-400 ${FIELD_FOCUS}"
          />
          <svg viewBox="0 0 20 20" fill="currentColor" class="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true">
            <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd" />
          </svg>
        </div>
        <button type="button" data-action="add-tarea" class="${BTN_PRIMARY}">
          <span aria-hidden="true">+</span> Nueva tarea
        </button>
      </div>

      <!-- Table -->
      <div class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5">
        <div class="overflow-x-auto">
          <table class="min-w-full w-full text-left">
            <thead class="border-b border-slate-200 bg-slate-50">
              <tr>
                <th class="px-4 py-3 text-sm font-semibold text-slate-700">Nombre</th>
                <th class="px-4 py-3 text-sm font-semibold text-slate-700">Categoria</th>
                <th class="px-4 py-3 text-sm font-semibold text-slate-700">Tipo</th>
                <th class="px-4 py-3 text-right text-sm font-semibold text-slate-700">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">${rows}</tbody>
          </table>
        </div>
      </div>
      <p class="text-xs text-slate-400">${filtered.length} tarea${filtered.length !== 1 ? "s" : ""} en catalogo</p>
    </div>`;
}

function renderModal(editing: TareaCatalogo | null): string {
  const isEdit = !!editing;
  const nombre = editing?.nombre ?? "";
  const categoria = editing?.categoria ?? "";
  const es_complemento = editing?.es_complemento ?? false;

  return `
    <div id="tarea-modal-backdrop" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 class="text-lg font-semibold text-slate-900 mb-4">${isEdit ? "Editar tarea" : "Nueva tarea"}</h3>
        <form id="tarea-modal-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
            <input name="nombre" type="text" required value="${escapeHtml(nombre)}"
              class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 ${FIELD_FOCUS}"
              placeholder="Descripcion de la tarea" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Categoria (opcional)</label>
            <input name="categoria" type="text" value="${escapeHtml(categoria)}"
              class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 ${FIELD_FOCUS}"
              placeholder="Ej: logistica, calidad, seguridad..." />
          </div>
          <div class="flex items-center gap-2">
            <input name="es_complemento" type="checkbox" ${es_complemento ? "checked" : ""}
              class="size-4 rounded border-slate-300 text-leoni-blue focus:ring-leoni-blue" />
            <label class="text-sm text-slate-700">Tarea complementaria</label>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" data-action="close-modal" class="${BTN_SECONDARY}">Cancelar</button>
            <button type="submit" class="${BTN_PRIMARY}">${isEdit ? "Guardar" : "Crear"}</button>
          </div>
        </form>
      </div>
    </div>`;
}

function renderDeleteConfirm(tarea: TareaCatalogo): string {
  return `
    <div id="tarea-delete-backdrop" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 class="text-lg font-semibold text-slate-900 mb-2">Desactivar tarea</h3>
        <p class="text-sm text-slate-600 mb-4">¿Desactivar <strong>${escapeHtml(tarea.nombre)}</strong> del catalogo? Los perfiles que ya la tienen asignada no se veran afectados.</p>
        <div class="flex justify-end gap-2">
          <button type="button" data-action="close-delete" class="${BTN_SECONDARY}">Cancelar</button>
          <button type="button" data-action="confirm-delete" class="${BTN_DANGER}">Desactivar</button>
        </div>
      </div>
    </div>`;
}

// ── Page mount ────────────────────────────────────────────────────────

export function mountTareasCatalogo(container: HTMLElement, signal: AbortSignal): void {
  let status: "loading" | "ready" | "error" = "loading";
  let items: TareaCatalogo[] = [];
  let filterText = "";
  let errorMessage: string | null = null;
  let editingTarea: TareaCatalogo | null = null;
  let showModal = false;
  let deletingTarea: TareaCatalogo | null = null;
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  mountAppShell(container, {
    pageTitle: "Catalogo de Tareas",
    activeNav: "empleados",
    mainClass: "py-5 sm:py-6",
    mainHtml: `<div id="tareas-catalogo-root" class="flex min-h-0 flex-1 flex-col gap-4 sm:gap-5">
      <div id="tareas-catalogo-inner">${renderLoading()}</div>
      <div id="tarea-modal-host"></div>
      <div id="tarea-delete-host"></div>
    </div>`,
  });

  function paint(): void {
    const inner = container.querySelector("#tareas-catalogo-inner");
    if (!inner) return;

    if (status === "loading") {
      inner.innerHTML = renderLoading();
      return;
    }
    if (status === "error") {
      inner.innerHTML = renderError(errorMessage);
      return;
    }

    inner.innerHTML = `
      <!-- Breadcrumb -->
      <nav class="text-xs text-slate-500" aria-label="Breadcrumb">
        <ol class="flex items-center gap-1">
          <li><a href="#/" class="hover:text-leoni-blue">Inicio</a></li>
          <li class="text-slate-300">/</li>
          <li class="font-medium text-slate-700">Catalogo de Tareas</li>
        </ol>
      </nav>
      ${renderTable(items, filterText)}`;

    // Modal
    const modalHost = container.querySelector("#tarea-modal-host");
    if (modalHost) modalHost.innerHTML = showModal ? renderModal(editingTarea) : "";

    // Delete confirm
    const deleteHost = container.querySelector("#tarea-delete-host");
    if (deleteHost) deleteHost.innerHTML = deletingTarea ? renderDeleteConfirm(deletingTarea) : "";
  }

  async function loadCatalogo(): Promise<void> {
    try {
      items = await getTareasCatalogo({ page_size: 200 });
      status = "ready";
    } catch (e) {
      status = "error";
      errorMessage = (e as TareaCatalogoFetchError)?.detail ?? "Error al cargar";
    }
    paint();
  }

  // Event delegation
  container.addEventListener("click", async (e) => {
    if (signal.aborted) return;
    const target = e.target as HTMLElement;
    const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
    if (!action) return;

    if (action === "add-tarea") {
      editingTarea = null;
      showModal = true;
      paint();
      return;
    }

    if (action === "edit-tarea") {
      const id = Number(target.closest<HTMLElement>("[data-id]")?.dataset.id);
      const item = items.find(t => t.id === id);
      if (item) {
        editingTarea = item;
        showModal = true;
        paint();
      }
      return;
    }

    if (action === "delete-tarea") {
      const id = Number(target.closest<HTMLElement>("[data-id]")?.dataset.id);
      const item = items.find(t => t.id === id);
      if (item) {
        deletingTarea = item;
        paint();
      }
      return;
    }

    if (action === "close-modal") {
      showModal = false;
      editingTarea = null;
      paint();
      return;
    }

    if (action === "close-delete") {
      deletingTarea = null;
      paint();
      return;
    }

    if (action === "confirm-delete" && deletingTarea) {
      try {
        await fetchWithAuth(`/api/v1/tareas-catalogo/${deletingTarea.id}`, { method: "DELETE" });
        deletingTarea = null;
        await loadCatalogo();
      } catch {
        deletingTarea = null;
        paint();
      }
      return;
    }
  }, { signal });

  // Modal backdrop close
  container.addEventListener("click", (e) => {
    if (signal.aborted) return;
    const target = e.target as HTMLElement;
    if (target.id === "tarea-modal-backdrop") {
      showModal = false;
      editingTarea = null;
      paint();
    }
    if (target.id === "tarea-delete-backdrop") {
      deletingTarea = null;
      paint();
    }
  }, { signal });

  // Search input
  container.addEventListener("input", (e) => {
    if (signal.aborted) return;
    const target = e.target as HTMLElement;
    if (target.id === "tarea-catalogo-search") {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        filterText = (target as HTMLInputElement).value;
        paint();
      }, 250);
    }
  }, { signal });

  // Form submit
  container.addEventListener("submit", async (e) => {
    if (signal.aborted) return;
    const form = (e.target as HTMLElement).closest("#tarea-modal-form");
    if (!form) return;
    e.preventDefault();

    const fd = new FormData(form as HTMLFormElement);
    const nombre = String(fd.get("nombre") ?? "").trim();
    const categoria = String(fd.get("categoria") ?? "").trim() || undefined;
    const es_complemento = fd.has("es_complemento");

    if (!nombre) return;

    const submitBtn = (form as HTMLElement).querySelector<HTMLButtonElement>("button[type=submit]");
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Guardando..."; }

    try {
      if (editingTarea) {
        const body: Record<string, unknown> = {};
        if (nombre !== editingTarea.nombre) body.nombre = nombre;
        if (categoria !== editingTarea.categoria) body.categoria = categoria ?? null;
        if (es_complemento !== editingTarea.es_complemento) body.es_complemento = es_complemento;
        if (Object.keys(body).length > 0) {
          await fetchWithAuth(`/api/v1/tareas-catalogo/${editingTarea.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        }
      } else {
        await createTareaCatalogo({ nombre, categoria, es_complemento });
      }
      showModal = false;
      editingTarea = null;
      await loadCatalogo();
    } catch (err) {
      const detail = (err as TareaCatalogoFetchError)?.detail ?? "Error al guardar";
      const errorEl = (form as HTMLElement).querySelector("#tarea-form-error");
      if (errorEl) {
        errorEl.textContent = detail;
        errorEl.classList.remove("hidden");
      }
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = editingTarea ? "Guardar" : "Crear"; }
    }
  }, { signal });

  // Initial load
  loadCatalogo();
}
