import { getRolFromAccessToken } from "../auth/jwt.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { getVisibleLevelUpCategories } from "../navigation/levelUpNav.ts";
import { renderShellHubPage } from "../navigation/shellHubPage.ts";

function renderLevelUpHubPage(): string {
  const rol = getRolFromAccessToken();
  const categories = getVisibleLevelUpCategories(rol).map((category) => ({
    id: category.id,
    title: category.title,
    items: category.items.map(({ href, label, svgPaths }) => ({ href, label, svgPaths })),
  }));

  return renderShellHubPage({
    eyebrow: "Desarrollo y cumplimiento",
    title: "Level Up",
    description: "Accede a las herramientas de talento, formación y cumplimiento desde un solo lugar.",
    categories,
    emptyTitle: "Level Up",
    emptyMessage: "No tienes acceso a módulos de Level Up en este momento.",
    sectionPrefix: "level-up",
  });
}

export function mountLevelUpHub(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Level Up",
    activeNav: "level-up",
    mainHtml: renderLevelUpHubPage(),
  });
}
