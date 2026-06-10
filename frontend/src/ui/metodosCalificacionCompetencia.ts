import { getMetodosCalificacionCompetencia } from "../api/metodosCalificacionCompetencia.ts";
import type {
  MetodoCalificacionCompetencia,
  MetodoCalificacionCompetenciaResumen,
} from "../dashboard/metodosCalificacionCompetencia/types.ts";

const DEFAULT_METODOS: MetodoCalificacionCompetencia[] = [
  { id: 0, valor: 1, nombre: "Planeado", orden: 1, activo: true, created_at: "", updated_at: "" },
  {
    id: 0,
    valor: 2,
    nombre: "En entrenamiento",
    orden: 2,
    activo: true,
    created_at: "",
    updated_at: "",
  },
  { id: 0, valor: 3, nombre: "Certificado", orden: 3, activo: true, created_at: "", updated_at: "" },
  { id: 0, valor: 4, nombre: "Experito", orden: 4, activo: true, created_at: "", updated_at: "" },
];

let cache: MetodoCalificacionCompetencia[] | null = null;
let loadPromise: Promise<MetodoCalificacionCompetencia[]> | null = null;

function sortMetodos(items: MetodoCalificacionCompetencia[]): MetodoCalificacionCompetencia[] {
  return [...items].filter((m) => m.activo).sort((a, b) => a.orden - b.orden);
}

export function getMetodosCalificacionCompetenciaSync(): MetodoCalificacionCompetencia[] {
  return sortMetodos(cache ?? DEFAULT_METODOS);
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

export async function ensureMetodosCalificacionCompetenciaLoaded(): Promise<
  MetodoCalificacionCompetencia[]
> {
  if (cache) return getMetodosCalificacionCompetenciaSync();
  if (!loadPromise) {
    loadPromise = getMetodosCalificacionCompetencia()
      .then((items) => {
        cache = items;
        return getMetodosCalificacionCompetenciaSync();
      })
      .catch(() => DEFAULT_METODOS)
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

export function nivelMetodoSelectTone(valor: number): string {
  if (valor === 0) return "border-dashed border-slate-200 bg-slate-50 text-slate-600";
  if (valor === 1) return "border-red-200 bg-red-50 text-red-900";
  if (valor === 2) return "border-orange-200 bg-orange-50 text-orange-900";
  if (valor === 3) return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

export function nivelMetodoLegendTone(valor: number): string {
  if (valor === 1) return "bg-red-100 ring-1 ring-red-200/80";
  if (valor === 2) return "bg-orange-100 ring-1 ring-orange-200/80";
  if (valor === 3) return "bg-amber-100 ring-1 ring-amber-200/80";
  if (valor >= 4) return "bg-emerald-100 ring-1 ring-emerald-200/80";
  return "bg-slate-50 ring-1 ring-dashed ring-slate-300";
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
