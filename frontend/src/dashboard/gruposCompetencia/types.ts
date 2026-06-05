export type GrupoCompetencia = {
  id: number;
  nombre: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type GrupoCompetenciaCreatePayload = {
  nombre: string;
};

export type GrupoCompetenciaUpdatePayload = GrupoCompetenciaCreatePayload;

export type GrupoCompetenciaFetchError = {
  status: number;
  detail: string;
};
