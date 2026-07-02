import { escapeHtml } from "../../ui/uiUtils.ts";
import { renderSurfaceCard, tipoEvaluadorLabel } from "../shared.ts";
import type { TipoEvaluador } from "../types.ts";
import type {
  CompetenciaCatalogoApi,
  ConfigApi,
  EscalaApi,
} from "../../api/evaluacion360.ts";

export interface ConfiguracionViewData {
  catalogo: CompetenciaCatalogoApi[] | null;
  escalas: EscalaApi[] | null;
  config: ConfigApi | null;
}

const CATEGORIA_LABEL: Record<string, string> = {
  tecnica: "Técnica",
  blanda: "Blanda",
};

function renderSkeleton(): string {
  const line = `<div class="h-4 w-full animate-pulse rounded bg-slate-100"></div>`;
  const card = `
    <article class="rounded-xl border border-border bg-white p-5">
      <div class="mb-4 h-4 w-48 animate-pulse rounded bg-slate-100"></div>
      <div class="space-y-2">${line.repeat(3)}</div>
    </article>`;
  return `<div class="space-y-5">${card.repeat(3)}</div>`;
}

function renderCatalogo(catalogo: CompetenciaCatalogoApi[]): string {
  const rows = catalogo
    .map(
      (c) => `
      <tr class="border-b border-slate-100 hover:bg-slate-50/50">
        <td class="px-4 py-3 text-sm font-medium text-text-primary">${escapeHtml(c.nombre)}</td>
        <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(c.categoria ? (CATEGORIA_LABEL[c.categoria] ?? c.categoria) : "—")}</td>
        <td class="px-4 py-3 text-sm tabular-nums text-slate-600">${c.num_preguntas > 0 ? `${c.num_preguntas} preg.` : `<span class="text-amber-600">⚠ sin preguntas</span>`}</td>
      </tr>`,
    )
    .join("");

  const body = `<div class="overflow-x-auto -mx-5 px-5">
      <table class="min-w-full text-left">
        <thead>
          <tr class="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-text-muted">
            <th class="px-4 py-2">Nombre</th>
            <th class="px-4 py-2">Categoría</th>
            <th class="px-4 py-2">Preguntas (banco 360)</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="3" class="px-4 py-8 text-center text-sm text-text-muted">No hay competencias en el catálogo.</td></tr>`}</tbody>
      </table>
    </div>
    <p class="mt-3 text-xs text-text-muted">
      Vinculado al catálogo de <a href="#/competencias" class="font-medium text-accent hover:underline">Competencias</a>. Registra preguntas por competencia en el banco 360°.
    </p>`;
  return renderSurfaceCard("Catálogo de competencias", "Competencias disponibles para campañas 360°", body);
}

function renderEscala(escalas: EscalaApi[], config: ConfigApi | null): string {
  const escala = escalas.find((e) => e.id === config?.escala_id) ?? escalas[0] ?? null;
  if (!escala) {
    return renderSurfaceCard(
      "Escala de evaluación",
      "Escala de la evaluación 360°",
      `<p class="text-sm text-text-muted">No hay escalas configuradas.</p>`,
    );
  }
  const niveles: string[] = [];
  for (let v = escala.valor_min; v <= escala.valor_max; v++) {
    const etiqueta = escala.etiquetas?.[String(v)] ?? `Nivel ${v}`;
    niveles.push(`
      <div class="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3">
        <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-light text-sm font-bold text-accent">${v}</span>
        <span class="text-sm font-medium text-text-primary">${escapeHtml(etiqueta)}</span>
      </div>`);
  }
  return renderSurfaceCard(
    "Escala de evaluación",
    `${escapeHtml(escala.nombre)} · ${escala.valor_min} a ${escala.valor_max}`,
    `<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">${niveles.join("")}</div>`,
  );
}

function renderTiposEvaluador(config: ConfigApi): string {
  const pesos = config.pesos_evaluadores ?? {};
  const entradas = Object.entries(pesos);
  const rows = entradas
    .map(
      ([tipo, peso]) => `
      <tr class="border-b border-slate-100">
        <td class="px-4 py-3 text-sm font-medium text-text-primary">${escapeHtml(tipoEvaluadorLabel(tipo as TipoEvaluador) ?? tipo)}</td>
        <td class="px-4 py-3 text-sm tabular-nums text-slate-600">${peso}%</td>
      </tr>`,
    )
    .join("");
  const total = entradas.reduce((s, [, p]) => s + Number(p), 0);
  const body = `<div class="overflow-x-auto -mx-5 px-5">
      <table class="min-w-full max-w-md text-left">
        <thead>
          <tr class="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-text-muted">
            <th class="px-4 py-2">Tipo</th>
            <th class="px-4 py-2">Ponderación</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="2" class="px-4 py-8 text-center text-sm text-text-muted">Sin ponderaciones por defecto configuradas.</td></tr>`}</tbody>
      </table>
    </div>
    <p class="mt-3 text-xs text-slate-500">Total: ${total}% · Nivel mínimo esperado: ${config.nivel_minimo_esperado}</p>`;
  return renderSurfaceCard("Tipos de evaluador", "Ponderaciones por defecto (deben sumar 100%)", body);
}

export function renderEval360Configuracion(data: ConfiguracionViewData): string {
  if (data.catalogo === null || data.escalas === null) {
    return renderSkeleton();
  }
  return `
    <div class="space-y-5">
      ${renderCatalogo(data.catalogo)}
      ${renderEscala(data.escalas, data.config)}
      ${data.config ? renderTiposEvaluador(data.config) : ""}
    </div>`;
}
