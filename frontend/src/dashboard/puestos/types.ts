// ── Nivel de competencia ──────────────────────────────────────────────
export type NivelCompetencia = 1 | 2 | 3 | 4;

export type TipoPuestoPerfil = "administrativo" | "operativo";

export type GradoPerfilItem = {
  id: number;
  nombre: string;
  orden: number;
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
export type PerfilPuesto = {
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
export type PerfilPuestoListItem = {
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
};

export type PerfilPuestoUpdatePayload = {
  codigo?: string;
  nombre_puesto?: string;
  area?: string;
  area_id?: number;
  grado_ids?: number[];
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
};

/** Valida que los IDs formen un rango consecutivo por `orden` del catálogo. */
export function gradosSonConsecutivos(
  catalogo: { id: number; orden: number }[],
  gradoIds: number[],
): boolean {
  if (gradoIds.length === 0) return false;
  if (new Set(gradoIds).size !== gradoIds.length) return false;
  const selected = catalogo
    .filter((g) => gradoIds.includes(g.id))
    .sort((a, b) => a.orden - b.orden);
  if (selected.length !== gradoIds.length) return false;
  return selected[selected.length - 1].orden - selected[0].orden + 1 === selected.length;
}

/** IDs de grados entre dos extremos (inclusive), ordenados por `orden`. */
export function gradoIdsEntre(
  catalogo: { id: number; orden: number }[],
  desdeId: number,
  hastaId: number,
): number[] {
  const desde = catalogo.find((g) => g.id === desdeId);
  const hasta = catalogo.find((g) => g.id === hastaId);
  if (!desde || !hasta) return [];
  const lo = Math.min(desde.orden, hasta.orden);
  const hi = Math.max(desde.orden, hasta.orden);
  return catalogo
    .filter((g) => g.orden >= lo && g.orden <= hi)
    .sort((a, b) => a.orden - b.orden)
    .map((g) => g.id);
}
