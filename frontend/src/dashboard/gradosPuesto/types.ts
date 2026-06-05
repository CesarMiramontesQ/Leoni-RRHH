export type GradoPuesto = {
  id: number;
  nombre: string;
  orden: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type GradoPuestoCreatePayload = {
  nombre: string;
  orden: number;
};

export type GradoPuestoUpdatePayload = {
  nombre: string;
  orden: number;
};

export type GradoPuestoFetchError = {
  status: number;
  detail: string;
};
