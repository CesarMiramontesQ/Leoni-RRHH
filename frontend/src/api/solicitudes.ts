import { fetchWithAuth } from "./http.ts";
import type { RhSolicitudEstadoCodigo, RhSolicitudTablaFila, RhSolicitudTipoCodigo } from "../solicitudes/rh/types.ts";
import { formatNoEmpleadoDisplay } from "../utils/noEmpleadoDisplay.ts";

export type SolicitudApiItem = {
  id: number;
  empleado_id: number;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  created_at: string;
  nivel_actual?: number;
  motivo?: string | null;
  comentarios?: string | null;
  empleado_nombre?: string;
  empleado_no_empleado?: string | number | null;
  empleado_area?: string | null;
  empleado_puesto?: string | null;
  empleado_foto?: string | null;
  lider_id?: number | null;
  lider_nombre?: string | null;
  gerente_linea_id?: number | null;
  gerente_linea_nombre?: string | null;
  supervisor_aprobo?: boolean;
  pendiente_aprobacion_supervisor?: boolean;
  pendiente_aprobacion_gerente?: boolean;
};

type SolicitudesApiPage = {
  items: SolicitudApiItem[];
  next_cursor: number | null;
  total: number;
};

export type SolicitudesFetchError = {
  status: number;
  detail: string;
};

/** Coincide con `_MSG_SOLICITUD_YA_EXISTE` en `app/services/solicitud_service.py` (409). */
export const SOLICITUD_DUPLICADA_DETAIL = "Esta solicitud ya existe";

export type SolicitudCreatePayload = {
  tipo:
    | "vacaciones"
    | "home_office"
    | "matrimonio"
    | "incapacidad_interna"
    | "defuncion"
    | "paternidad"
    | "permiso_sin_goce_sueldo";
  fecha_inicio: string;
  fecha_fin: string;
  motivo: string | null;
  comentarios: string | null;
  /** Titular de la solicitud; si se omite, el backend usa el usuario autenticado. */
  empleado_id?: number;
};

export type SolicitudCreateResponse = SolicitudApiItem;

/** Respuesta de `GET /api/v1/solicitudes/{id}/aprobaciones`. */
export type SolicitudAprobacionApiItem = {
  id: number;
  solicitud_id: number;
  aprobador_id: number;
  accion: string;
  nivel: number;
  comentario: string | null;
  timestamp: string;
  aprobador_nombre?: string;
};

/** Extrae `detail` legible de respuestas FastAPI / Pydantic. */
function normalizeApiErrorDetail(parsed: unknown): string | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const d = (parsed as { detail?: unknown }).detail;
  if (typeof d === "string" && d.trim()) return d.trim();
  if (Array.isArray(d)) {
    const parts = d
      .map((e) => {
        if (e && typeof e === "object" && "msg" in e) {
          const msg = (e as { msg?: unknown }).msg;
          return typeof msg === "string" ? msg : "";
        }
        return "";
      })
      .filter(Boolean);
    if (parts.length) return parts.join("; ");
  }
  return null;
}

async function readErrorDetail(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const parsed: unknown = JSON.parse(raw);
    const normalized = normalizeApiErrorDetail(parsed);
    if (normalized) return normalized;
  } catch {
    /* noop */
  }
  return raw.trim() || res.statusText || "Error";
}

function toTipo(tipo: string): RhSolicitudTipoCodigo {
  const raw = (tipo || "").trim().toLowerCase();
  if (raw === "vacaciones" || raw === "vacation") return "vacaciones";
  if (raw === "home_office" || raw === "home office" || raw === "homeoffice") return "home_office";
  if (raw === "matrimonio") return "matrimonio";
  if (raw === "incapacidad_interna" || raw === "incapacidad interna") return "incapacidad_interna";
  if (raw === "defuncion" || raw === "defunción") return "defuncion";
  if (raw === "paternidad") return "paternidad";
  if (raw === "permiso_sin_goce_sueldo" || raw === "permiso sin goce de sueldo") return "permiso_sin_goce_sueldo";
  return "vacaciones";
}

function toEstado(estado: string): RhSolicitudEstadoCodigo {
  const raw = (estado || "").trim().toLowerCase();
  if (raw === "pending" || raw === "pendiente") return "pending";
  if (raw === "approved" || raw === "aprobado") return "approved";
  if (raw === "rejected" || raw === "rechazado") return "rejected";
  if (raw === "cancelled" || raw === "cancelado" || raw === "canceled") return "cancelled";
  if (raw === "overridden" || raw === "override") return "overridden";
  if (raw === "changes_requested" || raw === "solicitar_cambios" || raw === "cambios_solicitados") {
    return "changes_requested";
  }
  return "cancelled";
}

function toFila(item: SolicitudApiItem): RhSolicitudTablaFila {
  const nombreApi = typeof item.empleado_nombre === "string" ? item.empleado_nombre.trim() : "";
  const empleadoNombreRaw = nombreApi || `Empleado #${item.empleado_id}`;
  const area =
    typeof item.empleado_area === "string" && item.empleado_area.trim() ? item.empleado_area.trim() : "Sin área";
  const supId = item.lider_id != null && Number.isFinite(item.lider_id) ? String(item.lider_id) : "";
  const supNom =
    typeof item.lider_nombre === "string" && item.lider_nombre.trim() ? item.lider_nombre.trim() : "Sin supervisor";
  const nivel =
    typeof item.nivel_actual === "number" && Number.isFinite(item.nivel_actual) ? item.nivel_actual : 1;

  return {
    id: item.id,
    empleado_id: String(item.empleado_id),
    empleado_nombre_raw: empleadoNombreRaw,
    empleado_no_empleado: formatNoEmpleadoDisplay(item.empleado_no_empleado) || null,
    empleado_puesto:
      typeof item.empleado_puesto === "string" && item.empleado_puesto.trim() ? item.empleado_puesto.trim() : null,
    foto_url: typeof item.empleado_foto === "string" && item.empleado_foto.trim() ? item.empleado_foto.trim() : null,
    numero_folio: `SOL-${item.id}`,
    area,
    tipo: toTipo(item.tipo),
    fecha_solicitud: item.created_at.slice(0, 10),
    fecha_inicio: item.fecha_inicio,
    fecha_fin: item.fecha_fin,
    periodo_etiqueta: null,
    estado: toEstado(item.estado),
    supervisor_id: supId,
    supervisor_nombre: supNom,
    fecha_aprobacion: null,
    nivel_actual: nivel,
    motivo: item.motivo ?? null,
    comentarios: item.comentarios ?? null,
  };
}

/** Mapea la respuesta del API al modelo de fila usado por la vista RH. */
export function mapSolicitudApiItemToRhTablaFila(item: SolicitudApiItem): RhSolicitudTablaFila {
  return toFila(item);
}

export async function getSolicitudesRows(limitPerPage = 100): Promise<RhSolicitudTablaFila[]> {
  const rows: RhSolicitudTablaFila[] = [];
  let cursor: number | null = null;

  while (true) {
    const params = new URLSearchParams();
    params.set("limit", String(limitPerPage));
    if (cursor != null) params.set("cursor", String(cursor));
    const res = await fetchWithAuth(`/api/v1/solicitudes?${params.toString()}`);
    if (!res.ok) {
      const detail = await readErrorDetail(res);
      throw { status: res.status, detail } as SolicitudesFetchError;
    }
    const page = (await res.json()) as SolicitudesApiPage;
    rows.push(...page.items.map(toFila));
    if (page.next_cursor == null) break;
    cursor = page.next_cursor;
  }

  return rows;
}

export async function getSolicitudById(id: number): Promise<SolicitudApiItem> {
  const res = await fetchWithAuth(`/api/v1/solicitudes/${id}`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as SolicitudesFetchError;
  }
  return (await res.json()) as SolicitudApiItem;
}

export async function getSolicitudAprobaciones(id: number): Promise<SolicitudAprobacionApiItem[]> {
  const res = await fetchWithAuth(`/api/v1/solicitudes/${id}/aprobaciones`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as SolicitudesFetchError;
  }
  return (await res.json()) as SolicitudAprobacionApiItem[];
}

export async function createSolicitud(payload: SolicitudCreatePayload): Promise<SolicitudCreateResponse> {
  const res = await fetchWithAuth("/api/v1/solicitudes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as SolicitudesFetchError;
  }
  return (await res.json()) as SolicitudCreateResponse;
}

export type SolicitudDecisionApiPayload = {
  nivel: number;
  comentario: string | null;
};

export async function approveSolicitud(
  solicitudId: number,
  body: SolicitudDecisionApiPayload,
): Promise<SolicitudApiItem> {
  const res = await fetchWithAuth(`/api/v1/solicitudes/${solicitudId}/approve`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accion: "approve",
      nivel: body.nivel,
      comentario: body.comentario,
    }),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as SolicitudesFetchError;
  }
  return (await res.json()) as SolicitudApiItem;
}

export async function rejectSolicitud(
  solicitudId: number,
  body: SolicitudDecisionApiPayload,
): Promise<SolicitudApiItem> {
  const res = await fetchWithAuth(`/api/v1/solicitudes/${solicitudId}/reject`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accion: "reject",
      nivel: body.nivel,
      comentario: body.comentario,
    }),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as SolicitudesFetchError;
  }
  return (await res.json()) as SolicitudApiItem;
}

export type SolicitudRequestChangesPayload = {
  nivel: number;
  comentario: string;
};

export async function requestChangesSolicitud(
  solicitudId: number,
  body: SolicitudRequestChangesPayload,
): Promise<SolicitudApiItem> {
  const res = await fetchWithAuth(`/api/v1/solicitudes/${solicitudId}/request-changes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nivel: body.nivel, comentario: body.comentario }),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as SolicitudesFetchError;
  }
  return (await res.json()) as SolicitudApiItem;
}

export type SolicitudRevisionPatchPayload = {
  fecha_inicio: string;
  fecha_fin: string;
  motivo: string | null;
};

export async function patchSolicitudRevision(
  solicitudId: number,
  body: SolicitudRevisionPatchPayload,
): Promise<SolicitudApiItem> {
  const res = await fetchWithAuth(`/api/v1/solicitudes/${solicitudId}/revision`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fecha_inicio: body.fecha_inicio,
      fecha_fin: body.fecha_fin,
      motivo: body.motivo,
    }),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as SolicitudesFetchError;
  }
  return (await res.json()) as SolicitudApiItem;
}
