import { canAccessUsuariosAdmin } from "../auth/jwt.ts";
import {
  getEmpleadoMetricas,
  getEmpleadoSaldoVacacionesReal,
  getEmpleadoVista360,
  type UsuarioVista360,
} from "../api/vista360.ts";
import { isUsuariosFetchError } from "../api/usuarios.ts";
import {
  computeIncidenciaMetricas,
  type EmpleadoIncidenciasMetricas,
} from "../utils/incidenciaMetricas.ts";

export type { EmpleadoIncidenciasMetricas };

export type LoadVista360Result =
  | {
      ok: true;
      data: UsuarioVista360;
      incidenciasMetricas: EmpleadoIncidenciasMetricas | null;
      saldoVacacionesReal: number | null;
    }
  | { ok: false; status: number; message: string; aborted: boolean };

const METRICAS_VACIAS: EmpleadoIncidenciasMetricas = {
  total: 0,
  retardos: 0,
  faltasJustificadas: 0,
};

export async function loadEmpleadoVista360(id: number, signal: AbortSignal): Promise<LoadVista360Result> {
  // Saldo real de vacaciones (SQL Server datos-analisis): carga en paralelo y tolerante a
  // fallos — si la BD externa está caída/lenta, el detalle sigue cargando y la card muestra
  // "no disponible".
  const fetchSaldoReal = () =>
    getEmpleadoSaldoVacacionesReal(id, { signal })
      .then((r) => r.saldo_gozo_total)
      .catch(() => null);

  try {
    if (canAccessUsuariosAdmin()) {
      const [data, metricas, saldoVacacionesReal] = await Promise.all([
        getEmpleadoVista360(id, { signal }),
        getEmpleadoMetricas(id, { signal }).catch(() => null),
        fetchSaldoReal(),
      ]);
      const incidenciasMetricas = metricas
        ? computeIncidenciaMetricas(metricas.incidencias_por_tipo)
        : METRICAS_VACIAS;
      return { ok: true, data, incidenciasMetricas, saldoVacacionesReal };
    }
    const [data, saldoVacacionesReal] = await Promise.all([
      getEmpleadoVista360(id, { signal }),
      fetchSaldoReal(),
    ]);
    return { ok: true, data, incidenciasMetricas: null, saldoVacacionesReal };
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
