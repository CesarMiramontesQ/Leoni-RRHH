import { escapeHtml } from "../../ui/uiUtils.ts";
import { FIELD_INPUT } from "../../ui/uiTokens.ts";
import { renderSurfaceCard } from "../shared.ts";
import { renderNineBox } from "./resultadosReal.ts";
import type { CampanaApi, DashboardApi, NineBoxApi } from "../../api/evaluacion360.ts";

export interface ReportesViewData {
  campanas: CampanaApi[] | null;
  campanaId: number | null;
  nineBox: NineBoxApi | null;
  nineBoxLoading: boolean;
  dashboard: DashboardApi | null;
}

const CAMPANA_ESTADOS_CON_RESULTADOS = ["activa", "en_progreso", "finalizada", "cerrada"];

function serieList(serie: { label: string; valor: number }[], tone: string): string {
  if (serie.length === 0) return `<p class="text-sm text-text-muted">Sin datos disponibles todavía.</p>`;
  return `<ul class="space-y-2">
    ${serie
      .map((p) => {
        const pct = Math.max(2, Math.min(100, (p.valor / 5) * 100));
        return `<li>
          <div class="flex items-center justify-between gap-2 text-xs">
            <span class="truncate text-text-primary" title="${escapeHtml(p.label)}">${escapeHtml(p.label)}</span>
            <span class="tabular-nums font-semibold text-text-primary">${p.valor.toFixed(1)}</span>
          </div>
          <div class="mt-1 h-2 rounded-full bg-slate-100"><div class="h-2 rounded-full ${tone}" style="width:${pct}%"></div></div>
        </li>`;
      })
      .join("")}
  </ul>`;
}

function renderAnalitica(dashboard: DashboardApi | null): string {
  if (!dashboard) return "";
  return `
    <div class="mt-6">
      <h2 class="text-sm font-semibold text-text-primary">Analítica de competencias</h2>
      <p class="mt-0.5 text-xs text-text-muted">Consolidado de todas las campañas (escala 0–5)</p>
    </div>
    <div class="mt-4 grid gap-5 lg:grid-cols-2">
      ${renderSurfaceCard("Competencias mejor evaluadas", "Promedio general", serieList(dashboard.competencias_mejor, "bg-emerald-500"))}
      ${renderSurfaceCard("Áreas de oportunidad", "Competencias con menor promedio", serieList(dashboard.competencias_oportunidad, "bg-amber-500"))}
    </div>`;
}

export function renderEval360Reportes(data: ReportesViewData): string {
  const campanas = (data.campanas ?? []).filter((c) =>
    CAMPANA_ESTADOS_CON_RESULTADOS.includes(c.estado),
  );
  const opciones = [
    `<option value="">Selecciona una campaña…</option>`,
    ...campanas.map(
      (c) => `<option value="${c.id}" ${c.id === data.campanaId ? "selected" : ""}>${escapeHtml(c.nombre)}</option>`,
    ),
  ].join("");

  const selector = `
    <div class="rounded-xl border border-border bg-white p-4">
      <label class="mb-1 block text-xs font-medium text-text-muted">Campaña</label>
      <select data-select="e360-rep-campana" class="${FIELD_INPUT} max-w-md">${opciones}</select>
      ${data.campanas === null ? `<p class="mt-2 text-xs text-text-muted">Cargando campañas…</p>` : ""}
      ${data.campanas !== null && campanas.length === 0 ? `<p class="mt-2 text-xs text-text-muted">No hay campañas activas o finalizadas con resultados.</p>` : ""}
    </div>`;

  let nineBoxSection = "";
  if (data.campanaId != null) {
    if (data.nineBoxLoading || data.nineBox === null) {
      nineBoxSection = `<div class="mt-5 h-64 animate-pulse rounded-xl bg-slate-100"></div>`;
    } else {
      nineBoxSection = `<div class="mt-5">${renderNineBox(data.nineBox)}</div>`;
    }
  } else {
    nineBoxSection = `<div class="mt-5 rounded-xl border border-dashed border-border bg-slate-50/50 px-4 py-10 text-center text-sm text-text-muted">Selecciona una campaña para ver su matriz de talento (9-box).</div>`;
  }

  return `
    ${selector}
    ${nineBoxSection}
    ${renderAnalitica(data.dashboard)}
    <p class="mt-6 text-xs text-text-muted">Los reportes organizacionales (tendencias trimestrales y heatmap por área) llegarán en una próxima entrega.</p>`;
}
