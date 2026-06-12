export type CategoriaCompetencia = "tecnica" | "blanda";

function normalizeNombre(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

const NOMBRES_TECNICA = new Set(["tecnica", "tecnicas", "competencias tecnicas"]);
const NOMBRES_BLANDA = new Set([
  "habilidad blanda",
  "habilidades blandas",
  "blanda",
  "competencias blandas",
]);

/** Deriva categoria (tecnica|blanda) a partir del nombre del grupo — alineado con backend. */
export function categoriaDesdeGrupoNombre(nombre: string): CategoriaCompetencia {
  const key = normalizeNombre(nombre);
  if (NOMBRES_TECNICA.has(key)) return "tecnica";
  if (NOMBRES_BLANDA.has(key)) return "blanda";
  if (key.includes("tecnica")) return "tecnica";
  if (key.includes("blanda") || key.includes("habilidad")) return "blanda";
  return "blanda";
}

export function grupoCompetenciaBadgeClasses(categoria: CategoriaCompetencia): string {
  return categoria === "tecnica"
    ? "border-blue-200 bg-blue-50 text-blue-800"
    : "border-violet-200 bg-violet-50 text-violet-900";
}
