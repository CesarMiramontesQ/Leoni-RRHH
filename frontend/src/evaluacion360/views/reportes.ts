import { escapeHtml } from "../../ui/uiUtils.ts";
import {
  HEATMAP_DATA,
  NINE_BOX,
  REPORTE_CARDS,
  TENDENCIAS_COMPETENCIA,
} from "../mockData.ts";
import { renderEval360ChartIds } from "../charts.ts";
import { renderSurfaceCard } from "../shared.ts";

function heatmapColor(valor: number): string {
  if (valor >= 4) return "bg-emerald-500 text-white";
  if (valor >= 3.5) return "bg-emerald-300 text-emerald-900";
  if (valor >= 3) return "bg-amber-300 text-amber-900";
  if (valor >= 2.5) return "bg-orange-300 text-orange-900";
  return "bg-red-400 text-white";
}

export function renderEval360Reportes(): string {
  const charts = renderEval360ChartIds();
  const competenciaLabels = ["Liderazgo", "Comunicación", "Trabajo eq.", "Orient. res.", "Adaptab.", "Resol. prob.", "Des. personal"];

  const cards = REPORTE_CARDS.map(
    (c) => `
    <div class="rounded-xl border border-border bg-white p-5">
      <h3 class="text-sm font-semibold text-text-primary">${escapeHtml(c.titulo)}</h3>
      <ul class="mt-3 space-y-2">
        ${c.items.map((item, i) => `<li class="flex items-center gap-2 text-sm text-slate-700"><span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-light text-[10px] font-bold text-accent">${i + 1}</span>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </div>`,
  ).join("");

  const tendencias = TENDENCIAS_COMPETENCIA.map(
    (t) => `
    <tr class="border-b border-slate-100">
      <td class="px-4 py-3 text-sm font-medium text-text-primary">${escapeHtml(t.competencia)}</td>
      <td class="px-4 py-3 text-sm tabular-nums text-center">${t.q1.toFixed(1)}</td>
      <td class="px-4 py-3 text-sm tabular-nums text-center">${t.q2.toFixed(1)}</td>
      <td class="px-4 py-3 text-sm tabular-nums text-center">${t.q3.toFixed(1)}</td>
      <td class="px-4 py-3 text-sm tabular-nums text-center font-semibold text-accent">${t.q4.toFixed(1)}</td>
    </tr>`,
  ).join("");

  const heatmapHeader = competenciaLabels
    .map((l) => `<th class="px-2 py-2 text-[10px] font-semibold text-text-muted">${escapeHtml(l)}</th>`)
    .join("");

  const heatmapRows = HEATMAP_DATA.map(
    (row) => `
    <tr>
      <td class="px-3 py-2 text-xs font-medium text-text-primary">${escapeHtml(row.dept)}</td>
      ${row.competencias
        .map(
          (v) =>
            `<td class="p-1"><div class="flex size-10 items-center justify-center rounded text-[10px] font-semibold tabular-nums ${heatmapColor(v)}" title="${v.toFixed(1)}">${v.toFixed(1)}</div></td>`,
        )
        .join("")}
    </tr>`,
  ).join("");

  const potencialLabels = ["Alto potencial", "Potencial medio", "Bajo potencial"];
  const desempenoLabels = ["Alto desempeño", "Desempeño medio", "Bajo desempeño"];

  const nineBoxGrid = ["alto", "medio", "bajo"].map((desempeno) => {
    return ["alto", "medio", "bajo"]
      .map((potencial) => {
        const cell = NINE_BOX.find((c) => c.desempeno === desempeno && c.potencial === potencial);
        const bg =
          cell?.clasificacion === "Talento clave"
            ? "bg-emerald-50 border-emerald-200"
            : cell?.clasificacion === "Promovibles"
              ? "bg-blue-50 border-blue-200"
              : cell?.clasificacion === "Consistentes"
                ? "bg-slate-50 border-slate-200"
                : "bg-amber-50 border-amber-200";
        return `
        <div class="min-h-[6rem] rounded-lg border p-3 ${bg}">
          <p class="text-[10px] font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(cell?.clasificacion ?? "")}</p>
          <ul class="mt-2 space-y-0.5">
            ${(cell?.empleados ?? []).map((e) => `<li class="text-xs text-slate-700">${escapeHtml(e)}</li>`).join("")}
          </ul>
        </div>`;
      })
      .join("");
  });

  return `
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">${cards}</div>

    <div class="mt-6">
      <h2 class="text-sm font-semibold text-text-primary">Analítica</h2>
      <p class="mt-0.5 text-xs text-text-muted">Evolución, comparativos y tendencias organizacionales</p>
    </div>

    <div class="mt-4 grid gap-5 lg:grid-cols-2">
      ${renderSurfaceCard("Evolución histórica", "Promedio general por periodo", charts.lineEvolucion)}
      ${renderSurfaceCard("Comparativo por departamento", "Promedio de calificación", charts.barDept)}
    </div>

    <div class="mt-5">
      ${renderSurfaceCard(
        "Tendencias por competencia",
        "Evolución trimestral",
        `<div class="overflow-x-auto -mx-5 px-5">
          <table class="min-w-full text-left">
            <thead>
              <tr class="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-text-muted">
                <th class="px-4 py-2">Competencia</th>
                <th class="px-4 py-2 text-center">Q1</th>
                <th class="px-4 py-2 text-center">Q2</th>
                <th class="px-4 py-2 text-center">Q3</th>
                <th class="px-4 py-2 text-center">Q4</th>
              </tr>
            </thead>
            <tbody>${tendencias}</tbody>
          </table>
        </div>`,
      )}
    </div>

    <div class="mt-5">
      ${renderSurfaceCard(
        "Heatmap organizacional",
        "Puntuación por departamento y competencia",
        `<div class="overflow-x-auto -mx-5 px-5">
          <table class="min-w-full text-left">
            <thead><tr><th class="px-3 py-2"></th>${heatmapHeader}</tr></thead>
            <tbody>${heatmapRows}</tbody>
          </table>
        </div>`,
      )}
    </div>

    <div class="mt-5">
      ${renderSurfaceCard(
        "Matriz de talento (9-box)",
        "Desempeño vs. potencial",
        `<div class="grid grid-cols-[auto_1fr] gap-3">
          <div class="flex flex-col justify-around py-8 text-[10px] font-semibold text-text-muted [writing-mode:vertical-rl] rotate-180">
            ${desempenoLabels.map((l) => `<span class="py-4">${escapeHtml(l)}</span>`).join("")}
          </div>
          <div>
            <div class="mb-2 flex justify-around text-[10px] font-semibold text-text-muted">
              ${potencialLabels.map((l) => `<span>${escapeHtml(l)}</span>`).join("")}
            </div>
            <div class="grid grid-cols-3 gap-2">${nineBoxGrid.join("")}</div>
          </div>
        </div>`,
      )}
    </div>`;
}
