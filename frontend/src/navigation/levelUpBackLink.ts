/**
 * Enlace estándar «Volver» al hub principal de Level Up (#/level-up).
 */

import { renderModuleBackBar, renderModuleBackLink } from "./moduleBackLink.ts";

export const LEVEL_UP_HUB_HREF = "#/level-up";

/** Botón/enlace «Volver» al menú principal de Level Up. */
export function renderLevelUpBackLink(): string {
  return renderModuleBackLink(LEVEL_UP_HUB_HREF, "Volver a Level Up");
}

/** Contenedor con margen inferior para ubicar el enlace antes del encabezado de página. */
export function renderLevelUpBackBar(): string {
  return renderModuleBackBar(LEVEL_UP_HUB_HREF, "Volver a Level Up");
}
