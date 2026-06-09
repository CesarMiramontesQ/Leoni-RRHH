/** Prefijos hash del módulo Level Up donde se restablece el scroll al entrar. */
const LEVEL_UP_ROUTE_PREFIXES = [
  "#/level-up",
  "#/cursos",
  "#/sesiones",
  "#/capacitaciones",
  "#/puestos",
  "#/competencias",
  "#/tareas-catalogo",
  "#/capacidades",
  "#/evaluaciones",
  "#/opls",
  "#/evidencias",
  "#/sugerencias",
  "#/encuestas",
] as const;

export function isLevelUpRouteHash(hash: string): boolean {
  const h = hash || "#/";
  return LEVEL_UP_ROUTE_PREFIXES.some((prefix) => h === prefix || h.startsWith(`${prefix}/`));
}

export function resetPageScroll(): void {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

/** Restablece scroll tras pintar el DOM de la nueva vista. */
export function schedulePageScrollReset(): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => resetPageScroll());
  });
}
