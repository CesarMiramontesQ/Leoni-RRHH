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
  /** Accesos activos (PENDIENTE/ACCEDIDO) en la semana; puede ser mayor que `total_registros`. */
  total_comidas: number;
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

export type ComedorRhPaseExternoApiItem = {
  codigo_acceso: string;
  password_temporal: string;
};

export type ComedorRhCredencialTemporalApi = {
  lote_id: string;
  valido_desde: string;
  valido_hasta: string;
  pases: ComedorRhPaseExternoApiItem[];
};

export type ComedorRhRegistroResponseApi = {
  total_registros_creados: number;
  modo: "interno" | "externo";
  credenciales_temporales: ComedorRhCredencialTemporalApi | null;
};

export type ComedorCodigoExternoApiItem = {
  id: number;
  fecha_inicio: string;
  fecha_fin: string;
  cantidad_personas: number;
  tipo_comida: string;
  codigo_acceso: string;
  password_temporal: string;
  estatus: "ACTIVO" | "USADO_PARCIAL" | "USADO_TOTAL" | "VENCIDO";
  usados: number;
  empleado_id?: number | null;
  lote_id?: string | null;
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

export type ComedorRhProximoRegistroApi = {
  id: number;
  empleado_id: number;
  empleado_nombre: string;
  no_empleado: string;
  area: string;
  comedor_nombre: string;
  fecha_servicio: string;
  tipo_comida: string;
  estado_acceso: string;
};

export type ComedorRhProximosRegistrosPageApi = {
  items: ComedorRhProximoRegistroApi[];
  total: number;
  page: number;
  page_size: number;
};

export type ComedorRhProximosFiltroEstado = "todos" | "confirmado" | "cancelado";

export async function getComedorRhProximosRegistros(
  page: number,
  pageSize: 10 | 50,
  opts?: { buscar?: string; filtroEstado?: ComedorRhProximosFiltroEstado },
): Promise<ComedorRhProximosRegistrosPageApi> {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  params.set("filtro_estado", opts?.filtroEstado ?? "todos");
  if (opts?.buscar?.trim()) params.set("buscar", opts.buscar.trim());
  const res = await fetchWithAuth(`/api/v1/comedor/accesos/rh/proximos-registros?${params.toString()}`);
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorRhProximosRegistrosPageApi;
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

export async function crearComedorRhRegistro(payload: {
  personType: "interno" | "externo";
  comedorId: number;
  fechasIso: string[];
  tipoComida: string;
  employeeId?: number | null;
  externalPeopleCount?: number | null;
  observaciones?: string;
}): Promise<ComedorRhRegistroResponseApi> {
  const res = await fetchWithAuth("/api/v1/comedor/accesos/rh/registro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      person_type: payload.personType,
      comedor_id: payload.comedorId,
      fechas_servicio: payload.fechasIso,
      tipo_comida: payload.tipoComida,
      target_user_id: payload.employeeId ?? null,
      external_people_count: payload.externalPeopleCount ?? null,
      observaciones: payload.observaciones ?? "",
    }),
  });
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorRhRegistroResponseApi;
}

export async function getComedorRhCodigosExternos(params: {
  desdeIso?: string;
  hastaIso?: string;
  estatus?: "ACTIVO" | "USADO_PARCIAL" | "USADO_TOTAL" | "VENCIDO" | "todos";
}): Promise<ComedorCodigoExternoApiItem[]> {
  const q = new URLSearchParams();
  if (params.desdeIso) q.set("desde", params.desdeIso);
  if (params.hastaIso) q.set("hasta", params.hastaIso);
  if (params.estatus && params.estatus !== "todos") q.set("estatus", params.estatus);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  const res = await fetchWithAuth(`/api/v1/comedor/accesos/rh/codigos-externos${suffix}`);
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorCodigoExternoApiItem[];
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
