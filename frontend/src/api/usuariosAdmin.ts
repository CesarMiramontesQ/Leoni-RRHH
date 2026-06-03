// frontend/src/api/usuariosAdmin.ts
/**
 * Cliente API para operaciones de RH sobre /api/v1/usuarios.
 *
 * Operaciones disponibles:
 *   - fetchUsuariosRoles()       GET /api/v1/usuarios/roles
 *   - patchUsuarioAsignacion()   PATCH /api/v1/usuarios/{id}  (rol_id, comedor_id; lider_id legacy)
 */

import { fetchWithAuth } from "./http.ts";
import type { RolBrief, UsuarioListItem, UsuariosFetchError } from "./usuarios.ts";

export type { UsuariosFetchError };

export type UsuarioAsignacionPayload = {
  lider_id?: number | null;
  rol_id?: number | null;
  comedor_id?: number;
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

export async function patchUsuarioAsignacion(
  id: number,
  body: UsuarioAsignacionPayload,
): Promise<UsuarioListItem> {
  const res = await fetchWithAuth(`/api/v1/usuarios/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as UsuarioListItem;
}
