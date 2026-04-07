import { mountDashboardPlaceholder } from "./pages/dashboard.ts";
import { mountEmployeeVista360 } from "./pages/empleadoVista360.ts";
import { mountEmpleados } from "./pages/empleados.ts";
import { mountSolicitudes } from "./pages/solicitudes.ts";

let routeAbort: AbortController | null = null;

/** Detiene listeners de hash (p. ej. al cerrar sesión). */
export function abortAuthenticatedShell(): void {
  routeAbort?.abort();
  routeAbort = null;
}

/** SPA por hash: `#/` dashboard, `#/empleados` listado RH. */
export function mountAuthenticatedShell(container: HTMLElement): void {
  routeAbort?.abort();
  routeAbort = new AbortController();
  const { signal } = routeAbort;

  const go = (): void => {
    const h = window.location.hash || "#/";
    const vistaMatch = h.match(/^#\/empleados\/(\d+)\/?/);
    if (vistaMatch) {
      const id = Number.parseInt(vistaMatch[1] ?? "", 10);
      if (!Number.isNaN(id)) {
        mountEmployeeVista360(container, id, signal);
        return;
      }
    }
    if (h.startsWith("#/empleados")) {
      mountEmpleados(container, signal);
    } else if (h.startsWith("#/solicitudes")) {
      mountSolicitudes(container, signal);
    } else {
      mountDashboardPlaceholder(container);
    }
  };

  window.addEventListener("hashchange", go, { signal });
  go();
}
