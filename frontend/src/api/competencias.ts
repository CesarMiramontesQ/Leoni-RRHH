import { fetchWithAuth } from "./http.ts";
import type {
  CeldaMatriz,
  Competencia,
  CompetenciaCreatePayload,
  CompetenciaFila,
  CompetenciasFilterOptions,
  CompetenciaUpdatePayload,
  GapCritico,
  BrechaItem,
  MatrizResumen,
  NivelMatriz,
  PuestoColumna,
  AuditoriaInfo,
} from "../dashboard/competencias/types.ts";

// ── Error type ────────────────────────────────────────────────────────
export type CompetenciasFetchError = {
  status: number;
  detail: string;
};

// ── Response types ────────────────────────────────────────────────────
export type MatrizDataResponse = {
  puestos: PuestoColumna[];
  competencias: CompetenciaFila[];
  celdas: CeldaMatriz[];
  resumen: MatrizResumen;
  gaps: GapCritico[];
  auditoria: AuditoriaInfo | null;
};

// ── Request types ─────────────────────────────────────────────────────
export type MatrizBulkUpdatePayload = {
  cambios: Array<{
    competencia_id: string;
    puesto_id: string;
    nivel: NivelMatriz;
  }>;
};

// ── Error helper ──────────────────────────────────────────────────────
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

// ── Catalogo CRUD ─────────────────────────────────────────────────────

/** GET /api/v1/competencias — listado de competencias del catalogo */
export async function getCompetencias(): Promise<Competencia[]> {
  const res = await fetchWithAuth("/api/v1/competencias");
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as CompetenciasFetchError;
  }
  const data = await res.json();
  const items = data.items ?? data;
  return (items as Record<string, unknown>[]).map((c) => ({
    id: c.id as number,
    nombre: (c.nombre ?? "") as string,
    grupo: (c.categoria === "blanda" ? "habilidad_blanda" : "tecnica") as Competencia["grupo"],
    descripcion: (c.descripcion ?? "") as string,
    activa: (c.activo ?? true) as boolean,
    created_at: (c.created_at ?? "") as string,
  }));
}

/** GET /api/v1/competencias/:id */
export async function getCompetenciaById(id: number): Promise<Competencia> {
  const res = await fetchWithAuth(`/api/v1/competencias/${id}`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as CompetenciasFetchError;
  }
  const c = await res.json();
  return {
    id: c.id,
    nombre: c.nombre ?? "",
    grupo: c.categoria === "blanda" ? "habilidad_blanda" : "tecnica",
    descripcion: c.descripcion ?? "",
    activa: c.activo ?? true,
    created_at: c.created_at ?? "",
  };
}

/** POST /api/v1/competencias */
export async function createCompetencia(payload: CompetenciaCreatePayload): Promise<Competencia> {
  const body = {
    nombre: payload.nombre,
    descripcion: payload.descripcion,
    categoria: payload.grupo === "habilidad_blanda" ? "blanda" : "tecnica",
  };
  const res = await fetchWithAuth("/api/v1/competencias", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as CompetenciasFetchError;
  }
  const c = await res.json();
  return {
    id: c.id,
    nombre: c.nombre ?? "",
    grupo: c.categoria === "blanda" ? "habilidad_blanda" : "tecnica",
    descripcion: c.descripcion ?? "",
    activa: c.activo ?? true,
    created_at: c.created_at ?? "",
  };
}

/** PUT /api/v1/competencias/:id */
export async function updateCompetencia(id: number, payload: CompetenciaUpdatePayload): Promise<Competencia> {
  const body: Record<string, unknown> = {};
  if (payload.nombre !== undefined) body.nombre = payload.nombre;
  if (payload.descripcion !== undefined) body.descripcion = payload.descripcion;
  if (payload.grupo !== undefined) body.categoria = payload.grupo === "habilidad_blanda" ? "blanda" : "tecnica";
  const res = await fetchWithAuth(`/api/v1/competencias/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as CompetenciasFetchError;
  }
  const c = await res.json();
  return {
    id: c.id,
    nombre: c.nombre ?? "",
    grupo: c.categoria === "blanda" ? "habilidad_blanda" : "tecnica",
    descripcion: c.descripcion ?? "",
    activa: c.activo ?? true,
    created_at: c.created_at ?? "",
  };
}

/** DELETE /api/v1/competencias/:id */
export async function deleteCompetencia(id: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/competencias/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as CompetenciasFetchError;
  }
}

// ── Matriz ────────────────────────────────────────────────────────────

/** GET /api/v1/competencias/filter-options */
export async function getCompetenciasFilterOptions(): Promise<CompetenciasFilterOptions> {
  const res = await fetchWithAuth("/api/v1/competencias/filter-options");
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as CompetenciasFetchError;
  }
  return (await res.json()) as CompetenciasFilterOptions;
}

/** GET /api/v1/competencias/matriz?area_id=&linea_id=&sector_id= */
export async function getMatrizData(params: {
  area_id: string;
  linea_id: string;
  sector_id: string;
}): Promise<MatrizDataResponse> {
  const qs = new URLSearchParams();
  if (params.area_id) qs.set("area_id", params.area_id);
  if (params.linea_id) qs.set("linea_id", params.linea_id);
  if (params.sector_id) qs.set("sector_id", params.sector_id);
  const url = `/api/v1/competencias/matriz${qs.toString() ? `?${qs.toString()}` : ""}`;
  const res = await fetchWithAuth(url);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as CompetenciasFetchError;
  }
  const raw = await res.json();

  // Transform backend MatrizResponse → frontend MatrizDataResponse
  const puestos: PuestoColumna[] = (raw.puestos ?? []).map((p: Record<string, unknown>) => ({
    id: String(p.id),
    nombre: (p.nombre ?? "") as string,
  }));

  const competencias: CompetenciaFila[] = (raw.competencias ?? []).map((c: Record<string, unknown>) => ({
    id: String(c.competencia_id),
    nombre: (c.competencia_nombre ?? "") as string,
    grupo: (c.categoria === "blanda" ? "habilidad_blanda" : "tecnica") as "tecnica" | "habilidad_blanda",
  }));

  const celdas: CeldaMatriz[] = [];
  for (const row of raw.competencias ?? []) {
    const niveles = (row as Record<string, unknown>).niveles as Record<string, number> | undefined;
    if (niveles) {
      for (const [puestoId, nivel] of Object.entries(niveles)) {
        celdas.push({
          competencia_id: String((row as Record<string, unknown>).competencia_id),
          puesto_id: String(puestoId),
          nivel: nivel as CeldaMatriz["nivel"],
        });
      }
    }
  }

  return {
    puestos,
    competencias,
    celdas,
    resumen: { porcentaje_cumplimiento: 0, total_empleados: 0, total_requisitos: celdas.length },
    gaps: [],
    auditoria: null,
  };
}

/** PUT /api/v1/competencias/matriz — guardado masivo de celdas editadas */
export async function updateMatrizBulk(payload: MatrizBulkUpdatePayload): Promise<{ actualizados: number; errores: string[] }> {
  const body = {
    celdas: payload.cambios.map((c) => ({
      competencia_id: Number(c.competencia_id),
      puesto_perfil_id: Number(c.puesto_id),
      nivel_requerido: c.nivel,
    })),
  };
  const res = await fetchWithAuth("/api/v1/competencias/matriz", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as CompetenciasFetchError;
  }
  return (await res.json()) as { actualizados: number; errores: string[] };
}

// ── Resumen y brechas ─────────────────────────────────────────────────

/** GET /api/v1/competencias/resumen-area?area_id= */
export async function getResumen(area_id?: string): Promise<MatrizResumen> {
  const qs = area_id ? `?area_id=${encodeURIComponent(area_id)}` : "";
  const res = await fetchWithAuth(`/api/v1/competencias/resumen-area${qs}`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as CompetenciasFetchError;
  }
  const raw = await res.json();
  return {
    porcentaje_cumplimiento: raw.cumplimiento_porcentaje ?? 0,
    total_empleados: raw.total_empleados ?? 0,
    total_requisitos: raw.requisitos_activos ?? 0,
  };
}

/** GET /api/v1/competencias/brechas?area_id= */
export async function getBrechas(area_id?: string): Promise<BrechaItem[]> {
  const qs = area_id ? `?area_id=${encodeURIComponent(area_id)}` : "";
  const res = await fetchWithAuth(`/api/v1/competencias/brechas${qs}`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as CompetenciasFetchError;
  }
  const raw = await res.json();
  const brechas = raw.brechas ?? raw;
  return (brechas as Record<string, unknown>[]).map((b) => ({
    competencia_nombre: (b.competencia_nombre ?? "") as string,
    puesto_nombre: "",
    nivel_actual_promedio: 0,
    nivel_requerido: (b.nivel_requerido_promedio ?? 0) as BrechaItem["nivel_requerido"],
    porcentaje_brecha: (b.gap_porcentaje ?? 0) as number,
    empleados_afectados: (b.empleados_afectados ?? 0) as number,
    severidad: ((b.gap_porcentaje as number) >= 80 ? "critica" : (b.gap_porcentaje as number) >= 60 ? "alta" : (b.gap_porcentaje as number) >= 40 ? "media" : "baja") as BrechaItem["severidad"],
  }));
}
