// ── Nivel de competencia ──────────────────────────────────────────────
export type NivelCompetencia = 1 | 2 | 3 | 4;

export type TipoPuestoPerfil = "administrativo" | "operativo";

/** Global Level del perfil (P10, M3). */
export type GradoPerfilItem = {
  id: number;
  nombre: string;
  orden: number;
  codigo?: string | null;
  career_path_codigo?: string | null;
};

export type EstadoPuestoPerfil = "activo" | "inactivo" | "en_revision";

/**
 * Clasificación organizacional del puesto (Willis Towers Watson).
 *
 * El Global Grade clasifica el puesto dentro de la estructura organizacional;
 * no expresa sueldo, banda salarial ni compensación.
 */
export type ClasificacionPerfil = {
  career_path_id: number | null;
  career_path_codigo: string | null;
  career_path_nombre: string | null;
  funcion_id: number | null;
  funcion_nombre: string | null;
  disciplina_id: number | null;
  disciplina_nombre: string | null;
  global_grade_id: number | null;
  global_grade_codigo: string | null;
  global_grade_nombre: string | null;
  estado: EstadoPuestoPerfil;
  clasificacion_completa: boolean;
  /** Solo llegan en el detalle; el listado los deja en null. */
  clasificado_por: string | null;
  clasificado_en: string | null;
};

/** Un campo que se movió en un evento de clasificación. */
export type ClasificacionCambio = {
  campo: string;
  etiqueta: string;
  anterior: string | null;
  nuevo: string | null;
};

export type ClasificacionHistorialItem = {
  id: number;
  version: number | null;
  cambios: ClasificacionCambio[];
  motivo: string | null;
  changed_by: number | null;
  changed_by_nombre: string | null;
  created_at: string;
};

// ── Competencia tecnica ───────────────────────────────────────────────
export type CompetenciaTecnica = {
  id: string;
  nombre: string;
  descripcion: string;
  nivel_requerido: NivelCompetencia;
};

// ── Habilidad blanda ──────────────────────────────────────────────────
export type HabilidadBlanda = {
  id: string;
  nombre: string;
  nivel_requerido: NivelCompetencia;
};

// ── Maquina / Herramienta ─────────────────────────────────────────────
export type MaquinaHerramienta = {
  id: string;
  nombre: string;
  requiere_certificacion: boolean;
};

// ── Recomendacion IA ──────────────────────────────────────────────────
export type IaRecomendacion = {
  id: string;
  tipo: "competencia_tecnica" | "habilidad_blanda" | "emergente";
  nombre: string;
  descripcion: string;
  confianza: number; // 0-100
  aceptada: boolean;
};

// ── Perfil de puesto completo ─────────────────────────────────────────
export type PerfilPuesto = ClasificacionPerfil & {
  id: number;
  codigo: string; // e.g. "PRF-2024-082"
  nombre_puesto: string;
  area: string;
  area_id: number | null;
  grados: GradoPerfilItem[];
  tipo: TipoPuestoPerfil;
  recomendaciones_ia: IaRecomendacion[];
  version: string; // e.g. "3.2"
  ultima_actualizacion: string; // ISO datetime
};

// ── Resumen para listado / tabla ──────────────────────────────────────
export type PerfilPuestoListItem = ClasificacionPerfil & {
  id: number;
  codigo: string;
  nombre_puesto: string;
  area: string;
  area_id: number | null;
  grados: GradoPerfilItem[];
  tipo: TipoPuestoPerfil;
  version: string;
  ultima_actualizacion: string;
};

// ── Payload para crear / editar ───────────────────────────────────────
export type PerfilPuestoCreatePayload = {
  codigo: string;
  nombre_puesto: string;
  area: string;
  area_id: number;
  grado_ids: number[];
  // Clasificación: obligatoria al crear.
  career_path_id: number;
  funcion_id: number;
  disciplina_id: number;
  /** Solo si el global level no tiene equivalencia configurada. */
  global_grade_id?: number | null;
  estado?: EstadoPuestoPerfil;
  motivo_clasificacion?: string | null;
};

export type PerfilPuestoUpdatePayload = {
  codigo?: string;
  nombre_puesto?: string;
  area?: string;
  area_id?: number;
  grado_ids?: number[];
  tipo?: TipoPuestoPerfil;
  career_path_id?: number;
  funcion_id?: number;
  disciplina_id?: number;
  global_grade_id?: number | null;
  estado?: EstadoPuestoPerfil;
  motivo_clasificacion?: string | null;
};

// ── Respuesta de generacion IA ────────────────────────────────────────
export type GenerateAiResponse = {
  descripcion: string;
  competencias_tecnicas: string[];
  habilidades_blandas: string[];
  maquinas_herramientas: string[];
};

// ── Estado de la pagina ───────────────────────────────────────────────
export type PuestosPageStatus = "loading" | "ready" | "saving" | "error";

export type PuestosFilterState = {
  q: string;
  area: string;
  grado_id: string;
  career_path_id: string;
  funcion_id: string;
  disciplina_id: string;
  global_grade_id: string;
  estado: string;
};

// `gradosSonConsecutivos` y `gradoIdsEntre` vivían aquí, en un archivo de tipos.
// Se movieron a `talento/clasificacionPuestoUi.ts` como `globalLevelsSonConsecutivos`
// y `globalLevelsEntre`, junto al resto de la presentación de la clasificación:
// un rango solo es válido dentro de un mismo career path, y esa regla debe estar
// donde se dibuja el rango.
export {
  globalLevelsEntre as gradoIdsEntre,
  globalLevelsSonConsecutivos as gradosSonConsecutivos,
} from "../../talento/clasificacionPuestoUi.ts";
