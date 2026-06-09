/**
 * Enlace estándar «Volver» al hub principal de Comedor (#/comedor/accesos).
 */

import { getRolFromAccessToken } from "../auth/jwt.ts";
import { COMEDOR_SIDEBAR_ITEM } from "./comedorNav.ts";
import { renderModuleBackBar, renderModuleBackLink } from "./moduleBackLink.ts";

export const COMEDOR_HUB_HREF = COMEDOR_SIDEBAR_ITEM.href;

export function renderComedorBackLink(): string {
  if (getRolFromAccessToken() === "empleado") return "";
  return renderModuleBackLink(COMEDOR_HUB_HREF, "Volver a Comedor");
}

export function renderComedorBackBar(): string {
  if (getRolFromAccessToken() === "empleado") return "";
  return renderModuleBackBar(COMEDOR_HUB_HREF, "Volver a Comedor");
}
