export type TipoCurso = "interno" | "externo";
export type ClasificacionCurso = "adicional" | "contemplado";
export type CategoriaCurso = "tecnico" | "calidad" | "seguridad" | "operativo" | "blanda";

export interface Curso {
  id: number;
  nombre: string;
  proveedor: string | null;
  duracion_horas: number | null;
  cupo_max: number | null;
  instructor: string | null;
  categoria: CategoriaCurso | null;
  modalidad: string | null;
  sesiones_anio: number | null;
  tipo: TipoCurso | null;
  clasificacion: ClasificacionCurso | null;
  obligatorio: boolean;
  descripcion: string | null;
  requisitos: string | null;
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
  proveedor?: string;
  duracion_horas?: number;
  cupo_max?: number;
  instructor?: string;
  categoria?: CategoriaCurso;
  modalidad?: string;
  sesiones_anio?: number;
  tipo?: TipoCurso;
  clasificacion?: ClasificacionCurso;
  obligatorio?: boolean;
  descripcion?: string;
  requisitos?: string;
}

export interface CursoUpdatePayload {
  nombre?: string;
  proveedor?: string;
  duracion_horas?: number;
  cupo_max?: number;
  instructor?: string;
  categoria?: CategoriaCurso;
  modalidad?: string;
  sesiones_anio?: number;
  tipo?: TipoCurso;
  clasificacion?: ClasificacionCurso;
  obligatorio?: boolean;
  descripcion?: string;
  requisitos?: string;
  activo?: boolean;
}

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
  ubicacion: string | null;
  instructor: string | null;
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
  ubicacion?: string;
  instructor?: string;
  cupo_max?: number;
  notas?: string;
}

export interface CursoSesionUpdatePayload {
  fecha_inicio?: string;
  fecha_fin?: string;
  hora_inicio?: string;
  hora_fin?: string;
  ubicacion?: string;
  instructor?: string;
  cupo_max?: number;
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
