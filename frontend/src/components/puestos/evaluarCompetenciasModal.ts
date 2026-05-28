/**
 * Modal para evaluar competencias de un empleado asignado a un perfil.
 * Muestra requerido vs actual con chips toggle y badges de compliance por categoría.
 */

import {
  getAsignacionGap,
  syncEvaluacionCompetencias,
  type GapCompetencia,
} from "../../api/puestos.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { BTN_PRIMARY, BTN_GHOST } from "../../ui/uiTokens.ts";

export type EvaluarCompetenciasModalHandle = {
  open: () => void;
  close: () => void;
};

export type EvaluarCompetenciasModalOptions = {
  perfilId: number;
  asignacionId: number;
  nombreEmpleado: string;
  onSuccess?: () => void;
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

type ComplianceLevel = "verde" | "amarillo" | "rojo" | "na";

function computeCompliance(requiredIds: Set<number>, actualIds: Set<number>): ComplianceLevel {
  if (requiredIds.size === 0) return "na";
  const inter = [...requiredIds].filter(id => actualIds.has(id));
  if (inter.length === requiredIds.size) return "verde";
  if (inter.length > 0) return "amarillo";
  return "rojo";
}

function complianceBadge(level: ComplianceLevel): string {
  switch (level) {
    case "verde":
      return `<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"><span class="size-1.5 rounded-full bg-emerald-500"></span>Cumple</span>`;
    case "amarillo":
      return `<span class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700"><span class="size-1.5 rounded-full bg-amber-500"></span>Parcial</span>`;
    case "rojo":
      return `<span class="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700"><span class="size-1.5 rounded-full bg-red-500"></span>No cumple</span>`;
    default:
      return "";
  }
}

const CHIP_REQUIRED = "inline-block rounded-md border px-2 py-0.5 text-xs font-medium";
const CHIP_ACTUAL_ON = "border border-solid cursor-pointer rounded-md px-2 py-0.5 text-xs font-medium transition-all";
const CHIP_ACTUAL_OFF = "border border-dashed border-slate-300 text-slate-400 cursor-pointer rounded-md px-2 py-0.5 text-xs font-medium transition-all hover:border-slate-400 hover:text-slate-600";

export function mountEvaluarCompetenciasModal(
  host: HTMLElement,
  options: EvaluarCompetenciasModalOptions,
): EvaluarCompetenciasModalHandle {
  host.innerHTML = overlayHtml(options.nombreEmpleado);
  const overlay = host.querySelector("#evaluar-comp-overlay") as HTMLElement;
  const body = host.querySelector("#evaluar-comp-body") as HTMLElement;

  let gapItems: GapCompetencia[] = [];
  let actualIds: Set<number> = new Set();
  let saving = false;

  function close(): void {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", escHandler);
  }

  const VALID_SUBCATEGORIAS = new Set(SUBCATEGORIAS.map(s => s.key));

  async function load(): Promise<void> {
    body.innerHTML = `<p class="text-sm text-text-muted">Cargando evaluación...</p>`;
    try {
      const gap = await getAsignacionGap(options.perfilId, options.asignacionId);
      gapItems = gap.gap_competencias.filter(g => g.subcategoria && VALID_SUBCATEGORIAS.has(g.subcategoria));
      actualIds = new Set(
        gapItems
          .filter(g => g.evaluado && g.situacion_actual === "cumple")
          .map(g => g.competencia_requisito_id),
      );
      render();
    } catch {
      body.innerHTML = `<p class="text-sm text-red-600">Error al cargar evaluación</p>`;
    }
  }

  function render(): void {
    const sections = SUBCATEGORIAS.map(sub => {
      const items = gapItems.filter(g => g.subcategoria === sub.key);
      if (items.length === 0) return "";

      const colors = SUBCATEGORIA_COLORS[sub.key] ?? "bg-slate-100 text-slate-600 border-slate-300";
      const requiredIds = new Set(items.map(g => g.competencia_requisito_id));
      const actualInCategory = new Set(items.filter(g => actualIds.has(g.competencia_requisito_id)).map(g => g.competencia_requisito_id));
      const compliance = computeCompliance(requiredIds, actualInCategory);

      const chips = items.map(item => {
        const isActual = actualIds.has(item.competencia_requisito_id);
        const cls = isActual ? `${CHIP_ACTUAL_ON} ${colors}` : CHIP_ACTUAL_OFF;
        return `<button type="button" class="${cls}" data-req-id="${item.competencia_requisito_id}">${escapeHtml(item.competencia_nombre)}</button>`;
      }).join("");

      return `
        <div class="mb-5 last:mb-0">
          <div class="mb-2 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="rounded px-1.5 py-0.5 text-[10px] font-semibold ${colors.split(" ").slice(0, 2).join(" ")}">${escapeHtml(sub.label)}</span>
              <span class="text-[10px] text-slate-400">${actualInCategory.size} / ${items.length}</span>
            </div>
            ${complianceBadge(compliance)}
          </div>
          <div class="mb-1.5">
            <span class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Requerido</span>
            <div class="mt-1 flex flex-wrap gap-1">
              ${items.map(g => `<span class="${CHIP_REQUIRED} ${colors}">${escapeHtml(g.competencia_nombre)}</span>`).join("")}
            </div>
          </div>
          <div>
            <span class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Situación actual (click para toggle)</span>
            <div class="mt-1 flex flex-wrap gap-1.5">${chips}</div>
          </div>
        </div>`;
    }).join("");

    const hasItems = gapItems.length > 0;

    body.innerHTML = hasItems ? `
      <div class="space-y-1">${sections}</div>
      <div class="mt-5 flex justify-end gap-2">
        <button type="button" data-cancel class="${BTN_GHOST} text-sm">Cancelar</button>
        <button type="button" data-save class="${BTN_PRIMARY} text-sm ${saving ? "opacity-50 pointer-events-none" : ""}">Guardar evaluación</button>
      </div>
    ` : `<p class="text-sm text-slate-500 italic">Sin competencias requeridas para este perfil.</p>`;
  }

  body.addEventListener("click", (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>("[data-req-id]");
    if (chip && !saving) {
      const reqId = Number(chip.dataset.reqId);
      if (actualIds.has(reqId)) {
        actualIds.delete(reqId);
      } else {
        actualIds.add(reqId);
      }
      render();
      return;
    }

    const cancelBtn = (e.target as HTMLElement).closest<HTMLElement>("[data-cancel]");
    if (cancelBtn) {
      close();
      return;
    }

    const saveBtn = (e.target as HTMLElement).closest<HTMLElement>("[data-save]");
    if (saveBtn && !saving) {
      save();
    }
  });

  async function save(): Promise<void> {
    saving = true;
    render();
    try {
      await syncEvaluacionCompetencias(options.perfilId, options.asignacionId, {
        competencia_requisito_ids: [...actualIds],
      });
      options.onSuccess?.();
      close();
    } catch {
      saving = false;
      render();
    }
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  host.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("[data-close-evaluar-comp]")) close();
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

function overlayHtml(nombre: string): string {
  return `
    <div
      id="evaluar-comp-overlay"
      class="fixed inset-0 z-50 hidden items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <div
        class="w-full max-w-2xl rounded-xl border border-border bg-white shadow-xl max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evaluar-comp-title"
      >
        <div class="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="evaluar-comp-title" class="text-lg font-semibold text-text-primary">Evaluar competencias</h2>
            <p class="text-xs text-slate-500 mt-0.5">${escapeHtml(nombre)}</p>
          </div>
          <button
            type="button"
            data-close-evaluar-comp
            class="rounded-lg p-1 text-text-muted hover:bg-surface hover:text-text-primary"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <div id="evaluar-comp-body" class="flex-1 overflow-y-auto px-5 py-4"></div>
      </div>
    </div>`;
}
