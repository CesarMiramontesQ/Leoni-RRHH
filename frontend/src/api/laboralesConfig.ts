/**
 * Configuración laborales (`/api/v1/laborales-config`): reglas de home office por área
 * y días festivos de la planta. Solo RH con el módulo `laborales-configuracion`.
 */
import { fetchWithAuth } from "./http.ts";

async function readErrorDetail(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const j = JSON.parse(raw) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) {
      const msgs = j.detail
        .map((d) => (d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : ""))
        .filter(Boolean);
      if (msgs.length) return msgs.join(" ");
    }
  } catch {
    /* ignore */
  }
  return raw || res.statusText || "Error";
}

export class LaboralesConfigFetchError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "LaboralesConfigFetchError";
    this.status = status;
  }
}

async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  throw new LaboralesConfigFetchError(res.status, await readErrorDetail(res));
}

export type HomeOfficeReglaAreaItem = {
  area_id: number;
  area_descripcion: string;
  /** null ⇒ el área no tiene regla capturada. */
  dias_permitidos: number | null;
  periodo_semanas: number | null;
  activo: boolean;
  actualizado_en: string | null;
  actualizado_por: string | null;
};

export type HomeOfficeReglasAreaListResponse = {
  items: HomeOfficeReglaAreaItem[];
  total: number;
};

export type HomeOfficeReglaAreaUpdate = {
  dias_permitidos: number;
  periodo_semanas: number;
  activo: boolean;
};

const BASE = "/api/v1/laborales-config/home-office/areas";

export async function getHomeOfficeReglasArea(): Promise<HomeOfficeReglasAreaListResponse> {
  const res = await fetchWithAuth(BASE);
  await throwIfNotOk(res);
  return (await res.json()) as HomeOfficeReglasAreaListResponse;
}

export async function guardarHomeOfficeReglaArea(
  areaId: number,
  body: HomeOfficeReglaAreaUpdate,
): Promise<HomeOfficeReglaAreaItem> {
  const res = await fetchWithAuth(`${BASE}/${areaId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await throwIfNotOk(res);
  return (await res.json()) as HomeOfficeReglaAreaItem;
}

// ── Días festivos ────────────────────────────────────────────────────────────

export type DiaFestivoItem = {
  id: number;
  /** ISO yyyy-mm-dd */
  fecha: string;
  descripcion: string;
  activo: boolean;
  actualizado_en: string | null;
  actualizado_por: string | null;
};

export type DiasFestivosListResponse = { anio: number; items: DiaFestivoItem[]; total: number };

export type DiaFestivoGuardadoResponse = {
  item: DiaFestivoItem;
  /** Solicitudes vivas de vacaciones/HO que incluyen la fecha. No se recalculan. */
  solicitudes_afectadas: number;
};

export type DiasFestivosCargaOficialesResponse = {
  anio: number;
  agregados: DiaFestivoItem[];
  omitidos: number;
};

const FESTIVOS = "/api/v1/laborales-config/dias-festivos";

export async function getDiasFestivos(anio: number): Promise<DiasFestivosListResponse> {
  const res = await fetchWithAuth(`${FESTIVOS}?anio=${anio}`);
  await throwIfNotOk(res);
  return (await res.json()) as DiasFestivosListResponse;
}

export async function crearDiaFestivo(body: {
  fecha: string;
  descripcion: string;
}): Promise<DiaFestivoGuardadoResponse> {
  const res = await fetchWithAuth(FESTIVOS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await throwIfNotOk(res);
  return (await res.json()) as DiaFestivoGuardadoResponse;
}

export async function actualizarDiaFestivo(
  id: number,
  body: { descripcion: string; activo: boolean },
): Promise<DiaFestivoGuardadoResponse> {
  const res = await fetchWithAuth(`${FESTIVOS}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await throwIfNotOk(res);
  return (await res.json()) as DiaFestivoGuardadoResponse;
}

export async function cargarDiasFestivosOficiales(
  anio: number,
): Promise<DiasFestivosCargaOficialesResponse> {
  const res = await fetchWithAuth(`${FESTIVOS}/cargar-oficiales`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ anio }),
  });
  await throwIfNotOk(res);
  return (await res.json()) as DiasFestivosCargaOficialesResponse;
}

export function laboralesConfigErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof LaboralesConfigFetchError) return error.message || fallback;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
