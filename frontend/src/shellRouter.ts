import { getRolFromAccessToken } from "./auth/jwt.ts";
import {
  empleadoMayAccessHash,
  isRhHomeHash,
  modulosMayAccessHash,
  resolveRhModoHomeHash,
  resolveRhModeLandingHash,
  resolveRoutedHashForRol,
  RH_MODO_INICIO_HASH,
  RH_SIN_PERMISOS_HASH,
  rhMayAccessHash,
  supervisorMayAccessHash,
  usesSupervisorRoutePolicy,
} from "./navigation/shellNavPolicy.ts";
import { isModulosRhEnrolled } from "./auth/rhModulePermissions.ts";
import { vistaRolPermiteHash } from "./auth/vistaRolPermissions.ts";
import { isAdminUser, isNonRhRhMode, isRhDirectorUiMode, isRhEmpleadoUiMode, isRhGestorTeamUiMode, isRhOperativoUiMode, RH_UI_MODE_CHANGE_EVENT } from "./auth/rhUiMode.ts";
import { mountDashboardPlaceholder } from "./pages/dashboard.ts";
import { mountEmployeeVista360, parseVista360InitialTabFromHash } from "./pages/empleadoVista360.ts";
import { mountActas } from "./pages/actas.ts";
import { mountActaDetalle } from "./pages/actaDetalle.ts";
import { mountEmpleados } from "./pages/empleados.ts";
import { mountFaltasRetardos } from "./pages/faltasRetardos.ts";
import { mountViajesLaborales } from "./pages/viajesLaborales.ts";
import { mountIncidencias } from "./pages/incidencias.ts";
import { mountComedor } from "./pages/comedor.ts";
import { mountNotificaciones } from "./pages/notificaciones.ts";
import { mountOrganigrama } from "./pages/organigrama.ts";
import { mountPuestos } from "./pages/puestos.ts";
import { mountWtwMapa } from "./pages/wtwMapa.ts";
import { mountPuestosAjustes } from "./pages/puestosAjustes.ts";
import { mountPerfilPuestoDetalle } from "./pages/perfilPuestoDetalle.ts";
import { mountPuestoEmpleados } from "./pages/puestoEmpleados.ts";
import { mountMetricas } from "./pages/metricas.ts";
import { mountSolicitudes } from "./pages/solicitudes.ts";
import { mountCompetencias } from "./pages/competencias.ts";
import { mountTareasCatalogo } from "./pages/tareasCatalogo.ts";
import { mountCursosJuntas } from "./pages/cursosJuntas.ts";
import { mountCursosProveedores } from "./pages/cursosProveedores.ts";
import { mountCursosExternos } from "./pages/cursosExternos.ts";
import { mountCursosVencimientos } from "./pages/cursosVencimientos.ts";
import { mountEvaluaciones } from "./pages/evaluaciones.ts";
import { mountEvaluacionEmpleado } from "./pages/evaluacionEmpleado.ts";
import { canAccessOrganigramaPage } from "./auth/jwt.ts";
import {
  mountCursos,
  mountSugerencias,
  mountEncuestas,
} from "./pages/levelUp.ts";
import { mountEvidencias } from "./pages/evidencias.ts";
import { mountLevelUpHub } from "./pages/levelUpHub.ts";
import { mountLaboralesHub } from "./pages/laboralesHub.ts";
import { mountComedorHub } from "./pages/comedorHub.ts";
import { mountCapacidades } from "./pages/capacidades.ts";
import { mountSesiones } from "./pages/sesiones.ts";
import { mountSesionDetalle } from "./pages/sesionDetalle.ts";
import { mountCursosAjustes } from "./pages/cursosAjustes.ts";
import { mountCursosSeguimiento } from "./pages/cursosSeguimiento.ts";
import { mountMisEncuestas } from "./pages/misEncuestas.ts";
import { mountMisEncuestasRh } from "./pages/misEncuestasRh.ts";
import { mountMisMetas } from "./pages/misMetas.ts";
import { mountAppShell, type ShellNavKey } from "./layouts/appShell.ts";
import { errorState, RH_LISTADO_PAGE_OUTER } from "./ui/uiTokens.ts";
import { schedulePageScrollReset, shouldResetScrollOnRoute } from "./navigation/resetPageScroll.ts";
import { destroyAllCharts } from "./charts/index.ts";
import {
  mountAjustesPermisosRh,
  mountRhModuleAccessDenied,
  mountRhSinPermisosDisponibles,
} from "./pages/ajustesPermisosRh.ts";
import { mountConciliacion } from "./pages/conciliacion.ts";
import { mountAjustesNominas } from "./pages/ajustesNominas.ts";
import { mountHorasExtra } from "./pages/horasExtra.ts";
import { mountHorasExtraAprobaciones } from "./pages/horasExtraAprobaciones.ts";
import { mountHorasExtraSolicitud } from "./pages/horasExtraSolicitud.ts";
import { mountGestionPdi } from "./pages/gestionPdi.ts";
import { mountRhModoInicio } from "./pages/rhModoInicio.ts";

/**
 * Renderiza un estado de error dentro del app shell cuando un `import()`
 * dinámico de una página falla (chunk no disponible / error de red), en vez
 * de dejar el contenedor en blanco (lección de un incidente previo).
 */
function renderLazyPageImportError(container: HTMLElement, activeNav: ShellNavKey, pageTitle: string, err: unknown): void {
  console.error(`No se pudo cargar la página "${pageTitle}"`, err);
  mountAppShell(container, {
    pageTitle,
    activeNav,
    mainClass: "py-5 sm:py-6",
    mainHtml: `<div class="${RH_LISTADO_PAGE_OUTER}">${errorState({
      message: "No se pudo cargar esta página. Recarga para intentar de nuevo.",
      actionLabel: "Recargar",
      actionAttrs: 'onclick="window.location.reload()"',
    })}</div>`,
  });
}

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
    let rawHash = window.location.hash || "#/";
    // Para no-RH INSCRITOS en permisos RH, `modulosMayAccessHash` es la única
    // autoridad de ruta (rol base + grants en Modo RH). Las redirecciones por rol
    // de abajo no deben pisar el grant, o un inscrito con permiso de una página
    // RH-exclusiva (ajustes, actas, reporte comedor, evaluación 360) sería enviado a #/.
    const enrolledNonRh = !isAdminUser() && isModulosRhEnrolled();
    const adminRhOperativo = isAdminUser() && isRhOperativoUiMode();
    const nonRhInRhMode = enrolledNonRh && isNonRhRhMode();
    // Vista apagada por el admin RH para este rol: pantalla de acceso denegado, no una
    // redirección silenciosa — el usuario tiene que entender por qué no entró.
    if (vistaRolPermiteHash(rawHash) === false) {
      mountRhModuleAccessDenied(container);
      return;
    }
    if (!enrolledNonRh && !adminRhOperativo) {
      if (getRolFromAccessToken() === "empleado" && !empleadoMayAccessHash(rawHash)) {
        history.replaceState(null, "", "#/");
      }
      const rolAtEntry = getRolFromAccessToken();
      if (usesSupervisorRoutePolicy(rolAtEntry) && !supervisorMayAccessHash(rawHash)) {
        history.replaceState(null, "", "#/");
      }
    }
    const rol = getRolFromAccessToken();
    if ((adminRhOperativo || nonRhInRhMode) && isRhHomeHash(rawHash) && !modulosMayAccessHash("#/", rol)) {
      const landing = resolveRhModoHomeHash();
      if (landing !== rawHash) {
        history.replaceState(null, "", landing);
        rawHash = landing;
      }
    }
    if (isAdminUser() && !rhMayAccessHash(rawHash)) {
      if (isRhEmpleadoUiMode() || isRhGestorTeamUiMode() || isRhDirectorUiMode()) {
        if (rawHash !== "#/") {
          history.replaceState(null, "", "#/");
        }
        routeToHash(container, signal, "#/");
        return;
      }
      mountRhModuleAccessDenied(container);
      return;
    }
    if (!isAdminUser() && isModulosRhEnrolled() && !modulosMayAccessHash(rawHash, rol)) {
      mountRhModuleAccessDenied(container);
      return;
    }
    const h = resolveRoutedHashForRol(rol, rawHash, { enrolledNonRh });

    routeToHash(container, signal, h);
    if (shouldResetScrollOnRoute(window.location.hash || "#/")) {
      schedulePageScrollReset();
    }
  };

  const routeToHash = (container: HTMLElement, signal: AbortSignal, h: string): void => {
    destroyAllCharts();
    if (h.startsWith(RH_SIN_PERMISOS_HASH)) {
      mountRhSinPermisosDisponibles(container);
      return;
    }

    if (h.startsWith(RH_MODO_INICIO_HASH)) {
      mountRhModoInicio(container);
      return;
    }

    if (h.startsWith("#/ajustes/permisos-rh")) {
      mountAjustesPermisosRh(container, signal);
      return;
    }

    if (h.startsWith("#/ajustes/vistas-rol")) {
      void import("./pages/ajustesVistasRol.ts")
        .then(({ mountAjustesVistasRol }) => mountAjustesVistasRol(container, signal))
        // `activeNav: "dashboard"` porque Vistas por rol vive en el menú de usuario,
        // no en el sidebar: no hay ítem que resaltar.
        .catch((err) =>
          renderLazyPageImportError(container, "dashboard", "Vistas por rol", err),
        );
      return;
    }

    if (h.startsWith("#/ajustes/scheduler-logs")) {
      void import("./pages/schedulerLogs.ts")
        .then(({ mountSchedulerLogs }) => mountSchedulerLogs(container, signal))
        // `activeNav: "dashboard"` porque la página no está en ningún menú: no hay
        // ítem que resaltar. Es a propósito — se llega solo por URL.
        .catch((err) =>
          renderLazyPageImportError(container, "dashboard", "Logs del scheduler", err),
        );
      return;
    }

    if (h.startsWith("#/reportes")) {
      history.replaceState(null, "", "#/comedor/reporte");
      mountComedor(container, signal);
      return;
    }

    if (h.startsWith("#/nominas/conciliacion")) {
      mountConciliacion(container);
      return;
    }

    if (h.startsWith("#/nominas/ajustes")) {
      mountAjustesNominas(container, signal);
      return;
    }

    if (h.startsWith("#/horas-extra/solicitud")) {
      mountHorasExtraSolicitud(container);
      return;
    }

    if (h.startsWith("#/nominas/horas-extra/aprobaciones")) {
      mountHorasExtraAprobaciones(container);
      return;
    }

    if (h.startsWith("#/nominas/horas-extra")) {
      mountHorasExtra(container);
      return;
    }

    if (h.startsWith("#/laborales/configuracion")) {
      void import("./pages/laboralesConfiguracion.ts")
        .then(({ mountLaboralesConfiguracion }) => mountLaboralesConfiguracion(container, signal))
        .catch((err) =>
          renderLazyPageImportError(container, "laborales", "Configuración laborales", err),
        );
      return;
    }

    if (h === "#/laborales") {
      mountLaboralesHub(container);
      return;
    }

    if (h === "#/comedor/accesos") {
      mountComedorHub(container);
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
    if (h.startsWith("#/talento/mis-encuestas")) {
      mountMisEncuestasRh(container, signal);
      return;
    }
    const encuestasRhResultadosMatch = h.match(/^#\/talento\/encuestas\/(\d+)\/resultados/);
    if (encuestasRhResultadosMatch) {
      const id = Number.parseInt(encuestasRhResultadosMatch[1] ?? "", 10);
      if (!Number.isNaN(id)) {
        void import("./pages/encuestasRhResultados.ts").then(({ mountEncuestasRhResultados }) => {
          mountEncuestasRhResultados(container, id, signal);
        });
        return;
      }
    }
    if (h.startsWith("#/talento/encuestas")) {
      void import("./pages/encuestasRh.ts").then(({ mountEncuestasRh }) => {
        mountEncuestasRh(container, signal);
      });
      return;
    }
    if (h.startsWith("#/talento/mis-metas")) {
      mountMisMetas(container, signal);
      return;
    }
    if (h.startsWith("#/talento/metas")) {
      void import("./pages/metas.ts").then(({ mountMetas }) => {
        mountMetas(container, signal);
      });
      return;
    }
    if (h.startsWith("#/talento/mi-desempeno")) {
      void import("./pages/misDesempeno.ts").then(({ mountMisDesempeno }) => {
        mountMisDesempeno(container, signal);
      }).catch((err) => renderLazyPageImportError(container, "mi-desempeno", "Mi desempeño", err));
      return;
    }
    if (h.startsWith("#/talento/dashboard")) {
      void import("./pages/dashboardTalento.ts").then(({ mountDashboardTalento }) => {
        mountDashboardTalento(container, signal);
      }).catch((err) => renderLazyPageImportError(container, "dashboard-talento", "Dashboard de Talento", err));
      return;
    }
    if (h.startsWith("#/talento/ciclo-desempeno")) {
      void import("./pages/cicloDesempeno.ts").then(({ mountCicloDesempeno }) => {
        mountCicloDesempeno(container, signal);
      }).catch((err) => renderLazyPageImportError(container, "ciclo-desempeno", "Ciclo de Desempeño", err));
      return;
    }
    if (h.startsWith("#/cumplimiento/historial-objetivo")) {
      void import("./pages/historialObjetivo.ts").then(({ mountHistorialObjetivo }) => {
        mountHistorialObjetivo(container, signal);
      }).catch((err) => renderLazyPageImportError(container, "historial-objetivo", "Historial Objetivo", err));
      return;
    }
    if (h.startsWith("#/organigrama")) {
      if (!canAccessOrganigramaPage()) {
        history.replaceState(null, "", "#/");
        mountDashboardPlaceholder(container, signal);
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

    if (h.startsWith("#/level-up/evaluacion-360")) {
      void import("./pages/evaluacion360.ts").then(({ mountEvaluacion360 }) => {
        mountEvaluacion360(container, signal);
      });
      return;
    }
    if (h.startsWith("#/level-up")) {
      mountLevelUpHub(container);
      return;
    }
    if (h.startsWith("#/capacidades")) {
      mountCapacidades(container, signal);
      return;
    }
    if (h.startsWith("#/operaciones")) {
      void import("./pages/operaciones.ts").then(({ mountOperaciones }) => {
        mountOperaciones(container, signal);
      }).catch((err) => renderLazyPageImportError(container, "operaciones", "Cobertura y polivalencia", err));
      return;
    }
    if (h === "#/cursos/ajustes") {
      mountCursosAjustes(container, signal);
      return;
    }
    if (h === "#/cursos/seguimiento" || h.startsWith("#/cursos/seguimiento/")) {
      mountCursosSeguimiento(container);
      return;
    }
    if (h.startsWith("#/cursos/juntas")) {
      mountCursosJuntas(container, signal);
      return;
    }
    if (h.startsWith("#/cursos/proveedores")) {
      mountCursosProveedores(container, signal);
      return;
    }
    if (h.startsWith("#/cursos/externos")) {
      mountCursosExternos(container, signal);
      return;
    }
    if (h.startsWith("#/cursos/vencimientos")) {
      mountCursosVencimientos(container, signal);
      return;
    }
    if (h.startsWith("#/cursos")) {
      mountCursos(container, signal);
      return;
    }
    if (h.startsWith("#/opls")) {
      void import("./pages/opls.ts").then(({ mountOpls }) => {
        mountOpls(container, signal);
      }).catch((err) => renderLazyPageImportError(container, "opls", "Manejo de OPLs", err));
      return;
    }
    if (h.startsWith("#/evidencias")) {
      mountEvidencias(container, signal);
      return;
    }
    if (h.startsWith("#/sugerencias")) {
      mountSugerencias(container, signal);
      return;
    }
    if (h.startsWith("#/mis-firmas")) {
      void import("./pages/misFirmas.ts").then(({ mountMisFirmas }) => {
        mountMisFirmas(container, signal);
      }).catch((err) => renderLazyPageImportError(container, "mis-firmas", "Mis firmas", err));
      return;
    }
    if (h.startsWith("#/mis-aprobaciones-opl")) {
      void import("./pages/misAprobaciones.ts").then(({ mountMisAprobaciones }) => {
        mountMisAprobaciones(container, signal);
      }).catch((err) => renderLazyPageImportError(container, "mis-aprobaciones-opl", "Aprobaciones de OPL", err));
      return;
    }
    if (h.startsWith("#/mis-encuestas")) {
      mountMisEncuestas(container, signal);
      return;
    }
    if (h.startsWith("#/mis-evaluaciones")) {
      void import("./pages/misEvaluaciones.ts").then(({ mountMisEvaluaciones }) => {
        mountMisEvaluaciones(container, signal);
      });
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

    if (h.startsWith("#/puestos/ajustes")) {
      mountPuestosAjustes(container, signal);
      return;
    }

    // Antes del listado: `#/puestos` se lo comería.
    if (h.startsWith("#/puestos/wtw")) {
      mountWtwMapa(container, signal);
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
    if (h.startsWith("#/pdi-gestion")) {
      mountGestionPdi(container, signal);
      return;
    }
    const evalEmpMatch = h.match(/^#\/evaluaciones\/empleado\/(\d+)/);
    if (evalEmpMatch) {
      const id = Number.parseInt(evalEmpMatch[1] ?? "", 10);
      if (!Number.isNaN(id)) {
        mountEvaluacionEmpleado(container, id, signal);
        return;
      }
    }
    if (h.startsWith("#/evaluaciones")) {
      mountEvaluaciones(container, signal);
    } else if (h.startsWith("#/empleados")) {
      mountEmpleados(container, signal);
    } else if (h.startsWith("#/metricas")) {
      mountMetricas(container, signal);
    } else if (h.startsWith("#/solicitudes")) {
      mountSolicitudes(container, signal);
    } else if (h.startsWith("#/faltas-retardos")) {
      mountFaltasRetardos(container, signal);
    } else if (h.startsWith("#/viajes-laborales")) {
      mountViajesLaborales(container, signal);
    } else if (h.startsWith("#/incidencias")) {
      mountIncidencias(container, signal);
    } else {
      mountDashboardPlaceholder(container, signal);
    }
  };

  window.addEventListener("hashchange", go, { signal });
  window.addEventListener(
    RH_UI_MODE_CHANGE_EVENT,
    () => {
      const landing = resolveRhModeLandingHash();
      if ((window.location.hash || "#/") !== landing) {
        history.replaceState(null, "", landing);
      }
      go();
    },
    { signal },
  );
  go();
}
