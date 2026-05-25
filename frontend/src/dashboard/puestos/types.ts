// ── Nivel de competencia ──────────────────────────────────────────────
export type NivelCompetencia = 1 | 2 | 3 | 4;

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
export type PerfilPuesto = {
  id: number;
  codigo: string; // e.g. "PRF-2024-082"
  nombre_puesto: string;
  area: string;
  nivel: string; // e.g. "operativo", "mando_medio", "gerencial"
  recomendaciones_ia: IaRecomendacion[];
  version: string; // e.g. "3.2"
  ultima_actualizacion: string; // ISO datetime
};

// ── Resumen para listado / tabla ──────────────────────────────────────
export type PerfilPuestoListItem = {
  id: number;
  codigo: string;
  nombre_puesto: string;
  area: string;
  nivel: string;
  version: string;
  ultima_actualizacion: string;
};

// ── Payload para crear / editar ───────────────────────────────────────
export type PerfilPuestoCreatePayload = {
  codigo: string;
  nombre_puesto: string;
  area: string;
  area_id: number | null;
  nivel: string;
};

export type PerfilPuestoUpdatePayload = {
  codigo?: string;
  nombre_puesto?: string;
  area?: string;
  area_id?: number | null;
  nivel?: string;
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
  nivel: string;
};
