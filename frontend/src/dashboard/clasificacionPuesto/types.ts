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
