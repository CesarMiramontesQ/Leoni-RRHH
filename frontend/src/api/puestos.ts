import { fetchWithAuth } from "./http.ts";
import type {
  PerfilPuesto,
  PerfilPuestoListItem,
  PerfilPuestoCreatePayload,
  PerfilPuestoUpdatePayload,
  GenerateAiResponse,
} from "../dashboard/puestos/types.ts";

// ── Error type ────────────────────────────────────────────────────────
export type PuestosFetchError = {
  status: number;
  detail: string;
};

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

function throwIfNotOk(res: Response, detail: string): never {
  const err: PuestosFetchError = { status: res.status, detail };
  throw err;
}

// ── Mapping helper ────────────────────────────────────────────────────
function mapBackendToPerfilPuesto(p: Record<string, unknown>): PerfilPuesto {
  return {
    id: p.id as number,
    codigo: (p.codigo ?? "") as string,
    nombre_puesto: (p.nombre ?? "") as string,
    area: (p.area_nombre ?? "") as string,
    nivel: (p.nivel ?? "") as string,
    recomendaciones_ia: [] as PerfilPuesto["recomendaciones_ia"],
    version: String(p.version ?? "1"),
    ultima_actualizacion: (p.updated_at ?? "") as string,
  };
}

// ── Area option type ──────────────────────────────────────────────────
export type AreaOption = { id: number; label: string };

// ── API functions ─────────────────────────────────────────────────────

/** GET /api/v1/competencias/filter-options — areas disponibles */
export async function getAreasOptions(): Promise<AreaOption[]> {
  const res = await fetchWithAuth("/api/v1/competencias/filter-options");
  if (!res.ok) return [];
  const data = await res.json();
  return (data.areas ?? []).map((a: { id: string; label: string }) => ({
    id: Number(a.id),
    label: a.label,
  }));
}

// ── Resumen tarjetas type ─────────────────────────────────────────────
export type PerfilTarjetaItem = {
  id: number;
  codigo: string;
  nombre: string;
  area_nombre: string | null;
  nivel: string | null;
  personas: number;
  cumplimiento_pct: number;
  brechas: number;
  cursos: number;
  evidencias: number;
};

/** GET /api/v1/puestos-perfil/resumen-tarjetas — metricas para vista tarjetas */
export async function getResumenTarjetas(): Promise<PerfilTarjetaItem[]> {
  const res = await fetchWithAuth("/api/v1/puestos-perfil/resumen-tarjetas");
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  const data = await res.json();
  return data.items ?? [];
}

/** GET /api/v1/puestos-perfil — listado para tabla */
export async function getPerfilesList(): Promise<PerfilPuestoListItem[]> {
  const res = await fetchWithAuth("/api/v1/puestos-perfil");
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  const data = await res.json();
  const items = data.items ?? data;
  return items.map((p: Record<string, unknown>) => ({
    id: p.id as number,
    codigo: p.codigo as string,
    nombre_puesto: (p.nombre ?? "") as string,
    area: (p.area_nombre ?? "") as string,
    nivel: (p.nivel ?? "") as string,
    version: String(p.version ?? "1"),
    ultima_actualizacion: (p.updated_at ?? "") as string,
  }));
}

/** GET /api/v1/puestos-perfil/:id — perfil completo */
export async function getPerfilById(id: number): Promise<PerfilPuesto> {
  const res = await fetchWithAuth(`/api/v1/puestos-perfil/${id}`);
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  const p = await res.json();
  return mapBackendToPerfilPuesto(p);
}

/** POST /api/v1/puestos-perfil — crear perfil */
export async function createPerfil(payload: PerfilPuestoCreatePayload): Promise<PerfilPuesto> {
  const body = {
    nombre: payload.nombre_puesto,
    nivel: payload.nivel || null,
    area_id: payload.area_id || null,
  };
  const res = await fetchWithAuth("/api/v1/puestos-perfil", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return mapBackendToPerfilPuesto(await res.json());
}

/** PUT /api/v1/puestos-perfil/:id — actualizar perfil */
export async function updatePerfil(id: number, payload: PerfilPuestoUpdatePayload): Promise<PerfilPuesto> {
  const body: Record<string, unknown> = {};
  if (payload.nombre_puesto) body.nombre = payload.nombre_puesto;
  if (payload.nivel) body.nivel = payload.nivel;
  if (payload.area_id !== undefined) body.area_id = payload.area_id;
  const res = await fetchWithAuth(`/api/v1/puestos-perfil/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return mapBackendToPerfilPuesto(await res.json());
}

/** DELETE /api/v1/puestos-perfil/:id — eliminar perfil */
export async function deletePerfil(id: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/puestos-perfil/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
}

/** POST /api/v1/puestos-perfil/:id/generar-ia — generar competencias con IA */
export async function generateAi(id: number): Promise<GenerateAiResponse> {
  const res = await fetchWithAuth(`/api/v1/puestos-perfil/${id}/generar-ia`, {
    method: "POST",
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as GenerateAiResponse;
}

// ── Tareas ───────────────────────────────────────────────────────────────────

export type PerfilTarea = { id: number; orden: number; descripcion: string; es_complemento: boolean };

/** GET /api/v1/perfiles/:id/tareas */
export async function getPerfilTareas(perfilId: number): Promise<PerfilTarea[]> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/tareas`);
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as PerfilTarea[];
}

/** POST /api/v1/perfiles/:id/tareas */
export async function createPerfilTarea(
  perfilId: number,
  body: { orden: number; descripcion: string; es_complemento: boolean },
): Promise<PerfilTarea> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/tareas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as PerfilTarea;
}

/** DELETE /api/v1/perfiles/:id/tareas/:tareaId */
export async function deletePerfilTarea(perfilId: number, tareaId: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/tareas/${tareaId}`, {
    method: "DELETE",
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
}

/** PUT /api/v1/perfiles/:id/tareas/reorder */
export async function reorderPerfilTareas(perfilId: number, items: { id: number; orden: number }[]): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/tareas/reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(items),
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
}

// ── Cualificaciones ──────────────────────────────────────────────────────────

export type PerfilCualificacion = { id: number; tipo: string; situacion_deseada: string; comentarios: string | null };

/** GET /api/v1/perfiles/:id/cualificaciones */
export async function getPerfilCualificaciones(perfilId: number): Promise<PerfilCualificacion[]> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/cualificaciones`);
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as PerfilCualificacion[];
}

/** POST /api/v1/perfiles/:id/cualificaciones */
export async function createPerfilCualificacion(
  perfilId: number,
  body: { tipo: string; situacion_deseada: string; comentarios?: string },
): Promise<PerfilCualificacion> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/cualificaciones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as PerfilCualificacion;
}

/** DELETE /api/v1/perfiles/:id/cualificaciones/:cualificacionId */
export async function deletePerfilCualificacion(perfilId: number, cualificacionId: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/cualificaciones/${cualificacionId}`, {
    method: "DELETE",
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
}

// ── Competencias requeridas ──────────────────────────────────────────────────

export type PerfilCompetencia = { id: number; competencia_id: number | null; competencia_nombre: string | null; categoria: string; descripcion: string; orden: number };

/** GET /api/v1/perfiles/:id/competencias */
export async function getPerfilCompetencias(perfilId: number): Promise<PerfilCompetencia[]> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/competencias`);
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as PerfilCompetencia[];
}

/** POST /api/v1/perfiles/:id/competencias */
export async function createPerfilCompetencia(
  perfilId: number,
  body: { competencia_id?: number; categoria: string; descripcion?: string; orden?: number },
): Promise<PerfilCompetencia> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/competencias`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as PerfilCompetencia;
}

/** DELETE /api/v1/perfiles/:id/competencias/:competenciaId */
export async function deletePerfilCompetencia(perfilId: number, competenciaId: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/competencias/${competenciaId}`, {
    method: "DELETE",
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
}

// ── Asignaciones ─────────────────────────────────────────────────────────────

/** POST /api/v1/perfiles/:id/asignaciones */
export async function createPerfilAsignacion(
  perfilId: number,
  body: { puesto_perfil_id: number; empleado_id: number; departamento?: string },
): Promise<unknown> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/asignaciones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return await res.json();
}

/** DELETE /api/v1/perfiles/:id/asignaciones/:asignacionId (soft-delete) */
export async function deletePerfilAsignacion(perfilId: number, asignacionId: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/asignaciones/${asignacionId}`, {
    method: "DELETE",
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
}
