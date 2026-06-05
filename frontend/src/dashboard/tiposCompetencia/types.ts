export type TipoCompetencia = {
  id: number;
  nombre: string;
  grupo_competencia_id: number;
  grupo_nombre: string;
  grupo_categoria: "tecnica" | "blanda" | "";
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type TipoCompetenciaCreatePayload = {
  nombre: string;
  grupo_competencia_id: number;
};

export type TipoCompetenciaUpdatePayload = TipoCompetenciaCreatePayload;

export type TipoCompetenciaFetchError = {
  status: number;
  detail: string;
};
