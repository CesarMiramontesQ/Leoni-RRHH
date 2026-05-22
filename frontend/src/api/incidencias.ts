import { fetchWithAuth } from "./http.ts";
import type {
  RhIncidenciaEstadoCodigo,
  RhIncidenciaListFilters,
  RhIncidenciaPrioridadCodigo,
  RhIncidenciaTablaFila,
  RhIncidenciaTipoCodigo,
  RhIncidenciasEstadisticasData,
} from "../incidencias/rh/types.ts";
import { emptyRhIncidenciaListFilters } from "../incidencias/rh/types.ts";

export type IncidenciasKpiApi = {
  abiertas: number;
  en_investigacion: number;
  resueltas: number;
  criticas: number;
};

export type IncidenciaApiItem = {
  id: number;
  empleado_id: number;
  tipo: string;
  no_empleado?: string | null;
  nombre?: string | null;
  fecha?: string | null;
  categoria?: string | null;
  detalle?: string | null;
  area?: string | null;
  subarea?: string | null;
  origen?: string | null;
  origen_id?: number | null;
  synced_at?: string | null;
  puesto?: string | null;
  supervisor_directo?: string | null;
  created_at: string;
  updated_at: string;
  evidencias_count?: number;
};

export type IncidenciasListPageApi = {
  items: IncidenciaApiItem[];
  total: number;
  page: number;
  page_size: number;
  resumen: IncidenciasKpiApi;
};

export type IncidenciasFetchError = {
  status: number;
  detail: string;
};

async function readErrorDetail(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const parsed = JSON.parse(raw) as { detail?: unknown };
    if (typeof parsed.detail === "string" && parsed.detail.trim()) return parsed.detail.trim();
  } catch {
    /* noop */
  }
  return raw || res.statusText || "Error";
}

export type IncidenciasCatalogItemsApi = {
  items: string[];
};

export async function fetchIncidenciasTiposRegistrados(): Promise<string[]> {
  const res = await fetchWithAuth("/api/v1/incidencias/tipos");
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as IncidenciasFetchError;
  }
  const data = (await res.json()) as IncidenciasCatalogItemsApi;
  return Array.isArray(data.items) ? data.items : [];
}

export async function fetchIncidenciasAreasRegistradas(): Promise<string[]> {
  const res = await fetchWithAuth("/api/v1/incidencias/areas");
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as IncidenciasFetchError;
  }
  const data = (await res.json()) as IncidenciasCatalogItemsApi;
  return Array.isArray(data.items) ? data.items : [];
}

export async function fetchIncidenciasSubareasRegistradas(area?: string): Promise<string[]> {
  const p = new URLSearchParams();
  const ar = area?.trim();
  if (ar) p.set("area", ar);
  const qs = p.toString();
  const res = await fetchWithAuth(`/api/v1/incidencias/subareas${qs ? `?${qs}` : ""}`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as IncidenciasFetchError;
  }
  const data = (await res.json()) as IncidenciasCatalogItemsApi;
  return Array.isArray(data.items) ? data.items : [];
}

function parseOptionalInt(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseOptionalDate(s: string): string | undefined {
  const t = s.trim();
  if (!t) return undefined;
  return t;
}

/** Query string de filtros (sin paginación), compartido por listado y estadísticas. */
export function appendIncidenciasFilterParams(p: URLSearchParams, filters: RhIncidenciaListFilters): void {
  const tipo = filters.tipo.trim();
  if (tipo) p.set("tipo", tipo);
  const eid = parseOptionalInt(filters.empleado_id);
  if (eid !== undefined) p.set("empleado_id", String(eid));
  const noEmp = filters.no_empleado.trim();
  if (noEmp) p.set("no_empleado", noEmp);
  const nom = filters.nombre.trim();
  if (nom) p.set("nombre", nom);
  const fecha = parseOptionalDate(filters.fecha);
  if (fecha) p.set("fecha", fecha);
  const cat = filters.categoria.trim();
  if (cat) p.set("categoria", cat);
  const ar = filters.area.trim();
  if (ar) p.set("area", ar);
  const sub = filters.subarea.trim();
  if (sub) p.set("subarea", sub);
  const fi = parseOptionalDate(filters.fecha_inicio);
  if (fi) p.set("fecha_inicio", fi);
  const ff = parseOptionalDate(filters.fecha_fin);
  if (ff) p.set("fecha_fin", ff);
}

/** Serializa filtros aplicados y paginación a query string (omitir vacíos). */
export function buildIncidenciasListQuery(
  filters: RhIncidenciaListFilters,
  page: number,
  pageSize: number,
): string {
  const p = new URLSearchParams();
  p.set("page", String(Math.max(1, page)));
  p.set("page_size", String(Math.min(10, Math.max(1, pageSize))));
  appendIncidenciasFilterParams(p, filters);
  return p.toString();
}

export function buildIncidenciasEstadisticasQuery(
  filters: RhIncidenciaListFilters,
  opts?: { tendencia_agrupacion?: "dia" | "semana" | "mes" },
): string {
  const p = new URLSearchParams();
  appendIncidenciasFilterParams(p, filters);
  if (opts?.tendencia_agrupacion) {
    p.set("tendencia_agrupacion", opts.tendencia_agrupacion);
  }
  return p.toString();
}

function inferTipoCodigo(tipo: string): RhIncidenciaTipoCodigo {
  const t = tipo.toLowerCase();
  if (t.includes("seguridad")) return "indisciplina";
  if (t.includes("calidad")) return "indisciplina";
  if (t.includes("retardo")) return "retardo";
  if (t.includes("daño") || t.includes("dano") || t.includes("equipo")) return "dano_equipo";
  if (t.includes("indisciplina") || t.includes("disciplina")) return "indisciplina";
  if (t.includes("falta") || t.includes("ausencia")) return "falta_injustificada";
  return "indisciplina";
}

/** Texto de API/JSON a string recortada; vacío si nulo o sin contenido. */
function strCampoIncidencia(v: string | null | undefined): string {
  if (v == null) return "";
  const t = String(v).trim();
  return t;
}

export function incidenciaApiItemToTablaFila(item: IncidenciaApiItem): RhIncidenciaTablaFila {
  const fechaNegocio = item.fecha?.trim();
  const fechaDisplay =
    fechaNegocio && fechaNegocio.length >= 10 ? fechaNegocio.slice(0, 10) : "";
  const nombre = item.nombre?.trim();
  const supervisorDirecto = item.supervisor_directo?.trim();
  const puestoApi = item.puesto?.trim();
  return {
    id: item.id,
    empleado_id: String(item.empleado_id),
    empleado_nombre_raw: nombre && nombre.length > 0 ? nombre : `Empleado #${item.empleado_id}`,
    foto_url: null,
    numero_folio: `INC-${item.id}`,
    area: strCampoIncidencia(item.area),
    supervisor_id: "",
    supervisor_nombre: supervisorDirecto || "—",
    tipo: inferTipoCodigo(item.tipo),
    tipo_texto: item.tipo,
    fecha: fechaDisplay,
    estado: "abierto",
    prioridad: "baja",
    descripcion: item.detalle?.trim() || undefined,
    no_empleado: item.no_empleado,
    categoria: item.categoria,
    detalle: item.detalle,
    subarea: strCampoIncidencia(item.subarea) || null,
    origen: item.origen ?? null,
    origen_id: item.origen_id ?? null,
    synced_at: item.synced_at ?? null,
    created_at: item.created_at,
    updated_at: item.updated_at,
    supervisor_directo: item.supervisor_directo ?? null,
    puesto: item.puesto ?? null,
    puesto_empleado: puestoApi,
  };
}

export async function fetchIncidenciasEstadisticas(
  filters: RhIncidenciaListFilters,
  opts?: { tendencia_agrupacion?: "dia" | "semana" | "mes" },
): Promise<RhIncidenciasEstadisticasData> {
  const qs = buildIncidenciasEstadisticasQuery(filters, opts);
  const suffix = qs.length > 0 ? `?${qs}` : "";
  const res = await fetchWithAuth(`/api/v1/incidencias/estadisticas${suffix}`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as IncidenciasFetchError;
  }
  const raw = (await res.json()) as Partial<RhIncidenciasEstadisticasData>;
  const sumTipos = (raw.incidencias_por_tipo ?? []).reduce((s, x) => s + x.total, 0);
  const totalFallback =
    typeof raw.total_incidencias === "number" && raw.total_incidencias >= 0
      ? raw.total_incidencias
      : sumTipos;
  return {
    total_incidencias: totalFallback,
    incidencias_seguridad: raw.incidencias_seguridad ?? 0,
    incidencias_calidad: raw.incidencias_calidad ?? 0,
    areas_con_mas_incidencias: raw.areas_con_mas_incidencias ?? [],
    subareas_con_mas_incidencias: raw.subareas_con_mas_incidencias ?? [],
    empleados_con_mas_incidencias: raw.empleados_con_mas_incidencias ?? [],
    incidencias_por_tipo: raw.incidencias_por_tipo ?? [],
    incidencias_por_mes: raw.incidencias_por_mes ?? [],
    incidencias_por_mes_y_tipo: raw.incidencias_por_mes_y_tipo ?? [],
    tendencia_agrupacion:
      raw.tendencia_agrupacion === "dia" ||
      raw.tendencia_agrupacion === "semana" ||
      raw.tendencia_agrupacion === "mes"
        ? raw.tendencia_agrupacion
        : null,
    incidencias_por_periodo_y_tipo: raw.incidencias_por_periodo_y_tipo ?? [],
    total_periodo_anterior:
      typeof raw.total_periodo_anterior === "number" ? raw.total_periodo_anterior : null,
    variacion_total_pct:
      typeof raw.variacion_total_pct === "number" && Number.isFinite(raw.variacion_total_pct)
        ? raw.variacion_total_pct
        : null,
  };
}

export async function fetchIncidenciasListPage(
  filters: RhIncidenciaListFilters,
  page: number,
  pageSize = 10,
): Promise<IncidenciasListPageApi> {
  const qs = buildIncidenciasListQuery(filters, page, pageSize);
  const res = await fetchWithAuth(`/api/v1/incidencias?${qs}`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as IncidenciasFetchError;
  }
  return (await res.json()) as IncidenciasListPageApi;
}

/** Todas las filas del listado con los filtros indicados (pagina en bloques de 10). */
export async function fetchAllIncidenciasForExport(
  filters: RhIncidenciaListFilters,
): Promise<RhIncidenciaTablaFila[]> {
  const out: RhIncidenciaTablaFila[] = [];
  let page = 1;
  const pageSize = 10;
  while (true) {
    const data = await fetchIncidenciasListPage(filters, page, pageSize);
    for (const it of data.items) {
      out.push(incidenciaApiItemToTablaFila(it));
    }
    if (data.items.length === 0 || page * pageSize >= data.total) break;
    page += 1;
  }
  return out;
}

/**
 * Acumula filas de incidencias para consumidores legacy (p. ej. dashboard líder).
 * Pagina internamente en bloques de 10 hasta cubrir `limit` o agotar resultados.
 */
export async function getIncidenciasRows(limit = 100): Promise<RhIncidenciaTablaFila[]> {
  const filters = emptyRhIncidenciaListFilters();
  const out: RhIncidenciaTablaFila[] = [];
  let page = 1;
  const pageSize = 10;
  const maxPages = Math.ceil(limit / pageSize) + 2;
  while (out.length < limit && page <= maxPages) {
    const data = await fetchIncidenciasListPage(filters, page, pageSize);
    for (const it of data.items) {
      out.push(incidenciaApiItemToTablaFila(it));
      if (out.length >= limit) break;
    }
    if (data.items.length === 0 || page * pageSize >= data.total) break;
    page += 1;
  }
  return out.slice(0, limit);
}
