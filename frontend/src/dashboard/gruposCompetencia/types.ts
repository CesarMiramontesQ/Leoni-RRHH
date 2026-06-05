export type CategoriaGrupoCompetencia = "tecnica" | "blanda";

export type GrupoCompetencia = {
  id: number;
  nombre: string;
  categoria: CategoriaGrupoCompetencia;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type GrupoCompetenciaCreatePayload = {
  nombre: string;
  categoria: CategoriaGrupoCompetencia;
};

export type GrupoCompetenciaUpdatePayload = GrupoCompetenciaCreatePayload;

export type GrupoCompetenciaFetchError = {
  status: number;
  detail: string;
};
