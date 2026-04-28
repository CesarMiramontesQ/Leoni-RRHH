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
    const d = parsed.detail;
    if (typeof d === "string" && d.trim()) return d.trim();
    if (Array.isArray(d)) {
      const parts = d
        .map((item) => {
          if (item && typeof item === "object" && "msg" in item) {
            return String((item as { msg: unknown }).msg).trim();
          }
          return "";
        })
        .filter(Boolean);
      if (parts.length) return parts.join("; ");
    }
  } catch {
    /* noop */
  }
  return raw?.trim() || res.statusText || "Error";
}

function throwComedorError(status: number, detail: string): never {
  throw { status, detail } as ComedorApiError;
}

export function isComedorApiError(value: unknown): value is ComedorApiError {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ComedorApiError>;
  return typeof candidate.status === "number" && typeof candidate.detail === "string";
}

/** Mensaje legible para toasts y UI (incluye respuestas `{ status, detail }` del API comedor). */
export function comedorErrorMessage(
  value: unknown,
  fallback = "No se pudo completar la operación. Intenta de nuevo.",
): string {
  if (isComedorApiError(value) && value.detail.trim()) return value.detail.trim();
  if (value instanceof Error && value.message.trim()) return value.message.trim();
  return fallback;
}

export async function getComedoresActivos(): Promise<ComedorApiItem[]> {
  const res = await fetchWithAuth("/api/v1/comedor/comedores");
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorApiItem[];
}

export async function crearComedor(payload: {
  nombre: string;
  ubicacion: string | null;
  capacidad: number | null;
  activo: boolean;
}): Promise<ComedorApiItem> {
  const res = await fetchWithAuth("/api/v1/comedor/comedores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nombre: payload.nombre,
      ubicacion: payload.ubicacion,
      capacidad: payload.capacidad,
      activo: payload.activo,
    }),
  });
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorApiItem;
}

export async function editarComedor(
  comedorId: number,
  payload: {
    nombre: string;
    ubicacion: string | null;
    capacidad: number | null;
    activo: boolean;
  },
): Promise<ComedorApiItem> {
  const res = await fetchWithAuth(`/api/v1/comedor/comedores/${comedorId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nombre: payload.nombre,
      ubicacion: payload.ubicacion,
      capacidad: payload.capacidad,
      activo: payload.activo,
    }),
  });
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorApiItem;
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

export type ComedorMisReservaApiItem = {
  id: number;
  comedor_id: number;
  fecha_servicio: string;
  tipo_comida: string;
  estado_acceso: string;
};

export type ComedorEquipoReservaApiItem = {
  id: number;
  empleado_id: number;
  empleado_nombre: string;
  empleado_nombre_corto: string;
  fecha_servicio: string;
  tipo_comida: string;
  estado_acceso: string;
};

export type ComedorEquipoBeneficiarioApiItem = {
  empleado_id: number;
  no_empleado: string;
  nombre: string;
  nombre_corto: string;
};

export type ComedorEquipoMetricasApi = {
  semana_actual_total: number;
  semana_proxima_total: number;
  porcentaje_caseras: number;
  porcentaje_saludables: number;
  total_activas: number;
};

export type ComedorResumenDiarioApiItem = {
  fecha: string;
  caseras: number;
  saludables: number;
};

export type ComedorPrimeraFechaApi = {
  fecha_iso: string;
};

export type ComedorMisFechasOcupadasApi = {
  fechas: string[];
};

export async function getComedorMisFechasOcupadas(
  desdeIso: string,
  hastaIso: string,
): Promise<ComedorMisFechasOcupadasApi> {
  const params = new URLSearchParams();
  params.set("desde", desdeIso);
  params.set("hasta", hastaIso);
  const res = await fetchWithAuth(`/api/v1/comedor/accesos/mis-fechas-ocupadas?${params.toString()}`);
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorMisFechasOcupadasApi;
}

export async function getComedorPrimeraFechaReserva(): Promise<ComedorPrimeraFechaApi> {
  const res = await fetchWithAuth("/api/v1/comedor/accesos/primera-fecha-permitida");
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorPrimeraFechaApi;
}

export async function getComedorMisReservasMes(anio: number, mes: number): Promise<ComedorMisReservaApiItem[]> {
  const params = new URLSearchParams();
  params.set("anio", String(anio));
  params.set("mes", String(mes));
  const res = await fetchWithAuth(`/api/v1/comedor/accesos/mis-reservas?${params.toString()}`);
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorMisReservaApiItem[];
}

export async function getComedorMisProximasReservas(limite = 5): Promise<ComedorMisReservaApiItem[]> {
  const params = new URLSearchParams();
  params.set("limite", String(limite));
  const res = await fetchWithAuth(`/api/v1/comedor/accesos/mis-proximas-reservas?${params.toString()}`);
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorMisReservaApiItem[];
}

export async function getComedorEquipoReservasMes(
  anio: number,
  mes: number,
): Promise<ComedorEquipoReservaApiItem[]> {
  const params = new URLSearchParams();
  params.set("anio", String(anio));
  params.set("mes", String(mes));
  const res = await fetchWithAuth(`/api/v1/comedor/accesos/equipo/mis-reservas?${params.toString()}`);
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorEquipoReservaApiItem[];
}

export async function getComedorEquipoProximasReservas(limite = 50): Promise<ComedorEquipoReservaApiItem[]> {
  const params = new URLSearchParams();
  params.set("limite", String(limite));
  const res = await fetchWithAuth(`/api/v1/comedor/accesos/equipo/mis-proximas-reservas?${params.toString()}`);
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorEquipoReservaApiItem[];
}

export async function getComedorEquipoBeneficiarios(): Promise<ComedorEquipoBeneficiarioApiItem[]> {
  const res = await fetchWithAuth("/api/v1/comedor/accesos/equipo/beneficiarios");
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorEquipoBeneficiarioApiItem[];
}

export async function getComedorEquipoMetricas(): Promise<ComedorEquipoMetricasApi> {
  const res = await fetchWithAuth("/api/v1/comedor/accesos/equipo/metricas");
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorEquipoMetricasApi;
}

export async function getComedorRhResumenDiario(
  desdeIso: string,
  hastaIso: string,
): Promise<ComedorResumenDiarioApiItem[]> {
  const params = new URLSearchParams();
  params.set("desde", desdeIso);
  params.set("hasta", hastaIso);
  const res = await fetchWithAuth(`/api/v1/comedor/accesos/rh/resumen-diario?${params.toString()}`);
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorResumenDiarioApiItem[];
}

export async function reservarComedorAcceso(payload: {
  comedorId: number;
  fechasIso: string[];
  tipoComida: string;
  targetUserId?: number;
}): Promise<void> {
  const res = await fetchWithAuth("/api/v1/comedor/accesos/reservar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      comedor_id: payload.comedorId,
      fechas_servicio: payload.fechasIso,
      tipo_comida: payload.tipoComida,
      target_user_id: payload.targetUserId ?? null,
    }),
  });
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
}

export async function editarComedorAcceso(payload: {
  accesoId: number;
  tipoComida: string;
}): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/comedor/accesos/${payload.accesoId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tipo_comida: payload.tipoComida }),
  });
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
}

export async function cancelarComedorAcceso(accesoId: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/comedor/accesos/${accesoId}`, {
    method: "DELETE",
  });
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
}
