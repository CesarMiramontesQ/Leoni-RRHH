import { getRolFromAccessToken } from "../auth/jwt.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { getVisibleLaboralesCategories } from "../navigation/laboralesNav.ts";
import { renderShellHubPage } from "../navigation/shellHubPage.ts";

function renderLaboralesHubPage(): string {
  const rol = getRolFromAccessToken();
  return renderShellHubPage({
    eyebrow: "Operación diaria",
    title: "Laborales",
    description: "Accede a métricas, solicitudes, incidencias y actas desde un solo lugar.",
    categories: getVisibleLaboralesCategories(rol),
    emptyTitle: "Laborales",
    emptyMessage: "No tienes acceso a módulos laborales en este momento.",
    sectionPrefix: "laborales",
  });
}

export function mountLaboralesHub(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Laborales",
    activeNav: "laborales",
    mainHtml: renderLaboralesHubPage(),
  });
}
