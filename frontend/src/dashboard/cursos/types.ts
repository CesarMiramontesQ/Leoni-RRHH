export type InstructorTipo = "interno" | "externo";

export interface Curso {
  id: number;
  nombre: string;
  duracion_horas: number | null;
  cupo_max: number | null;
  categoria_id: number | null;
  categoria_nombre: string | null;
  tipo_id: number | null;
  tipo_nombre: string | null;
  clasificacion_id: number | null;
  clasificacion_nombre: string | null;
  proveedor_id: number | null;
  proveedor_nombre: string | null;
  instructor_tipo: InstructorTipo | null;
  instructor_empleado_id: number | null;
  instructor_externo_id: number | null;
  instructor_nombre: string | null;
  modalidad: string | null;
  sesiones_anio: number | null;
  obligatorio: boolean;
  descripcion: string | null;
  requisitos: string | null;
  centro_costos: number | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CursoListResponse {
  items: Curso[];
  total: number;
  page: number;
  page_size: number;
}

export interface CursoCreatePayload {
  nombre: string;
  duracion_horas?: number;
  cupo_max?: number;
  categoria_id?: number;
  tipo_id?: number;
  clasificacion_id?: number;
  proveedor_id?: number;
  instructor_tipo?: InstructorTipo;
  instructor_empleado_id?: number;
  instructor_externo_id?: number;
  modalidad?: string;
  sesiones_anio?: number;
  obligatorio?: boolean;
  descripcion?: string;
  requisitos?: string;
  centro_costos?: number;
}

export interface CursoUpdatePayload {
  nombre?: string;
  duracion_horas?: number;
  cupo_max?: number;
  categoria_id?: number;
  tipo_id?: number;
  clasificacion_id?: number;
  proveedor_id?: number;
  instructor_tipo?: InstructorTipo;
  instructor_empleado_id?: number;
  instructor_externo_id?: number;
  modalidad?: string;
  sesiones_anio?: number;
  obligatorio?: boolean;
  descripcion?: string;
  requisitos?: string;
  centro_costos?: number;
  activo?: boolean;
}

// ── Sesiones ──────────────────────────────────────────────────────────────────

export const TIPO_LABELS: Record<string, string> = {
  interno: "Interno",
  externo: "Externo",
};

export const CLASIFICACION_LABELS: Record<string, string> = {
  adicional: "Adicional",
  contemplado: "Contemplado",
};

export const CATEGORIA_LABELS: Record<string, string> = {
  tecnico: "Técnico",
  calidad: "Calidad",
  seguridad: "Seguridad",
  operativo: "Operativo",
  blanda: "Blanda",
};

// ── Sesiones ──────────────────────────────────────────────────────────────────

export type EstadoSesion = "programada" | "en_curso" | "completada" | "cancelada";

export interface CursoSesion {
  id: number;
  curso_id: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  tipo: string | null;
  ubicacion: string | null;
  instructor_tipo: InstructorTipo | null;
  instructor_empleado_id: number | null;
  instructor_externo_id: number | null;
  instructor_nombre: string | null;
  costo: number | null;
  cupo_max: number | null;
  notas: string | null;
  estado: EstadoSesion;
  inscritos_count: number;
  created_at: string;
  updated_at: string;
}

export interface CursoSesionListResponse {
  items: CursoSesion[];
  total: number;
}

export interface CursoSesionCreatePayload {
  fecha_inicio: string;
  fecha_fin?: string;
  hora_inicio?: string;
  hora_fin?: string;
  tipo?: string;
  ubicacion?: string;
  instructor_tipo?: InstructorTipo;
  instructor_empleado_id?: number;
  instructor_externo_id?: number;
  costo?: number;
  notas?: string;
}

export interface CursoSesionUpdatePayload {
  fecha_inicio?: string;
  fecha_fin?: string;
  hora_inicio?: string;
  hora_fin?: string;
  tipo?: string;
  ubicacion?: string;
  instructor_tipo?: InstructorTipo;
  instructor_empleado_id?: number;
  instructor_externo_id?: number;
  costo?: number;
  notas?: string;
  estado?: EstadoSesion;
}

export const ESTADO_SESION_LABELS: Record<EstadoSesion, string> = {
  programada: "Programada",
  en_curso: "En curso",
  completada: "Completada",
  cancelada: "Cancelada",
};

// ── Inscritos en sesión ──────────────────────────────────────────────────────

export interface SesionEmpleadoItem {
  id: number;
  empleado_id: number;
  nombre_empleado: string | null;
  no_empleado: string | null;
  asistio: boolean | null;
}
