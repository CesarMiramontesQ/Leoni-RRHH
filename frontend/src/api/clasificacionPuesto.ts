import { fetchWithAuth } from "./http.ts";
import type {
  CareerPath,
  CareerPathCreatePayload,
  CareerPathUpdatePayload,
  ClasificacionPuestoFetchError,
  DisciplinaPuesto,
  DisciplinaPuestoCreatePayload,
  DisciplinaPuestoUpdatePayload,
  Equivalencia,
  EquivalenciaCreatePayload,
  EquivalenciaUpdatePayload,
  FuncionPuesto,
  FuncionPuestoCreatePayload,
  FuncionPuestoUpdatePayload,
  GlobalGrade,
  GlobalGradeCreatePayload,
  GlobalGradeUpdatePayload,
} from "../dashboard/clasificacionPuesto/types.ts";

const BASE = "/api/v1/clasificacion-puesto";

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

function fail(res: Response, detail: string): never {
  throw { status: res.status, detail } as ClasificacionPuestoFetchError;
}

function mapCareerPath(raw: Record<string, unknown>): CareerPath {
  return {
    id: raw.id as number,
    codigo: (raw.codigo ?? "") as string,
    nombre: (raw.nombre ?? "") as string,
    activo: (raw.activo ?? true) as boolean,
    created_at: (raw.created_at ?? "") as string,
    updated_at: (raw.updated_at ?? "") as string,
  };
}

function mapFuncion(raw: Record<string, unknown>): FuncionPuesto {
  return {
    id: raw.id as number,
    codigo: (raw.codigo ?? "") as string,
    nombre: (raw.nombre ?? "") as string,
    activo: (raw.activo ?? true) as boolean,
    created_at: (raw.created_at ?? "") as string,
    updated_at: (raw.updated_at ?? "") as string,
  };
}

function mapDisciplina(raw: Record<string, unknown>): DisciplinaPuesto {
  return {
    id: raw.id as number,
    funcion_id: (raw.funcion_id ?? 0) as number,
    funcion_nombre: (raw.funcion_nombre ?? null) as string | null,
    nombre: (raw.nombre ?? "") as string,
    codigo: (raw.codigo ?? null) as string | null,
    activo: (raw.activo ?? true) as boolean,
    created_at: (raw.created_at ?? "") as string,
    updated_at: (raw.updated_at ?? "") as string,
  };
}

async function listar<T>(
  url: string,
  map: (raw: Record<string, unknown>) => T,
): Promise<T[]> {
  const res = await fetchWithAuth(url);
  if (!res.ok) fail(res, await readErrorDetail(res));
  const data = await res.json();
  const items = (data.items ?? data) as Record<string, unknown>[];
  return items.map(map);
}

async function mutar<T>(
  url: string,
  method: "POST" | "PATCH",
  payload: unknown,
  map: (raw: Record<string, unknown>) => T,
): Promise<T> {
  const res = await fetchWithAuth(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) fail(res, await readErrorDetail(res));
  return map((await res.json()) as Record<string, unknown>);
}

async function eliminar(url: string): Promise<void> {
  const res = await fetchWithAuth(url, { method: "DELETE" });
  if (!res.ok) fail(res, await readErrorDetail(res));
}

// ── Career Paths ────────────────────────────────────────────────────────────

/** GET /api/v1/clasificacion-puesto/career-paths */
export async function getCareerPaths(opts?: {
  busqueda?: string;
}): Promise<CareerPath[]> {
  const qs = new URLSearchParams({ page: "1", page_size: "100" });
  if (opts?.busqueda?.trim()) qs.set("busqueda", opts.busqueda.trim());
  return listar(`${BASE}/career-paths?${qs}`, mapCareerPath);
}

export async function createCareerPath(
  payload: CareerPathCreatePayload,
): Promise<CareerPath> {
  return mutar(`${BASE}/career-paths`, "POST", payload, mapCareerPath);
}

export async function updateCareerPath(
  id: number,
  payload: CareerPathUpdatePayload,
): Promise<CareerPath> {
  return mutar(`${BASE}/career-paths/${id}`, "PATCH", payload, mapCareerPath);
}

export async function deleteCareerPath(id: number): Promise<void> {
  return eliminar(`${BASE}/career-paths/${id}`);
}

// ── Funciones ───────────────────────────────────────────────────────────────

/** GET /api/v1/clasificacion-puesto/funciones */
export async function getFuncionesPuesto(opts?: {
  busqueda?: string;
}): Promise<FuncionPuesto[]> {
  const qs = new URLSearchParams({ page: "1", page_size: "200" });
  if (opts?.busqueda?.trim()) qs.set("busqueda", opts.busqueda.trim());
  return listar(`${BASE}/funciones?${qs}`, mapFuncion);
}

export async function createFuncionPuesto(
  payload: FuncionPuestoCreatePayload,
): Promise<FuncionPuesto> {
  return mutar(`${BASE}/funciones`, "POST", payload, mapFuncion);
}

export async function updateFuncionPuesto(
  id: number,
  payload: FuncionPuestoUpdatePayload,
): Promise<FuncionPuesto> {
  return mutar(`${BASE}/funciones/${id}`, "PATCH", payload, mapFuncion);
}

export async function deleteFuncionPuesto(id: number): Promise<void> {
  return eliminar(`${BASE}/funciones/${id}`);
}

// ── Disciplinas ─────────────────────────────────────────────────────────────

/** GET /api/v1/clasificacion-puesto/disciplinas */
export async function getDisciplinasPuesto(opts?: {
  funcion_id?: number;
  busqueda?: string;
}): Promise<DisciplinaPuesto[]> {
  const qs = new URLSearchParams({ page: "1", page_size: "500" });
  if (opts?.funcion_id) qs.set("funcion_id", String(opts.funcion_id));
  if (opts?.busqueda?.trim()) qs.set("busqueda", opts.busqueda.trim());
  return listar(`${BASE}/disciplinas?${qs}`, mapDisciplina);
}

export async function createDisciplinaPuesto(
  payload: DisciplinaPuestoCreatePayload,
): Promise<DisciplinaPuesto> {
  return mutar(`${BASE}/disciplinas`, "POST", payload, mapDisciplina);
}

export async function updateDisciplinaPuesto(
  id: number,
  payload: DisciplinaPuestoUpdatePayload,
): Promise<DisciplinaPuesto> {
  return mutar(`${BASE}/disciplinas/${id}`, "PATCH", payload, mapDisciplina);
}

export async function deleteDisciplinaPuesto(id: number): Promise<void> {
  return eliminar(`${BASE}/disciplinas/${id}`);
}

// ── Global Grades ───────────────────────────────────────────────────────────

function mapGlobalGrade(raw: Record<string, unknown>): GlobalGrade {
  return {
    id: raw.id as number,
    codigo: (raw.codigo ?? "") as string,
    nombre: (raw.nombre ?? "") as string,
    descripcion: (raw.descripcion ?? null) as string | null,
    orden: (raw.orden ?? 0) as number,
    activo: (raw.activo ?? true) as boolean,
    created_at: (raw.created_at ?? "") as string,
    updated_at: (raw.updated_at ?? "") as string,
  };
}

/** GET /api/v1/clasificacion-puesto/global-grades */
export async function getGlobalGrades(opts?: {
  busqueda?: string;
}): Promise<GlobalGrade[]> {
  const qs = new URLSearchParams({ page: "1", page_size: "200" });
  if (opts?.busqueda?.trim()) qs.set("busqueda", opts.busqueda.trim());
  return listar(`${BASE}/global-grades?${qs}`, mapGlobalGrade);
}

export async function createGlobalGrade(
  payload: GlobalGradeCreatePayload,
): Promise<GlobalGrade> {
  return mutar(`${BASE}/global-grades`, "POST", payload, mapGlobalGrade);
}

export async function updateGlobalGrade(
  id: number,
  payload: GlobalGradeUpdatePayload,
): Promise<GlobalGrade> {
  return mutar(`${BASE}/global-grades/${id}`, "PATCH", payload, mapGlobalGrade);
}

export async function deleteGlobalGrade(id: number): Promise<void> {
  return eliminar(`${BASE}/global-grades/${id}`);
}

// ── Equivalencias Career Level ↔ Global Grade ───────────────────────────────

function mapEquivalencia(raw: Record<string, unknown>): Equivalencia {
  return {
    id: raw.id as number,
    career_level_id: (raw.career_level_id ?? 0) as number,
    career_level_codigo: (raw.career_level_codigo ?? null) as string | null,
    career_level_nombre: (raw.career_level_nombre ?? null) as string | null,
    career_path_id: (raw.career_path_id ?? null) as number | null,
    career_path_codigo: (raw.career_path_codigo ?? null) as string | null,
    career_path_nombre: (raw.career_path_nombre ?? null) as string | null,
    global_grade_id: (raw.global_grade_id ?? 0) as number,
    global_grade_codigo: (raw.global_grade_codigo ?? null) as string | null,
    global_grade_nombre: (raw.global_grade_nombre ?? null) as string | null,
    activo: (raw.activo ?? true) as boolean,
    created_at: (raw.created_at ?? "") as string,
    updated_at: (raw.updated_at ?? "") as string,
  };
}

/** GET /api/v1/clasificacion-puesto/equivalencias */
export async function getEquivalencias(opts?: {
  career_path_id?: number;
}): Promise<Equivalencia[]> {
  const qs = new URLSearchParams({ page: "1", page_size: "500" });
  if (opts?.career_path_id) qs.set("career_path_id", String(opts.career_path_id));
  return listar(`${BASE}/equivalencias?${qs}`, mapEquivalencia);
}

/**
 * Global grades a los que equivale un career level, ordenados por `orden`.
 *
 * Es una **lista** porque un nivel abarca un tramo: M4 puede ser GG17 y GG18.
 * Vacía no es un error: significa que RH no configuró la equivalencia y el
 * global grade queda libre.
 */
export async function resolverEquivalencia(
  careerLevelId: number,
): Promise<Equivalencia[]> {
  const res = await fetchWithAuth(
    `${BASE}/equivalencias/resolver?career_level_id=${careerLevelId}`,
  );
  if (!res.ok) fail(res, await readErrorDetail(res));
  const data = (await res.json()) as Record<string, unknown>[] | null;
  return (data ?? []).map(mapEquivalencia);
}

export async function createEquivalencia(
  payload: EquivalenciaCreatePayload,
): Promise<Equivalencia> {
  return mutar(`${BASE}/equivalencias`, "POST", payload, mapEquivalencia);
}

export async function updateEquivalencia(
  id: number,
  payload: EquivalenciaUpdatePayload,
): Promise<Equivalencia> {
  return mutar(`${BASE}/equivalencias/${id}`, "PATCH", payload, mapEquivalencia);
}

export async function deleteEquivalencia(id: number): Promise<void> {
  return eliminar(`${BASE}/equivalencias/${id}`);
}
