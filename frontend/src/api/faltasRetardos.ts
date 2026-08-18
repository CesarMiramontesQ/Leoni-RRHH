import { fetchWithAuth } from "./http.ts";

export type FaltaRetardoTipo =
  | "falta_justificada"
  | "falta_injustificada"
  | "retardo"
  | "incapacidad"
  | "suspension"
  | "matrimonio"
  | "incapacidad_interna"
  | "defuncion"
  | "paternidad"
  | "vacaciones";

export type FaltaRetardoListItem = {
  id: number;
  empleado_id: number;
  empleado_nombre: string | null;
  numero_empleado: string | null;
  tipo: FaltaRetardoTipo;
  fecha_evento: string;
  fecha_fin: string | null;
  observaciones: string | null;
  registrado_por_id: number | null;
  registrado_por_nombre: string | null;
  created_at: string;
  origen?: string | null;
  origen_id?: number | null;
};

export type FaltasRetardosPageResponse = {
  items: FaltaRetardoListItem[];
  total: number;
  page: number;
  page_size: number;
};

export type FaltaRetardoCreatePayload = {
  empleado_id: number;
  tipo: FaltaRetardoTipo;
  fecha_evento: string;
  fecha_fin?: string | null;
  observaciones?: string | null;
};

export type FaltasRetardosListParams = {
  page: number;
  page_size: number;
  empleado_id?: number;
  tipo?: FaltaRetardoTipo | "";
  fecha_inicio?: string;
  fecha_fin?: string;
  busqueda?: string;
};

export type FaltasRetardosEstadisticasParams = {
  empleado_id?: number;
  tipo?: FaltaRetardoTipo | "";
  /** Subconjunto de tipos; acota también el ranking, que se calcula en el servidor. */
  tipos?: readonly FaltaRetardoTipo[];
  fecha_inicio?: string;
  fecha_fin?: string;
  busqueda?: string;
  area?: string;
  tendencia_agrupacion?: "dia" | "semana" | "mes";
  /** Tamaño de `empleados_con_mas_eventos` (1-50; el API usa 10 por omisión). */
  top_empleados?: number;
};

export type FaltasRetardosEstadisticasResponse = {
  total_eventos: number;
  falta_justificada: number;
  falta_injustificada: number;
  retardo: number;
  incapacidad: number;
  suspension: number;
  eventos_por_mes: { periodo: string; total: number }[];
  eventos_por_periodo_y_tipo?: {
    periodo: string;
    tipo: FaltaRetardoTipo;
    total: number;
  }[];
  tendencia_agrupacion?: "dia" | "semana" | "mes" | null;
  eventos_por_tipo: { tipo: FaltaRetardoTipo; total: number; porcentaje: number }[];
  /** Colaboradores con al menos un evento, sin recortar por `top_empleados`. */
  total_colaboradores_con_eventos: number;
  empleados_con_mas_eventos: {
    empleado_id: number;
    no_empleado: string | null;
    nombre: string | null;
    total: number;
    por_tipo: { tipo: FaltaRetardoTipo; total: number }[];
  }[];
};

async function readErrorDetail(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const j = JSON.parse(raw) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) {
      return j.detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && "msg" in item) {
            return String((item as { msg: unknown }).msg);
          }
          return JSON.stringify(item);
        })
        .join("; ");
    }
  } catch {
    /* ignore */
  }
  return raw || res.statusText || "Error";
}

export async function getFaltasRetardosPage(
  params: FaltasRetardosListParams,
): Promise<FaltasRetardosPageResponse> {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("page_size", String(params.page_size));
  if (params.empleado_id != null) sp.set("empleado_id", String(params.empleado_id));
  if (params.tipo) sp.set("tipo", params.tipo);
  if (params.fecha_inicio?.trim()) sp.set("fecha_inicio", params.fecha_inicio.trim());
  if (params.fecha_fin?.trim()) sp.set("fecha_fin", params.fecha_fin.trim());
  if (params.busqueda?.trim()) sp.set("busqueda", params.busqueda.trim());

  const res = await fetchWithAuth(`/api/v1/faltas-retardos?${sp.toString()}`);
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) };
  }
  return (await res.json()) as FaltasRetardosPageResponse;
}

function buildFaltasRetardosQueryParams(
  params: FaltasRetardosEstadisticasParams,
): URLSearchParams {
  const sp = new URLSearchParams();
  if (params.empleado_id != null) sp.set("empleado_id", String(params.empleado_id));
  if (params.tipo) sp.set("tipo", params.tipo);
  for (const t of params.tipos ?? []) sp.append("tipos", t);
  if (params.fecha_inicio?.trim()) sp.set("fecha_inicio", params.fecha_inicio.trim());
  if (params.fecha_fin?.trim()) sp.set("fecha_fin", params.fecha_fin.trim());
  if (params.busqueda?.trim()) sp.set("busqueda", params.busqueda.trim());
  if (params.area?.trim()) sp.set("area", params.area.trim());
  if (params.tendencia_agrupacion) sp.set("tendencia_agrupacion", params.tendencia_agrupacion);
  if (params.top_empleados != null) sp.set("top_empleados", String(params.top_empleados));
  return sp;
}

export async function getFaltasRetardosEstadisticas(
  params: FaltasRetardosEstadisticasParams,
): Promise<FaltasRetardosEstadisticasResponse> {
  const sp = buildFaltasRetardosQueryParams(params);
  const qs = sp.toString();
  const res = await fetchWithAuth(
    `/api/v1/faltas-retardos/estadisticas${qs ? `?${qs}` : ""}`,
  );
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) };
  }
  return (await res.json()) as FaltasRetardosEstadisticasResponse;
}

export async function createFaltaRetardo(
  payload: FaltaRetardoCreatePayload,
): Promise<FaltaRetardoListItem> {
  const res = await fetchWithAuth("/api/v1/faltas-retardos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) };
  }
  return (await res.json()) as FaltaRetardoListItem;
}

export async function getFaltasRetardosTipos(): Promise<FaltaRetardoTipo[]> {
  const res = await fetchWithAuth("/api/v1/faltas-retardos/tipos");
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) };
  }
  const data = (await res.json()) as { items: FaltaRetardoTipo[] };
  return data.items;
}

// El mirror FI/RE hacia importadas_historico ya no tiene endpoint: corre en el job
// semanal del backend (miércoles 08:30, America/Mexico_City).
