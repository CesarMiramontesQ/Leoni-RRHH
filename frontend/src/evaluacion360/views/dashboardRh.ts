import { escapeHtml } from "../../ui/uiUtils.ts";
import {
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_BTN_SECONDARY,
} from "../../ui/uiTokens.ts";
import { renderSurfaceCard } from "../shared.ts";
import type { DashboardApi } from "../../api/evaluacion360.ts";

type SeriePunto = { label: string; valor: number };

function kpiTile(label: string, value: string, sub = ""): string {
  return `
    <article class="rounded-[14px] border border-border bg-white p-4">
      <p class="text-xs font-medium text-text-muted">${escapeHtml(label)}</p>
      <p class="mt-2 text-2xl font-bold tabular-nums tracking-tight text-text-primary">${escapeHtml(value)}</p>
      ${sub ? `<p class="mt-1 text-[11px] text-text-muted">${escapeHtml(sub)}</p>` : ""}
    </article>`;
}

function renderKpis(k: DashboardApi["kpis"]): string {
  const promedio = k.promedio_general != null ? `${k.promedio_general.toFixed(1)}/5` : "—";
  const mayor =
    k.competencia_mayor != null
      ? `${k.competencia_mayor}${k.competencia_mayor_promedio != null ? ` · ${k.competencia_mayor_promedio.toFixed(1)}` : ""}`
      : "—";
  const menor =
    k.competencia_menor != null
      ? `${k.competencia_menor}${k.competencia_menor_promedio != null ? ` · ${k.competencia_menor_promedio.toFixed(1)}` : ""}`
      : "—";
  return `
    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      ${kpiTile("Campañas activas", String(k.campanas_activas))}
      ${kpiTile("Campañas finalizadas", String(k.campanas_finalizadas))}
      ${kpiTile("Participantes", String(k.participantes))}
      ${kpiTile("Promedio general", promedio)}
      ${kpiTile("Evaluaciones respondidas", String(k.evaluaciones_respondidas))}
      ${kpiTile("Evaluaciones pendientes", String(k.evaluaciones_pendientes))}
      ${kpiTile("Competencia mejor evaluada", mayor)}
      ${kpiTile("Competencia de oportunidad", menor)}
    </div>`;
}

/** Lista de barras horizontales para una serie label/valor. `max` fija la escala. */
function barList(serie: SeriePunto[], max: number, fmt: (v: number) => string, tone = "bg-accent"): string {
  if (serie.length === 0) return `<p class="text-sm text-text-muted">Sin datos.</p>`;
  const escala = max > 0 ? max : 1;
  return `<ul class="space-y-2">
    ${serie
      .map((p) => {
        const pct = Math.max(2, Math.min(100, (p.valor / escala) * 100));
        return `<li>
          <div class="flex items-center justify-between gap-2 text-xs">
            <span class="truncate text-text-primary" title="${escapeHtml(p.label)}">${escapeHtml(p.label)}</span>
            <span class="tabular-nums font-semibold text-text-primary">${escapeHtml(fmt(p.valor))}</span>
          </div>
          <div class="mt-1 h-2 rounded-full bg-slate-100"><div class="h-2 rounded-full ${tone}" style="width:${pct}%"></div></div>
        </li>`;
      })
      .join("")}
  </ul>`;
}

function renderAvanceCampanas(items: DashboardApi["avance_por_campana"]): string {
  if (items.length === 0) return `<p class="text-sm text-text-muted">Sin campañas.</p>`;
  return `<ul class="space-y-3">
    ${items
      .map((c) => {
        const pct = Math.round(c.avance);
        return `<li>
          <div class="flex items-center justify-between gap-2 text-xs">
            <span class="truncate text-text-primary" title="${escapeHtml(c.nombre)}">${escapeHtml(c.nombre)}</span>
            <span class="tabular-nums font-semibold text-text-primary">${pct}%</span>
          </div>
          <div class="mt-1 h-2 rounded-full bg-slate-100"><div class="h-2 rounded-full bg-accent" style="width:${Math.max(2, Math.min(100, pct))}%"></div></div>
        </li>`;
      })
      .join("")}
  </ul>`;
}

function renderSkeleton(): string {
  const tile = `<div class="h-20 animate-pulse rounded-[14px] bg-slate-100"></div>`;
  const card = `<div class="h-48 animate-pulse rounded-xl bg-slate-100"></div>`;
  return `
    <section class="mt-6 space-y-6">
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">${tile.repeat(8)}</div>
      <div class="grid gap-5 lg:grid-cols-2">${card.repeat(2)}</div>
    </section>`;
}

export function renderEval360RhDashboard(data: DashboardApi | null): string {
  if (data === null) return renderSkeleton();
  const distMax = Math.max(0, ...data.distribucion_calificaciones.map((d) => d.valor));
  return `
    <section class="mt-6 space-y-6" aria-labelledby="e360-seccion-planta">
      <div>
        <h2 id="e360-seccion-planta" class="text-sm font-semibold text-text-primary">Resumen general 360°</h2>
        <p class="mt-0.5 text-xs text-text-muted">Indicadores en tiempo real de las campañas de evaluación.</p>
        <div class="mt-4">${renderKpis(data.kpis)}</div>
      </div>

      <div class="grid gap-5 lg:grid-cols-2">
        ${renderSurfaceCard(
          "Competencias mejor evaluadas",
          "Promedio general (escala 0–5)",
          barList(data.competencias_mejor, 5, (v) => v.toFixed(1), "bg-emerald-500"),
        )}
        ${renderSurfaceCard(
          "Áreas de oportunidad",
          "Competencias con menor promedio",
          barList(data.competencias_oportunidad, 5, (v) => v.toFixed(1), "bg-amber-500"),
        )}
      </div>

      <div class="grid gap-5 lg:grid-cols-2">
        ${renderSurfaceCard("Avance por campaña", "Porcentaje de evaluaciones completadas", renderAvanceCampanas(data.avance_por_campana))}
        ${renderSurfaceCard(
          "Distribución de calificaciones",
          "Cantidad de evaluaciones por rango",
          barList(data.distribucion_calificaciones, distMax, (v) => String(Math.round(v)), "bg-accent"),
        )}
      </div>
    </section>`;
}

export function renderEval360RhHeader(): string {
  return `
    <header class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-medium text-text-muted">Level Up · Recursos Humanos</p>
        <h1 class="mt-0.5 text-xl font-bold text-text-primary">Evaluación 360°</h1>
        <p class="mt-1 text-sm text-text-muted">Vista integral de desempeño, competencias y brechas de talento por planta.</p>
      </div>
      <div class="rh-sol-header__toolbar mt-3 flex flex-wrap items-center gap-2 sm:mt-0">
        <button type="button" class="${RH_LISTADO_BTN_GHOST}" data-action="e360-exportar">Exportar resultados</button>
        <button type="button" class="${RH_LISTADO_BTN_SECONDARY}" data-action="e360-generar-reporte">Generar reporte</button>
        <button type="button" class="${RH_LISTADO_BTN_PRIMARY}" data-action="e360-open-modal">Nueva campaña</button>
      </div>
    </header>`;
}
