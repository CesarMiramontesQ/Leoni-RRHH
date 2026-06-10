export type OpcionCalificacion = {
  id: number;
  metodo_calificacion_id: number;
  etiqueta: string;
  valor: string;
  orden: number;
  peso: number | null;
  activo: boolean;
};

export type MetodoCalificacionConfig = {
  comparador: string;
  permite_na?: boolean;
  requiere_opciones?: boolean;
  captura?: { campos?: string[]; anios_habilitado?: boolean };
};

export type MetodoCalificacion = {
  id: number;
  nombre: string;
  tipo: string;
  descripcion: string | null;
  config: MetodoCalificacionConfig;
  activo: boolean;
  opciones: OpcionCalificacion[];
  created_at: string;
  updated_at: string;
};

export type TipoCualificacion = {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  metodo_calificacion_id: number | null;
  metodo_nombre: string;
  metodo_tipo: string;
  metodo_config: MetodoCalificacionConfig;
  opciones: OpcionCalificacion[];
  cualificacion_catalogo_id: number | null;
  created_at: string;
  updated_at: string;
};

export type CualificacionCatalogo = {
  id: number;
  tipo_cualificacion_id: number;
  tipo_nombre: string;
  metodo_calificacion_id: number;
  metodo_nombre: string;
  metodo_tipo: string;
  metodo_config: MetodoCalificacionConfig;
  nombre: string;
  descripcion: string | null;
  obligatorio: boolean;
  activo: boolean;
  opciones: OpcionCalificacion[];
  created_at: string;
  updated_at: string;
};

export type CatalogoCompleto = {
  tipos: TipoCualificacion[];
  metodos: MetodoCalificacion[];
  cualificaciones: CualificacionCatalogo[];
};

export type CriterioRequerido = Record<string, unknown>;
export type ValorCapturado = Record<string, unknown>;

export type PerfilCualificacion = {
  id: number;
  puesto_perfil_id: number;
  cualificacion_catalogo_id: number | null;
  cualificacion_nombre: string;
  tipo_nombre: string;
  metodo_tipo: string;
  metodo_config: MetodoCalificacionConfig;
  opciones: OpcionCalificacion[];
  criterio_requerido: CriterioRequerido | null;
  comentarios: string | null;
  created_at: string;
  updated_at: string;
};

export type GapCualificacion = {
  cualificacion_id: number;
  cualificacion_catalogo_id: number | null;
  cualificacion_nombre: string;
  tipo_nombre: string;
  metodo_tipo: string;
  metodo_config: MetodoCalificacionConfig;
  opciones: OpcionCalificacion[];
  criterio_requerido: CriterioRequerido | null;
  criterio_label: string;
  valor_capturado: ValorCapturado | null;
  capturado_label: string | null;
  comentarios: string | null;
  evaluado: boolean;
  cumple: boolean | null;
};
