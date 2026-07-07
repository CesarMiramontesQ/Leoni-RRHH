import { COMEDOR_HUB_HREF } from "./comedorBackLink.ts";
import { LABORALES_HUB_HREF } from "./laboralesBackLink.ts";
import { LEVEL_UP_HUB_HREF } from "./levelUpBackLink.ts";

const LEVEL_UP_ROUTE_PREFIXES = [
  "#/level-up",
  "#/level-up/evaluacion-360",
  "#/cursos",
  "#/sesiones",
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

const COMEDOR_ROUTE_PREFIXES = [
  COMEDOR_HUB_HREF,
  "#/comedor",
  "#/reportes",
] as const;

const LABORALES_ROUTE_PREFIXES = [
  LABORALES_HUB_HREF,
  "#/metricas",
  "#/solicitudes",
  "#/incidencias",
  "#/actas",
  "#/viajes-laborales",
] as const;

function matchesRoutePrefix(hash: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => hash === prefix || hash.startsWith(`${prefix}/`));
}

export function isLevelUpRouteHash(hash: string): boolean {
  return matchesRoutePrefix(hash || "#/", LEVEL_UP_ROUTE_PREFIXES);
}

export function isComedorRouteHash(hash: string): boolean {
  return matchesRoutePrefix(hash || "#/", COMEDOR_ROUTE_PREFIXES);
}

export function isLaboralesRouteHash(hash: string): boolean {
  return matchesRoutePrefix(hash || "#/", LABORALES_ROUTE_PREFIXES);
}

export function shouldResetScrollOnRoute(hash: string): boolean {
  const h = hash || "#/";
  return isLevelUpRouteHash(h) || isComedorRouteHash(h) || isLaboralesRouteHash(h);
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
