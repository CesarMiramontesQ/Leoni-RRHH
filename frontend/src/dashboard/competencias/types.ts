// ── Nivel de celda en la matriz ───────────────────────────────────────
export type NivelMatriz = 0 | 1 | 2 | 3 | 4;

// ── Puesto (columna) ─────────────────────────────────────────────────
export type PuestoColumna = {
  id: string;
  nombre: string;
  abreviacion?: string;
};

// ── Competencia (fila) ────────────────────────────────────────────────
export type CompetenciaFila = {
  id: string;
  nombre: string;
  grupo: "tecnica" | "habilidad_blanda";
};

// ── Celda editable ────────────────────────────────────────────────────
export type CeldaMatriz = {
  competencia_id: string;
  puesto_id: string;
  nivel: NivelMatriz;
};

// ── Gap critico ───────────────────────────────────────────────────────
export type GapCritico = {
  competencia_nombre: string;
  puesto_nombre: string;
  nivel_actual_promedio: number;
  nivel_requerido: NivelMatriz;
  porcentaje_brecha: number;
  empleados_afectados: number;
};

// ── Resumen de la matriz ──────────────────────────────────────────────
export type MatrizResumen = {
  porcentaje_cumplimiento: number;
  total_empleados: number;
  total_requisitos: number;
};

// ── Auditoria ────────────────────────────────────────────────────────
export type AuditoriaInfo = {
  nombre: string;
  dias_restantes: number;
  meta_trimestral: number;
  tendencia_vs_mes_anterior: number;
};

// ── Filtros ───────────────────────────────────────────────────────────
export type CompetenciasFilterState = {
  area_id: string;
  linea_id: string;
  sector_id: string;
};

export type CompetenciasFilterOptions = {
  areas: ReadonlyArray<{ id: string; label: string }>;
  lineas: ReadonlyArray<{ id: string; label: string }>;
  sectores: ReadonlyArray<{ id: string; label: string }>;
};

// ── Catalogo de competencias (CRUD) ──────────────────────────────────
export type Competencia = {
  id: number;
  nombre: string;
  grupo: "tecnica" | "habilidad_blanda";
  subcategoria?: string;
  descripcion: string;
  activa: boolean;
  created_at: string;
};

export type CompetenciaCreatePayload = {
  nombre: string;
  grupo: "tecnica" | "habilidad_blanda";
  subcategoria?: string;
  descripcion: string;
};

export type CompetenciaUpdatePayload = {
  nombre?: string;
  grupo?: "tecnica" | "habilidad_blanda";
  subcategoria?: string;
  descripcion?: string;
  activa?: boolean;
};

// ── Brecha item (tabla de brechas) ───────────────────────────────────
export type BrechaItem = {
  competencia_nombre: string;
  puesto_nombre: string;
  nivel_actual_promedio: number;
  nivel_requerido: NivelMatriz;
  porcentaje_brecha: number;
  empleados_afectados: number;
  severidad: "critica" | "alta" | "media" | "baja";
};

// ── Fila de matriz (para tabla editable) ─────────────────────────────
export type MatrizRow = {
  competencia: CompetenciaFila;
  niveles: Record<string, NivelMatriz>; // key = puesto_id
};

// ── Estado de pagina ──────────────────────────────────────────────────
export type CompetenciasTab = "catalogo" | "matriz" | "brechas";

export type CompetenciasPageStatus = "loading" | "ready" | "saving" | "error";

export type CompetenciasPageState = {
  status: CompetenciasPageStatus;
  activeTab: CompetenciasTab;
  // Catalogo
  catalogoItems: Competencia[];
  catalogoFilter: string;
  // Matriz
  filters: CompetenciasFilterState;
  filterOptions: CompetenciasFilterOptions;
  puestos: PuestoColumna[];
  competencias: CompetenciaFila[];
  celdas: CeldaMatriz[];
  celdasModificadas: Map<string, NivelMatriz>;
  resumen: MatrizResumen | null;
  // Brechas
  gaps: GapCritico[];
  brechas: BrechaItem[];
  auditoria: AuditoriaInfo | null;
  errorMessage: string | null;
};
