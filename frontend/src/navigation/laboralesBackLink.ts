/**
 * Enlace estándar «Volver» al hub principal de Laborales (#/laborales).
 */

import { getRolFromAccessToken } from "../auth/jwt.ts";
import { LABORALES_SIDEBAR_ITEM } from "./laboralesNav.ts";
import { renderModuleBackBar, renderModuleBackLink } from "./moduleBackLink.ts";

export const LABORALES_HUB_HREF = LABORALES_SIDEBAR_ITEM.href;

export function renderLaboralesBackLink(): string {
  return renderModuleBackLink(LABORALES_HUB_HREF, "Volver a Laborales");
}

export function renderLaboralesBackBar(): string {
  return renderModuleBackBar(LABORALES_HUB_HREF, "Volver a Laborales");
}

/** Barra «Volver» en Solicitudes: oculta para rol Empleado (opción principal del menú). */
export function renderSolicitudesBackBar(): string {
  if (getRolFromAccessToken() === "empleado") return "";
  return renderLaboralesBackBar();
}
