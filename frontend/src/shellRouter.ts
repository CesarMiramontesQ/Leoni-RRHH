import { mountDashboardPlaceholder } from "./pages/dashboard.ts";
import { mountEmpleados } from "./pages/empleados.ts";

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
    if (h.startsWith("#/empleados")) {
      mountEmpleados(container, signal);
    } else {
      mountDashboardPlaceholder(container);
    }
  };

  window.addEventListener("hashchange", go, { signal });
  go();
}
