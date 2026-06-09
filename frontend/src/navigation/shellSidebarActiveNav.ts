import { getRolFromAccessToken } from "../auth/jwt.ts";
import { resolveComedorSidebarActiveNav } from "./comedorNav.ts";
import { resolveLaboralesSidebarActiveNav } from "./laboralesNav.ts";
import { resolveLevelUpSidebarActiveNav } from "./levelUpNav.ts";

export function resolveShellSidebarActiveNav(activeNav: string | undefined): string | undefined {
  const rol = getRolFromAccessToken();
  let nav = activeNav;
  nav = resolveLaboralesSidebarActiveNav(nav, rol);
  nav = resolveComedorSidebarActiveNav(nav);
  nav = resolveLevelUpSidebarActiveNav(nav);
  return nav;
}
