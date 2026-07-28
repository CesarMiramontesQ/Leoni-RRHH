/**
 * Career Level (Willis Towers Watson): P1..Pn / M1..Mn, único dentro de su
 * career path.
 *
 * No tiene orden propio: lo posiciona el Global Grade al que equivale, que es el
 * ordenador real del sistema Towers — por eso un P10 y un M1 pueden pesar lo mismo.
 */
export type GradoPuesto = {
  id: number;
  career_path_id: number;
  career_path_codigo: string | null;
  career_path_nombre: string | null;
  /** Etiqueta corta del nivel: "P10", "M3". */
  codigo: string;
  nombre: string;
  /**
   * Posición del nivel, que viene de su Global Grade.
   *
   * `null` cuando no tiene equivalencia configurada: ese nivel no se puede
   * ubicar en el rango de un perfil.
   */
  global_grade_id: number | null;
  global_grade_codigo: string | null;
  global_grade_orden: number | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type GradoPuestoCreatePayload = {
  career_path_id: number;
  codigo: string;
  nombre: string;
};

export type GradoPuestoUpdatePayload = GradoPuestoCreatePayload;

export type GradoPuestoFetchError = {
  status: number;
  detail: string;
};
