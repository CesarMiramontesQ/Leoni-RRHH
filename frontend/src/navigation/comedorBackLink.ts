/**
 * Enlace estándar «Volver» al hub principal de Comedor (#/comedor/accesos).
 */

import { COMEDOR_SIDEBAR_ITEM } from "./comedorNav.ts";
import { renderModuleBackBar, renderModuleBackLink } from "./moduleBackLink.ts";

export const COMEDOR_HUB_HREF = COMEDOR_SIDEBAR_ITEM.href;

export function renderComedorBackLink(): string {
  return renderModuleBackLink(COMEDOR_HUB_HREF, "Volver a Comedor");
}

export function renderComedorBackBar(): string {
  return renderModuleBackBar(COMEDOR_HUB_HREF, "Volver a Comedor");
}
