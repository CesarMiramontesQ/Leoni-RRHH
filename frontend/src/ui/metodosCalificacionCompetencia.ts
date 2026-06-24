import { getMetodosCalificacionCompetencia } from "../api/metodosCalificacionCompetencia.ts";
import type {
  MetodoCalificacionCompetencia,
  MetodoCalificacionCompetenciaResumen,
} from "../dashboard/metodosCalificacionCompetencia/types.ts";

let cache: MetodoCalificacionCompetencia[] | null = null;
let loadPromise: Promise<MetodoCalificacionCompetencia[]> | null = null;

function sortMetodos(items: MetodoCalificacionCompetencia[]): MetodoCalificacionCompetencia[] {
  return [...items].filter((m) => m.activo).sort((a, b) => a.orden - b.orden);
}

function resolvedMetodos(): MetodoCalificacionCompetencia[] {
  return cache ?? [];
}

export function getMetodosCalificacionCompetenciaSync(): MetodoCalificacionCompetencia[] {
  return sortMetodos(resolvedMetodos());
}

export function setMetodosCalificacionCompetenciaCache(
  items: MetodoCalificacionCompetencia[] | MetodoCalificacionCompetenciaResumen[],
): void {
  cache = items.map((m, idx) => ({
    id: "id" in m ? m.id : idx + 1,
    valor: m.valor,
    nombre: m.nombre,
    orden: m.orden,
    activo: true,
    created_at: "",
    updated_at: "",
  }));
}

export async function ensureMetodosCalificacionCompetenciaLoaded(
  force = false,
): Promise<MetodoCalificacionCompetencia[]> {
  if (!force && cache !== null) return getMetodosCalificacionCompetenciaSync();
  if (force) {
    cache = null;
    loadPromise = null;
  }
  if (!loadPromise) {
    loadPromise = getMetodosCalificacionCompetencia()
      .then((items) => {
        cache = items;
        return getMetodosCalificacionCompetenciaSync();
      })
      .catch(() => {
        cache = null;
        return [] as MetodoCalificacionCompetencia[];
      })
      .finally(() => {
        loadPromise = null;
      });
  }
  return loadPromise;
}

export function invalidateMetodosCalificacionCompetenciaCache(): void {
  cache = null;
}

export function buildNivelMetodoOptions(includeNa = true): { value: number; label: string }[] {
  const metodos = getMetodosCalificacionCompetenciaSync();
  const opts = metodos.map((m) => ({
    value: m.valor,
    label: `${m.valor} — ${m.nombre}`,
  }));
  return includeNa ? [{ value: 0, label: "0 — N/A" }, ...opts] : opts;
}

export function nivelMetodoLabel(valor: number, includePrefix = true): string {
  if (valor <= 0) return includePrefix ? "0 — N/A" : "N/A";
  const metodo = getMetodosCalificacionCompetenciaSync().find((m) => m.valor === valor);
  if (!metodo) return includePrefix ? `Nivel ${valor}` : String(valor);
  return includePrefix ? `${metodo.valor} — ${metodo.nombre}` : metodo.nombre;
}

const TONE_PALETTE = [
  "border-red-200 bg-red-50 text-red-900",
  "border-orange-200 bg-orange-50 text-orange-900",
  "border-amber-200 bg-amber-50 text-amber-900",
  "border-emerald-200 bg-emerald-50 text-emerald-900",
  "border-blue-200 bg-blue-50 text-blue-900",
  "border-violet-200 bg-violet-50 text-violet-900",
];

const LEGEND_PALETTE = [
  "bg-red-100 ring-1 ring-red-200/80",
  "bg-orange-100 ring-1 ring-orange-200/80",
  "bg-amber-100 ring-1 ring-amber-200/80",
  "bg-emerald-100 ring-1 ring-emerald-200/80",
  "bg-blue-100 ring-1 ring-blue-200/80",
  "bg-violet-100 ring-1 ring-violet-200/80",
];

export function nivelMetodoSelectTone(valor: number): string {
  if (valor === 0) return "border-dashed border-slate-200 bg-slate-50 text-slate-600";
  const metodos = getMetodosCalificacionCompetenciaSync();
  const idx = metodos.findIndex((m) => m.valor === valor);
  return TONE_PALETTE[idx >= 0 ? idx % TONE_PALETTE.length : TONE_PALETTE.length - 1];
}

export function nivelMetodoLegendTone(valor: number): string {
  if (valor <= 0) return "bg-slate-50 ring-1 ring-dashed ring-slate-300";
  const metodos = getMetodosCalificacionCompetenciaSync();
  const idx = metodos.findIndex((m) => m.valor === valor);
  return LEGEND_PALETTE[idx >= 0 ? idx % LEGEND_PALETTE.length : LEGEND_PALETTE.length - 1];
}

export function maxNivelActivoValor(): number {
  const metodos = getMetodosCalificacionCompetenciaSync();
  return metodos.length > 0 ? Math.max(...metodos.map((m) => m.valor)) : 0;
}

export function renderNivelMetodoSelectHtml(
  selected: number,
  attrs: string,
  includePlaceholder = false,
): string {
  const opts = (includePlaceholder
    ? [{ value: 0, label: "— Seleccionar nivel —" }]
    : []
  )
    .concat(buildNivelMetodoOptions(false))
    .map(
      (o) =>
        `<option value="${o.value}" ${o.value === selected ? "selected" : ""}>${o.label}</option>`,
    )
    .join("");
  return `<select ${attrs}>${opts}</select>`;
}

export function buildNivelMetodoLabelsMap(includeNa = true): Record<number, string> {
  const map: Record<number, string> = {};
  if (includeNa) map[0] = "N/A";
  for (const m of getMetodosCalificacionCompetenciaSync()) {
    map[m.valor] = m.nombre;
  }
  return map;
}
