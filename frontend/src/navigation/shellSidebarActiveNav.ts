import { resolveComedorSidebarActiveNav } from "./comedorNav.ts";
import { resolveLaboralesSidebarActiveNav } from "./laboralesNav.ts";
import { resolveLevelUpSidebarActiveNav } from "./levelUpNav.ts";

export function resolveShellSidebarActiveNav(activeNav: string | undefined): string | undefined {
  let nav = activeNav;
  nav = resolveLaboralesSidebarActiveNav(nav);
  nav = resolveComedorSidebarActiveNav(nav);
  nav = resolveLevelUpSidebarActiveNav(nav);
  return nav;
}
