import { fetchWithAuth } from "./http.ts";

export type HorasExtraEstadoSolicitud =
  | "borrador"
  | "pendiente"
  | "aprobado"
  | "rechazado"
  | "cancelado";
export type HorasExtraTabFiltro = "todos" | "pendientes" | "aprobados" | "rechazados";

export type HorasExtraLider = {
  empleado_id: number;
  nombre: string;
};

export type HorasExtraEmpleado = {
  id: number;
  empleado_id: number;
  no_empleado: string;
  nombre: string;
  puesto_nombre: string | null;
  centrocosto_id: number | null;
  lider: HorasExtraLider | null;
};

export type HorasExtraSolicitudInfo = {
  solicitud_id: number;
  semana: number;
  semana_inicio: string;
  fecha_solicitud: string;
  tipo: "planeado" | "espontaneo";
  area_descripcion: string | null;
  centrocosto_id: number;
  centrocosto_descripcion: string | null;
  motivo: string | null;
  estado: HorasExtraEstadoSolicitud;
  total_horas: number;
  registrado_por_nombre: string | null;
  aprobador_nombre: string | null;
  fecha_aprobacion: string | null;
};

export type HorasExtraFila = {
  empleado: HorasExtraEmpleado;
  solicitud: HorasExtraSolicitudInfo;
};

export type HorasExtraResumen = {
  total_horas_extra: number;
  colaboradores_con_registro: number;
  empleados_con_horas_extra: number;
  empleados_activos_planta: number;
  solicitudes_total: number;
  solicitudes_pendientes: number;
  solicitudes_aprobadas: number;
  solicitudes_rechazadas: number;
  porcentaje_aprobacion: number;
};

export type HorasExtraCentroCostoOption = {
  id: number;
  label: string;
};

export type HorasExtraFilterOptionsResponse = {
  centros_costo: HorasExtraCentroCostoOption[];
};

export type HorasExtraListResponse = {
  semana_actual: number;
  resumen: HorasExtraResumen;
  tabs: Record<HorasExtraTabFiltro, number>;
  filter_options: HorasExtraFilterOptionsResponse;
  items: HorasExtraFila[];
  total: number;
  page: number;
  page_size: number;
};

export type HorasExtraFetchError = {
  status: number;
  detail: string;
};

export type HorasExtraListParams = {
  page?: number;
  page_size?: number;
  tab?: HorasExtraTabFiltro;
  q?: string;
  area_id?: number;
  centrocosto_id?: number;
  lider_empleado_id?: number;
};

async function readErrorDetail(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const j = JSON.parse(raw) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
  } catch {
    /* ignore */
  }
  return raw || res.statusText || "Error";
}

export async function getHorasExtraList(
  params: HorasExtraListParams = {},
): Promise<HorasExtraListResponse> {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page ?? 1));
  sp.set("page_size", String(params.page_size ?? 12));
  if (params.tab) sp.set("tab", params.tab);
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.area_id != null) sp.set("area_id", String(params.area_id));
  if (params.centrocosto_id != null) sp.set("centrocosto_id", String(params.centrocosto_id));
  if (params.lider_empleado_id != null) {
    sp.set("lider_empleado_id", String(params.lider_empleado_id));
  }

  const res = await fetchWithAuth(`/api/v1/nominas/horas-extra?${sp.toString()}`);
  if (!res.ok) {
    const err: HorasExtraFetchError = { status: res.status, detail: await readErrorDetail(res) };
    throw err;
  }
  return (await res.json()) as HorasExtraListResponse;
}
