import { fetchWithAuth } from "./http.ts";
import type { RolBrief, UsuariosFetchError } from "./usuarios.ts";

/**
 * Cuerpo POST /api/v1/usuarios — alineado con app.schemas.usuarios.UsuarioCreate.
 * Opcionales: null u omitidos según convenga; el backend acepta null en opcionales.
 */
export type UsuarioCreatePayload = {
  num_empleado: string;
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  departamento?: string | null;
  puesto?: string | null;
  rol_id: number;
  supervisor_id?: number | null;
  /** ISO date YYYY-MM-DD */
  fecha_ingreso?: string | null;
};

export type UsuarioCreatedResponse = {
  id: number;
  num_empleado: string;
  nombre: string;
  apellido: string;
  email: string;
  departamento: string | null;
  puesto: string | null;
  rol_id: number;
  rol: RolBrief | null;
  supervisor_id: number | null;
  activo: boolean;
  fecha_ingreso: string | null;
  created_at: string;
};

function throwIfNotOk(res: Response, detail: string): never {
  const err: UsuariosFetchError = { status: res.status, detail };
  throw err;
}

async function readErrorDetail(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const j = JSON.parse(raw) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) {
      const parts = j.detail.map((item: unknown) => {
        if (typeof item === "object" && item !== null && "msg" in item) {
          return String((item as { msg: unknown }).msg);
        }
        return JSON.stringify(item);
      });
      return parts.join(" · ");
    }
  } catch {
    /* ignore */
  }
  return raw || res.statusText || "Error";
}

export async function fetchUsuariosRoles(): Promise<RolBrief[]> {
  const res = await fetchWithAuth("/api/v1/usuarios/roles");
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as RolBrief[];
}

export async function createUsuario(body: UsuarioCreatePayload): Promise<UsuarioCreatedResponse> {
  const payload = {
    num_empleado: body.num_empleado.trim(),
    nombre: body.nombre.trim(),
    apellido: body.apellido.trim(),
    email: body.email.trim(),
    password: body.password,
    rol_id: body.rol_id,
    departamento: body.departamento?.trim() || null,
    puesto: body.puesto?.trim() || null,
    supervisor_id: body.supervisor_id ?? null,
    fecha_ingreso: body.fecha_ingreso?.trim() || null,
  };

  const res = await fetchWithAuth("/api/v1/usuarios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as UsuarioCreatedResponse;
}
