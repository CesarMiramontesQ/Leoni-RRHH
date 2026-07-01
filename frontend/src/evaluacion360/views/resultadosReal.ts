// frontend/src/evaluacion360/views/resultadosReal.ts
// Vista de Resultados/Reportes conectada a la API: selector de campaña y
// participante, radar auto vs evaluadores, brechas, comentarios, evolución
// histórica y exportación PDF/Excel.

import { escapeHtml } from "../../ui/uiUtils.ts";
import { BTN_SECONDARY, FIELD_INPUT } from "../../ui/uiTokens.ts";
import type {
  CampanaApi,
  NineBoxApi,
  ParticipanteApi,
  ReporteIndividualApi,
} from "../../api/evaluacion360.ts";
import { renderEval360ChartIds } from "../charts.ts";
import { renderSurfaceCard } from "../shared.ts";
import type { CompetenciaPuntuacion } from "../types.ts";

const TIPO_LABELS: Record<string, string> = {
  autoevaluacion: "Autoevaluación",
  jefe: "Jefe directo",
  par: "Par",
  subordinado: "Subordinado",
  cliente_interno: "Cliente interno",
  cliente_externo: "Cliente externo",
};

export interface ResultadosProps {
  campanas: CampanaApi[] | null;
  campanaId: number | null;
  participantes: ParticipanteApi[] | null;
  participanteId: number | null;
  reporte: ReporteIndividualApi | null;
  loading: boolean;
  nineBox: NineBoxApi | null;
}

const SEG_COLOR: Record<string, string> = {
  sobresaliente: "bg-emerald-50 text-emerald-800 border-emerald-200",
  estable: "bg-blue-50 text-blue-800 border-blue-200",
  desarrollo: "bg-amber-50 text-amber-800 border-amber-200",
  riesgo: "bg-red-50 text-red-800 border-red-200",
};

export function renderNineBox(box: NineBoxApi): string {
  type Band = "bajo" | "medio" | "alto";
  const filas: Band[] = ["alto", "medio", "bajo"]; // desempeño (Y)
  const cols: Band[] = ["bajo", "medio", "alto"]; // potencial (X)
  const cellBg: Record<string, string> = {
    "alto-alto": "bg-emerald-50", "alto-medio": "bg-emerald-50/60", "medio-alto": "bg-emerald-50/60",
    "bajo-bajo": "bg-red-50", "bajo-medio": "bg-amber-50/50", "medio-bajo": "bg-amber-50/50",
  };
  const lookup = new Map<string, { clasificacion: string; empleados: string[] }>();
  for (const c of box.celdas) lookup.set(`${c.desempeno}-${c.potencial}`, c);

  const grid = filas
    .map((d) => {
      const cells = cols
        .map((p) => {
          const key = `${d}-${p}`;
          const cell = lookup.get(key);
          const bg = cellBg[key] ?? "bg-white";
          const nombres = cell?.empleados ?? [];
          return `<div class="min-h-[92px] rounded-lg border border-slate-200 ${bg} p-2">
            <p class="text-[10px] font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(cell?.clasificacion ?? "")}</p>
            <div class="mt-1 flex flex-wrap gap-1">${nombres.slice(0, 6).map((n) => `<span class="rounded bg-white/80 px-1.5 py-0.5 text-[11px] text-text-primary shadow-sm">${escapeHtml(n)}</span>`).join("")}${nombres.length > 6 ? `<span class="text-[11px] text-text-muted">+${nombres.length - 6}</span>` : ""}</div>
          </div>`;
        })
        .join("");
      return `<div class="grid grid-cols-3 gap-2">${cells}</div>`;
    })
    .join('<div class="h-2"></div>');

  const segs = box.segmentos
    .map(
      (s) => `<div class="rounded-lg border px-3 py-2 text-center ${SEG_COLOR[s.segmento] ?? "bg-slate-50 border-slate-200"}">
      <p class="text-lg font-bold tabular-nums">${s.cantidad}</p>
      <p class="text-[11px] font-medium">${escapeHtml(s.label)}</p>
    </div>`,
    )
    .join("");

  return renderSurfaceCard(
    "Matriz 9-Box y detección de talento",
    "Desempeño (vertical) × Potencial (horizontal). El potencial se ajusta por participante.",
    `<div class="grid gap-2 text-[11px] text-text-muted"><div class="grid grid-cols-3 gap-2 text-center"><span>Potencial bajo</span><span>Potencial medio</span><span>Potencial alto</span></div></div>
     <div class="mt-1">${grid}</div>
     <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">${segs}</div>`,
  );
}

function externoDeCompetencia(promedioPorTipo: Record<string, number> | null): number {
  if (!promedioPorTipo) return 0;
  const vals = Object.entries(promedioPorTipo)
    .filter(([t]) => t !== "autoevaluacion")
    .map(([, v]) => v);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

export function mapReporteToChartComps(rep: ReporteIndividualApi): CompetenciaPuntuacion[] {
  return rep.competencias.map((c) => ({
    nombre: c.competencia_nombre ?? "—",
    autoevaluacion: c.autoevaluacion ?? 0,
    evaluadores: externoDeCompetencia(c.promedio_por_tipo) || (c.promedio_general ?? 0),
    requerida: c.nivel_esperado ?? undefined,
  }));
}

function brechaBadge(estado: string | null): string {
  const map: Record<string, string> = {
    cumple: "border-emerald-200 bg-emerald-50 text-emerald-800",
    riesgo: "border-amber-200 bg-amber-50 text-amber-800",
    brecha: "border-red-200 bg-red-50 text-red-800",
  };
  const labels: Record<string, string> = { cumple: "Cumple", riesgo: "Riesgo", brecha: "Brecha" };
  if (!estado) return "—";
  return `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${map[estado] ?? ""}">${labels[estado] ?? estado}</span>`;
}

function fmt(n: number | null | undefined): string {
  return n == null ? "—" : Number(n).toFixed(1);
}

function renderToolbar(props: ResultadosProps): string {
  const campanas = (props.campanas ?? []).filter((c) =>
    ["activa", "en_progreso", "finalizada", "cerrada"].includes(c.estado),
  );
  const campOpts = [`<option value="">Selecciona campaña…</option>`]
    .concat(
      campanas.map(
        (c) => `<option value="${c.id}" ${props.campanaId === c.id ? "selected" : ""}>${escapeHtml(c.nombre)}</option>`,
      ),
    )
    .join("");
  const partOpts =
    props.participantes === null
      ? '<option value="">—</option>'
      : [`<option value="">Selecciona colaborador…</option>`]
          .concat(
            props.participantes.map(
              (p) => `<option value="${p.id}" ${props.participanteId === p.id ? "selected" : ""}>${escapeHtml(p.empleado_nombre ?? `#${p.empleado_id}`)}</option>`,
            ),
          )
          .join("");
  const exportBtns = props.reporte
    ? `<div class="flex gap-2">
        <button type="button" class="${BTN_SECONDARY}" data-action="e360-export-pdf">Exportar PDF</button>
        <button type="button" class="${BTN_SECONDARY}" data-action="e360-export-excel">Exportar Excel</button>
      </div>`
    : "";
  return `
    <div class="flex flex-col gap-3 rounded-xl border border-border bg-white p-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="grid flex-1 gap-3 sm:grid-cols-2">
        <div>
          <label class="mb-1 block text-xs font-medium text-text-muted">Campaña</label>
          <select data-select="e360-res-campana" class="${FIELD_INPUT}">${campOpts}</select>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-text-muted">Colaborador</label>
          <select data-select="e360-res-participante" class="${FIELD_INPUT}" ${props.participantes === null ? "disabled" : ""}>${partOpts}</select>
        </div>
      </div>
      ${exportBtns}
    </div>`;
}

export function renderResultadosReal(props: ResultadosProps): string {
  const toolbar = renderToolbar(props);

  const nineBoxCard = props.nineBox ? `<div class="mt-5">${renderNineBox(props.nineBox)}</div>` : "";

  if (props.loading) {
    return `${toolbar}${nineBoxCard}<div class="mt-5 h-64 animate-pulse rounded-xl bg-slate-100"></div>`;
  }
  if (!props.reporte) {
    return `${toolbar}${nineBoxCard}
      <div class="mt-5 rounded-xl border border-border bg-white px-5 py-16 text-center text-sm text-text-muted">
        Selecciona un colaborador para ver su reporte individual, o revisa la matriz 9-Box de la campaña.
      </div>`;
  }

  const rep = props.reporte;
  const charts = renderEval360ChartIds();
  const iniciales = (rep.empleado_nombre ?? "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const brechas = rep.competencias
    .map(
      (c) => `
    <tr class="border-b border-slate-100">
      <td class="px-4 py-3 text-sm font-medium text-text-primary">${escapeHtml(c.competencia_nombre ?? "—")}</td>
      <td class="px-4 py-3 text-center text-sm tabular-nums text-slate-600">${fmt(c.nivel_esperado)}</td>
      <td class="px-4 py-3 text-center text-sm tabular-nums text-slate-600">${fmt(c.promedio_general)}</td>
      <td class="px-4 py-3 text-center text-sm tabular-nums ${(c.brecha ?? 0) < 0 ? "text-red-600" : "text-emerald-600"}">${fmt(c.brecha)}</td>
      <td class="px-4 py-3 text-center">${brechaBadge(c.estado_brecha)}</td>
    </tr>`,
    )
    .join("");

  const listaSimple = (items: string[], color: string) =>
    items.length
      ? `<ul class="space-y-2">${items.map((t) => `<li class="text-sm text-slate-700 before:mr-2 before:content-['•'] before:${color}">${escapeHtml(t)}</li>`).join("")}</ul>`
      : '<p class="text-sm text-text-muted">Sin datos.</p>';

  const comentarios = rep.comentarios.length
    ? `<div class="space-y-2">${rep.comentarios
        .map(
          (com) => `
        <div class="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(com.competencia_nombre ?? "General")} · ${escapeHtml(TIPO_LABELS[com.tipo_evaluador ?? ""] ?? com.tipo_evaluador ?? "s/d")}</p>
          <p class="mt-1 text-sm text-slate-700">${escapeHtml(com.texto)}</p>
        </div>`,
        )
        .join("")}</div>`
    : '<p class="text-sm text-text-muted">Sin comentarios.</p>';

  const evolucion = rep.evolucion.length
    ? `<div class="overflow-x-auto"><table class="min-w-full text-left"><thead><tr class="text-xs font-semibold uppercase tracking-wide text-text-muted"><th class="px-3 py-2">Campaña</th><th class="px-3 py-2">Fecha</th><th class="px-3 py-2 text-right">Calificación</th></tr></thead><tbody>${rep.evolucion
        .map(
          (e) => `<tr class="border-b border-slate-100"><td class="px-3 py-2 text-sm text-text-primary">${escapeHtml(e.campana_nombre)}</td><td class="px-3 py-2 text-sm text-slate-600">${e.fecha ? escapeHtml(e.fecha) : "—"}</td><td class="px-3 py-2 text-right text-sm font-semibold tabular-nums text-accent">${fmt(e.calificacion_general)}</td></tr>`,
        )
        .join("")}</tbody></table></div>`
    : '<p class="text-sm text-text-muted">Sin historial previo.</p>';

  return `
    ${toolbar}
    ${nineBoxCard}
    <div class="mt-5 rounded-xl border border-border bg-white p-5">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div class="flex size-16 shrink-0 items-center justify-center rounded-full bg-accent-light text-lg font-bold text-accent" aria-hidden="true">${escapeHtml(iniciales)}</div>
        <div class="flex-1">
          <h2 class="text-lg font-semibold text-text-primary">${escapeHtml(rep.empleado_nombre ?? "—")}</h2>
          <p class="text-sm text-text-muted">${escapeHtml(rep.puesto ?? "—")}${rep.area ? " · " + escapeHtml(rep.area) : ""} · ${escapeHtml(rep.campana_nombre ?? "")}</p>
        </div>
        <div class="flex gap-6 text-center">
          <div><p class="text-2xl font-bold tabular-nums text-accent">${fmt(rep.calificacion_general)}</p><p class="text-xs text-text-muted">General</p></div>
          <div><p class="text-lg font-semibold text-blue-700">${fmt(rep.promedio_autoevaluacion)}</p><p class="text-xs text-text-muted">Auto</p></div>
          <div><p class="text-lg font-semibold text-emerald-700">${fmt(rep.promedio_externo)}</p><p class="text-xs text-text-muted">Externo</p></div>
        </div>
      </div>
    </div>

    <div class="mt-5 grid gap-5 lg:grid-cols-2">
      ${renderSurfaceCard("Radar de competencias", "Autoevaluación vs. promedio evaluadores", charts.radar)}
      ${renderSurfaceCard("Comparativo", "Autoevaluación vs. evaluadores", charts.barComparativo)}
    </div>

    <div class="mt-5 grid gap-5 lg:grid-cols-2">
      ${renderSurfaceCard("Fortalezas", "Mejores competencias", listaSimple(rep.fortalezas, "text-emerald-500"))}
      ${renderSurfaceCard("Áreas de oportunidad", "Competencias por debajo del nivel esperado", listaSimple(rep.oportunidades, "text-amber-500"))}
    </div>

    <div class="mt-5">
      ${renderSurfaceCard(
        "Brechas por competencia",
        "Nivel esperado vs. resultado obtenido",
        `<div class="overflow-x-auto -mx-5 px-5"><table class="min-w-full text-left"><thead><tr class="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-text-muted"><th class="px-4 py-2">Competencia</th><th class="px-4 py-2 text-center">Esperado</th><th class="px-4 py-2 text-center">Obtenido</th><th class="px-4 py-2 text-center">Brecha</th><th class="px-4 py-2 text-center">Estado</th></tr></thead><tbody>${brechas}</tbody></table></div>`,
      )}
    </div>

    <div class="mt-5 grid gap-5 lg:grid-cols-2">
      ${renderSurfaceCard("Comentarios", "Retroalimentación por tipo de evaluador", comentarios)}
      ${renderSurfaceCard("Evolución histórica", "Calificación general en campañas previas", evolucion)}
    </div>

    <p class="mt-5 text-xs text-text-muted">
      Integración: <a href="#/puestos" class="font-medium text-accent hover:underline">Perfiles de puesto</a> ·
      <a href="#/competencias" class="font-medium text-accent hover:underline">Competencias</a> ·
      <a href="#/cursos" class="font-medium text-accent hover:underline">Cursos</a>
    </p>`;
}
