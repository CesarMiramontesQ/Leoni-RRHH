import { fetchWithAuth } from "./http.ts";

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

export type HorasExtraTipoSolicitud = "planeado" | "espontaneo";
export type HorasExtraEstadoSolicitud =
  | "borrador"
  | "pendiente"
  | "aprobado"
  | "rechazado"
  | "cancelado";

export type HorasExtraEmpleadoOption = {
  id: number;
  no_empleado: string;
  nombre: string;
  centrocosto_id: number | null;
  area_id: number | null;
  subarea_id: number | null;
};

export type HorasExtraSolicitudOpciones = {
  empleados: HorasExtraEmpleadoOption[];
  semana_actual: number;
};

export type HorasExtraDetalleCreate = {
  empleado_id: number;
  lunes: number;
  martes: number;
  miercoles: number;
  jueves: number;
  viernes: number;
  sabado: number;
  domingo: number;
};

export type HorasExtraSolicitudCreate = {
  fecha_solicitud: string;
  semana: number;
  tipo: HorasExtraTipoSolicitud;
  motivo: string;
  empleados: HorasExtraDetalleCreate[];
};

export type HorasExtraDetalleResponse = HorasExtraDetalleCreate & {
  id: number;
  no_empleado: string;
  nombre_empleado: string;
  total_horas: number;
};

export type HorasExtraSolicitudResponse = {
  id: number;
  fecha_solicitud: string;
  semana: number;
  semana_inicio: string;
  tipo: HorasExtraTipoSolicitud;
  departamento_id: number;
  departamento_nombre: string;
  area_id: number;
  area_descripcion: string;
  subarea_id: number;
  subarea_descripcion: string;
  centrocosto_id: number;
  centrocosto_descripcion: string;
  motivo_id: number;
  motivo_descripcion: string;
  comentarios: string | null;
  estado: HorasExtraEstadoSolicitud;
  total_horas_general: number;
  total_empleados: number;
  created_at: string;
  detalle: HorasExtraDetalleResponse[];
};

export type HorasExtraSolicitudListItem = {
  id: number;
  fecha_solicitud: string;
  semana: number;
  semana_inicio: string;
  departamento_nombre: string;
  area_descripcion: string;
  tipo: HorasExtraTipoSolicitud;
  total_horas_general: number;
  estado: HorasExtraEstadoSolicitud;
  created_at: string;
};

export type HorasExtraSolicitudListResponse = {
  items: HorasExtraSolicitudListItem[];
  total: number;
  page: number;
  page_size: number;
};

export type HorasExtraSolicitudFetchError = {
  status: number;
  detail: string;
};

export async function getHorasExtraSolicitudOpciones(): Promise<HorasExtraSolicitudOpciones> {
  const res = await fetchWithAuth("/api/v1/horas-extra/solicitudes/opciones");
  if (!res.ok) {
    const err: HorasExtraSolicitudFetchError = {
      status: res.status,
      detail: await readErrorDetail(res),
    };
    throw err;
  }
  return (await res.json()) as HorasExtraSolicitudOpciones;
}

export async function getHorasExtraSolicitudes(
  page = 1,
  pageSize = 10,
): Promise<HorasExtraSolicitudListResponse> {
  const sp = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  const res = await fetchWithAuth(`/api/v1/horas-extra/solicitudes?${sp.toString()}`);
  if (!res.ok) {
    const err: HorasExtraSolicitudFetchError = {
      status: res.status,
      detail: await readErrorDetail(res),
    };
    throw err;
  }
  return (await res.json()) as HorasExtraSolicitudListResponse;
}

export async function createHorasExtraSolicitud(
  body: HorasExtraSolicitudCreate,
): Promise<HorasExtraSolicitudResponse> {
  const res = await fetchWithAuth("/api/v1/horas-extra/solicitudes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err: HorasExtraSolicitudFetchError = {
      status: res.status,
      detail: await readErrorDetail(res),
    };
    throw err;
  }
  return (await res.json()) as HorasExtraSolicitudResponse;
}

export async function getHorasExtraSolicitudDetalle(
  id: number,
): Promise<HorasExtraSolicitudResponse> {
  const res = await fetchWithAuth(`/api/v1/horas-extra/solicitudes/${id}`);
  if (!res.ok) {
    const err: HorasExtraSolicitudFetchError = {
      status: res.status,
      detail: await readErrorDetail(res),
    };
    throw err;
  }
  return (await res.json()) as HorasExtraSolicitudResponse;
}
