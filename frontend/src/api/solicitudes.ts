import { fetchWithAuth } from "./http.ts";
import type { RhSolicitudEstadoCodigo, RhSolicitudTablaFila, RhSolicitudTipoCodigo } from "../solicitudes/rh/types.ts";

type SolicitudApiItem = {
  id: number;
  empleado_id: number;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  created_at: string;
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

function toTipo(tipo: string): RhSolicitudTipoCodigo {
  return tipo === "vacaciones" ? "vacaciones" : "home_office";
}

function toEstado(estado: string): RhSolicitudEstadoCodigo {
  if (
    estado === "pending" ||
    estado === "approved" ||
    estado === "rejected" ||
    estado === "cancelled" ||
    estado === "overridden" ||
    estado === "changes_requested"
  ) {
    return estado;
  }
  return "cancelled";
}

function toFila(item: SolicitudApiItem): RhSolicitudTablaFila {
  return {
    id: item.id,
    empleado_id: String(item.empleado_id),
    empleado_nombre_raw: `Empleado #${item.empleado_id}`,
    foto_url: null,
    numero_folio: `SOL-${item.id}`,
    area: "Sin área",
    tipo: toTipo(item.tipo),
    fecha_solicitud: item.created_at.slice(0, 10),
    fecha_inicio: item.fecha_inicio,
    fecha_fin: item.fecha_fin,
    periodo_etiqueta: null,
    estado: toEstado(item.estado),
    supervisor_id: "",
    supervisor_nombre: "Sin supervisor",
    fecha_aprobacion: null,
  };
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
