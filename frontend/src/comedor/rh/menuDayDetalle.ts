/** Elementos complementarios del menú por día (plantilla Excel, vista previa, API). */
export type ComedorMenuDetalleCategoria =
  | "sopa_o_crema"
  | "guarniciones"
  | "complementos"
  | "tortillas"
  | "postres"
  | "salsas"
  | "aguas";

export type ComedorMenuDiaDetalle = Record<ComedorMenuDetalleCategoria, string[]>;

/** Orden de visualización alineado con la plantilla «Planeación Menú». */
export const MENU_DETALLE_CATEGORIAS: readonly {
  key: ComedorMenuDetalleCategoria;
  label: string;
}[] = [
  { key: "sopa_o_crema", label: "Sopa o crema" },
  { key: "guarniciones", label: "Guarniciones" },
  { key: "complementos", label: "Complementos" },
  { key: "tortillas", label: "Tortilla" },
  { key: "postres", label: "Postre" },
  { key: "salsas", label: "Salsa" },
  { key: "aguas", label: "Aguas" },
];

export function createEmptyMenuDiaDetalle(): ComedorMenuDiaDetalle {
  return {
    sopa_o_crema: [],
    guarniciones: [],
    complementos: [],
    tortillas: [],
    postres: [],
    salsas: [],
    aguas: [],
  };
}

export function appendMenuDetalleItem(list: string[], value: string): void {
  const trimmed = value.trim();
  if (!trimmed) return;
  const exists = list.some((item) => item.toLowerCase() === trimmed.toLowerCase());
  if (!exists) list.push(trimmed);
}

export type TemplateRowTarget =
  | { kind: "plato"; variant: "normal" | "dieta" }
  | { kind: "detalle"; categoria: ComedorMenuDetalleCategoria };

/** Mapea etiquetas de fila de la plantilla «Planeación Menú» a campos del menú. */
export function templateRowTarget(rowLabel: string): TemplateRowTarget | null {
  if (rowLabel === "opcion a") return { kind: "plato", variant: "normal" };
  if (rowLabel === "opcion b") return { kind: "plato", variant: "dieta" };
  if (rowLabel === "sopa o crema" || rowLabel === "sopa" || rowLabel.startsWith("sopa ")) {
    return { kind: "detalle", categoria: "sopa_o_crema" };
  }
  if (rowLabel.startsWith("guarnicion")) return { kind: "detalle", categoria: "guarniciones" };
  if (rowLabel.startsWith("complemento")) return { kind: "detalle", categoria: "complementos" };
  if (rowLabel.startsWith("tortilla")) return { kind: "detalle", categoria: "tortillas" };
  if (rowLabel === "postre" || rowLabel.startsWith("postre ")) {
    return { kind: "detalle", categoria: "postres" };
  }
  if (rowLabel === "salsa" || rowLabel.startsWith("salsa ")) return { kind: "detalle", categoria: "salsas" };
  if (rowLabel === "aguas" || rowLabel.startsWith("agua ")) return { kind: "detalle", categoria: "aguas" };
  return null;
}

export function cloneMenuDiaDetalle(detalle: ComedorMenuDiaDetalle): ComedorMenuDiaDetalle {
  return {
    sopa_o_crema: [...detalle.sopa_o_crema],
    guarniciones: [...detalle.guarniciones],
    complementos: [...detalle.complementos],
    tortillas: [...detalle.tortillas],
    postres: [...detalle.postres],
    salsas: [...detalle.salsas],
    aguas: [...detalle.aguas],
  };
}

/** Fusiona detalle guardado en API con estructura vacía (compatibilidad con registros antiguos). */
export function parseMenuDiaDetalleFromApi(value: unknown): ComedorMenuDiaDetalle {
  const empty = createEmptyMenuDiaDetalle();
  if (!value || typeof value !== "object") return empty;
  const source = value as Record<string, unknown>;
  const readList = (key: ComedorMenuDetalleCategoria): string[] => {
    const raw = source[key];
    if (!Array.isArray(raw)) return [];
    return raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  };
  return {
    sopa_o_crema: readList("sopa_o_crema"),
    guarniciones: readList("guarniciones"),
    complementos: readList("complementos"),
    tortillas: readList("tortillas"),
    postres: readList("postres"),
    salsas: readList("salsas"),
    aguas: readList("aguas"),
  };
}
