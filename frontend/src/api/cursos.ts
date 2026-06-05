import { fetchWithAuth } from "./http.ts";
import type {
  Curso,
  CursoListResponse,
  CursoCreatePayload,
  CursoUpdatePayload,
  CursoSesion,
  CursoSesionListResponse,
  CursoSesionCreatePayload,
  CursoSesionUpdatePayload,
  SesionEmpleadoItem,
} from "../dashboard/cursos/types.ts";

async function readErrorDetail(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      const d = (parsed as { detail?: unknown }).detail;
      if (typeof d === "string" && d.trim()) return d.trim();
    }
  } catch {
    /* noop */
  }
  return raw.trim() || res.statusText || "Error";
}

export async function getCursos(params?: {
  page?: number;
  page_size?: number;
  tipo?: string;
  clasificacion?: string;
  obligatorio?: boolean;
  categoria?: string;
  busqueda?: string;
}): Promise<CursoListResponse> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.page_size) qs.set("page_size", String(params.page_size));
  if (params?.tipo) qs.set("tipo", params.tipo);
  if (params?.clasificacion) qs.set("clasificacion", params.clasificacion);
  if (params?.obligatorio !== undefined && params.obligatorio !== null) qs.set("obligatorio", String(params.obligatorio));
  if (params?.categoria) qs.set("categoria", params.categoria);
  if (params?.busqueda) qs.set("busqueda", params.busqueda);

  const res = await fetchWithAuth(`/api/v1/level-up/cursos?${qs.toString()}`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return res.json();
}

export async function getCursoById(id: number): Promise<Curso> {
  const res = await fetchWithAuth(`/api/v1/level-up/cursos/${id}`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return res.json();
}

export async function createCurso(data: CursoCreatePayload): Promise<Curso> {
  const res = await fetchWithAuth("/api/v1/level-up/cursos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return res.json();
}

export async function updateCurso(id: number, data: CursoUpdatePayload): Promise<Curso> {
  const res = await fetchWithAuth(`/api/v1/level-up/cursos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return res.json();
}

export async function deleteCurso(id: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/level-up/cursos/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
}

// ── Cursos por puesto ──────────────────────────────────────────────────────

export interface CursoPuestoItem {
  id: number;
  curso_id: number;
  puesto_perfil_id: number;
  obligatorio: boolean;
  curso_nombre: string | null;
  sesion_id: number | null;
  sesion_fecha: string | null;
}

export async function getCursosPuesto(perfilId: number): Promise<CursoPuestoItem[]> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/cursos`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return res.json();
}

export async function asignarCursoPuesto(
  perfilId: number,
  cursoId: number,
  obligatorio: boolean = false,
  sesionId?: number | null,
): Promise<CursoPuestoItem> {
  const payload: Record<string, unknown> = { curso_id: cursoId, obligatorio };
  if (sesionId) payload.sesion_id = sesionId;
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/cursos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return res.json();
}

export async function eliminarCursoPuesto(perfilId: number, cursoPuestoId: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/cursos/${cursoPuestoId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
}

// ── Cursos extra por empleado (individual) ─────────────────────────────────

export interface CursoEmpleadoItem {
  id: number;
  curso_id: number;
  empleado_id: number;
  curso_nombre: string | null;
  sesion_id: number | null;
  sesion_fecha: string | null;
}

export async function getCursosExtra(perfilId: number, asignacionId: number): Promise<CursoEmpleadoItem[]> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/asignaciones/${asignacionId}/cursos-extra`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return res.json();
}

export async function asignarCursoExtra(perfilId: number, asignacionId: number, cursoId: number, sesionId?: number | null): Promise<CursoEmpleadoItem> {
  const payload: Record<string, unknown> = { curso_id: cursoId };
  if (sesionId) payload.sesion_id = sesionId;
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/asignaciones/${asignacionId}/cursos-extra`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return res.json();
}

export async function eliminarCursoExtra(perfilId: number, asignacionId: number, cursoEmpleadoId: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/asignaciones/${asignacionId}/cursos-extra/${cursoEmpleadoId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
}

// ── Puestos y empleados de un curso ────────────────────────────────────────

export interface CursoPuestoEmpleado {
  empleado_id: number;
  nombre: string | null;
  no_empleado: string | null;
}

export interface CursoPuestoDetail {
  id: number;
  puesto_perfil_id: number;
  puesto_nombre: string | null;
  puesto_codigo: string | null;
  obligatorio: boolean;
  empleados_count: number;
  empleados: CursoPuestoEmpleado[];
}

export interface CursoEmpleadoDetail {
  id: number;
  empleado_id: number;
  nombre_empleado: string | null;
  no_empleado: string | null;
}

export async function getCursoPuestos(cursoId: number): Promise<CursoPuestoDetail[]> {
  const res = await fetchWithAuth(`/api/v1/level-up/cursos/${cursoId}/puestos`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return res.json();
}

export async function getCursoEmpleadosExtra(cursoId: number): Promise<CursoEmpleadoDetail[]> {
  const res = await fetchWithAuth(`/api/v1/level-up/cursos/${cursoId}/empleados-extra`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return res.json();
}

// ── Sesiones de un curso ──────────────────────────────────────────────────────

export async function getCursoSesiones(cursoId: number): Promise<CursoSesionListResponse> {
  const res = await fetchWithAuth(`/api/v1/level-up/cursos/${cursoId}/sesiones`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return res.json();
}

export async function getCursoSesion(cursoId: number, sesionId: number): Promise<CursoSesion> {
  const res = await fetchWithAuth(`/api/v1/level-up/cursos/${cursoId}/sesiones/${sesionId}`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return res.json();
}

export async function createCursoSesion(cursoId: number, data: CursoSesionCreatePayload): Promise<CursoSesion> {
  const res = await fetchWithAuth(`/api/v1/level-up/cursos/${cursoId}/sesiones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return res.json();
}

export async function updateCursoSesion(cursoId: number, sesionId: number, data: CursoSesionUpdatePayload): Promise<CursoSesion> {
  const res = await fetchWithAuth(`/api/v1/level-up/cursos/${cursoId}/sesiones/${sesionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return res.json();
}

export async function deleteCursoSesion(cursoId: number, sesionId: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/level-up/cursos/${cursoId}/sesiones/${sesionId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
}

// ── Empleados inscritos en sesión ────────────────────────────────────────────

export async function getSesionEmpleados(cursoId: number, sesionId: number): Promise<SesionEmpleadoItem[]> {
  const res = await fetchWithAuth(`/api/v1/level-up/cursos/${cursoId}/sesiones/${sesionId}/empleados`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return res.json();
}

export async function inscribirEmpleadoSesion(cursoId: number, sesionId: number, empleadoId: number): Promise<SesionEmpleadoItem> {
  const res = await fetchWithAuth(`/api/v1/level-up/cursos/${cursoId}/sesiones/${sesionId}/empleados`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ empleado_id: empleadoId }),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return res.json();
}

export async function quitarEmpleadoSesion(cursoId: number, sesionId: number, inscripcionId: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/level-up/cursos/${cursoId}/sesiones/${sesionId}/empleados/${inscripcionId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
}

export type EmpleadoElegible = { id: number; nombre: string | null; no_empleado: string | null; origen: string };

export async function getSesionEmpleadosElegibles(cursoId: number, sesionId: number, q: string): Promise<EmpleadoElegible[]> {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  const res = await fetchWithAuth(`/api/v1/level-up/cursos/${cursoId}/sesiones/${sesionId}/empleados-elegibles?${params.toString()}`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail };
  }
  return res.json();
}
