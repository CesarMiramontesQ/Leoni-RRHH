import { getRolFromAccessToken } from "./auth/jwt.ts";
import {
  empleadoMayAccessHash,
  modulosMayAccessHash,
  rhMayAccessHash,
  supervisorMayAccessHash,
} from "./navigation/shellNavPolicy.ts";
import { isModulosRhEnrolled } from "./auth/rhModulePermissions.ts";
import { isRhEmpleadoUiMode, RH_UI_MODE_CHANGE_EVENT } from "./auth/rhUiMode.ts";
import { mountDashboardPlaceholder } from "./pages/dashboard.ts";
import { mountEmployeeVista360, parseVista360InitialTabFromHash } from "./pages/empleadoVista360.ts";
import { mountActas } from "./pages/actas.ts";
import { mountActaDetalle } from "./pages/actaDetalle.ts";
import { mountEmpleados } from "./pages/empleados.ts";
import { mountIncidencias } from "./pages/incidencias.ts";
import { mountComedor } from "./pages/comedor.ts";
import { mountNotificaciones } from "./pages/notificaciones.ts";
import { mountOrganigrama } from "./pages/organigrama.ts";
import { mountPuestos } from "./pages/puestos.ts";
import { mountPerfilPuestoDetalle } from "./pages/perfilPuestoDetalle.ts";
import { mountPuestoEmpleados } from "./pages/puestoEmpleados.ts";
import { mountMetricas } from "./pages/metricas.ts";
import { mountSolicitudes } from "./pages/solicitudes.ts";
import { mountCompetencias } from "./pages/competencias.ts";
import { mountTareasCatalogo } from "./pages/tareasCatalogo.ts";
import { mountEvaluaciones } from "./pages/evaluaciones.ts";
import { mountCapacitaciones } from "./pages/capacitaciones.ts";
import { mountEvaluacionEmpleado } from "./pages/evaluacionEmpleado.ts";
import { canAccessOrganigramaPage } from "./auth/jwt.ts";
import {
  mountLevelUpDashboard,
  mountCursos,
  mountOPLs,
  mountEvidencias,
  mountSugerencias,
  mountEncuestas,
} from "./pages/levelUp.ts";
import { mountCapacidades } from "./pages/capacidades.ts";
import { mountSesiones } from "./pages/sesiones.ts";
import { mountSesionDetalle } from "./pages/sesionDetalle.ts";
import { mountAjustesPermisosRh, mountRhModuleAccessDenied } from "./pages/ajustesPermisosRh.ts";

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
    const rawHash = window.location.hash || "#/";
    if (getRolFromAccessToken() === "empleado" && !empleadoMayAccessHash(rawHash)) {
      history.replaceState(null, "", "#/");
    }
    if (getRolFromAccessToken() === "supervisor" && !supervisorMayAccessHash(rawHash)) {
      history.replaceState(null, "", "#/");
    }
    const rol = getRolFromAccessToken();
    if (rol === "rh" && !rhMayAccessHash(rawHash)) {
      if (isRhEmpleadoUiMode()) {
        if (rawHash !== "#/") {
          history.replaceState(null, "", "#/");
        }
        routeToHash(container, signal, "#/");
        return;
      }
      mountRhModuleAccessDenied(container);
      return;
    }
    if (rol !== "rh" && isModulosRhEnrolled() && !modulosMayAccessHash(rawHash, rol)) {
      mountRhModuleAccessDenied(container);
      return;
    }
    const h =
      rol === "empleado" && !empleadoMayAccessHash(rawHash) ? "#/"
      : rol === "supervisor" && !supervisorMayAccessHash(rawHash) ? "#/"
      : rawHash;

    routeToHash(container, signal, h);
  };

  const routeToHash = (container: HTMLElement, signal: AbortSignal, h: string): void => {

    if (h.startsWith("#/ajustes/permisos-rh")) {
      mountAjustesPermisosRh(container, signal);
      return;
    }

    if (h.startsWith("#/reportes")) {
      history.replaceState(null, "", "#/comedor/reporte");
      mountComedor(container, signal);
      return;
    }

    if (h.startsWith("#/comedor")) {
      mountComedor(container, signal);
      return;
    }
    if (h.startsWith("#/notificaciones")) {
      mountNotificaciones(container, signal);
      return;
    }
    if (h.startsWith("#/organigrama")) {
      if (!canAccessOrganigramaPage()) {
        history.replaceState(null, "", "#/");
        mountDashboardPlaceholder(container);
        return;
      }
      mountOrganigrama(container, signal);
      return;
    }
    const actaMatch = h.match(/^#\/actas\/(\d+)\/?/);
    if (actaMatch) {
      const id = Number.parseInt(actaMatch[1] ?? "", 10);
      if (!Number.isNaN(id)) {
        mountActaDetalle(container, id, signal);
        return;
      }
    }

    if (h.startsWith("#/actas")) {
      mountActas(container);
      return;
    }

    if (h.startsWith("#/level-up")) {
      mountLevelUpDashboard(container);
      return;
    }
    if (h.startsWith("#/capacidades")) {
      mountCapacidades(container, signal);
      return;
    }
    if (h.startsWith("#/cursos")) {
      mountCursos(container);
      return;
    }
    if (h.startsWith("#/opls")) {
      mountOPLs(container);
      return;
    }
    if (h.startsWith("#/evidencias")) {
      mountEvidencias(container);
      return;
    }
    if (h.startsWith("#/sugerencias")) {
      mountSugerencias(container);
      return;
    }
    if (h.startsWith("#/encuestas")) {
      mountEncuestas(container);
      return;
    }
    const sesionDetalleMatch = h.match(/^#\/sesiones\/(\d+)\/(\d+)/);
    if (sesionDetalleMatch) {
      const cId = Number.parseInt(sesionDetalleMatch[1] ?? "", 10);
      const sId = Number.parseInt(sesionDetalleMatch[2] ?? "", 10);
      if (!Number.isNaN(cId) && !Number.isNaN(sId)) {
        mountSesionDetalle(container, cId, sId, signal);
        return;
      }
    }
    if (h.startsWith("#/sesiones")) {
      mountSesiones(container);
      return;
    }

    const puestoEmpleadosMatch = h.match(/^#\/puestos\/(\d+)\/empleados/);
    if (puestoEmpleadosMatch) {
      const id = Number.parseInt(puestoEmpleadosMatch[1] ?? "", 10);
      if (!Number.isNaN(id)) {
        mountPuestoEmpleados(container, id);
        return;
      }
    }

    const puestoDetalleMatch = h.match(/^#\/puestos\/(\d+)$/);
    if (puestoDetalleMatch) {
      const id = Number.parseInt(puestoDetalleMatch[1] ?? "", 10);
      if (!Number.isNaN(id)) {
        mountPerfilPuestoDetalle(container, id);
        return;
      }
    }
    if (h.startsWith("#/puestos")) {
      mountPuestos(container, signal);
      return;
    }

    if (h.startsWith("#/competencias")) {
      mountCompetencias(container, signal);
      return;
    }

    if (h.startsWith("#/tareas-catalogo")) {
      mountTareasCatalogo(container, signal);
      return;
    }

    const vistaMatch = h.match(/^#\/empleados\/(\d+)/);
    if (vistaMatch) {
      const id = Number.parseInt(vistaMatch[1] ?? "", 10);
      if (!Number.isNaN(id)) {
        mountEmployeeVista360(container, id, signal, { initialTab: parseVista360InitialTabFromHash(h) });
        return;
      }
    }
    const evalEmpMatch = h.match(/^#\/evaluaciones\/empleado\/(\d+)/);
    if (evalEmpMatch) {
      const id = Number.parseInt(evalEmpMatch[1] ?? "", 10);
      if (!Number.isNaN(id)) {
        mountEvaluacionEmpleado(container, id, signal);
        return;
      }
    }
    if (h.startsWith("#/capacitaciones")) {
      mountCapacitaciones(container, signal);
    } else if (h.startsWith("#/evaluaciones")) {
      mountEvaluaciones(container, signal);
    } else if (h.startsWith("#/empleados")) {
      mountEmpleados(container, signal);
    } else if (h.startsWith("#/metricas")) {
      mountMetricas(container, signal);
    } else if (h.startsWith("#/solicitudes")) {
      mountSolicitudes(container, signal);
    } else if (h.startsWith("#/incidencias")) {
      mountIncidencias(container, signal);
    } else {
      mountDashboardPlaceholder(container);
    }
  };

  window.addEventListener("hashchange", go, { signal });
  window.addEventListener(RH_UI_MODE_CHANGE_EVENT, go, { signal });
  go();
}
