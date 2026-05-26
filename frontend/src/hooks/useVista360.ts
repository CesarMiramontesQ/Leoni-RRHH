import { canAccessUsuariosAdmin } from "../auth/jwt.ts";
import { getEmpleadoMetricas, getEmpleadoVista360, type UsuarioVista360 } from "../api/vista360.ts";
import { isUsuariosFetchError } from "../api/usuarios.ts";
import {
  computeIncidenciaMetricas,
  type EmpleadoIncidenciasMetricas,
} from "../utils/incidenciaMetricas.ts";

export type { EmpleadoIncidenciasMetricas };

export type LoadVista360Result =
  | { ok: true; data: UsuarioVista360; incidenciasMetricas: EmpleadoIncidenciasMetricas | null }
  | { ok: false; status: number; message: string; aborted: boolean };

const METRICAS_VACIAS: EmpleadoIncidenciasMetricas = {
  total: 0,
  retardos: 0,
  faltasJustificadas: 0,
};

export async function loadEmpleadoVista360(id: number, signal: AbortSignal): Promise<LoadVista360Result> {
  try {
    if (canAccessUsuariosAdmin()) {
      const [data, metricas] = await Promise.all([
        getEmpleadoVista360(id, { signal }),
        getEmpleadoMetricas(id, { signal }).catch(() => null),
      ]);
      const incidenciasMetricas = metricas
        ? computeIncidenciaMetricas(metricas.incidencias_por_tipo)
        : METRICAS_VACIAS;
      return { ok: true, data, incidenciasMetricas };
    }
    const data = await getEmpleadoVista360(id, { signal });
    return { ok: true, data, incidenciasMetricas: null };
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
