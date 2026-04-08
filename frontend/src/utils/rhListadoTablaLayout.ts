/** Filas visibles mínimas para reservar scroll vertical en el viewport (Solicitudes, Incidencias, etc.). */
export const RH_LISTADO_TABLA_MIN_FILAS_SCROLL_VERTICAL = 10;

export function rhListadoTablaUsaScrollVerticalViewport(visibleRowCount: number): boolean {
  return visibleRowCount >= RH_LISTADO_TABLA_MIN_FILAS_SCROLL_VERTICAL;
}

/** Clases Tailwind para la sección de tabla y el contenedor con scroll. */
export function rhListadoTablaClasesLayoutScroll(usaScrollVertical: boolean): {
  sectionLayoutCls: string;
  bodyWrapCls: string;
} {
  if (usaScrollVertical) {
    return {
      sectionLayoutCls: "flex min-h-0 flex-1 flex-col overflow-hidden",
      bodyWrapCls: "min-h-0 flex-1 overflow-auto -mx-4 sm:mx-0",
    };
  }
  return {
    sectionLayoutCls: "shrink-0 overflow-hidden",
    bodyWrapCls: "overflow-x-auto -mx-4 sm:mx-0",
  };
}
