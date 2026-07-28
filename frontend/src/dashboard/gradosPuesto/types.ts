/**
 * Career Level (Willis Towers Watson).
 *
 * El recurso se sigue llamando `grados-puesto` por compatibilidad, pero el
 * concepto es el Career Level: P1..Pn / M1..Mn, unico DENTRO de su career path.
 */
export type GradoPuesto = {
  id: number;
  career_path_id: number;
  career_path_codigo: string | null;
  career_path_nombre: string | null;
  /** Etiqueta corta del nivel: "P10", "M3". */
  codigo: string;
  nombre: string;
  orden: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type GradoPuestoCreatePayload = {
  career_path_id: number;
  codigo: string;
  nombre: string;
  orden: number;
};

export type GradoPuestoUpdatePayload = GradoPuestoCreatePayload;

export type GradoPuestoFetchError = {
  status: number;
  detail: string;
};
