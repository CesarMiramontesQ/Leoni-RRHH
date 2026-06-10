import { escapeHtml } from "../../ui/uiUtils.ts";
import { BTN_SECONDARY } from "../../ui/uiTokens.ts";
import type { BrechaEstado, EmpleadoEval360 } from "../types.ts";
import { renderEval360ChartIds } from "../charts.ts";
import { renderSurfaceCard, tipoEvaluadorLabel } from "../shared.ts";

function brechaBadge(estado: BrechaEstado): string {
  const map: Record<BrechaEstado, string> = {
    cumple: "border-emerald-200 bg-emerald-50 text-emerald-800",
    riesgo: "border-amber-200 bg-amber-50 text-amber-800",
    brecha: "border-red-200 bg-red-50 text-red-800",
  };
  const labels: Record<BrechaEstado, string> = { cumple: "Cumple", riesgo: "Riesgo", brecha: "Brecha" };
  return `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${map[estado]}">${labels[estado]}</span>`;
}

export function renderEval360EmployeeDetail(empleado: EmpleadoEval360): string {
  const charts = renderEval360ChartIds();
  const e = empleado;

  const fortalezas = [...e.competencias]
    .sort((a, b) => b.evaluadores - a.evaluadores)
    .slice(0, 3)
    .map(
      (c) => `<div class="flex items-center justify-between py-2"><span class="text-sm text-text-primary">${escapeHtml(c.nombre)}</span><span class="text-sm font-semibold tabular-nums text-emerald-700">${c.evaluadores.toFixed(1)}</span></div>`,
    )
    .join("");

  const mejoras = [...e.competencias]
    .sort((a, b) => a.evaluadores - b.evaluadores)
    .slice(0, 3)
    .map(
      (c) => `<div class="flex items-center justify-between py-2"><span class="text-sm text-text-primary">${escapeHtml(c.nombre)}</span><span class="text-sm font-semibold tabular-nums text-amber-700">${c.evaluadores.toFixed(1)}</span></div>`,
    )
    .join("");

  const comentarios = e.comentarios
    .map(
      (g) => `
    <div class="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(tipoEvaluadorLabel(g.tipo))}</h3>
      <ul class="mt-2 space-y-2">${g.comentarios.map((c) => `<li class="text-sm text-slate-700 before:mr-2 before:text-accent before:content-['•']">${escapeHtml(c)}</li>`).join("")}</ul>
    </div>`,
    )
    .join("");

  const participacionRows = e.participacion
    .map(
      (p) => `
    <tr class="border-b border-slate-100">
      <td class="px-3 py-2 text-sm">${escapeHtml(p.tipo)}</td>
      <td class="px-3 py-2 text-sm tabular-nums">${p.completadas}/${p.asignadas}</td>
      <td class="px-3 py-2"><div class="h-2 w-20 overflow-hidden rounded-full bg-slate-100"><div class="h-full bg-accent" style="width:${p.pct}%"></div></div></td>
    </tr>`,
    )
    .join("");

  const brechasPuesto = e.brechasPuesto
    .map(
      (b) => `
    <tr class="border-b border-slate-100">
      <td class="px-4 py-3 text-sm font-medium text-text-primary">${escapeHtml(b.competencia)}</td>
      <td class="px-4 py-3 text-sm tabular-nums text-center">${b.requerida.toFixed(1)}</td>
      <td class="px-4 py-3 text-sm tabular-nums text-center">${b.actual.toFixed(1)}</td>
      <td class="px-4 py-3 text-center">${brechaBadge(b.estado)}</td>
    </tr>`,
    )
    .join("");

  const acciones = e.accionesRecomendadas
    .map(
      (a) => `
    <div class="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3">
      <span class="text-sm text-text-primary">${escapeHtml(a)}</span>
      <button type="button" class="${BTN_SECONDARY} !px-3 !py-1.5 text-xs" data-action="e360-crear-accion">${escapeHtml(a.startsWith("Asignar") ? "Crear acción" : "Crear acción")}</button>
    </div>`,
    )
    .join("");

  return `
    <div class="rounded-xl border border-border bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div class="flex size-20 shrink-0 items-center justify-center rounded-full bg-accent-light text-xl font-bold text-accent" aria-hidden="true">${escapeHtml(e.iniciales)}</div>
        <div class="flex-1 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div><p class="text-xs text-text-muted">Nombre</p><p class="text-sm font-semibold text-text-primary">${escapeHtml(e.nombre)}</p></div>
          <div><p class="text-xs text-text-muted">Número de empleado</p><p class="text-sm font-semibold tabular-nums">${escapeHtml(e.numero)}</p></div>
          <div><p class="text-xs text-text-muted">Puesto</p><p class="text-sm font-semibold">${escapeHtml(e.puesto)}</p></div>
          <div><p class="text-xs text-text-muted">Departamento</p><p class="text-sm font-semibold">${escapeHtml(e.departamento)}</p></div>
          <div><p class="text-xs text-text-muted">Supervisor</p><p class="text-sm font-semibold">${escapeHtml(e.supervisor)}</p></div>
          <div><p class="text-xs text-text-muted">Antigüedad</p><p class="text-sm font-semibold">${escapeHtml(e.antiguedad)}</p></div>
          <div><p class="text-xs text-text-muted">Campaña evaluada</p><p class="text-sm font-semibold">${escapeHtml(e.campana)}</p></div>
          <div><p class="text-xs text-text-muted">Calificación general</p><p class="text-2xl font-bold tabular-nums text-accent">${e.calificacion > 0 ? e.calificacion.toFixed(1) : "—"}</p></div>
          <div><p class="text-xs text-text-muted">Nivel obtenido</p><p class="text-sm font-semibold text-emerald-700">${escapeHtml(e.nivel)}</p></div>
        </div>
      </div>
    </div>

    <div class="mt-5">
      <h3 class="mb-3 text-sm font-semibold text-text-primary">Resultados 360°</h3>
      <div class="grid gap-5 lg:grid-cols-2">
        ${renderSurfaceCard("Radar de competencias", "Autoevaluación vs. promedio evaluadores", charts.radar)}
        ${renderSurfaceCard("Comparativo", "Autoevaluación vs. evaluadores", charts.barComparativo)}
      </div>
      <div class="mt-5 grid gap-5 lg:grid-cols-3">
        ${renderSurfaceCard("Distribución de evaluadores", "", charts.donut)}
        ${renderSurfaceCard(
          "Resumen de participación",
          "",
          `<table class="min-w-full text-left"><tbody>${participacionRows}</tbody></table>`,
        )}
        ${renderSurfaceCard("Comentarios destacados", "", `<div class="max-h-48 space-y-2 overflow-y-auto">${e.comentarios.flatMap((g) => g.comentarios.slice(0, 1).map((c) => `<p class="text-sm text-slate-700"><span class="font-semibold text-text-muted">${escapeHtml(tipoEvaluadorLabel(g.tipo))}:</span> ${escapeHtml(c)}</p>`)).join("")}</div>`)}
      </div>
      <div class="mt-5 grid gap-5 lg:grid-cols-2">
        ${renderSurfaceCard("Fortalezas", "", `<div class="divide-y divide-slate-100">${fortalezas}</div>`)}
        ${renderSurfaceCard("Áreas de mejora", "", `<div class="divide-y divide-slate-100">${mejoras}</div>`)}
      </div>
      <div class="mt-5">${renderSurfaceCard("Comentarios", "Retroalimentación anónima", `<div class="grid gap-4 sm:grid-cols-2">${comentarios}</div>`)}</div>
      <div class="mt-5">${renderSurfaceCard("Brecha contra perfil de puesto", "", `<div class="overflow-x-auto -mx-5 px-5"><table class="min-w-full"><thead><tr class="border-b text-xs font-semibold uppercase text-text-muted"><th class="px-4 py-2 text-left">Competencia</th><th class="px-4 py-2 text-center">Requerida</th><th class="px-4 py-2 text-center">Obtenida</th><th class="px-4 py-2 text-center">Estado</th></tr></thead><tbody>${brechasPuesto}</tbody></table></div>`)}</div>
    </div>

    <div class="mt-5">${renderSurfaceCard("Acciones recomendadas", "Sugerencias para RH según resultados", `<div class="space-y-2">${acciones}</div>`)}</div>

    <div class="mt-5">${renderSurfaceCard("Evolución histórica del empleado", "Individual vs. departamento vs. planta", charts.lineEmpleado)}</div>`;
}
