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
