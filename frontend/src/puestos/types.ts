/**
 * Re-exporta tipos del dominio de puestos desde la ubicacion canonica.
 * Esto permite a los componentes importar desde `../../puestos/types.ts`
 * segun la estructura definida en el spec.
 */
export type {
  NivelCompetencia,
  CompetenciaTecnica,
  HabilidadBlanda,
  MaquinaHerramienta,
  IaRecomendacion,
  PerfilPuesto,
  PerfilPuestoListItem,
  PerfilPuestoCreatePayload,
  PerfilPuestoUpdatePayload,
  GenerateAiResponse,
  PuestosPageStatus,
  PuestosFilterState,
  TipoPuestoPerfil,
} from "../dashboard/puestos/types.ts";
