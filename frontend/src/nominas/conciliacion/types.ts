/** Tipos de la vista Conciliación de Nómina — preparados para integración futura. */

export type ConciliacionPeriodoEstado = "con_diferencias" | "conciliado" | "pendiente";

export type ConciliacionEstatus = "conciliado" | "menor" | "critica" | "sin_contab";

export type ConciliacionSummaryAccent = "default" | "info" | "danger" | "success" | "warning";

export type ConciliacionSummaryCard = {
  id: string;
  label: string;
  value: string;
  footer: string;
  accent?: ConciliacionSummaryAccent;
  badgeLabel?: string;
  badgeTone?: "danger" | "success" | "neutral";
};

export type ConciliacionFiltros = {
  razonSocial: string;
  periodo: string;
  centro: string;
  ultimaCorrida: string;
};

export type ConciliacionMontosFila = {
  nominaAcum: number | null;
  tressAcum: number | null;
  difNomTress: number | null;
  directosContab: number | null;
  indirectosContab: number | null;
  totalContab: number | null;
  difNomContab: number | null;
};

export type ConciliacionConceptoFila = ConciliacionMontosFila & {
  id: string;
  nombre: string;
  estatus: ConciliacionEstatus;
};

export type ConciliacionCategoria = ConciliacionMontosFila & {
  id: string;
  nombre: string;
  tipoLabel: string;
  expanded: boolean;
  difCount: number;
  filas: readonly ConciliacionConceptoFila[];
};

export type ConciliacionPageViewModel = {
  periodoEstado: ConciliacionPeriodoEstado;
  periodoEstadoLabel: string;
  filtros: ConciliacionFiltros;
  summaryCards: readonly ConciliacionSummaryCard[];
  categorias: readonly ConciliacionCategoria[];
};
