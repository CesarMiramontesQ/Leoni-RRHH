/**
 * Cobertura del caso "supervisor sin permiso de horas extra" a nivel de render.
 *
 * Vive en un archivo aparte de `appShell.render.test.ts` porque
 * `isHorasExtraRegistroAutorizado` se mockea por archivo (vi.mock aplica a todo el
 * módulo dentro del archivo que lo declara), y ese otro archivo la fija en `true`
 * para poder seguir afirmando sobre el conteo de `<details>` con las tres secciones
 * plegables presentes (ver su comentario junto al mock de `../auth/jwt.ts`).
 *
 * El motivo concreto: mover Comedor fuera de "Mis trámites" dejó a esa sección con
 * un único ítem condicional (`horas-extra-solicitud`). `supervisorNav.test.ts` ya
 * prueba, en la capa de datos, que `getVisibleSupervisorNavSections` descarta la
 * sección cuando queda vacía. Este archivo cierra el lazo en la capa de HTML: prueba
 * sobre la salida real de `renderSupervisorSidebarSections` que sin el permiso hay
 * 2 `<details>` (no 3), que el título "Mis trámites" no aparece, y que Comedor —
 * el punto del cambio— sigue apareciendo exactamente una vez porque ya no depende
 * de esa sección.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../auth/jwt.ts", () => ({
  getRolFromAccessToken: () => "supervisor",
  getRhGestorAlcanceFromToken: () => null,
  getAccessTokenPayload: () => null,
  isHorasExtraAprobador: () => false,
  isHorasExtraRegistroAutorizado: () => false,
  canAccessEmpleadoPersonalDashboard: () => false,
  getUserDisplayNameFromAccessToken: () => "",
  getUserInitialsFromAccessToken: () => "",
}));

vi.mock("../auth/rhUiMode.ts", () => ({
  isAdminUser: () => false,
  isNonRhRhMode: () => false,
  isNonRhPermisosUser: () => false,
  isRhDirectorUiMode: () => false,
  isRhEmpleadoUiMode: () => false,
  isRhGerenteUiMode: () => false,
  isRhGestorTeamUiMode: () => false,
  isRhLiderUiMode: () => false,
  isRhOperativoUiMode: () => false,
  hasRhPermisosActivos: () => false,
  getRhUiModeLabel: () => "",
  isRhToggleOn: () => false,
  toggleNonRhRhMode: () => {},
  toggleRhUiMode: () => {},
  setAdminUser: () => {},
  setRhInPermisosList: () => {},
  setRhPermisosActivos: () => {},
  getRhUiModeHeaderValue: () => null,
}));

import { renderSupervisorSidebarSections } from "./appShell.ts";

describe("renderSupervisorSidebarSections sin permiso de horas extra", () => {
  it("pinta 2 <details> (no 3), sin el título 'Mis trámites', y Comedor sigue arriba una sola vez", () => {
    const html = renderSupervisorSidebarSections(undefined, "supervisor");
    const detailsBlocks = html.match(/<details[\s\S]*?<\/details>/g) ?? [];
    expect(detailsBlocks).toHaveLength(2);
    expect(html).not.toContain("Mis trámites");
    expect((html.match(/href="#\/comedor"/g) ?? []).length).toBe(1);
  });
});
