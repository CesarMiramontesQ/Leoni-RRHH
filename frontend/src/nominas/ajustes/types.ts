import type {
  HorasExtraAutorizadoItem,
  HorasExtraAutorizadosFiltro,
} from "../../api/nominasAjustes.ts";

export type AjustesNominasStatus = "loading" | "ready" | "error";

export type AjustesNominasState = {
  status: AjustesNominasStatus;
  errorMessage?: string;
  successMessage?: string;
  items: HorasExtraAutorizadoItem[];
  total: number;
  totalAutorizados: number;
  page: number;
  pageSize: number;
  q: string;
  filtro: HorasExtraAutorizadosFiltro;
  seleccion: ReadonlySet<number>;
  updating: boolean;
};
