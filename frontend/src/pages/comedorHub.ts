import { getRolFromAccessToken } from "../auth/jwt.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { getVisibleComedorCategories } from "../navigation/comedorNav.ts";
import { renderShellHubPage } from "../navigation/shellHubPage.ts";

function renderComedorHubPage(): string {
  const rol = getRolFromAccessToken();
  return renderShellHubPage({
    eyebrow: "Servicios al personal",
    title: "Comedor",
    description: "Accede a la gestión del comedor y reportes desde un solo lugar.",
    categories: getVisibleComedorCategories(rol),
    emptyTitle: "Comedor",
    emptyMessage: "No tienes acceso a módulos de comedor en este momento.",
    sectionPrefix: "comedor",
  });
}

export function mountComedorHub(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Comedor",
    activeNav: "comedor",
    mainHtml: renderComedorHubPage(),
  });
}
