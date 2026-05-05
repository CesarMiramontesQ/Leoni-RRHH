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
  return (await res.json()) as Competencia[];
}

/** GET /api/v1/competencias/:id */
export async function getCompetenciaById(id: number): Promise<Competencia> {
  const res = await fetchWithAuth(`/api/v1/competencias/${id}`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as CompetenciasFetchError;
  }
  return (await res.json()) as Competencia;
}

/** POST /api/v1/competencias */
export async function createCompetencia(payload: CompetenciaCreatePayload): Promise<Competencia> {
  const res = await fetchWithAuth("/api/v1/competencias", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as CompetenciasFetchError;
  }
  return (await res.json()) as Competencia;
}

/** PUT /api/v1/competencias/:id */
export async function updateCompetencia(id: number, payload: CompetenciaUpdatePayload): Promise<Competencia> {
  const res = await fetchWithAuth(`/api/v1/competencias/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as CompetenciasFetchError;
  }
  return (await res.json()) as Competencia;
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
  return (await res.json()) as MatrizDataResponse;
}

/** PUT /api/v1/competencias/matriz — guardado masivo de celdas editadas */
export async function updateMatrizBulk(payload: MatrizBulkUpdatePayload): Promise<MatrizDataResponse> {
  const res = await fetchWithAuth("/api/v1/competencias/matriz", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as CompetenciasFetchError;
  }
  return (await res.json()) as MatrizDataResponse;
}

// ── Resumen y brechas ─────────────────────────────────────────────────

/** GET /api/v1/competencias/resumen?area_id= */
export async function getResumen(area_id?: string): Promise<MatrizResumen> {
  const qs = area_id ? `?area_id=${encodeURIComponent(area_id)}` : "";
  const res = await fetchWithAuth(`/api/v1/competencias/resumen${qs}`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as CompetenciasFetchError;
  }
  return (await res.json()) as MatrizResumen;
}

/** GET /api/v1/competencias/brechas?area_id= */
export async function getBrechas(area_id?: string): Promise<BrechaItem[]> {
  const qs = area_id ? `?area_id=${encodeURIComponent(area_id)}` : "";
  const res = await fetchWithAuth(`/api/v1/competencias/brechas${qs}`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as CompetenciasFetchError;
  }
  return (await res.json()) as BrechaItem[];
}
