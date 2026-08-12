/**
 * La página de logs del scheduler no debe aparecer en ninguna parte de la navegación.
 *
 * Es un test de regresión: hoy pasa desde el primer momento. Su trabajo es fallar el día
 * que alguien "acomode" el menú de usuario y le agregue el enlace, que es exactamente lo
 * que la feature pide que no exista.
 *
 * Nota de entorno: este proyecto corre vitest con `environment: "node"` (sin
 * jsdom/happy-dom, ver frontend/vitest.config.ts), y `document`/`window` no existen.
 * `mountAppShell` sí toca `document.title`, `document.addEventListener` y
 * `requestAnimationFrame` además de escribir en el contenedor, así que se stubean esos
 * globals con lo mínimo que la función necesita para completar el mount sin lanzar. El
 * contenedor es un doble mínimo (mismo patrón que `dashboardTalento.test.ts`): solo
 * `innerHTML` y un `querySelector` que siempre devuelve `null`, que es justo lo que
 * `mountAppShell` ya tolera en cada llamada (encadena `?.` o corta con `if (!x) return`).
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../auth/jwt.ts", () => ({
  getRolFromAccessToken: () => "rh",
  getRhGestorAlcanceFromToken: () => null,
  getAccessTokenPayload: () => null,
  isHorasExtraAprobador: () => false,
  isHorasExtraRegistroAutorizado: () => false,
  canAccessEmpleadoPersonalDashboard: () => false,
  getUserDisplayNameFromAccessToken: () => "Admin Prueba",
  getUserInitialsFromAccessToken: () => "AP",
}));

vi.mock("../auth/rhUiMode.ts", () => ({
  isAdminUser: () => true,
  isNonRhRhMode: () => false,
  isNonRhPermisosUser: () => false,
  isRhDirectorUiMode: () => false,
  isRhEmpleadoUiMode: () => false,
  isRhGerenteUiMode: () => false,
  isRhGestorTeamUiMode: () => false,
  isRhLiderUiMode: () => false,
  isRhOperativoUiMode: () => true,
  hasRhPermisosActivos: () => true,
  getRhUiModeLabel: () => "",
  isRhToggleOn: () => false,
  toggleNonRhRhMode: () => {},
  toggleRhUiMode: () => {},
  setAdminUser: () => {},
  setRhInPermisosList: () => {},
  setRhPermisosActivos: () => {},
  getRhUiModeHeaderValue: () => null,
}));

vi.stubGlobal("document", {
  title: "",
  addEventListener: () => {},
  removeEventListener: () => {},
});
vi.stubGlobal("window", { location: { hash: "" } });
vi.stubGlobal("requestAnimationFrame", () => {});

/** Doble mínimo de `HTMLElement`: solo lo que `mountAppShell` consume del contenedor. */
class FakeElement {
  innerHTML = "";
  querySelector(): null {
    return null;
  }
}

describe("appShell — la página de logs del scheduler está oculta", () => {
  it("no aparece en el menú de usuario ni en el sidebar, ni para un admin", async () => {
    const { mountAppShell } = await import("./appShell.ts");
    const host = new FakeElement();

    mountAppShell(host as unknown as HTMLElement, {
      pageTitle: "Dashboard",
      activeNav: "dashboard",
      mainHtml: "<div></div>",
    });

    expect(host.innerHTML).not.toContain("scheduler-logs");
    expect(host.innerHTML).not.toContain("Logs del scheduler");
  });
});
