export type NivelPuesto = {
  id: number;
  nombre: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type NivelPuestoCreatePayload = {
  nombre: string;
};

export type NivelPuestoUpdatePayload = {
  nombre: string;
};

export type NivelPuestoFetchError = {
  status: number;
  detail: string;
};
