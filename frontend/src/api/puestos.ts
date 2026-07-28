import { fetchWithAuth } from "./http.ts";
import type {
  ClasificacionHistorialItem,
  ClasificacionPerfil,
  EstadoPuestoPerfil,
  GradoPerfilItem,
  PerfilPuesto,
  PerfilPuestoListItem,
  PerfilPuestoCreatePayload,
  PerfilPuestoUpdatePayload,
  GenerateAiResponse,
  TipoPuestoPerfil,
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

function mapTipoPuestoPerfil(value: unknown): TipoPuestoPerfil {
  return value === "operativo" ? "operativo" : "administrativo";
}

function mapGrados(raw: unknown): GradoPerfilItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((g) => {
      const item = g as Record<string, unknown>;
      return {
        id: item.id as number,
        nombre: String(item.nombre ?? ""),
        orden: Number(item.orden ?? 0),
        codigo: (item.codigo ?? null) as string | null,
        career_path_codigo: (item.career_path_codigo ?? null) as string | null,
      };
    })
    .sort((a, b) => a.orden - b.orden);
}

/** Campos de clasificación organizacional, compartidos por listado y detalle. */
function mapClasificacion(p: Record<string, unknown>): ClasificacionPerfil {
  return {
    career_path_id: (p.career_path_id as number | null) ?? null,
    career_path_codigo: (p.career_path_codigo as string | null) ?? null,
    career_path_nombre: (p.career_path_nombre as string | null) ?? null,
    funcion_id: (p.funcion_id as number | null) ?? null,
    funcion_nombre: (p.funcion_nombre as string | null) ?? null,
    disciplina_id: (p.disciplina_id as number | null) ?? null,
    disciplina_nombre: (p.disciplina_nombre as string | null) ?? null,
    global_grade_id: (p.global_grade_id as number | null) ?? null,
    global_grade_codigo: (p.global_grade_codigo as string | null) ?? null,
    global_grade_nombre: (p.global_grade_nombre as string | null) ?? null,
    estado: ((p.estado as EstadoPuestoPerfil) ?? "activo"),
    clasificacion_completa: Boolean(p.clasificacion_completa),
    clasificado_por: (p.clasificado_por as string | null) ?? null,
    clasificado_en: (p.clasificado_en as string | null) ?? null,
  };
}

// ── Mapping helper ────────────────────────────────────────────────────
function mapBackendToPerfilPuesto(p: Record<string, unknown>): PerfilPuesto {
  return {
    id: p.id as number,
    codigo: (p.codigo ?? "") as string,
    nombre_puesto: (p.nombre ?? "") as string,
    area: (p.area_nombre ?? "") as string,
    area_id: (p.area_id as number | null) ?? null,
    grados: mapGrados(p.grados),
    tipo: mapTipoPuestoPerfil(p.tipo),
    recomendaciones_ia: [] as PerfilPuesto["recomendaciones_ia"],
    version: String(p.version ?? "1"),
    ultima_actualizacion: (p.updated_at ?? "") as string,
    ...mapClasificacion(p),
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
  grados: { id: number; nombre: string; orden: number }[];
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
  grado_id?: number;
  page_size?: number;
  page?: number;
  busqueda?: string;
  career_path_id?: number;
  funcion_id?: number;
  disciplina_id?: number;
  global_grade_id?: number;
  estado?: string;
  clasificacion_pendiente?: boolean;
}): Promise<PerfilPuestoListItem[]> {
  const pageSize = Math.min(opts?.page_size ?? 100, 100);
  const qs = new URLSearchParams({
    page: String(opts?.page ?? 1),
    page_size: String(pageSize),
  });
  if (opts?.area_id) qs.set("area_id", String(opts.area_id));
  if (opts?.grado_id) qs.set("grado_id", String(opts.grado_id));
  if (opts?.busqueda?.trim()) qs.set("busqueda", opts.busqueda.trim());
  if (opts?.career_path_id) qs.set("career_path_id", String(opts.career_path_id));
  if (opts?.funcion_id) qs.set("funcion_id", String(opts.funcion_id));
  if (opts?.disciplina_id) qs.set("disciplina_id", String(opts.disciplina_id));
  if (opts?.global_grade_id) qs.set("global_grade_id", String(opts.global_grade_id));
  if (opts?.estado) qs.set("estado", opts.estado);
  if (opts?.clasificacion_pendiente) qs.set("clasificacion_pendiente", "true");
  const res = await fetchWithAuth(`/api/v1/puestos-perfil?${qs}`);
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  const data = await res.json();
  const items = data.items ?? data;
  return items.map((p: Record<string, unknown>) => ({
    id: p.id as number,
    codigo: p.codigo as string,
    nombre_puesto: (p.nombre ?? "") as string,
    area: (p.area_nombre ?? "") as string,
    area_id: (p.area_id as number | null) ?? null,
    grados: mapGrados(p.grados),
    tipo: mapTipoPuestoPerfil(p.tipo),
    version: String(p.version ?? "1"),
    ultima_actualizacion: (p.updated_at ?? "") as string,
    ...mapClasificacion(p),
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
  const body: Record<string, unknown> = {
    codigo: payload.codigo,
    nombre: payload.nombre_puesto,
    area_id: payload.area_id,
    grado_ids: payload.grado_ids,
    career_path_id: payload.career_path_id,
    funcion_id: payload.funcion_id,
    disciplina_id: payload.disciplina_id,
  };
  // Solo se envía si el global level no tiene equivalencia configurada: si la
  // tiene, el backend lo resuelve desde ahí.
  if (payload.global_grade_id) body.global_grade_id = payload.global_grade_id;
  if (payload.estado) body.estado = payload.estado;
  if (payload.motivo_clasificacion) {
    body.motivo_clasificacion = payload.motivo_clasificacion;
  }
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
  if (payload.codigo) body.codigo = payload.codigo;
  if (payload.nombre_puesto) body.nombre = payload.nombre_puesto;
  if (payload.grado_ids !== undefined) body.grado_ids = payload.grado_ids;
  if (payload.area_id !== undefined) body.area_id = payload.area_id;
  // `tipo` viajaba en el payload del modal de detalle pero nunca se copiaba al
  // body: el cambio se perdía en silencio.
  if (payload.tipo !== undefined) body.tipo = payload.tipo;
  if (payload.career_path_id !== undefined) body.career_path_id = payload.career_path_id;
  if (payload.funcion_id !== undefined) body.funcion_id = payload.funcion_id;
  if (payload.disciplina_id !== undefined) body.disciplina_id = payload.disciplina_id;
  if (payload.global_grade_id !== undefined) {
    body.global_grade_id = payload.global_grade_id;
  }
  if (payload.estado !== undefined) body.estado = payload.estado;
  if (payload.motivo_clasificacion !== undefined) {
    body.motivo_clasificacion = payload.motivo_clasificacion;
  }
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

/** Valores fijos validados en backend; no son catálogo editable. */
export type PrioridadTarea = "alta" | "media" | "baja";
export type FrecuenciaTarea =
  | "diaria"
  | "semanal"
  | "mensual"
  | "trimestral"
  | "anual"
  | "eventual";

export type PerfilTarea = {
  id: number;
  orden: number;
  descripcion: string;
  es_complemento: boolean;
  tarea_catalogo_id: number | null;
  tarea_catalogo_nombre: string | null;
  grado_id: number | null;
  grado_nombre: string | null;
  es_general: boolean;
  categoria_tarea_id: number | null;
  categoria_tarea_nombre: string | null;
  prioridad: PrioridadTarea | null;
  frecuencia: FrecuenciaTarea | null;
  /** Porcentaje del tiempo del puesto. La suma no es bloqueante. */
  porcentaje_dedicacion: number | null;
};

/** Suma de dedicación de un alcance del perfil (general o un global level). */
export type DedicacionAlcance = {
  grado_id: number | null;
  grado_nombre: string | null;
  es_general: boolean;
  total_porcentaje: number;
  tareas_con_porcentaje: number;
  tareas_sin_porcentaje: number;
};

/** GET /api/v1/perfiles/:id/tareas/dedicacion */
export async function getDedicacionPerfil(
  perfilId: number,
): Promise<DedicacionAlcance[]> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/tareas/dedicacion`);
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as DedicacionAlcance[];
}

/** GET /api/v1/perfiles/:id/tareas */
export async function getPerfilTareas(
  perfilId: number,
  opts?: { grado_id?: number },
): Promise<PerfilTarea[]> {
  const qs = new URLSearchParams();
  if (opts?.grado_id) qs.set("grado_id", String(opts.grado_id));
  const suffix = qs.toString() ? `?${qs}` : "";
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/tareas${suffix}`);
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as PerfilTarea[];
}

/** POST /api/v1/perfiles/:id/tareas */
export async function createPerfilTarea(
  perfilId: number,
  body: {
    orden: number;
    descripcion?: string;
    es_complemento?: boolean;
    tarea_catalogo_id?: number;
    grado_id?: number | null;
    categoria_tarea_id?: number | null;
    prioridad?: PrioridadTarea | null;
    frecuencia?: FrecuenciaTarea | null;
    porcentaje_dedicacion?: number | null;
  },
): Promise<PerfilTarea> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/tareas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as PerfilTarea;
}

/** PUT /api/v1/perfiles/:id/tareas/:tareaId */
export async function updatePerfilTarea(
  perfilId: number,
  tareaId: number,
  body: {
    descripcion?: string;
    orden?: number;
    es_complemento?: boolean;
    grado_id?: number | null;
    categoria_tarea_id?: number | null;
    prioridad?: PrioridadTarea | null;
    frecuencia?: FrecuenciaTarea | null;
    porcentaje_dedicacion?: number | null;
  },
): Promise<PerfilTarea> {
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/tareas/${tareaId}`, {
    method: "PUT",
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
  categoria: string | null;
  grupo_nombre: string | null;
  grado_id: number | null;
  grado_nombre: string | null;
  es_general: boolean;
  nivel_requerido: number;
  /** Qué acredita el nivel requerido en este puesto. Opcional. */
  evidencia: string | null;
  orden: number | null;
};

/** GET /api/v1/perfiles/:id/competencias — con grado_id: específicas + generales */
export async function getPerfilCompetencias(
  perfilId: number,
  gradoId?: number | null,
): Promise<PerfilCompetencia[]> {
  const qs = new URLSearchParams();
  if (gradoId != null) qs.set("grado_id", String(gradoId));
  const suffix = qs.toString() ? `?${qs}` : "";
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/competencias${suffix}`);
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as PerfilCompetencia[];
}

/** POST /api/v1/perfiles/:id/competencias — agrega competencia del catálogo */
export async function createPerfilCompetencia(
  perfilId: number,
  body: {
    competencia_id: number;
    grado_id?: number | null;
    nivel_requerido: number;
    evidencia?: string | null;
  },
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
  /** Omitir para conservar la evidencia ya capturada. */
  evidencia?: string | null;
};

/** PUT /api/v1/perfiles/:id/competencias/sync — sync multi-select por categoría */
export async function syncPerfilCompetencias(
  perfilId: number,
  body: {
    grado_id?: number | null;
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

/**
 * PATCH /api/v1/perfiles/:id/competencias/:requisitoId
 *
 * Actualiza el nivel requerido y, si se pasa, la evidencia. Omitir `evidencia`
 * conserva la ya capturada.
 */
export async function updatePerfilCompetenciaNivel(
  perfilId: number,
  requisitoId: number,
  nivel_requerido: number,
  evidencia?: string | null,
): Promise<PerfilCompetencia> {
  const body: Record<string, unknown> = { nivel_requerido };
  if (evidencia !== undefined) body.evidencia = evidencia;
  const res = await fetchWithAuth(`/api/v1/perfiles/${perfilId}/competencias/${requisitoId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
/** Empleado activo sin asignación de perfil, para el buscador del modal de asignar. */
export type EmpleadoDisponible = {
  id: number;
  no_empleado: number;
  nombre: string;
  area: { descripcion: string } | null;
};

/** GET /api/v1/perfiles/empleados-disponibles?q= — busca empleados activos no asignados */
export async function buscarEmpleadosDisponiblesPerfil(q: string): Promise<EmpleadoDisponible[]> {
  const res = await fetchWithAuth(
    `/api/v1/perfiles/empleados-disponibles?q=${encodeURIComponent(q)}`,
  );
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return await res.json();
}

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

/**
 * POST /api/v1/perfiles/:id/asignaciones/:asignacionId/firmar
 * Registra el acuse (firma). El backend decide superior vs empleado según el rol del usuario:
 * rh/supervisor → firma del superior; el propio empleado → firma del empleado.
 */
export async function firmarAcuseAsignacion(
  perfilId: number,
  asignacionId: number,
  body: {
    fecha_firma_superior?: string;
    firma_superior_id?: string;
    fecha_firma_empleado?: string;
    firma_empleado_id?: string;
  },
): Promise<unknown> {
  const res = await fetchWithAuth(
    `/api/v1/perfiles/${perfilId}/asignaciones/${asignacionId}/firmar`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return await res.json();
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

/**
 * GET /api/v1/puestos-perfil/:id/clasificacion-historial
 *
 * Bitácora de la clasificación organizacional, del evento más reciente al más
 * antiguo. Cada uno trae el diff (campo, valor anterior, valor nuevo).
 */
export async function getClasificacionHistorial(
  id: number,
): Promise<ClasificacionHistorialItem[]> {
  const res = await fetchWithAuth(
    `/api/v1/puestos-perfil/${id}/clasificacion-historial`,
  );
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  const data = await res.json();
  return (data.items ?? []) as ClasificacionHistorialItem[];
}
