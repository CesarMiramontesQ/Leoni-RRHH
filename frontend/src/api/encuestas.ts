import { fetchWithAuth } from "./http.ts";
import type {
  CursoEncuestasResumen,
  EncuestaDetalle,
  EncuestaEstado,
  EncuestaPendienteList,
  EncuestaRespuesta,
  EncuestaRespuestaInput,
  EncuestasDashboard,
} from "../dashboard/cursos/encuestasTypes.ts";

const BASE = "/api/v1/level-up";

async function parseError(res: Response, fallback: string): Promise<never> {
  let detail = fallback;
  try {
    const body = await res.json();
    if (body && typeof body.detail === "string") detail = body.detail;
  } catch {
    /* sin cuerpo JSON */
  }
  throw new Error(detail);
}

// ── Administración (RH) ──────────────────────────────────────────────────────

export async function getEncuestaEstado(
  cursoId: number,
  sesionId: number,
): Promise<EncuestaEstado> {
  const res = await fetchWithAuth(
    `${BASE}/cursos/${cursoId}/sesiones/${sesionId}/encuesta`,
  );
  if (!res.ok) await parseError(res, "No se pudo cargar el estado de la encuesta");
  return res.json() as Promise<EncuestaEstado>;
}

export async function habilitarEncuesta(
  cursoId: number,
  sesionId: number,
  fechaLimite?: string | null,
): Promise<EncuestaEstado> {
  const res = await fetchWithAuth(
    `${BASE}/cursos/${cursoId}/sesiones/${sesionId}/encuesta`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fecha_limite: fechaLimite ?? null }),
    },
  );
  if (!res.ok) await parseError(res, "No se pudo habilitar la encuesta");
  return res.json() as Promise<EncuestaEstado>;
}

export async function actualizarEncuesta(
  cursoId: number,
  sesionId: number,
  payload: { estado?: "activa" | "cerrada"; fecha_limite?: string | null },
): Promise<EncuestaEstado> {
  const res = await fetchWithAuth(
    `${BASE}/cursos/${cursoId}/sesiones/${sesionId}/encuesta`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) await parseError(res, "No se pudo actualizar la encuesta");
  return res.json() as Promise<EncuestaEstado>;
}

export async function deshabilitarEncuesta(
  cursoId: number,
  sesionId: number,
): Promise<void> {
  const res = await fetchWithAuth(
    `${BASE}/cursos/${cursoId}/sesiones/${sesionId}/encuesta`,
    { method: "DELETE" },
  );
  if (!res.ok && res.status !== 204) {
    await parseError(res, "No se pudo deshabilitar la encuesta");
  }
}

export async function getCursoEncuestasResumen(
  cursoId: number,
): Promise<CursoEncuestasResumen> {
  const res = await fetchWithAuth(`${BASE}/cursos/${cursoId}/encuestas/resumen`);
  if (!res.ok) await parseError(res, "No se pudo cargar el resumen de encuestas");
  return res.json() as Promise<CursoEncuestasResumen>;
}

export async function getEncuestasDashboard(): Promise<EncuestasDashboard> {
  const res = await fetchWithAuth(`${BASE}/cursos/dashboard/encuestas`);
  if (!res.ok) await parseError(res, "No se pudo cargar el dashboard de encuestas");
  return res.json() as Promise<EncuestasDashboard>;
}

// ── Empleado ─────────────────────────────────────────────────────────────────

export async function getMisEncuestasPendientes(): Promise<EncuestaPendienteList> {
  const res = await fetchWithAuth(`${BASE}/encuestas/pendientes`);
  if (!res.ok) await parseError(res, "No se pudieron cargar tus encuestas pendientes");
  return res.json() as Promise<EncuestaPendienteList>;
}

export async function getEncuestaDetalle(
  encuestaId: number,
): Promise<EncuestaDetalle> {
  const res = await fetchWithAuth(`${BASE}/encuestas/${encuestaId}`);
  if (!res.ok) await parseError(res, "No se pudo cargar la encuesta");
  return res.json() as Promise<EncuestaDetalle>;
}

export async function responderEncuesta(
  encuestaId: number,
  payload: EncuestaRespuestaInput,
): Promise<EncuestaRespuesta> {
  const res = await fetchWithAuth(`${BASE}/encuestas/${encuestaId}/respuesta`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) await parseError(res, "No se pudo registrar tu respuesta");
  return res.json() as Promise<EncuestaRespuesta>;
}
