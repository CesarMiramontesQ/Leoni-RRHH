import { fetchWithAuth } from "./http.ts";

export type ComedorApiError = {
  status: number;
  detail: string;
};

export type ComedorApiItem = {
  id: number;
  nombre: string;
  ubicacion: string | null;
  capacidad: number | null;
  activo: boolean;
};

export type MenuSemanalApiItem = {
  id: number;
  comedor_id: number;
  semana: string;
  dia: string;
  tipo: string;
  descripcion: string | null;
  foto_path: string | null;
  created_by: number;
  created_at: string;
};

export type ComedorEstadisticasApi = {
  semana: string;
  total_registros: number;
  normal: number;
  dieta: number;
  acceso_concedido: number;
};

export type ComedorProyeccionesApi = {
  ultimas_4_semanas: Record<string, { normal: number; dieta: number }>;
  promedio_semanal: number;
};

async function readErrorDetail(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const parsed = JSON.parse(raw) as { detail?: unknown };
    if (typeof parsed.detail === "string" && parsed.detail.trim()) return parsed.detail.trim();
  } catch {
    /* noop */
  }
  return raw || res.statusText || "Error";
}

function throwComedorError(status: number, detail: string): never {
  throw { status, detail } as ComedorApiError;
}

export async function getComedoresActivos(): Promise<ComedorApiItem[]> {
  const res = await fetchWithAuth("/api/v1/comedor/comedores");
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorApiItem[];
}

export async function getComedorMenuSemana(
  comedorId: number,
  semanaIso: string,
): Promise<MenuSemanalApiItem[]> {
  const params = new URLSearchParams();
  params.set("comedor_id", String(comedorId));
  params.set("semana", semanaIso);
  const res = await fetchWithAuth(`/api/v1/comedor/menu?${params.toString()}`);
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as MenuSemanalApiItem[];
}

export async function registrarComedorSeleccion(payload: {
  comedorId: number;
  semanaIso: string;
  tipoPlatillo: string;
}): Promise<void> {
  const res = await fetchWithAuth("/api/v1/comedor/registro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      comedor_id: payload.comedorId,
      semana: payload.semanaIso,
      tipo_platillo: payload.tipoPlatillo,
    }),
  });
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
}

export async function publicarComedorMenu(payload: {
  comedorId: number;
  semanaIso: string;
  dia: string;
  tipo: string;
  descripcion: string;
}): Promise<void> {
  const res = await fetchWithAuth("/api/v1/comedor/menu", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      comedor_id: payload.comedorId,
      semana: payload.semanaIso,
      dia: payload.dia,
      tipo: payload.tipo,
      descripcion: payload.descripcion || null,
    }),
  });
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
}

export async function getComedorEstadisticas(semanaIso?: string): Promise<ComedorEstadisticasApi> {
  const params = new URLSearchParams();
  if (semanaIso) params.set("semana", semanaIso);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await fetchWithAuth(`/api/v1/comedor/estadisticas${suffix}`);
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorEstadisticasApi;
}

export async function getComedorProyecciones(): Promise<ComedorProyeccionesApi> {
  const res = await fetchWithAuth("/api/v1/comedor/proyecciones");
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorProyeccionesApi;
}
