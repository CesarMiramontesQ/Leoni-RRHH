export type CategoriaTarea = {
  id: number;
  nombre: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type CategoriaTareaCreatePayload = {
  nombre: string;
};

export type CategoriaTareaUpdatePayload = CategoriaTareaCreatePayload;

export type CategoriaTareaFetchError = {
  status: number;
  detail: string;
};
