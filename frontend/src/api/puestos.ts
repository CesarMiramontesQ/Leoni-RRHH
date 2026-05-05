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
    competencias_tecnicas: (p.competencias_tecnicas ?? []) as PerfilPuesto["competencias_tecnicas"],
    habilidades_blandas: (p.habilidades_blandas ?? []) as PerfilPuesto["habilidades_blandas"],
    maquinas_herramientas: (p.maquinas_herramientas ?? []) as PerfilPuesto["maquinas_herramientas"],
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
