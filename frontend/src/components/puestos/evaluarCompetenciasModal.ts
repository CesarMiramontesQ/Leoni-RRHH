/**
 * Modal para evaluar competencias de un empleado asignado a un perfil.
 * Cada competencia se califica con nivel 0-4 (0=N/A, 1=mínimo, 4=máximo).
 */

import {
  getAsignacionGap,
  syncEvaluacionCompetencias,
  type GapCompetencia,
} from "../../api/puestos.ts";
import { getTiposCompetencia } from "../../api/tiposCompetencia.ts";
import type { TipoCompetencia } from "../../dashboard/tiposCompetencia/types.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { BTN_PRIMARY, BTN_GHOST, FIELD_FOCUS, SELECT_CHEVRON } from "../../ui/uiTokens.ts";

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

const TIPO_CHIP_PALETTE = [
  "bg-blue-50 text-blue-700 border-blue-200",
  "bg-violet-50 text-violet-700 border-violet-200",
  "bg-emerald-50 text-emerald-700 border-emerald-200",
  "bg-amber-50 text-amber-700 border-amber-200",
  "bg-rose-50 text-rose-700 border-rose-200",
  "bg-cyan-50 text-cyan-700 border-cyan-200",
];

const TIPO_COMPLEMENTOS = "Complementos";

const NIVEL_LABELS: Record<number, string> = {
  0: "0 — N/A",
  1: "1 — Planeado",
  2: "2 — En entrenamiento",
  3: "3 — Certificado",
  4: "4 — Experto",
};

export function mountEvaluarCompetenciasModal(
  host: HTMLElement,
  options: EvaluarCompetenciasModalOptions,
): EvaluarCompetenciasModalHandle {
  host.innerHTML = overlayHtml(options.nombreEmpleado);
  const overlay = host.querySelector("#evaluar-comp-overlay") as HTMLElement;
  const body = host.querySelector("#evaluar-comp-body") as HTMLElement;

  let gapItems: GapCompetencia[] = [];
  let tiposCatalogo: TipoCompetencia[] = [];
  let niveles: Map<number, number> = new Map(); // competencia_requisito_id → nivel (0-4)
  let saving = false;

  function close(): void {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", escHandler);
  }

  async function load(): Promise<void> {
    body.innerHTML = `<p class="text-sm text-text-muted">Cargando evaluación...</p>`;
    try {
      const [gap, tipos] = await Promise.all([
        getAsignacionGap(options.perfilId, options.asignacionId),
        getTiposCompetencia({ page_size: 200 }),
      ]);
      tiposCatalogo = tipos.filter((t) => t.nombre !== TIPO_COMPLEMENTOS);
      const validTipoIds = new Set(tiposCatalogo.map((t) => t.id));
      gapItems = gap.gap_competencias.filter(
        (g) => g.tipo_competencia_id != null && validTipoIds.has(g.tipo_competencia_id),
      );

      niveles = new Map();
      for (const g of gapItems) {
        if (g.evaluado && g.situacion_actual != null) {
          const n = parseInt(g.situacion_actual, 10);
          niveles.set(g.competencia_requisito_id, isNaN(n) ? (g.situacion_actual === "cumple" ? 4 : 0) : n);
        }
      }
      render();
    } catch {
      body.innerHTML = `<p class="text-sm text-red-600">Error al cargar evaluación</p>`;
    }
  }

  function render(): void {
    const sections = tiposCatalogo.map((sub, idx) => {
      const items = gapItems.filter((g) => g.tipo_competencia_id === sub.id);
      if (items.length === 0) return "";

      const colors = TIPO_CHIP_PALETTE[idx % TIPO_CHIP_PALETTE.length] ?? "bg-slate-100 text-slate-600 border-slate-300";
      const evaluated = items.filter(g => (niveles.get(g.competencia_requisito_id) ?? 0) > 0).length;

      const rows = items.map(item => {
        const reqId = item.competencia_requisito_id;
        const currentNivel = niveles.get(reqId) ?? 0;
        const opts = [0, 1, 2, 3, 4].map(n =>
          `<option value="${n}" ${currentNivel === n ? "selected" : ""}>${NIVEL_LABELS[n]}</option>`
        ).join("");

        return `
          <div class="flex items-center gap-3 py-2">
            <span class="flex-1 text-sm text-text-primary">${escapeHtml(item.competencia_nombre)}</span>
            <div class="grid grid-cols-1 w-40 shrink-0">
              <select data-nivel-req="${reqId}"
                class="col-start-1 row-start-1 block w-full appearance-none rounded-lg border border-border bg-white px-2.5 py-1.5 pr-7 text-xs text-text-primary ${FIELD_FOCUS}">
                ${opts}
              </select>
              ${SELECT_CHEVRON}
            </div>
          </div>`;
      }).join("");

      return `
        <div class="mb-5 last:mb-0">
          <div class="mb-2 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="rounded px-1.5 py-0.5 text-[10px] font-semibold ${colors.split(" ").slice(0, 2).join(" ")}">${escapeHtml(sub.nombre)}</span>
              <span class="text-[10px] text-slate-400">${evaluated} / ${items.length} evaluadas</span>
            </div>
          </div>
          <div class="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white px-3">
            ${rows}
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

  body.addEventListener("change", (e) => {
    const select = (e.target as HTMLElement).closest<HTMLSelectElement>("[data-nivel-req]");
    if (select) {
      const reqId = Number(select.dataset.nivelReq);
      const nivel = Number(select.value);
      niveles.set(reqId, nivel);
    }
  });

  body.addEventListener("click", (e) => {
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
      const evaluaciones = gapItems.map(g => ({
        competencia_requisito_id: g.competencia_requisito_id,
        nivel: niveles.get(g.competencia_requisito_id) ?? 0,
      }));
      await syncEvaluacionCompetencias(options.perfilId, options.asignacionId, {
        evaluaciones,
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
