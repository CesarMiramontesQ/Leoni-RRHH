import { fetchWithAuth } from "./http.ts";

export type OrganigramaNodo = {
  id: number;
  empleado_id: number;
  no_empleado: string;
  nombre_colaborador: string;
  nombre_puesto: string | null;
  departamento: string | null;
  correo: string | null;
  foto_url: string | null;
  extension_telefono: string | null;
  parent_id: number | null;
  nivel_jerarquico: number;
  nivel_visual: "direccion" | "gerencia" | "jefaturas" | "operacion";
  activo: boolean;
  estado_empleado: string | null;
  reportes_directos: number;
  created_at: string;
  updated_at: string | null;
  relacion_incompleta: boolean;
  children: OrganigramaNodo[];
};

export type OrganigramaResponse = {
  total_nodos: number;
  total_raices: number;
  total_relaciones_incompletas: number;
  generated_at: string;
  roots: OrganigramaNodo[];
};

export type OrganigramaFetchError = {
  status: number;
  detail: string;
};

function throwOrganigramaError(status: number, detail: string): never {
  const err: OrganigramaFetchError = { status, detail };
  throw err;
}

async function readErrorDetail(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const parsed = JSON.parse(raw) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
  } catch {
    /* ignore */
  }
  return raw || res.statusText || "Error";
}

export async function getOrganigrama(): Promise<OrganigramaResponse> {
  const res = await fetchWithAuth("/api/v1/organigrama");
  if (!res.ok) {
    throwOrganigramaError(res.status, await readErrorDetail(res));
  }
  return (await res.json()) as OrganigramaResponse;
}
