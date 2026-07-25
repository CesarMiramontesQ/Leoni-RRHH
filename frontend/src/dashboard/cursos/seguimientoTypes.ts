export type EstadoCursoEmpleado =
  | "pendiente"
  | "programado"
  | "completado"
  | "no_acreditado"
  | "en_progreso";

export interface CursosDashboardKpis {
  cursos_asignados: number;
  cursos_pendientes: number;
  cursos_completados: number;
  cursos_con_sesion_proxima: number;
  sesiones_pendientes: number;
  sesiones_programadas: number;
  sesiones_completadas: number;
  empleados_con_cursos_pendientes: number;
  empleados_con_sesiones_pendientes: number;
  empleados_sin_completar_obligatorio: number;
}

export interface CursosDashboardEmpleadoResumenItem {
  empleado_id: number;
  nombre_empleado: string | null;
  no_empleado: string | null;
  area_nombre: string | null;
  pendientes_count: number;
}

export interface CursosDashboardSesionProximaItem {
  sesion_id: number;
  curso_id: number;
  curso_nombre: string | null;
  fecha_inicio: string;
  estado: string;
  inscritos_count: number;
}

export interface CursosDashboardCursoCompletadoItem {
  empleado_id: number;
  nombre_empleado: string | null;
  curso_id: number;
  curso_nombre: string | null;
  fecha_finalizacion: string | null;
}

/** Opción del selector de área; llega completa, sin recortar por el filtro. */
export interface CursosDashboardAreaItem {
  id: number;
  nombre: string;
}

export interface CursosDashboardResumen {
  kpis: CursosDashboardKpis;
  areas: CursosDashboardAreaItem[];
  empleados_cursos_pendientes: CursosDashboardEmpleadoResumenItem[];
  empleados_sesiones_pendientes: CursosDashboardEmpleadoResumenItem[];
  sesiones_proximas: CursosDashboardSesionProximaItem[];
  cursos_completados_recientes: CursosDashboardCursoCompletadoItem[];
}

export interface CursosDashboardRegistroItem {
  empleado_id: number;
  nombre_empleado: string | null;
  no_empleado: string | null;
  area_nombre: string | null;
  puesto_nombre: string | null;
  curso_id: number;
  curso_nombre: string | null;
  curso_obligatorio: boolean;
  estado_curso: EstadoCursoEmpleado;
  origen_asignacion: string | null;
  sesion_id: number | null;
  sesion_fecha_inicio: string | null;
  estado_sesion: string | null;
  asistio: boolean | null;
  fecha_finalizacion: string | null;
}

export interface CursosDashboardRegistrosResponse {
  items: CursosDashboardRegistroItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface CursosDashboardHistorialCursoItem {
  curso_id: number;
  curso_nombre: string | null;
  curso_obligatorio: boolean;
  estado_curso: EstadoCursoEmpleado;
  origen_asignacion: string | null;
  fecha_finalizacion: string | null;
}

export interface CursosDashboardHistorialSesionItem {
  sesion_id: number;
  curso_id: number;
  curso_nombre: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado_sesion: string;
  asistio: boolean | null;
  es_proxima: boolean;
}

export interface CursosDashboardEmpleadoHistorial {
  empleado_id: number;
  nombre_empleado: string | null;
  no_empleado: string | null;
  area_nombre: string | null;
  puesto_nombre: string | null;
  cursos: CursosDashboardHistorialCursoItem[];
  sesiones: CursosDashboardHistorialSesionItem[];
}

export interface CursosDashboardRegistrosParams {
  page?: number;
  page_size?: number;
  empleado_id?: number;
  curso_id?: number;
  area_id?: number;
  puesto_id?: number;
  estado_curso?: EstadoCursoEmpleado;
  estado_sesion?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  q?: string;
}

export const ESTADO_CURSO_LABELS: Record<EstadoCursoEmpleado, string> = {
  pendiente: "Pendiente",
  programado: "Programado",
  completado: "Completado",
  no_acreditado: "No acreditado",
  en_progreso: "En progreso",
};

export const ESTADO_CURSO_BADGE: Record<EstadoCursoEmpleado, string> = {
  pendiente: "border-amber-200 bg-amber-50 text-amber-800",
  programado: "border-blue-200 bg-blue-50 text-blue-800",
  completado: "border-emerald-200 bg-emerald-50 text-emerald-800",
  no_acreditado: "border-red-200 bg-red-50 text-red-800",
  en_progreso: "border-violet-200 bg-violet-50 text-violet-800",
};
