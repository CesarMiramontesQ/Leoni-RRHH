export function rhListadoTablaUsaScrollVerticalViewport(visibleRowCount: number): boolean {
  void visibleRowCount;
  return false;
}

/** Clases Tailwind para la sección de tabla y el contenedor con scroll. */
export function rhListadoTablaClasesLayoutScroll(usaScrollVertical: boolean): {
  sectionLayoutCls: string;
  bodyWrapCls: string;
} {
  void usaScrollVertical;
  return {
    sectionLayoutCls: "shrink-0 overflow-hidden",
    bodyWrapCls: "overflow-x-auto -mx-4 sm:mx-0",
  };
}
