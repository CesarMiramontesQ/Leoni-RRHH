import { fetchWithAuth } from "./http.ts";

export type ViajeLaboralEstado =
  | "borrador"
  | "pendiente"
  | "aprobado"
  | "rechazado"
  | "cancelado";

export type ViajeLaboralListItem = {
  id: number;
  empleado_id: number;
  empleado_nombre: string | null;
  numero_empleado: string | null;
  fecha_salida: string;
  fecha_regreso: string;
  lugar_origen: string;
  lugar_destino: string;
  motivo: string;
  descripcion: string | null;
  medio_transporte: string;
  hospedaje: string | null;
  viaticos_estimados: number | null;
  estado: ViajeLaboralEstado;
  registrado_por_id: number;
  registrado_por_nombre: string | null;
  aprobado_por_id: number | null;
  aprobado_por_nombre: string | null;
  motivo_rechazo: string | null;
  created_at: string;
  updated_at: string;
};

export type ViajesLaboralesPageResponse = {
  items: ViajeLaboralListItem[];
  total: number;
  page: number;
  page_size: number;
};

export type ViajeLaboralEstadoOption = {
  value: ViajeLaboralEstado;
  label: string;
};

export type ViajesLaboralesEstadisticasResponse = {
  total: number;
  pendientes: number;
  aprobados: number;
  cancelados: number;
};

export type ViajeLaboralPayload = {
  empleado_id: number;
  fecha_salida: string;
  fecha_regreso: string;
  lugar_origen: string;
  lugar_destino: string;
  motivo: string;
  descripcion?: string | null;
  medio_transporte: string;
  hospedaje?: string | null;
  viaticos_estimados?: number | null;
};

export type ViajesLaboralesListParams = {
  page: number;
  page_size: number;
  empleado_id?: number;
  fecha_inicio?: string;
  fecha_fin?: string;
  destino?: string;
  estado?: ViajeLaboralEstado | "";
  busqueda?: string;
};

export type ViajesLaboralesFetchError = { status: number; detail: string };

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

function buildListParams(params: ViajesLaboralesListParams): URLSearchParams {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("page_size", String(params.page_size));
  if (params.empleado_id != null) sp.set("empleado_id", String(params.empleado_id));
  if (params.fecha_inicio?.trim()) sp.set("fecha_inicio", params.fecha_inicio.trim());
  if (params.fecha_fin?.trim()) sp.set("fecha_fin", params.fecha_fin.trim());
  if (params.destino?.trim()) sp.set("destino", params.destino.trim());
  if (params.estado) sp.set("estado", params.estado);
  if (params.busqueda?.trim()) sp.set("busqueda", params.busqueda.trim());
  return sp;
}

export async function getViajesLaboralesPage(
  params: ViajesLaboralesListParams,
): Promise<ViajesLaboralesPageResponse> {
  const res = await fetchWithAuth(
    `/api/v1/viajes-laborales?${buildListParams(params).toString()}`,
  );
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as ViajesLaboralesFetchError;
  }
  return (await res.json()) as ViajesLaboralesPageResponse;
}

export async function getViajesLaboralesEstadisticas(
  params: Omit<ViajesLaboralesListParams, "page" | "page_size">,
): Promise<ViajesLaboralesEstadisticasResponse> {
  const sp = buildListParams({ ...params, page: 1, page_size: 1 });
  sp.delete("page");
  sp.delete("page_size");
  const res = await fetchWithAuth(`/api/v1/viajes-laborales/estadisticas?${sp.toString()}`);
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as ViajesLaboralesFetchError;
  }
  return (await res.json()) as ViajesLaboralesEstadisticasResponse;
}

export async function getViajesLaboralesEstados(): Promise<ViajeLaboralEstadoOption[]> {
  const res = await fetchWithAuth("/api/v1/viajes-laborales/estados");
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as ViajesLaboralesFetchError;
  }
  const data = (await res.json()) as { items: ViajeLaboralEstadoOption[] };
  return data.items;
}

export async function getViajeLaboral(id: number): Promise<ViajeLaboralListItem> {
  const res = await fetchWithAuth(`/api/v1/viajes-laborales/${id}`);
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as ViajesLaboralesFetchError;
  }
  return (await res.json()) as ViajeLaboralListItem;
}

export async function createViajeLaboral(
  payload: ViajeLaboralPayload,
): Promise<ViajeLaboralListItem> {
  const res = await fetchWithAuth("/api/v1/viajes-laborales", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as ViajesLaboralesFetchError;
  }
  return (await res.json()) as ViajeLaboralListItem;
}

export async function updateViajeLaboral(
  id: number,
  payload: Partial<ViajeLaboralPayload>,
): Promise<ViajeLaboralListItem> {
  const res = await fetchWithAuth(`/api/v1/viajes-laborales/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as ViajesLaboralesFetchError;
  }
  return (await res.json()) as ViajeLaboralListItem;
}

export async function enviarViajeLaboral(id: number): Promise<ViajeLaboralListItem> {
  const res = await fetchWithAuth(`/api/v1/viajes-laborales/${id}/enviar`, { method: "PUT" });
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as ViajesLaboralesFetchError;
  }
  return (await res.json()) as ViajeLaboralListItem;
}

export async function aprobarViajeLaboral(id: number): Promise<ViajeLaboralListItem> {
  const res = await fetchWithAuth(`/api/v1/viajes-laborales/${id}/aprobar`, { method: "PUT" });
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as ViajesLaboralesFetchError;
  }
  return (await res.json()) as ViajeLaboralListItem;
}

export async function rechazarViajeLaboral(
  id: number,
  motivo_rechazo: string,
): Promise<ViajeLaboralListItem> {
  const res = await fetchWithAuth(`/api/v1/viajes-laborales/${id}/rechazar`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ motivo_rechazo }),
  });
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as ViajesLaboralesFetchError;
  }
  return (await res.json()) as ViajeLaboralListItem;
}

export async function cancelarViajeLaboral(id: number): Promise<ViajeLaboralListItem> {
  const res = await fetchWithAuth(`/api/v1/viajes-laborales/${id}/cancelar`, { method: "PUT" });
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as ViajesLaboralesFetchError;
  }
  return (await res.json()) as ViajeLaboralListItem;
}

export async function deleteViajeLaboral(id: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/viajes-laborales/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw { status: res.status, detail: await readErrorDetail(res) } as ViajesLaboralesFetchError;
  }
}
