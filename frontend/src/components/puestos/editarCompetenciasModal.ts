/**
 * Modal para editar competencias requeridas de un perfil de puesto (solo RH).
 * Permite agregar y eliminar competencias inmediatamente.
 */

import {
  getPerfilCompetencias,
  createPerfilCompetencia,
  deletePerfilCompetencia,
  type PerfilCompetencia,
} from "../../api/puestos.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { BTN_PRIMARY, BTN_DANGER, FIELD_FOCUS, SELECT_CHEVRON } from "../../ui/uiTokens.ts";

export type EditarCompetenciasModalHandle = {
  open: () => void;
  close: () => void;
};

export type EditarCompetenciasModalOptions = {
  perfilId: number;
  onSuccess: () => void;
};

const CATEGORIA_OPTIONS: { value: string; label: string }[] = [
  { value: "informatica", label: "Informatica" },
  { value: "idiomas", label: "Idiomas" },
  { value: "profesional", label: "Profesional" },
  { value: "social", label: "Social" },
  { value: "personal", label: "Personal" },
  { value: "metodos", label: "Metodos" },
  { value: "complementos", label: "Complementos" },
];

const CATEGORIA_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIA_OPTIONS.map(o => [o.value, o.label]),
);

const CATEGORIA_COLORS: Record<string, string> = {
  informatica: "bg-blue-50 text-blue-700",
  idiomas: "bg-violet-50 text-violet-700",
  profesional: "bg-emerald-50 text-emerald-700",
  social: "bg-amber-50 text-amber-700",
  personal: "bg-rose-50 text-rose-700",
  metodos: "bg-cyan-50 text-cyan-700",
  complementos: "bg-slate-100 text-slate-600",
};

function overlayHtml(): string {
  return `
    <div
      id="editar-competencias-overlay"
      class="fixed inset-0 z-50 hidden items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <div
        class="w-full max-w-lg rounded-xl border border-border bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-competencias-title"
      >
        <div class="flex items-start justify-between gap-3 mb-4">
          <h2 id="editar-competencias-title" class="text-lg font-semibold text-text-primary">Editar competencias</h2>
          <button
            type="button"
            data-close-competencias-modal
            class="rounded-lg p-1 text-text-muted hover:bg-surface hover:text-text-primary"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <div id="editar-competencias-body">
          <p class="text-sm text-text-muted">Cargando...</p>
        </div>
      </div>
    </div>`;
}

function renderList(competencias: PerfilCompetencia[]): string {
  if (competencias.length === 0) {
    return `<p class="text-sm text-slate-500 italic py-2">Sin competencias registradas.</p>`;
  }
  return `
    <div class="max-h-60 overflow-y-auto divide-y divide-slate-100 mb-4">
      ${competencias.map(c => {
        const colorClass = CATEGORIA_COLORS[c.categoria] ?? "bg-slate-100 text-slate-600";
        return `
        <div class="flex items-center justify-between gap-2 py-2">
          <div class="flex items-center gap-2 min-w-0">
            <span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${colorClass}">${escapeHtml(CATEGORIA_LABELS[c.categoria] ?? c.categoria)}</span>
            <span class="text-sm text-text-primary truncate">${escapeHtml(c.descripcion)}</span>
          </div>
          <button type="button" data-delete-competencia="${c.id}" class="${BTN_DANGER} !px-2 !py-1 text-xs shrink-0" title="Eliminar">
            <svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>`;
      }).join("")}
    </div>`;
}

function renderForm(): string {
  const catOpts = CATEGORIA_OPTIONS.map(o =>
    `<option value="${o.value}">${escapeHtml(o.label)}</option>`
  ).join("");

  return `
    <form id="form-agregar-competencia" class="border-t border-slate-200 pt-4 space-y-3">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Agregar competencia</p>
      <div>
        <label for="comp-categoria" class="mb-1 block text-xs font-medium text-slate-600">Categoria</label>
        <div class="grid grid-cols-1">
          <select id="comp-categoria" name="categoria" required
            class="col-start-1 row-start-1 block w-full appearance-none rounded-lg border border-border bg-white px-3 py-2 pr-8 text-sm text-text-primary ${FIELD_FOCUS}">
            ${catOpts}
          </select>
          ${SELECT_CHEVRON}
        </div>
      </div>
      <div>
        <label for="comp-descripcion" class="mb-1 block text-xs font-medium text-slate-600">Descripcion</label>
        <input id="comp-descripcion" name="descripcion" type="text" required
          class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}"
          placeholder="Descripcion de la competencia" />
      </div>
      <div>
        <label for="comp-orden" class="mb-1 block text-xs font-medium text-slate-600">Orden</label>
        <input id="comp-orden" name="orden" type="number" min="1" required value="1"
          class="block w-24 rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}" />
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="submit" class="${BTN_PRIMARY} text-sm">Agregar</button>
      </div>
    </form>`;
}

export function mountEditarCompetenciasModal(
  host: HTMLElement,
  options: EditarCompetenciasModalOptions,
): EditarCompetenciasModalHandle {
  host.innerHTML = overlayHtml();

  const overlay = host.querySelector("#editar-competencias-overlay") as HTMLElement;
  const body = host.querySelector("#editar-competencias-body") as HTMLElement;

  let loading = false;

  function close(): void {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
  }

  async function refreshList(): Promise<void> {
    try {
      const items = await getPerfilCompetencias(options.perfilId);
      body.innerHTML = renderList(items) + renderForm();
      bindForm();
      bindDeleteButtons();
    } catch {
      body.innerHTML = `<p class="text-sm text-red-600">Error al cargar competencias.</p>`;
    }
  }

  function bindDeleteButtons(): void {
    body.querySelectorAll<HTMLButtonElement>("[data-delete-competencia]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.deleteCompetencia);
        if (loading) return;
        loading = true;
        btn.disabled = true;
        try {
          await deletePerfilCompetencia(options.perfilId, id);
          options.onSuccess();
          await refreshList();
        } catch {
          // silently fail
        } finally {
          loading = false;
        }
      });
    });
  }

  function bindForm(): void {
    const form = body.querySelector("#form-agregar-competencia") as HTMLFormElement | null;
    if (!form) return;
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (loading) return;
      loading = true;

      const fd = new FormData(form);
      const categoria = String(fd.get("categoria") ?? "").trim();
      const descripcion = String(fd.get("descripcion") ?? "").trim();
      const orden = Number(fd.get("orden") ?? 1);

      if (!categoria || !descripcion) { loading = false; return; }

      const submitBtn = form.querySelector<HTMLButtonElement>("button[type=submit]");
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Agregando..."; }

      try {
        await createPerfilCompetencia(options.perfilId, { categoria, descripcion, orden });
        options.onSuccess();
        await refreshList();
      } catch {
        // keep form
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
    if ((e.target as HTMLElement).closest("[data-close-competencias-modal]")) close();
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
