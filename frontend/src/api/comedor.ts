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

export type ComedorAsignadoApi = {
  comedor_id: number;
  comedor_nombre: string;
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
  /** Complementos del día (guarniciones, salsas, etc.) cuando el backend los expone. */
  detalle?: ComedorMenuDiaDetalleApi | null;
};

export type ComedorMenuDiaDetalleApi = {
  sopa_o_crema?: string[];
  guarniciones?: string[];
  complementos?: string[];
  tortillas?: string[];
  postres?: string[];
  salsas?: string[];
  aguas?: string[];
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
  /** Empleados activos sin comedor en `turnos_empleados` (alertas operativas RH). */
  empleados_sin_comedor_asignado: number;
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

export async function eliminarComedorMenuSemana(
  comedorId: number,
  semanaIso: string,
): Promise<{ comedor_id: number; semana: string; deleted_count: number }> {
  const params = new URLSearchParams();
  params.set("comedor_id", String(comedorId));
  params.set("semana", semanaIso);
  const res = await fetchWithAuth(`/api/v1/comedor/menu?${params.toString()}`, {
    method: "DELETE",
  });
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as { comedor_id: number; semana: string; deleted_count: number };
}

export async function eliminarComedorMenuDia(
  comedorId: number,
  semanaIso: string,
  dia: string,
  tipo?: "normal" | "dieta",
): Promise<{ comedor_id: number; semana: string; dia: string; tipo: string | null; deleted_count: number }> {
  const params = new URLSearchParams();
  params.set("comedor_id", String(comedorId));
  params.set("semana", semanaIso);
  params.set("dia", dia);
  if (tipo) params.set("tipo", tipo);
  const res = await fetchWithAuth(`/api/v1/comedor/menu/dia?${params.toString()}`, {
    method: "DELETE",
  });
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as {
    comedor_id: number;
    semana: string;
    dia: string;
    tipo: string | null;
    deleted_count: number;
  };
}

export async function getComedorAsignado(targetUserId?: number): Promise<ComedorAsignadoApi> {
  const params = new URLSearchParams();
  if (targetUserId != null) params.set("target_user_id", String(targetUserId));
  const qs = params.toString();
  const res = await fetchWithAuth(
    `/api/v1/comedor/mi-comedor-asignado${qs ? `?${qs}` : ""}`,
  );
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorAsignadoApi;
}

export async function registrarComedorSeleccion(payload: {
  comedorId?: number;
  semanaIso: string;
  tipoPlatillo: string;
}): Promise<void> {
  const body: Record<string, unknown> = {
    semana: payload.semanaIso,
    tipo_platillo: payload.tipoPlatillo,
  };
  if (payload.comedorId != null) body.comedor_id = payload.comedorId;
  const res = await fetchWithAuth("/api/v1/comedor/registro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
}

export async function publicarComedorMenu(payload: {
  comedorId: number;
  semanaIso: string;
  dia: string;
  tipo: string;
  descripcion: string;
  detalle?: ComedorMenuDiaDetalleApi | null;
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
      ...(payload.detalle ? { detalle: payload.detalle } : {}),
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

export type ComedorRhEmpleadoSinComedorApi = {
  empleado_id: number;
  no_empleado: string;
  nombre: string;
};

export type ComedorRhEmpleadosSinComedorListApi = {
  total: number;
  items: ComedorRhEmpleadoSinComedorApi[];
};

export async function getComedorRhEmpleadosSinComedorAsignado(): Promise<ComedorRhEmpleadosSinComedorListApi> {
  const res = await fetchWithAuth("/api/v1/comedor/rh/empleados-sin-comedor-asignado");
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorRhEmpleadosSinComedorListApi;
}

export type ComedorRhEmpleadoBusquedaApi = {
  empleado_id: number;
  no_empleado: number;
  nombre: string;
  area: string | null;
  /** Comedor asignado hoy en turnos; `null` si no tiene. */
  comedor_id: number | null;
};

/**
 * Busca empleados para el modal de registro.
 *
 * Vive bajo `/comedor/rh` a propósito: `/api/v1/empleados` exige el módulo `empleados`,
 * que un perfil de comedor no tiene, y devolvía un 403 que dejaba el buscador vacío.
 */
export async function buscarComedorRhEmpleados(
  q: string,
  limit = 8,
): Promise<{ total: number; items: ComedorRhEmpleadoBusquedaApi[] }> {
  const params = new URLSearchParams();
  params.set("q", q);
  params.set("limit", String(limit));
  const res = await fetchWithAuth(`/api/v1/comedor/rh/empleados-buscar?${params.toString()}`);
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as { total: number; items: ComedorRhEmpleadoBusquedaApi[] };
}

export async function asignarComedorRhTurnos(
  asignaciones: readonly { empleadoId: number; comedorId: number }[],
): Promise<{ actualizados: number }> {
  const res = await fetchWithAuth("/api/v1/comedor/rh/asignar-comedor-turnos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      asignaciones: asignaciones.map((row) => ({
        empleado_id: row.empleadoId,
        comedor_id: row.comedorId,
      })),
    }),
  });
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as { actualizados: number };
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
  /** Reservas con acceso validado (huella) sobre el total activo del equipo. */
  total_asistencias: number;
  /** Porcentaje de asistencia vs todas las reservas activas/confirmadas del equipo. */
  porcentaje_asistencia: number;
  porcentaje_caseras: number;
  porcentaje_saludables: number;
  total_activas: number;
};

export type ComedorResumenDiarioApiItem = {
  fecha: string;
  caseras: number;
  saludables: number;
  registros: number;
  asistencias: number;
};

export type ComedorRhSemanaRegistrosFuturosApiItem = {
  semana_inicio: string;
  total: number;
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
  comedor_id: number;
  comedor_nombre: string;
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
  pageSize: number,
  opts?: { buscar?: string; filtroEstado?: ComedorRhProximosFiltroEstado },
): Promise<ComedorRhProximosRegistrosPageApi> {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(Math.min(50, Math.max(1, pageSize))));
  params.set("filtro_estado", opts?.filtroEstado ?? "todos");
  if (opts?.buscar?.trim()) params.set("buscar", opts.buscar.trim());
  const res = await fetchWithAuth(`/api/v1/comedor/accesos/rh/proximos-registros?${params.toString()}`);
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorRhProximosRegistrosPageApi;
}

/** Registros operativos en un rango de fechas (inclusive); usado por Reporte comedor (RH). */
export async function getComedorRhRegistrosReporte(
  desdeIso: string,
  hastaIso: string,
  page: number,
  pageSize: number,
  opts?: { buscar?: string; filtroEstado?: ComedorRhProximosFiltroEstado },
): Promise<ComedorRhProximosRegistrosPageApi> {
  const params = new URLSearchParams();
  params.set("desde", desdeIso.slice(0, 10));
  params.set("hasta", hastaIso.slice(0, 10));
  params.set("page", String(page));
  params.set("page_size", String(Math.min(50, Math.max(1, pageSize))));
  params.set("filtro_estado", opts?.filtroEstado ?? "todos");
  if (opts?.buscar?.trim()) params.set("buscar", opts.buscar.trim());
  const res = await fetchWithAuth(`/api/v1/comedor/accesos/rh/registros-reporte?${params.toString()}`);
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
  const raw = (await res.json()) as Partial<ComedorResumenDiarioApiItem>[];
  return raw.map((row) => {
    const caseras = Math.max(0, row.caseras ?? 0);
    const saludables = Math.max(0, row.saludables ?? 0);
    const registros =
      typeof row.registros === "number" && row.registros >= 0
        ? row.registros
        : caseras + saludables;
    return {
      fecha: String(row.fecha ?? ""),
      caseras,
      saludables,
      registros,
      asistencias: Math.max(0, row.asistencias ?? 0),
    };
  });
}

export async function getComedorRhRegistrosFuturosPorSemana(
  semanas = 8,
): Promise<ComedorRhSemanaRegistrosFuturosApiItem[]> {
  const params = new URLSearchParams();
  params.set("semanas", String(Math.max(1, Math.min(16, semanas))));
  const res = await fetchWithAuth(
    `/api/v1/comedor/accesos/rh/registros-futuros-por-semana?${params.toString()}`,
  );
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorRhSemanaRegistrosFuturosApiItem[];
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
  comedorId?: number;
  fechasIso: string[];
  tipoComida: string;
  targetUserId?: number;
}): Promise<void> {
  const body: Record<string, unknown> = {
    fechas_servicio: payload.fechasIso,
    tipo_comida: payload.tipoComida,
    target_user_id: payload.targetUserId ?? null,
  };
  if (payload.comedorId != null) body.comedor_id = payload.comedorId;
  const res = await fetchWithAuth("/api/v1/comedor/accesos/reservar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

/** Jornada de TRESS (`levelup_horarios`) con su ventana de comida (Ajustes Comedor). */
export type ComedorJornadaComidaApi = {
  ho_codigo: string;
  descripcion: string;
  /** `HH:MM:SS`. La salida puede ser menor que la entrada: hay jornadas que cruzan medianoche. */
  hora_entrada: string | null;
  hora_salida: string | null;
  jornada_horas: number | null;
  activo: boolean;
  /** `null` = la jornada todavia no tiene ventana de comida configurada. */
  hora_inicio_comida: string | null;
  hora_fin_comida: string | null;
  actualizado_en: string | null;
  /** Turnos que recorren esta jornada: el alcance real de editarla. */
  turnos: string[];
  /** Personal de esos turnos segun `levelup_turnos_uso`; `null` = cache nunca sincronizada. */
  empleados_activos: number | null;
  en_catalogo: boolean;
};

/** Tramo de dias consecutivos del ciclo con la misma jornada. */
export type ComedorTurnoCicloBloqueApi = {
  dia_inicio: number;
  dia_fin: number;
  dias: number;
  /** "Dias 1-2" en un rotativo, "Lun-Vie" en un fijo. */
  etiqueta: string;
  estatus: "LABORABLE" | "DESCANSO";
  ho_codigo: string | null;
  ho_descripcion: string | null;
  hora_entrada: string | null;
  hora_salida: string | null;
  hora_inicio_comida: string | null;
  hora_fin_comida: string | null;
  configurada: boolean;
};

/** Turno del catalogo `levelup_turnos` con su ciclo desglosado. */
export type ComedorTurnoComidaApi = {
  tu_codigo: string;
  descripcion: string;
  activo: boolean;
  tipo_turno: "FIJO" | "ROTATIVO";
  jornada_horas: number | null;
  dias_semana: number | null;
  empleados_activos: number | null;
  /** Dias que dura el ciclo: 7 en un fijo, 21/28/56 en los rotativos reales. */
  longitud_ciclo: number | null;
  jornadas: string[];
  jornadas_configuradas: number;
  bloques: ComedorTurnoCicloBloqueApi[];
  /** Texto para degradar la fila cuando el ciclo no se puede calcular. */
  aviso: string | null;
};

/** Resultado de "que comida le toca a esta persona en esta fecha". */
export type ComedorVentanaComidaApi = {
  no_empleado: string;
  nombre: string | null;
  fecha: string;
  tu_codigo: string | null;
  turno_descripcion: string | null;
  tipo_turno: "FIJO" | "ROTATIVO" | null;
  estatus: "LABORABLE" | "DESCANSO" | null;
  posicion_ciclo: number | null;
  longitud_ciclo: number | null;
  ho_codigo: string | null;
  ho_descripcion: string | null;
  hora_entrada: string | null;
  hora_salida: string | null;
  hora_inicio_comida: string | null;
  hora_fin_comida: string | null;
  /** DESCANSO | JORNADA_SIN_CONFIGURAR | SIN_TURNO | PATRON_INVALIDO | ... */
  motivo_sin_ventana: string | null;
  aviso: string | null;
  turno_sincronizado_en: string | null;
};

export async function getComedorTurnosComida(
  opts: { incluirInactivos?: boolean; soloEnUso?: boolean } = {},
): Promise<ComedorTurnoComidaApi[]> {
  const params = new URLSearchParams();
  if (opts.incluirInactivos) params.set("incluir_inactivos", "true");
  if (opts.soloEnUso === false) params.set("solo_en_uso", "false");
  const query = params.toString() ? `?${params}` : "";
  const res = await fetchWithAuth(`/api/v1/comedor/turnos-comida${query}`);
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorTurnoComidaApi[];
}

export async function getComedorJornadasComida(
  opts: { soloEnUso?: boolean } = {},
): Promise<ComedorJornadaComidaApi[]> {
  const params = new URLSearchParams();
  if (opts.soloEnUso === false) params.set("solo_en_uso", "false");
  const query = params.toString() ? `?${params}` : "";
  const res = await fetchWithAuth(`/api/v1/comedor/jornadas-comida${query}`);
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorJornadaComidaApi[];
}

export async function guardarComedorJornadaComida(
  hoCodigo: string,
  payload: { horaInicioComida: string; horaFinComida: string },
): Promise<ComedorJornadaComidaApi> {
  const res = await fetchWithAuth(
    `/api/v1/comedor/jornadas-comida/${encodeURIComponent(hoCodigo)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hora_inicio_comida: payload.horaInicioComida,
        hora_fin_comida: payload.horaFinComida,
      }),
    },
  );
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorJornadaComidaApi;
}

export async function getComedorVentanaComida(
  noEmpleado: number,
  fecha: string,
): Promise<ComedorVentanaComidaApi> {
  const params = new URLSearchParams({ no_empleado: String(noEmpleado), fecha });
  const res = await fetchWithAuth(`/api/v1/comedor/ventana-comida?${params}`);
  if (!res.ok) throwComedorError(res.status, await readErrorDetail(res));
  return (await res.json()) as ComedorVentanaComidaApi;
}
