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
  aprobadores: AprobadoresState;
};

// ── Configuración de aprobadores (gerentes regionales / director) ──

export type AprobadorTipo = "gerente_regional" | "director";

/** Aprobador registrado en alguna de las dos tablas de la sección. */
export type AprobadorItem = {
  /** Id del registro de aprobador (no del empleado). */
  id: number;
  empleadoId: number;
  noEmpleado: string;
  nombre: string;
  email: string | null;
  areaPuesto: string | null;
  activo: boolean;
};

/** Candidato encontrado en el buscador del modal de aprobadores. */
export type AprobadorCandidato = {
  /** PK de `empleados.id` (mismo valor que envía el API en `empleado_id` del aprobador). */
  empleadoId: number;
  noEmpleado: string;
  nombre: string;
  email: string | null;
  areaPuesto: string | null;
};

/** Estado del modal "Agregar gerente regional" / "Agregar director" (null = cerrado). */
export type AprobadoresModalState = {
  tipo: AprobadorTipo;
  q: string;
  searching: boolean;
  searched: boolean;
  results: AprobadorCandidato[];
  seleccionados: ReadonlyMap<number, AprobadorCandidato>;
  submitting: boolean;
  errorMessage?: string;
};

export type AprobadoresState = {
  loading: boolean;
  /** Id del aprobador con una mutación en curso (toggle/eliminar). */
  mutatingId: number | null;
  gerentes: AprobadorItem[];
  directores: AprobadorItem[];
  modal: AprobadoresModalState | null;
  successMessage?: string;
  errorMessage?: string;
};
