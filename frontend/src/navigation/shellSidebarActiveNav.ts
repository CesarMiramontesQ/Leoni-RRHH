import { getRolFromAccessToken } from "../auth/jwt.ts";
import { usesRhStructuredSidebar } from "./shellNavPolicy.ts";
import { resolveComedorSidebarActiveNav } from "./comedorNav.ts";
import { resolveLaboralesSidebarActiveNav } from "./laboralesNav.ts";
import { resolveLevelUpSidebarActiveNav } from "./levelUpNav.ts";
import { resolveNominasSidebarActiveNav } from "./nominasNav.ts";

export function resolveShellSidebarActiveNav(activeNav: string | undefined): string | undefined {
  const rol = getRolFromAccessToken();
  if (usesRhStructuredSidebar(rol)) {
    return activeNav;
  }
  let nav = activeNav;
  nav = resolveLaboralesSidebarActiveNav(nav, rol);
  nav = resolveComedorSidebarActiveNav(nav);
  nav = resolveLevelUpSidebarActiveNav(nav);
  nav = resolveNominasSidebarActiveNav(nav);
  return nav;
}
