import { fetchWithAuth } from "./http.ts";
import type { UsuarioListItem, UsuariosFetchError } from "./usuarios.ts";

/** Usuario en vista 360 = UsuarioResponse (sin `lider_nombre` del listado). */
export type UsuarioVista360Usuario = Omit<UsuarioListItem, "lider_nombre">;

export type SolicitudBrief = {
  id: number;
  tipo: string;
  estado: string;
  fecha_inicio: string;
  fecha_fin: string;
  created_at: string;
};

export type IncidenciaBrief = {
  id: number;
  tipo: string;
  estatus_id: number | null;
  created_at: string;
};

export type ActaBrief = {
  id: number;
  estado: string;
  created_at: string;
};

/** Datos de `turnos_empleados`; la API solo lo incluye para solicitantes con rol RH. */
export type Vista360TurnoEmpleado = {
  comedor: string | null;
  turno: string | null;
};

export type UsuarioVista360 = {
  usuario: UsuarioVista360Usuario;
  solicitudes_recientes: SolicitudBrief[];
  incidencias_activas: IncidenciaBrief[];
  actas_firmadas: ActaBrief[];
  saldo_vacaciones: number;
  turno_empleado?: Vista360TurnoEmpleado | null;
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

function throwIfNotOk(res: Response, detail: string): never {
  const err: UsuariosFetchError = { status: res.status, detail };
  throw err;
}

export async function getEmpleadoVista360(
  id: number,
  options?: { signal?: AbortSignal },
): Promise<UsuarioVista360> {
  const res = await fetchWithAuth(`/api/v1/empleados/${id}/vista360`, {
    signal: options?.signal,
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as UsuarioVista360;
}
