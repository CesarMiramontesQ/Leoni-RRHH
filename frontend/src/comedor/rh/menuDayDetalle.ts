/** Elementos complementarios del menú por día (vista previa / importación Excel). */
export type ComedorMenuDetalleCategoria = "complementos" | "guarniciones" | "salsas" | "tortillas" | "aguas";

export type ComedorMenuDiaDetalle = Record<ComedorMenuDetalleCategoria, string[]>;

export const MENU_DETALLE_CATEGORIAS: readonly {
  key: ComedorMenuDetalleCategoria;
  label: string;
}[] = [
  { key: "complementos", label: "Complementos" },
  { key: "guarniciones", label: "Guarniciones" },
  { key: "salsas", label: "Salsas" },
  { key: "tortillas", label: "Tortillas" },
  { key: "aguas", label: "Aguas" },
];

export function createEmptyMenuDiaDetalle(): ComedorMenuDiaDetalle {
  return {
    complementos: [],
    guarniciones: [],
    salsas: [],
    tortillas: [],
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
  if (rowLabel.startsWith("guarnicion")) return { kind: "detalle", categoria: "guarniciones" };
  if (rowLabel.startsWith("complemento")) return { kind: "detalle", categoria: "complementos" };
  if (rowLabel === "salsa" || rowLabel.startsWith("salsa ")) return { kind: "detalle", categoria: "salsas" };
  if (rowLabel.startsWith("tortilla")) return { kind: "detalle", categoria: "tortillas" };
  if (rowLabel === "aguas" || rowLabel.startsWith("agua ")) return { kind: "detalle", categoria: "aguas" };
  return null;
}

export function cloneMenuDiaDetalle(detalle: ComedorMenuDiaDetalle): ComedorMenuDiaDetalle {
  return {
    complementos: [...detalle.complementos],
    guarniciones: [...detalle.guarniciones],
    salsas: [...detalle.salsas],
    tortillas: [...detalle.tortillas],
    aguas: [...detalle.aguas],
  };
}

