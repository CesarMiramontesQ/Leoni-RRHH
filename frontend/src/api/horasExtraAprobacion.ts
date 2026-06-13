/**
 * API del ciclo de aprobación de horas extra (gerente regional / director).
 */

import { fetchWithAuth } from "./http.ts";

export type HorasExtraTipoFirma = "gerente_area" | "gerente_regional" | "director_planta";
export type HorasExtraFirmaEstado = "pendiente" | "aprobado" | "rechazado";
export type HorasExtraEstadoConsolidado =
  | "pendiente"
  | "aprobado_parcial"
  | "aprobado"
  | "rechazado";

export type HorasExtraFirma = {
  tipo_firma: HorasExtraTipoFirma;
  tipo_firma_label: string;
  estado: HorasExtraFirmaEstado;
  aprobador_id: number | null;
  aprobador_nombre: string | null;
  rol_aprobador_nombre: string | null;
  fecha_aprobacion: string | null;
  comentario: string | null;
};

export type HorasExtraPendiente = {
  solicitud_id: number;
  semana: number;
  semana_inicio: string;
  fecha_solicitud: string;
  tipo: string;
  area_descripcion: string | null;
  subarea_descripcion: string | null;
  centrocosto_id: number | null;
  centrocosto_descripcion: string | null;
  motivo: string | null;
  total_horas: number;
  total_empleados: number;
  empleado_resumen: string | null;
  puesto_descripcion: string | null;
  registrado_por_nombre: string | null;
  mi_tipo_firma: HorasExtraTipoFirma;
  mi_tipo_firma_label: string;
  estado_consolidado: HorasExtraEstadoConsolidado;
  aprobado_parcial: boolean;
  created_at: string;
};

export type HorasExtraPendientesListResponse = {
  items: HorasExtraPendiente[];
  total: number;
  page: number;
  page_size: number;
};

export type HorasExtraEstadoConsolidadoResponse = {
  solicitud_id: number;
  estado: HorasExtraEstadoConsolidado;
  estado_label: string;
  aprobado_parcial: boolean;
  listo_para_nomina: boolean;
  firmas: HorasExtraFirma[];
  faltantes: string[];
  rechazado_por: string | null;
  comentario_rechazo: string | null;
};

export type HorasExtraHistorialResponse = {
  solicitud_id: number;
  estado: HorasExtraEstadoConsolidado;
  estado_label: string;
  firmas: HorasExtraFirma[];
  eventos: HorasExtraHistorialEvento[];
};

export type HorasExtraHistorialEvento = {
  usuario_nombre: string;
  rol: string | null;
  accion: string;
  comentario: string | null;
  fecha_hora: string;
};

export type HorasExtraDetalleEmpleado = {
  empleado_id: number;
  no_empleado: string;
  nombre: string;
  puesto_descripcion: string | null;
  departamento_descripcion: string | null;
  centrocosto_descripcion: string | null;
  subarea_descripcion: string | null;
  jefe_nombre: string | null;
  total_horas: number;
  lunes: number;
  martes: number;
  miercoles: number;
  jueves: number;
  viernes: number;
  sabado: number;
  domingo: number;
};

export type HorasExtraAprobadorAsignado = {
  nombre: string;
  email: string | null;
};

export type HorasExtraAprobacionDetalle = {
  solicitud_id: number;
  fecha_solicitud: string;
  semana: number;
  semana_inicio: string;
  tipo: string;
  motivo: string | null;
  comentarios: string | null;
  total_horas: number;
  total_empleados: number;
  created_at: string;
  registrado_por_nombre: string | null;
  area_descripcion: string | null;
  subarea_descripcion: string | null;
  centrocosto_descripcion: string | null;
  estado_consolidado: HorasExtraEstadoConsolidado;
  estado_label: string;
  empleados: HorasExtraDetalleEmpleado[];
  gerentes_regionales: HorasExtraAprobadorAsignado[];
  director_asignado: HorasExtraAprobadorAsignado | null;
  firmas: HorasExtraFirma[];
  historial: HorasExtraHistorialEvento[];
  mi_tipo_firma: HorasExtraTipoFirma | null;
  mi_tipo_firma_label: string | null;
  puede_aprobar: boolean;
  puede_rechazar: boolean;
};

export type HorasExtraAprobacionError = {
  status: number;
  detail: string;
};

export type HorasExtraPendientesParams = {
  page?: number;
  page_size?: number;
  q?: string;
  area_id?: number;
  centrocosto_id?: number;
  semana_inicio?: string;
};

export type HorasExtraAprobacionEstadisticas = {
  total_solicitudes: number;
  pendientes: number;
  aprobacion_parcial: number;
  aprobadas: number;
  rechazadas: number;
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

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err: HorasExtraAprobacionError = {
      status: res.status,
      detail: await readErrorDetail(res),
    };
    throw err;
  }
  return (await res.json()) as T;
}

export async function getHorasExtraPendientes(
  params: HorasExtraPendientesParams = {},
): Promise<HorasExtraPendientesListResponse> {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page ?? 1));
  sp.set("page_size", String(params.page_size ?? 12));
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.area_id != null) sp.set("area_id", String(params.area_id));
  if (params.centrocosto_id != null) sp.set("centrocosto_id", String(params.centrocosto_id));
  if (params.semana_inicio) sp.set("semana_inicio", params.semana_inicio);

  const res = await fetchWithAuth(
    `/api/v1/nominas/horas-extra/aprobaciones/pendientes?${sp.toString()}`,
  );
  return unwrap<HorasExtraPendientesListResponse>(res);
}

export async function getHorasExtraAprobacionesSolicitudes(
  params: HorasExtraPendientesParams = {},
): Promise<HorasExtraPendientesListResponse> {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page ?? 1));
  sp.set("page_size", String(params.page_size ?? 10));
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.area_id != null) sp.set("area_id", String(params.area_id));
  if (params.centrocosto_id != null) sp.set("centrocosto_id", String(params.centrocosto_id));
  if (params.semana_inicio) sp.set("semana_inicio", params.semana_inicio);

  const res = await fetchWithAuth(
    `/api/v1/nominas/horas-extra/aprobaciones/solicitudes?${sp.toString()}`,
  );
  return unwrap<HorasExtraPendientesListResponse>(res);
}

export async function getHorasExtraAprobacionesEstadisticas(): Promise<HorasExtraAprobacionEstadisticas> {
  const res = await fetchWithAuth("/api/v1/nominas/horas-extra/aprobaciones/estadisticas");
  return unwrap<HorasExtraAprobacionEstadisticas>(res);
}

export async function getHorasExtraAprobacionDetalle(
  solicitudId: number,
): Promise<HorasExtraAprobacionDetalle> {
  const res = await fetchWithAuth(
    `/api/v1/nominas/horas-extra/aprobaciones/${solicitudId}`,
  );
  return unwrap<HorasExtraAprobacionDetalle>(res);
}

export async function aprobarHorasExtra(
  solicitudId: number,
  comentario?: string,
): Promise<HorasExtraEstadoConsolidadoResponse> {
  const res = await fetchWithAuth(`/api/v1/nominas/horas-extra/${solicitudId}/aprobar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comentario: comentario?.trim() || null }),
  });
  return unwrap<HorasExtraEstadoConsolidadoResponse>(res);
}

export async function rechazarHorasExtra(
  solicitudId: number,
  comentario: string,
): Promise<HorasExtraEstadoConsolidadoResponse> {
  const res = await fetchWithAuth(`/api/v1/nominas/horas-extra/${solicitudId}/rechazar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comentario }),
  });
  return unwrap<HorasExtraEstadoConsolidadoResponse>(res);
}

export async function getHorasExtraEstado(
  solicitudId: number,
): Promise<HorasExtraEstadoConsolidadoResponse> {
  const res = await fetchWithAuth(`/api/v1/nominas/horas-extra/${solicitudId}/estado`);
  return unwrap<HorasExtraEstadoConsolidadoResponse>(res);
}

export async function getHorasExtraHistorial(
  solicitudId: number,
): Promise<HorasExtraHistorialResponse> {
  const res = await fetchWithAuth(`/api/v1/nominas/horas-extra/${solicitudId}/historial`);
  return unwrap<HorasExtraHistorialResponse>(res);
}
