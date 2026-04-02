import { getEmpleadoVista360, type UsuarioVista360 } from "../api/vista360.ts";
import { isUsuariosFetchError } from "../api/usuarios.ts";

export type LoadVista360Result =
  | { ok: true; data: UsuarioVista360 }
  | { ok: false; status: number; message: string; aborted: boolean };

export async function loadEmpleadoVista360(id: number, signal: AbortSignal): Promise<LoadVista360Result> {
  try {
    const data = await getEmpleadoVista360(id, { signal });
    return { ok: true, data };
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, status: 0, message: "", aborted: true };
    }
    if (isUsuariosFetchError(e)) {
      return { ok: false, status: e.status, message: e.detail, aborted: false };
    }
    return { ok: false, status: 0, message: "Error de conexión.", aborted: false };
  }
}
