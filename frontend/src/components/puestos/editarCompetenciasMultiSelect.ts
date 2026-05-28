import {
  getPerfilCompetencias,
  syncPerfilCompetencias,
} from "../../api/puestos.ts";
import { getCompetencias } from "../../api/competencias.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { BTN_PRIMARY } from "../../ui/uiTokens.ts";

export type EditarCompetenciasModalHandle = {
  open: () => void;
  close: () => void;
};

export type EditarCompetenciasModalOptions = {
  perfilId: number;
  onSuccess: () => void;
};

const SUBCATEGORIAS: { key: string; label: string }[] = [
  { key: "informatica", label: "Informática" },
  { key: "idiomas", label: "Idiomas" },
  { key: "profesional", label: "Profesional" },
  { key: "social", label: "Social" },
  { key: "personal", label: "Personal" },
  { key: "metodos", label: "Métodos" },
];

const SUBCATEGORIA_COLORS: Record<string, string> = {
  informatica: "bg-blue-50 text-blue-700 border-blue-200",
  idiomas: "bg-violet-50 text-violet-700 border-violet-200",
  profesional: "bg-emerald-50 text-emerald-700 border-emerald-200",
  social: "bg-amber-50 text-amber-700 border-amber-200",
  personal: "bg-rose-50 text-rose-700 border-rose-200",
  metodos: "bg-cyan-50 text-cyan-700 border-cyan-200",
};

const SELECTED_CHIP = "border border-solid cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-all";
const UNSELECTED_CHIP = "border border-dashed border-slate-300 text-slate-500 cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-all hover:border-slate-400 hover:text-slate-700";

type CatalogoItem = { id: number; nombre: string; subcategoria?: string };

export function mountEditarCompetenciasModal(
  host: HTMLElement,
  options: EditarCompetenciasModalOptions,
): EditarCompetenciasModalHandle {
  host.innerHTML = overlayHtml();
  const overlay = host.querySelector("#editar-competencias-overlay") as HTMLElement;
  const body = host.querySelector("#editar-competencias-body") as HTMLElement;

  let catalogo: CatalogoItem[] = [];
  let selections: Map<string, Set<number>> = new Map();
  let saving = false;

  function close(): void {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", escHandler);
  }

  async function load(): Promise<void> {
    body.innerHTML = `<p class="text-sm text-text-muted">Cargando catálogo...</p>`;
    try {
      const [catalogoItems, perfilComps] = await Promise.all([
        getCompetencias({ page_size: 200 }),
        getPerfilCompetencias(options.perfilId),
      ]);

      catalogo = catalogoItems
        .filter(c => c.subcategoria && SUBCATEGORIAS.some(s => s.key === c.subcategoria))
        .map(c => ({ id: c.id, nombre: c.nombre, subcategoria: c.subcategoria }));

      selections = new Map();
      for (const sub of SUBCATEGORIAS) {
        const selectedInCategory = new Set(
          perfilComps
            .filter(c => c.subcategoria === sub.key)
            .map(c => c.competencia_id),
        );
        selections.set(sub.key, selectedInCategory);
      }

      render();
    } catch {
      body.innerHTML = `<p class="text-sm text-red-600">Error al cargar catálogo</p>`;
    }
  }

  function render(): void {
    const sections = SUBCATEGORIAS.map(sub => {
      const items = catalogo.filter(c => c.subcategoria === sub.key);
      const selected = selections.get(sub.key) ?? new Set();
      const colors = SUBCATEGORIA_COLORS[sub.key] ?? "bg-slate-100 text-slate-600 border-slate-300";

      const chips = items.map(item => {
        const isSelected = selected.has(item.id);
        const cls = isSelected ? `${SELECTED_CHIP} ${colors}` : UNSELECTED_CHIP;
        return `<button type="button" class="${cls}" data-comp-id="${item.id}" data-sub="${sub.key}">${escapeHtml(item.nombre)}</button>`;
      }).join("");

      return `
        <div class="mb-5 last:mb-0">
          <div class="mb-2 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="rounded px-1.5 py-0.5 text-[10px] font-semibold ${colors.split(" ").slice(0, 2).join(" ")}">${escapeHtml(sub.label)}</span>
              <span class="text-[10px] text-slate-400">${selected.size} / ${items.length}</span>
            </div>
            <button type="button" data-save-sub="${sub.key}" class="text-[11px] font-medium text-leoni-blue hover:underline ${saving ? "opacity-50 pointer-events-none" : ""}">Guardar</button>
          </div>
          <div class="flex flex-wrap gap-1.5">${chips || '<span class="text-xs text-slate-400 italic">Sin opciones en catálogo</span>'}</div>
        </div>`;
    }).join("");

    body.innerHTML = `
      <div class="space-y-1">${sections}</div>
      <div class="mt-5 flex justify-end">
        <button type="button" data-save-all class="${BTN_PRIMARY} text-sm ${saving ? "opacity-50 pointer-events-none" : ""}">Guardar todo</button>
      </div>`;

    bindEvents();
  }

  function bindEvents(): void {
    body.addEventListener("click", (e) => {
      const chip = (e.target as HTMLElement).closest<HTMLElement>("[data-comp-id]");
      if (chip && !saving) {
        const compId = Number(chip.dataset.compId);
        const sub = chip.dataset.sub!;
        const set = selections.get(sub) ?? new Set();
        if (set.has(compId)) {
          set.delete(compId);
        } else {
          set.add(compId);
        }
        selections.set(sub, set);
        render();
        return;
      }

      const saveSubBtn = (e.target as HTMLElement).closest<HTMLElement>("[data-save-sub]");
      if (saveSubBtn && !saving) {
        const sub = saveSubBtn.dataset.saveSub!;
        saveCategory(sub);
        return;
      }

      const saveAllBtn = (e.target as HTMLElement).closest<HTMLElement>("[data-save-all]");
      if (saveAllBtn && !saving) {
        saveAll();
      }
    });
  }

  async function saveCategory(sub: string): Promise<void> {
    saving = true;
    render();
    try {
      const ids = [...(selections.get(sub) ?? [])];
      await syncPerfilCompetencias(options.perfilId, {
        subcategoria: sub,
        competencia_ids: ids,
      });
      options.onSuccess();
    } catch {
      // keep state
    } finally {
      saving = false;
      render();
    }
  }

  async function saveAll(): Promise<void> {
    saving = true;
    render();
    try {
      for (const sub of SUBCATEGORIAS) {
        const ids = [...(selections.get(sub.key) ?? [])];
        await syncPerfilCompetencias(options.perfilId, {
          subcategoria: sub.key,
          competencia_ids: ids,
        });
      }
      options.onSuccess();
      close();
    } catch {
      // keep state
    } finally {
      saving = false;
      render();
    }
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  host.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("[data-close-competencias-modal]")) close();
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
      load();
    },
    close,
  };
}

function overlayHtml(): string {
  return `
    <div
      id="editar-competencias-overlay"
      class="fixed inset-0 z-50 hidden items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <div
        class="w-full max-w-2xl rounded-xl border border-border bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-competencias-title"
      >
        <div class="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 id="editar-competencias-title" class="text-lg font-semibold text-text-primary">Competencias demostradas</h2>
            <p class="text-xs text-slate-500 mt-0.5">Selecciona las competencias requeridas para este puesto por categoría</p>
          </div>
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
