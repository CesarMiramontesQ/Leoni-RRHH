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
    nivel_id: p.nivel_id as number,
    nivel_nombre: (p.nivel_nombre ?? "") as string,
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
  nivel_id: number;
  nivel_nombre: string;
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
export async function getPerfilesList(opts?: {
  area_id?: number;
  page_size?: number;
  page?: number;
  busqueda?: string;
}): Promise<PerfilPuestoListItem[]> {
  const pageSize = Math.min(opts?.page_size ?? 100, 100);
  const qs = new URLSearchParams({
    page: String(opts?.page ?? 1),
    page_size: String(pageSize),
  });
  if (opts?.area_id) qs.set("area_id", String(opts.area_id));
  if (opts?.busqueda?.trim()) qs.set("busqueda", opts.busqueda.trim());
  const res = await fetchWithAuth(`/api/v1/puestos-perfil?${qs}`);
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  const data = await res.json();
  const items = data.items ?? data;
  return items.map((p: Record<string, unknown>) => ({
    id: p.id as number,
    codigo: p.codigo as string,
    nombre_puesto: (p.nombre ?? "") as string,
    area: (p.area_nombre ?? "") as string,
    nivel_id: p.nivel_id as number,
    nivel_nombre: (p.nivel_nombre ?? "") as string,
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
    nivel_id: payload.nivel_id,
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
  if (payload.nivel_id !== undefined) body.nivel_id = payload.nivel_id;
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

export type PerfilTarea = {
  id: number;
  orden: number;
  descripcion: string;
  es_complemento: boolean;
  tarea_catalogo_id: number | null;
  tarea_catalogo_nombre: string | null;
};

/** GET /api/v1/perfiles/:id/tareas */
export async function getPerfilTareas(perfilId: number): Promise<PerfilTarea[]> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/tareas`);
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as PerfilTarea[];
}

/** POST /api/v1/perfiles/:id/tareas */
export async function createPerfilTarea(
  perfilId: number,
  body: { orden: number; descripcion?: string; es_complemento?: boolean; tarea_catalogo_id?: number },
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

export type PerfilCualificacion = {
  id: number;
  puesto_perfil_id?: number;
  cualificacion_catalogo_id: number | null;
  cualificacion_nombre: string;
  tipo_nombre: string;
  metodo_tipo: string;
  metodo_config: Record<string, unknown>;
  opciones: Array<{
    id: number;
    etiqueta: string;
    valor: string;
    orden: number;
    peso: number | null;
  }>;
  criterio_requerido: Record<string, unknown> | null;
  comentarios: string | null;
  created_at?: string;
  updated_at?: string;
};

/** GET /api/v1/perfiles/:id/cualificaciones */
export async function getPerfilCualificaciones(perfilId: number): Promise<PerfilCualificacion[]> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/cualificaciones`);
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as PerfilCualificacion[];
}

/** POST /api/v1/perfiles/:id/cualificaciones */
export async function createPerfilCualificacion(
  perfilId: number,
  body: {
    cualificacion_catalogo_id: number;
    criterio_requerido: Record<string, unknown>;
    comentarios?: string;
  },
): Promise<PerfilCualificacion> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/cualificaciones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as PerfilCualificacion;
}

/** PUT /api/v1/perfiles/:id/cualificaciones/:cualificacionId */
export async function updatePerfilCualificacion(
  perfilId: number,
  cualificacionId: number,
  body: { criterio_requerido?: Record<string, unknown>; comentarios?: string },
): Promise<PerfilCualificacion> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/cualificaciones/${cualificacionId}`, {
    method: "PUT",
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

// ── Competencias requeridas (tabla unificada) ───────────────────────────────

export type PerfilCompetencia = {
  id: number;
  competencia_id: number;
  competencia_nombre: string;
  tipo_competencia_id: number | null;
  tipo_nombre: string | null;
  grado_id: number;
  grado_nombre: string;
  nivel_requerido: number;
  orden: number | null;
};

/** GET /api/v1/perfiles/:id/competencias?grado_id= */
export async function getPerfilCompetencias(
  perfilId: number,
  gradoId: number,
): Promise<PerfilCompetencia[]> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/competencias?grado_id=${gradoId}`);
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as PerfilCompetencia[];
}

/** POST /api/v1/perfiles/:id/competencias — agrega competencia del catálogo */
export async function createPerfilCompetencia(
  perfilId: number,
  body: { competencia_id: number; grado_id: number; nivel_requerido: number },
): Promise<PerfilCompetencia> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/competencias`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as PerfilCompetencia;
}

export type PerfilCompetenciaSyncItem = {
  competencia_id: number;
  nivel_requerido: number;
};

/** PUT /api/v1/perfiles/:id/competencias/sync — sync multi-select por categoría */
export async function syncPerfilCompetencias(
  perfilId: number,
  body: {
    grado_id: number;
    tipo_competencia_id: number;
    competencias: PerfilCompetenciaSyncItem[];
  },
): Promise<PerfilCompetencia[]> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/competencias/sync`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as PerfilCompetencia[];
}

/** PATCH /api/v1/perfiles/:id/competencias/:requisitoId — actualiza nivel requerido */
export async function updatePerfilCompetenciaNivel(
  perfilId: number,
  requisitoId: number,
  nivel_requerido: number,
): Promise<PerfilCompetencia> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/competencias/${requisitoId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nivel_requerido }),
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as PerfilCompetencia;
}

/** PUT /api/v1/perfiles/:id/asignaciones/:asigId/competencias-eval */
export async function syncEvaluacionCompetencias(
  perfilId: number,
  asignacionId: number,
  body: { evaluaciones: { competencia_requisito_id: number; nivel: number }[] },
): Promise<GapAnalysis> {
  const res = await fetchWithAuth(
    `/api/v1/perfiles/${perfilId}/asignaciones/${asignacionId}/competencias-eval`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as GapAnalysis;
}

// ── Gap Analysis / Evaluaciones ──────────────────────────────────────────────

export type GapCualificacion = {
  cualificacion_id: number;
  cualificacion_catalogo_id: number | null;
  cualificacion_nombre: string;
  tipo_nombre: string;
  metodo_tipo: string;
  metodo_config: Record<string, unknown>;
  opciones: PerfilCualificacion["opciones"];
  criterio_requerido: Record<string, unknown> | null;
  criterio_label: string;
  valor_capturado: Record<string, unknown> | null;
  capturado_label: string | null;
  comentarios: string | null;
  evaluado: boolean;
  cumple: boolean | null;
};

export type GapCompetencia = {
  competencia_requisito_id: number;
  competencia_nombre: string;
  tipo_competencia_id: number | null;
  tipo_nombre: string | null;
  nivel_requerido: number;
  situacion_actual: string | null;
  comentarios: string | null;
  evaluado: boolean;
};

export type GapAnalysis = {
  asignacion: { id: number; empleado_id: number; [k: string]: unknown };
  gap_cualificaciones: GapCualificacion[];
  gap_competencias: GapCompetencia[];
  resumen: {
    total_cualificaciones: number;
    evaluadas_cualificaciones: number;
    pendientes_cualificaciones: number;
    total_competencias: number;
    evaluadas_competencias: number;
    pendientes_competencias: number;
  };
};

/** GET /api/v1/perfiles/:perfilId/asignaciones/:asignacionId (gap analysis) */
export async function getAsignacionGap(perfilId: number, asignacionId: number): Promise<GapAnalysis> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/asignaciones/${asignacionId}`);
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as GapAnalysis;
}

export type EvaluacionCualificacionPayload = {
  cualificacion_id: number;
  valor_capturado: Record<string, unknown>;
  comentarios?: string;
};

/** PUT /api/v1/perfiles/:perfilId/asignaciones/:asignacionId (upsert evaluaciones) */
export async function updateEvaluaciones(
  perfilId: number,
  asignacionId: number,
  body: { evaluaciones_cualificacion?: EvaluacionCualificacionPayload[] },
): Promise<GapAnalysis> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/asignaciones/${asignacionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as GapAnalysis;
}

// ── Asignaciones ─────────────────────────────────────────────────────────────

/** POST /api/v1/perfiles/:id/asignaciones */
export async function createPerfilAsignacion(
  perfilId: number,
  body: {
    puesto_perfil_id: number;
    empleado_id: number;
    grado_id: number;
    departamento?: string;
  },
): Promise<unknown> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/asignaciones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return await res.json();
}

/** PATCH /api/v1/perfiles/:id/asignaciones/:asignacionId */
export async function updatePerfilAsignacion(
  perfilId: number,
  asignacionId: number,
  body: { grado_id?: number; departamento?: string },
): Promise<unknown> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/asignaciones/${asignacionId}`, {
    method: "PATCH",
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

// ── Tareas Extra (per-employee) ──────────────────────────────────────────────

export type PerfilTareaExtra = {
  id: number;
  perfil_funciones_id: number;
  tarea_catalogo_id: number;
  tarea_catalogo_nombre: string;
  tarea_catalogo_categoria: string | null;
  created_at: string;
};

/** GET /api/v1/perfiles/:perfilId/asignaciones/:asignacionId/tareas-extra */
export async function getAsignacionTareasExtra(
  perfilId: number,
  asignacionId: number,
): Promise<PerfilTareaExtra[]> {
  const res = await fetchWithAuth(
    `/api/v1/perfiles/${perfilId}/asignaciones/${asignacionId}/tareas-extra`,
  );
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as PerfilTareaExtra[];
}

/** POST /api/v1/perfiles/:perfilId/asignaciones/:asignacionId/tareas-extra */
export async function createAsignacionTareaExtra(
  perfilId: number,
  asignacionId: number,
  body: { tarea_catalogo_id: number },
): Promise<PerfilTareaExtra> {
  const res = await fetchWithAuth(
    `/api/v1/perfiles/${perfilId}/asignaciones/${asignacionId}/tareas-extra`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as PerfilTareaExtra;
}

/** DELETE /api/v1/perfiles/:perfilId/asignaciones/:asignacionId/tareas-extra/:tareaExtraId */
export async function deleteAsignacionTareaExtra(
  perfilId: number,
  asignacionId: number,
  tareaExtraId: number,
): Promise<void> {
  const res = await fetchWithAuth(
    `/api/v1/perfiles/${perfilId}/asignaciones/${asignacionId}/tareas-extra/${tareaExtraId}`,
    { method: "DELETE" },
  );
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
}
