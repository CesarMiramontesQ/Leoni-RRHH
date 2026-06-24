export type MetodoCalificacionCompetencia = {
  id: number;
  valor: number;
  nombre: string;
  orden: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type MetodoCalificacionCompetenciaCreatePayload = {
  nombre: string;
  orden: number;
};

export type MetodoCalificacionCompetenciaUpdatePayload = {
  nombre: string;
  orden: number;
  activo?: boolean;
};

export type MetodoCalificacionCompetenciaFetchError = {
  status: number;
  detail: string;
};

export type MetodoCalificacionCompetenciaResumen = {
  valor: number;
  nombre: string;
  orden: number;
};
