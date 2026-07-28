/**
 * Tipos de los catalogos de clasificacion de puesto (Willis Towers Watson).
 *
 * Career Path + Funcion + Disciplina + Global Level son la identidad oficial del
 * puesto. La Disciplina siempre depende de la Funcion.
 */

export type CareerPath = {
  id: number;
  /** Prefijo del Global Level: "P" -> P10, "M" -> M3. */
  codigo: string;
  nombre: string;
  orden: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type CareerPathCreatePayload = {
  codigo: string;
  nombre: string;
  orden: number;
};

export type CareerPathUpdatePayload = CareerPathCreatePayload;

export type FuncionPuesto = {
  id: number;
  codigo: string;
  nombre: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type FuncionPuestoCreatePayload = {
  codigo: string;
  nombre: string;
};

export type FuncionPuestoUpdatePayload = FuncionPuestoCreatePayload;

export type DisciplinaPuesto = {
  id: number;
  funcion_id: number;
  funcion_nombre: string | null;
  nombre: string;
  codigo: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type DisciplinaPuestoCreatePayload = {
  funcion_id: number;
  nombre: string;
  codigo?: string | null;
};

export type DisciplinaPuestoUpdatePayload = DisciplinaPuestoCreatePayload;

export type ClasificacionPuestoFetchError = {
  status: number;
  detail: string;
};

/**
 * Global Grade: clasificación organizacional oficial del puesto.
 *
 * No representa sueldo, banda salarial ni compensación — este sistema no
 * administra nada de eso.
 */
export type GlobalGrade = {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type GlobalGradeCreatePayload = {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  orden: number;
};

export type GlobalGradeUpdatePayload = GlobalGradeCreatePayload;

/** Equivalencia configurable Global Level → Global Grade. Única por nivel. */
export type Equivalencia = {
  id: number;
  global_level_id: number;
  global_level_codigo: string | null;
  global_level_nombre: string | null;
  career_path_id: number | null;
  career_path_codigo: string | null;
  career_path_nombre: string | null;
  global_grade_id: number;
  global_grade_codigo: string | null;
  global_grade_nombre: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type EquivalenciaCreatePayload = {
  global_level_id: number;
  global_grade_id: number;
};

export type EquivalenciaUpdatePayload = EquivalenciaCreatePayload;
