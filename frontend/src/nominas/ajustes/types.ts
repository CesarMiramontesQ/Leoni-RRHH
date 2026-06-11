import type {
  HorasExtraAutorizadoItem,
  HorasExtraAutorizadosStats,
} from "../../api/nominasAjustes.ts";

export type AjustesNominasStatus = "loading" | "ready" | "error";

/** Estado del modal "Autorizar empleados" (null = cerrado). */
export type AjustesNominasModalState = {
  q: string;
  searching: boolean;
  searched: boolean;
  results: HorasExtraAutorizadoItem[];
  seleccionados: ReadonlyMap<number, HorasExtraAutorizadoItem>;
  submitting: boolean;
  errorMessage?: string;
};

export type AjustesNominasState = {
  status: AjustesNominasStatus;
  errorMessage?: string;
  successMessage?: string;
  items: HorasExtraAutorizadoItem[];
  total: number;
  page: number;
  pageSize: number;
  q: string;
  stats: HorasExtraAutorizadosStats | null;
  revokingId: number | null;
  modal: AjustesNominasModalState | null;
};
