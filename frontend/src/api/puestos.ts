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

// ── API functions ─────────────────────────────────────────────────────

/** GET /api/v1/puestos/perfiles — listado para tabla */
export async function getPerfilesList(): Promise<PerfilPuestoListItem[]> {
  const res = await fetchWithAuth("/api/v1/puestos/perfiles");
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as PerfilPuestoListItem[];
}

/** GET /api/v1/puestos/perfiles/:id — perfil completo */
export async function getPerfilById(id: number): Promise<PerfilPuesto> {
  const res = await fetchWithAuth(`/api/v1/puestos/perfiles/${id}`);
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as PerfilPuesto;
}

/** POST /api/v1/puestos/perfiles — crear perfil */
export async function createPerfil(payload: PerfilPuestoCreatePayload): Promise<PerfilPuesto> {
  const res = await fetchWithAuth("/api/v1/puestos/perfiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as PerfilPuesto;
}

/** PUT /api/v1/puestos/perfiles/:id — actualizar perfil */
export async function updatePerfil(id: number, payload: PerfilPuestoUpdatePayload): Promise<PerfilPuesto> {
  const res = await fetchWithAuth(`/api/v1/puestos/perfiles/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as PerfilPuesto;
}

/** DELETE /api/v1/puestos/perfiles/:id — eliminar perfil */
export async function deletePerfil(id: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/puestos/perfiles/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
}

/** POST /api/v1/puestos/perfiles/:id/generate-ai — generar competencias con IA */
export async function generateAi(id: number): Promise<GenerateAiResponse> {
  const res = await fetchWithAuth(`/api/v1/puestos/perfiles/${id}/generate-ai`, {
    method: "POST",
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as GenerateAiResponse;
}
