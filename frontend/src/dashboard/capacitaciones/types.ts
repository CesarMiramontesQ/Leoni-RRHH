export interface Capacitacion {
  id: number;
  nombre: string;
  descripcion: string | null;
  duracion_horas: number;
  modalidad: CapacitacionModalidad;
  instructor: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  cupo_maximo: number | null;
  area_id: number | null;
  area_nombre: string | null;
  competencias_asociadas: Array<{ id: number; nombre: string }> | null;
  estado: CapacitacionEstado;
  inscritos_count: number;
  created_at: string;
  updated_at: string;
}

export interface CapacitacionListResponse {
  items: Capacitacion[];
  total: number;
  page: number;
  page_size: number;
}

export interface CapacitacionCreatePayload {
  nombre: string;
  descripcion?: string;
  duracion_horas: number;
  modalidad: CapacitacionModalidad;
  instructor?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  cupo_maximo?: number;
  area_id?: number;
  competencias_asociadas?: Array<{ id: number; nombre: string }>;
}

export interface CapacitacionUpdatePayload {
  nombre?: string;
  descripcion?: string;
  duracion_horas?: number;
  modalidad?: CapacitacionModalidad;
  instructor?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  cupo_maximo?: number;
  area_id?: number;
  competencias_asociadas?: Array<{ id: number; nombre: string }>;
  estado?: CapacitacionEstado;
}

export interface Inscripcion {
  id: number;
  capacitacion_id: number;
  capacitacion_nombre: string | null;
  empleado_id: number;
  empleado_nombre: string | null;
  estado: InscripcionEstado;
  calificacion: number | null;
  fecha_inscripcion: string;
  fecha_completado: string | null;
}

export interface InscripcionListResponse {
  items: Inscripcion[];
  total: number;
  page: number;
  page_size: number;
}

export type CapacitacionModalidad = "presencial" | "online" | "mixta";
export type CapacitacionEstado = "activa" | "cancelada" | "finalizada";
export type InscripcionEstado = "inscrito" | "en_curso" | "completado" | "cancelado";

export const MODALIDAD_LABELS: Record<string, string> = {
  presencial: "Presencial",
  online: "En linea",
  mixta: "Mixta",
};

export const ESTADO_LABELS: Record<string, string> = {
  activa: "Activa",
  cancelada: "Cancelada",
  finalizada: "Finalizada",
};

export const INSCRIPCION_ESTADO_LABELS: Record<string, string> = {
  inscrito: "Inscrito",
  en_curso: "En curso",
  completado: "Completado",
  cancelado: "Cancelado",
};
