/**
 * Modal «Nueva solicitud»: modo RH (selector de colaborador) y modo portal (`fixedEmpleadoDirectoryId`).
 */

import { getAuthMe, isAuthFetchError } from "../../api/auth.ts";
import { getEmpleadosPage } from "../../api/empleados.ts";
import type { UsuarioListItem } from "../../api/usuarios.ts";
import {
  getSolicitudById,
  patchSolicitudRevision,
  SOLICITUD_DUPLICADA_DETAIL,
} from "../../api/solicitudes.ts";
import { getUserDisplayNameFromAccessToken } from "../../auth/jwt.ts";
import { formatNombreEmpleadoUi } from "../../utils/nombreEmpleadoDisplay.ts";
import { isUsuariosFetchError } from "../../api/usuarios.ts";
import { esEmpleadoAdministrativo } from "../../utils/empleadoClasificacion.ts";
import {
  calcularDiasVacacionesSolicitados,
  calcularRangoDefuncion,
  calcularRangoMatrimonio,
  calcularRangoPaternidad,
  fechasOrdenValidas,
  MENSAJE_DEFUNCION_TRES_DIAS,
  MENSAJE_HOME_OFFICE_FIN_DE_SEMANA,
  MENSAJE_HOME_OFFICE_MES_LIMITE,
  MENSAJE_HOME_OFFICE_SOLO_ADMINISTRATIVO,
  MENSAJE_HOME_OFFICE_UN_DIA,
  MENSAJE_MATRIMONIO_DOS_DIAS,
  MENSAJE_PATERNIDAD_SIETE_DIAS_HABILES,
  MENSAJE_PERMISO_SIN_GOCE_ADMIN_FIN_DE_SEMANA,
  MENSAJE_VACACIONES_ADMIN_FIN_DE_SEMANA,
  MENSAJE_ANTICIPACION_MINIMA,
  esRangoDefuncionValido,
  fechaMinimaSolicitudIso,
  tipoRequiereAnticipacionMinima,
  esRangoMatrimonioValido,
  esRangoPaternidadValido,
  rangoIncluyeFinDeSemana,
  resumirRangoSinDescansos,
  sumarDiasIso,
} from "../../solicitudes/rh/rhNewRequestDays.ts";
import {
  createDescansosEmpleadoController,
  createLatestRequestSequence,
  tipoRequiereCalendarioDescansos,
  type DescansosLoadState,
} from "../../solicitudes/rh/descansosEmpleado.ts";
import {
  anioDeIso,
  createDiasFestivosCache,
  festivosEnRango,
  tipoAplicaFestivos,
} from "../../solicitudes/rh/diasFestivos.ts";
import { fetchRhEmpleadoRequestContext } from "../../solicitudes/rh/rhNewRequestEmployeeContext.ts";
import {
  enviarRhNuevaSolicitud,
  isSolicitudesFetchError,
  type RhNuevaSolicitudPayload,
} from "../../solicitudes/rh/rhNewRequestSubmit.ts";
import { showEmpleadosToast } from "../empleados/toast.ts";
import {
  bindAbortableEvent,
  bindWorkdayDatePicker,
  syncWorkdayDatePickerDisplay,
  type WorkdayDatePickerHandle,
} from "../../ui/workdayDatePicker.ts";
import { createRenderCycleController } from "../../ui/renderCycle.ts";
import {
  applyRhModalLiveFeedback,
  buildEmpleadoListboxHtml,
  buildFormHtml,
  buildInfoHomeOfficeHtml,
  buildInfoVacacionesHtml,
  computeRhModalFormUi,
  escapeHtml,
  loadingBodyHtml,
  shellHtml,
  type SupervisorSolicitudSujeto,
} from "./rhNewRequestModalUi.ts";

function empleadosExcluyeId(items: UsuarioListItem[], excluirId: number): UsuarioListItem[] {
  return items.filter((u) => u.id !== excluirId);
}

const MSG_HOME_OFFICE_SOLO_ADMINISTRATIVO = MENSAJE_HOME_OFFICE_SOLO_ADMINISTRATIVO;

function empleadoAdministrativoDesdeItem(item: UsuarioListItem | undefined): boolean {
  return esEmpleadoAdministrativo(item?.clasificacion);
}

export type RhNewRequestModalOptions = {
  signal: AbortSignal;
  toastContainer: HTMLElement;
  onSuccess: () => void | Promise<void>;
  onSessionExpired: () => void;
  /**
   * Id numérico de directorio del colaborador autenticado. Si se define, no se muestra selector de empleado
   * y el envío usa siempre este id (la UI no puede cambiar el destinatario).
   */
  fixedEmpleadoDirectoryId?: number;
  /** Habilita tipos especiales con goce de sueldo (solo RH). */
  allowPaidLeaveTypes?: boolean;
  /** Habilita tipo especial sin goce de sueldo (supervisor/gerente). */
  allowUnpaidLeaveType?: boolean;
  /** Muestra radio «personal / equipo» (supervisor y gerente): requiere `supervisorDirectoryId`. */
  supervisorSolicitudSubjectSelector?: boolean;
  /** Id de directorio del supervisor (sesión) para modo personal y filtrado en modo equipo. */
  supervisorDirectoryId?: number;
  /**
   * Aplica la anticipación mínima (vacaciones y home office desde mañana): bloquea hoy y el
   * pasado en el calendario y prellena mañana. RH (modo operativo) la deja en `false`.
   */
  aplicarAnticipacionMinima?: boolean;
};

export type RhNewRequestModalOpenOptions = {
  /** `id` del listado de empleados (directorio). */
  prefillEmpleadoId?: number;
  /** Reabrir solicitud en `changes_requested` (dueño vía `fixedEmpleadoDirectoryId` o `fixedEmpleadoParaRevision`). */
  revisarSolicitudId?: number;
  /**
   * Corrección cuando el modal no lleva `fixedEmpleadoDirectoryId` (p. ej. rol gestor con solicitud propia).
   * Debe coincidir con `empleado_id` de la solicitud en el servidor.
   */
  fixedEmpleadoParaRevision?: number;
};

export type RhNewRequestModalHandle = {
  open: (opts?: RhNewRequestModalOpenOptions) => Promise<void>;
  close: () => void;
  destroy: () => void;
};

function hoyLocalIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function mountRhNewRequestModal(host: HTMLElement, options: RhNewRequestModalOptions): RhNewRequestModalHandle {
  const fixedSelfId = options.fixedEmpleadoDirectoryId;
  /** Primera fecha permitida para el tipo actual, o `null` si no aplica (RH u otros tipos). */
  const fechaMinimaParaTipo = (t: string): string | null =>
    options.aplicarAnticipacionMinima === true && tipoRequiereAnticipacionMinima(t)
      ? fechaMinimaSolicitudIso(hoyLocalIso())
      : null;
  /** Fecha inicial del formulario: mañana si aplica la anticipación, hoy si no. */
  const fechaInicialParaTipo = (t: string): string => fechaMinimaParaTipo(t) ?? hoyLocalIso();
  host.innerHTML = shellHtml();
  const overlay = host.querySelector("#rh-nr-overlay") as HTMLElement | null;
  const body = host.querySelector("#rh-nr-body") as HTMLElement | null;
  if (!overlay || !body) {
    return { open: async () => {}, close: () => {}, destroy: () => void (host.innerHTML = "") };
  }

  const rootOverlay = overlay;
  const modalBody = body;

  let revisionSolicitudId: number | null = null;
  /** Dueño de la solicitud en corrección (validación de `empleado_id` en envío). */
  let revisionEmpleadoId: number | null = null;
  let revisionEmpleadoDisplayLine = "";
  let revisionTipoOriginal:
    | "vacaciones"
    | "home_office"
    | "matrimonio"
    | "incapacidad_interna"
    | "defuncion"
    | "paternidad"
    | "permiso_sin_goce_sueldo" = "vacaciones";

  let tipo:
    | "vacaciones"
    | "home_office"
    | "matrimonio"
    | "incapacidad_interna"
    | "defuncion"
    | "paternidad"
    | "permiso_sin_goce_sueldo" = "vacaciones";
  let empleadosCache: UsuarioListItem[] = [];
  /** Clasificación del colaborador titular (null = sin empleado seleccionado). */
  let empleadoEsAdministrativo: boolean | null = null;
  let contextoVac: number | null = null;
  /** Empleado con contexto cargado; distingue "sin empleado" de "saldo TRESS no disponible". */
  let contextoEmpleadoSel: number | null = null;
  let contextoHoText = "";
  let contextoHoPuedeSolicitarMes: boolean | null = null;
  /** Elegibilidad de HO por área (backend). Junto con la clasificación decide si se ofrece. */
  let contextoHoElegible: boolean | null = null;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let lastSearchQ = "";
  let empleadoSearchQ = "";
  let empleadoListboxOpen = false;
  let empleadoSearchLoading = false;
  let empleadoHighlightIndex = -1;
  /** Invalida respuestas de búsqueda obsoletas al escribir rápido. */
  let empleadoSearchSeq = 0;
  /** Personal vs equipo (supervisor/gerente cuando `supervisorSolicitudSubjectSelector`). */
  let solicitudSubjectSupervisor: SupervisorSolicitudSujeto = "personal";
  const renderCycle = createRenderCycleController(options.signal);
  const descansosController = createDescansosEmpleadoController();
  const festivosCache = createDiasFestivosCache();
  const contextoRequestSequence = createLatestRequestSequence();

  function descansosCargados(): Set<string> {
    return descansosController.getLoadedDates();
  }

  /** Festivos de la planta, solo para los tipos donde pesan (vacaciones y home office). */
  function festivosCargados(): ReadonlySet<string> {
    return tipoAplicaFestivos(tipo) ? festivosCache.getSet() : new Set<string>();
  }

  function festivosMapa(): ReadonlyMap<string, string> {
    return tipoAplicaFestivos(tipo) ? festivosCache.getMap() : new Map<string, string>();
  }

  const showSupervisorSujeto =
    options.supervisorSolicitudSubjectSelector === true &&
    typeof options.supervisorDirectoryId === "number" &&
    Number.isFinite(options.supervisorDirectoryId);
  const supervisorDirResolved = showSupervisorSujeto ? options.supervisorDirectoryId! : null;

  function listaEmpleadosParaSelector(): UsuarioListItem[] {
    if (showSupervisorSujeto && solicitudSubjectSupervisor === "team" && supervisorDirResolved != null) {
      return empleadosExcluyeId(empleadosCache, supervisorDirResolved);
    }
    return empleadosCache;
  }

  function empleadoEnCache(empleadoId: number): UsuarioListItem | undefined {
    return empleadosCache.find((u) => u.id === empleadoId);
  }

  function puedeMostrarHomeOffice(): boolean {
    // AND: Administrativo y área con regla de HO activa. Si falta cualquiera, el tipo
    // no aparece; el backend rechaza con el mismo criterio aunque se fuerce la petición.
    return empleadoEsAdministrativo === true && contextoHoElegible === true;
  }

  function asegurarTipoSolicitudPermitido(): void {
    if (tipo === "home_office" && !puedeMostrarHomeOffice()) {
      tipo = "vacaciones";
    }
  }

  function esEmpleadoSolicitudPropia(empleadoId: number): boolean {
    if (fixedSelfId != null && empleadoId === fixedSelfId) return true;
    return (
      supervisorDirResolved != null &&
      showSupervisorSujeto &&
      solicitudSubjectSupervisor === "personal" &&
      empleadoId === supervisorDirResolved
    );
  }

  async function resolverEmpleadoEsAdministrativo(empleadoId: number): Promise<boolean> {
    const cached = empleadoEnCache(empleadoId);
    if (cached) return empleadoAdministrativoDesdeItem(cached);

    if (esEmpleadoSolicitudPropia(empleadoId)) {
      const me = await getAuthMe();
      return esEmpleadoAdministrativo(me.clasificacion);
    }

    const pg = await getEmpleadosPage({ page: 1, page_size: 20, q: String(empleadoId), activo: true });
    const hit = pg.items.find((u) => u.id === empleadoId);
    if (hit) return empleadoAdministrativoDesdeItem(hit);
    return false;
  }

  async function resolverClasificacionEmpleado(empleadoId: number | null): Promise<boolean | null> {
    return empleadoId == null ? null : resolverEmpleadoEsAdministrativo(empleadoId);
  }

  function close(): void {
    contextoRequestSequence.invalidate();
    descansosController.setEmpleado(null);
    renderCycle.abort();
    rootOverlay.classList.add("hidden");
    rootOverlay.classList.remove("flex");
    document.body.style.overflow = "";
    revisionSolicitudId = null;
    revisionEmpleadoId = null;
    revisionEmpleadoDisplayLine = "";
    if (searchTimer) clearTimeout(searchTimer);
  }

  function focusFechaInicioPicker(): void {
    const trigger = host
      .querySelector("#rh-nr-inicio")
      ?.closest("[data-workday-date-picker]")
      ?.querySelector("[data-wd-trigger]") as HTMLButtonElement | null;
    // El picker queda debajo de «Disponibilidad»: un focus con scroll abría el
    // modal a media altura. El foco va al campo, pero la vista se queda arriba.
    trigger?.focus({ preventScroll: true });
    modalBody.scrollTop = 0;
  }

  function showError(msg: string): void {
    const el = host.querySelector("#rh-nr-error") as HTMLElement | null;
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    el.classList.add("mb-6");
  }

  function hideError(): void {
    const el = host.querySelector("#rh-nr-error") as HTMLElement | null;
    if (!el) return;
    el.textContent = "";
    el.classList.add("hidden");
    el.classList.remove("mb-6");
  }

  function updateInfoCard(): void {
    const card = host.querySelector("#rh-nr-info-card");
    if (!card) return;
    const fi = (host.querySelector("#rh-nr-inicio") as HTMLInputElement | null)?.value ?? "";
    const ff = (host.querySelector("#rh-nr-fin") as HTMLInputElement | null)?.value ?? "";
    const dias = calcularDiasVacacionesSolicitados(fi, ff, empleadoEsAdministrativo === true);
    const fechasOk = fechasOrdenValidas(fi, ff);
    if (tipo === "vacaciones") {
      card.innerHTML = buildInfoVacacionesHtml(contextoVac, dias, fechasOk, empleadoEsAdministrativo === true, contextoEmpleadoSel != null);
    } else if (tipo === "home_office") {
      card.innerHTML = buildInfoHomeOfficeHtml(contextoHoText);
    } else {
      const txt =
        tipo === "matrimonio" ? "Matrimonio: duración fija de 2 días con goce de sueldo."
        : tipo === "defuncion" ?
            empleadoEsAdministrativo === true
              ? "Defunción: 3 días hábiles con goce de sueldo. Si el rango cruza fin de semana, se ajustan los días hábiles más cercanos."
              : "Defunción: duración fija de 3 días con goce de sueldo."
        : tipo === "paternidad" ?
            "Paternidad: 7 días hábiles con goce de sueldo. Si la fecha de inicio cae en fin de semana, se ajustan los días hábiles más cercanos."
        : tipo === "permiso_sin_goce_sueldo" ?
          empleadoEsAdministrativo === true ?
            "Permiso sin goce de sueldo: registra motivo obligatorio y duración manual. Solo días entre semana (lunes a viernes) para colaboradores administrativos."
          : "Permiso sin goce de sueldo: registra motivo obligatorio y duración manual."
        : "Incapacidad interna: RH define manualmente la duración.";
      card.innerHTML = buildInfoHomeOfficeHtml(txt);
    }
  }

  function estadoDescansosActual(): DescansosLoadState {
    if (!tipoRequiereCalendarioDescansos(tipo)) return "ready";
    const controllerState = descansosController.getState();
    if (controllerState === "loading" || controllerState === "error") return controllerState;
    const snap = readFormSnapshot();
    if (!snap.selectedEmpleadoId || !snap.fechaInicio) return "idle";
    const fechaFin =
      tipo === "matrimonio" || tipo === "defuncion" || tipo === "paternidad"
        ? sumarDiasIso(snap.fechaInicio, 365)
        : snap.fechaFin;
    return fechaFin && descansosController.hasRangeLoaded(snap.fechaInicio, fechaFin)
      ? "ready"
      : "idle";
  }

  function refreshLiveFormState(): void {
    updateInfoCard();
    applyRhModalLiveFeedback(
      host,
      tipo,
      contextoVac,
      contextoHoPuedeSolicitarMes,
      estadoDescansosActual(),
      descansosCargados(),
      festivosCargados(),
    );
  }

  async function refreshContextForEmpleado(
    empleadoId: number | null,
    fechaReferencia?: string,
  ): Promise<boolean> {
    const requestToken = contextoRequestSequence.next();
    descansosController.setEmpleado(empleadoId);
    const fechaRef =
      fechaReferencia?.trim() ||
      (host.querySelector("#rh-nr-inicio") as HTMLInputElement | null)?.value ||
      "";
    let ctx: Awaited<ReturnType<typeof fetchRhEmpleadoRequestContext>>;
    let administrativo: boolean | null;
    try {
      [ctx, administrativo] = await Promise.all([
        fetchRhEmpleadoRequestContext(empleadoId, {
          fechaReferencia: tipo === "home_office" ? fechaRef : undefined,
          excluirSolicitudId: revisionSolicitudId ?? undefined,
        }),
        resolverClasificacionEmpleado(empleadoId),
      ]);
    } catch (error) {
      if (!contextoRequestSequence.isCurrent(requestToken)) return false;
      throw error;
    }
    if (!contextoRequestSequence.isCurrent(requestToken)) return false;
    empleadoEsAdministrativo = administrativo;
    contextoVac = ctx.diasVacacionesDisponibles;
    contextoEmpleadoSel = empleadoId;
    contextoHoText = ctx.homeOfficeResumen;
    contextoHoPuedeSolicitarMes = ctx.homeOfficePuedeSolicitarMes;
    contextoHoElegible = ctx.homeOfficeElegible;
    asegurarTipoSolicitudPermitido();
    updateInfoCard();
    applyRhModalLiveFeedback(
      host,
      tipo,
      contextoVac,
      contextoHoPuedeSolicitarMes,
      estadoDescansosActual(),
      descansosCargados(),
      festivosCargados(),
    );
    return true;
  }

  function readFormSnapshot(): {
    selectedEmpleadoId: string;
    fechaInicio: string;
    fechaFin: string;
    motivo: string;
  } {
    const hid = (host.querySelector("#rh-nr-empleado-id") as HTMLInputElement | null)?.value ?? "";
    const sel = (host.querySelector("#rh-nr-empleado") as HTMLSelectElement | null)?.value ?? "";
    return {
      selectedEmpleadoId: hid || sel,
      fechaInicio: (host.querySelector("#rh-nr-inicio") as HTMLInputElement | null)?.value ?? "",
      fechaFin: (host.querySelector("#rh-nr-fin") as HTMLInputElement | null)?.value ?? "",
      motivo: (host.querySelector("#rh-nr-motivo") as HTMLTextAreaElement | null)?.value ?? "",
    };
  }

  function restoreEmpleadoSearchFocus(caret?: number): void {
    const q = host.querySelector("#rh-nr-empleado-q") as HTMLInputElement | null;
    if (!q) return;
    q.focus();
    const pos = caret ?? q.value.length;
    try {
      q.setSelectionRange(pos, pos);
    } catch {
      /* type=search en algunos navegadores */
    }
  }

  /** Actualiza solo el listbox/ARIA sin recrear el input (evita saltos de cursor). */
  function syncEmpleadoListboxDom(): void {
    const wrap = host.querySelector("[data-rh-nr-empleado-combobox]");
    const input = host.querySelector("#rh-nr-empleado-q") as HTMLInputElement | null;
    if (!wrap) return;
    const selectedId =
      (host.querySelector("#rh-nr-empleado-id") as HTMLInputElement | null)?.value ?? "";
    const html = buildEmpleadoListboxHtml({
      items: listaEmpleadosParaSelector(),
      selectedId,
      highlightIndex: empleadoHighlightIndex,
      loading: empleadoSearchLoading,
      query: empleadoSearchQ,
      open: empleadoListboxOpen,
    });
    const existing = wrap.querySelector("#rh-nr-empleado-listbox");
    if (existing) existing.outerHTML = html;
    else wrap.insertAdjacentHTML("beforeend", html);

    if (input) {
      input.setAttribute("aria-expanded", empleadoListboxOpen ? "true" : "false");
      if (empleadoListboxOpen && empleadoHighlightIndex >= 0) {
        input.setAttribute(
          "aria-activedescendant",
          `rh-nr-empleado-opt-${empleadoHighlightIndex}`,
        );
      } else {
        input.removeAttribute("aria-activedescendant");
      }
    }
  }

  function selectedEmpleadoItemFromId(selectedId: string): UsuarioListItem | null {
    if (!selectedId.trim()) return null;
    const idNum = Number.parseInt(selectedId, 10);
    if (!Number.isFinite(idNum)) return null;
    return empleadoEnCache(idNum) ?? listaEmpleadosParaSelector().find((u) => u.id === idNum) ?? null;
  }

  async function loadEmpleados(q: string): Promise<void> {
    try {
      const pg = await getEmpleadosPage({ page: 1, page_size: 100, q: q.trim(), activo: true });
      empleadosCache = pg.items;
    } catch (e: unknown) {
      if (isUsuariosFetchError(e) && e.status === 401) {
        options.onSessionExpired();
        close();
        return;
      }
      throw e;
    }
  }

  function renderForm(
    preserve: Partial<{
      selectedId: string;
      fechaInicio: string;
      fechaFin: string;
      motivo: string;
      submitLabel: string;
    }>,
  ): void {
    const modoRevision = revisionSolicitudId != null;
    const empleadoSelfMode = !modoRevision && fixedSelfId != null;
    const supervisorPersonalMode =
      showSupervisorSujeto &&
      !modoRevision &&
      solicitudSubjectSupervisor === "personal" &&
      supervisorDirResolved != null;
    const actuaComoColaboradorPropio = empleadoSelfMode || supervisorPersonalMode;
    const supervisorSolicitudEquipo =
      showSupervisorSujeto && !modoRevision && solicitudSubjectSupervisor === "team";
    const singleDayHomeOffice = tipo === "home_office";
    const matrimonioDosDias = tipo === "matrimonio";
    const defuncionTresDias = tipo === "defuncion";
    const paternidadSieteDias = tipo === "paternidad";
    const hideMotivoVacaciones = tipo === "vacaciones";
    const hideMotivoEmpleado = actuaComoColaboradorPropio && tipo === "home_office";
    const snap = readFormSnapshot();
    asegurarTipoSolicitudPermitido();

    if (
      showSupervisorSujeto &&
      !modoRevision &&
      solicitudSubjectSupervisor === "personal" &&
      tipo === "permiso_sin_goce_sueldo"
    ) {
      tipo = "vacaciones";
    }

    let fixedEmpleado:
      | { directoryId: string; displayLine: string }
      | undefined;
    if (modoRevision && revisionEmpleadoId != null) {
      fixedEmpleado = {
        directoryId: String(revisionEmpleadoId),
        displayLine: revisionEmpleadoDisplayLine.trim() || `Empleado #${revisionEmpleadoId}`,
      };
    } else if (!modoRevision && fixedSelfId != null) {
      fixedEmpleado = {
        directoryId: String(fixedSelfId),
        displayLine: getUserDisplayNameFromAccessToken(),
      };
    } else if (supervisorPersonalMode && supervisorDirResolved != null) {
      fixedEmpleado = {
        directoryId: String(supervisorDirResolved),
        displayLine: getUserDisplayNameFromAccessToken().trim() || `Empleado #${supervisorDirResolved}`,
      };
    }

    const selectedEmpleadoId =
      fixedEmpleado != null ? fixedEmpleado.directoryId : (preserve.selectedId ?? snap.selectedEmpleadoId);
    const fechaInicio = preserve.fechaInicio ?? snap.fechaInicio;
    const fechaFinBase = preserve.fechaFin ?? snap.fechaFin;
    const descansos = descansosCargados();
    let fechaFin =
      singleDayHomeOffice ? fechaInicio
      : matrimonioDosDias && fechaInicio.trim()
        ? (calcularRangoMatrimonio(fechaInicio, descansos)?.fechaFin ?? "")
      : fechaFinBase;
    if (defuncionTresDias && fechaInicio.trim()) {
      const rango = calcularRangoDefuncion(
        fechaInicio,
        empleadoEsAdministrativo === true,
        descansos,
      );
      if (rango) {
        fechaFin = rango.fechaFin;
      }
    } else if (paternidadSieteDias && fechaInicio.trim()) {
      const rango = calcularRangoPaternidad(fechaInicio, descansos);
      if (rango) {
        fechaFin = rango.fechaFin;
      }
    }
    const fechaInicioEff =
      defuncionTresDias && fechaInicio.trim()
        ? (calcularRangoDefuncion(
            fechaInicio,
            empleadoEsAdministrativo === true,
            descansos,
          )?.fechaInicio ??
          fechaInicio)
        : paternidadSieteDias && fechaInicio.trim()
          ? (calcularRangoPaternidad(fechaInicio, descansos)?.fechaInicio ?? fechaInicio)
          : fechaInicio;
    const motivoBase = preserve.motivo ?? snap.motivo;
    const motivo =
      hideMotivoVacaciones || hideMotivoEmpleado ? "" : motivoBase;
    const dias = calcularDiasVacacionesSolicitados(
      fechaInicioEff,
      fechaFin,
      empleadoEsAdministrativo === true &&
        (tipo === "vacaciones" || tipo === "permiso_sin_goce_sueldo"),
    );
    const fechasOk = fechasOrdenValidas(fechaInicioEff, fechaFin);
    const infoHtml =
      tipo === "vacaciones"
        ? buildInfoVacacionesHtml(contextoVac, dias, fechasOk, empleadoEsAdministrativo === true, contextoEmpleadoSel != null)
        : tipo === "home_office"
          ? buildInfoHomeOfficeHtml(contextoHoText)
          : buildInfoHomeOfficeHtml(
              tipo === "matrimonio" ? "Matrimonio: duración fija de 2 días con goce de sueldo."
              : tipo === "defuncion" ?
                  empleadoEsAdministrativo === true
                    ? "Defunción: 3 días hábiles con goce de sueldo. Si el rango cruza fin de semana, se ajustan los días hábiles más cercanos."
                    : "Defunción: duración fija de 3 días con goce de sueldo."
              : tipo === "paternidad" ?
                  "Paternidad: 7 días hábiles con goce de sueldo. Si la fecha de inicio cae en fin de semana, se ajustan los días hábiles más cercanos."
              : tipo === "permiso_sin_goce_sueldo" ?
                  empleadoEsAdministrativo === true ?
                    "Permiso sin goce de sueldo: registra motivo obligatorio y duración manual. Solo días entre semana (lunes a viernes) para colaboradores administrativos."
                  : "Permiso sin goce de sueldo: registra motivo obligatorio y duración manual."
              : "Incapacidad interna: RH define manualmente la duración.",
            );
    const empleadoSelectorOmitido = fixedEmpleado != null;
    const requiereDescansos = tipoRequiereCalendarioDescansos(tipo);
    const descansoFinRequerido =
      fechaInicioEff && (matrimonioDosDias || defuncionTresDias || paternidadSieteDias)
        ? sumarDiasIso(fechaInicioEff, 365)
        : fechaFin;
    const controllerState = descansosController.getState();
    const descansosState: DescansosLoadState = !requiereDescansos
      ? "ready"
      : controllerState === "loading" || controllerState === "error"
        ? controllerState
        : selectedEmpleadoId &&
            fechaInicioEff &&
            descansoFinRequerido &&
            descansosController.hasRangeLoaded(fechaInicioEff, descansoFinRequerido)
          ? "ready"
          : "idle";
    const resumenDescansos =
      (tipo === "incapacidad_interna" || tipo === "vacaciones") &&
      fechaInicioEff &&
      fechaFin
        ? resumirRangoSinDescansos(fechaInicioEff, fechaFin, descansos)
        : null;
    const festivosExcluidos =
      tipo === "vacaciones" && fechaInicioEff && fechaFin
        ? festivosEnRango(fechaInicioEff, fechaFin, festivosCargados()).filter(
            (f) => !descansos.has(f),
          )
        : [];
    const ui = computeRhModalFormUi(
      tipo,
      contextoVac,
      selectedEmpleadoId,
      fechaInicioEff,
      fechaFin,
      motivo,
      empleadoSelectorOmitido,
      modoRevision,
      empleadoEsAdministrativo,
      contextoHoPuedeSolicitarMes,
      descansosState,
      descansos,
      fechaMinimaParaTipo(tipo),
      festivosCargados(),
    );
    const itemsParaSelector = listaEmpleadosParaSelector();
    const selectedItem = selectedEmpleadoItemFromId(selectedEmpleadoId);

    modalBody.innerHTML = buildFormHtml({
      tipo,
      showPaidLeaveTypes: options.allowPaidLeaveTypes === true,
      showUnpaidLeaveType: options.allowUnpaidLeaveType === true,
      items: itemsParaSelector,
      selectedEmpleadoId,
      selectedEmpleadoItem: selectedItem,
      empleadoSearchQ,
      empleadoListboxOpen,
      empleadoSearchLoading,
      empleadoHighlightIndex,
      fechaInicio: fechaInicioEff,
      fechaFin,
      motivo,
      diasLabel: ui.diasLabel,
      infoHtml,
      resumenState: ui.resumenState,
      resumenHint: ui.resumenHint,
      fechaInInvalid: ui.fechaInInvalid,
      fechaFinInvalid: ui.fechaFinInvalid,
      canSubmit: ui.canSubmit,
      fixedEmpleado,
      vacacionesAdministrativo: tipo === "vacaciones" && empleadoEsAdministrativo === true,
      empleadoAdministrativo: empleadoEsAdministrativo === true,
      homeOfficeMesDisponible:
        tipo === "home_office" ? contextoHoPuedeSolicitarMes !== false : undefined,
      modoRevision,
      submitLabel: preserve.submitLabel,
      singleDayHomeOfficeMode: singleDayHomeOffice,
      matrimonioTwoDayMode: matrimonioDosDias,
      defuncionThreeDayMode: defuncionTresDias,
      paternidadSevenDayMode: paternidadSieteDias,
      showMotivoField: !hideMotivoVacaciones && !hideMotivoEmpleado,
      showSupervisorSolicitudSubject: showSupervisorSujeto && !modoRevision,
      supervisorSolicitudSubject: solicitudSubjectSupervisor,
      fixedEmpleadoAyudaOverride: supervisorPersonalMode
        ? "La solicitud queda registrada a tu nombre. No puedes elegir otro colaborador en este modo."
        : undefined,
      empleadoBusquedaAyuda: supervisorSolicitudEquipo ?
        "Escribe nombre o número de un colaborador de tu equipo. Elige de la lista; tu propio usuario no aparece."
      : undefined,
      supervisorOcultarPermisoSinGoceEnTipo:
        showSupervisorSujeto && !modoRevision && solicitudSubjectSupervisor === "personal" ? true : undefined,
      showHomeOfficeType: puedeMostrarHomeOffice(),
      descansosState,
      descansosError: descansosController.getError(),
      fechasDescansoExcluidas: resumenDescansos?.fechasExcluidas ?? [],
      fechasFestivasExcluidas: festivosExcluidos,
      anticipacionHint: fechaMinimaParaTipo(tipo) ? MENSAJE_ANTICIPACION_MINIMA : undefined,
    });
    bindFormInteractions();
    applyRhModalLiveFeedback(
      host,
      tipo,
      contextoVac,
      contextoHoPuedeSolicitarMes,
      estadoDescansosActual(),
      descansosCargados(),
      festivosCargados(),
    );
  }

  function bindFormInteractions(): void {
    const renderSignal = renderCycle.next();

    const form = host.querySelector("#rh-nr-form") as HTMLFormElement | null;
    const qInput = host.querySelector("#rh-nr-empleado-q") as HTMLInputElement | null;
    const inicio = host.querySelector("#rh-nr-inicio") as HTMLInputElement | null;
    const fin = host.querySelector("#rh-nr-fin") as HTMLInputElement | null;
    const motivo = host.querySelector("#rh-nr-motivo") as HTMLTextAreaElement | null;
    const modoRevBind = revisionSolicitudId != null;
    const empleadoSelfBind = !modoRevBind && fixedSelfId != null;
    const supervisorPersonalBind =
      showSupervisorSujeto &&
      !modoRevBind &&
      solicitudSubjectSupervisor === "personal" &&
      supervisorDirResolved != null;
    const supervisorEquipoBind =
      showSupervisorSujeto && !modoRevBind && solicitudSubjectSupervisor === "team";
    const isSingleDayHomeOffice = tipo === "home_office";
    const isMatrimonioDosDias = tipo === "matrimonio";
    const isDefuncionTresDias = tipo === "defuncion";
    const isPaternidadSieteDias = tipo === "paternidad";

    function syncPickerDisplays(): void {
      for (const input of [inicio, fin]) {
        if (!input) continue;
        const root = input.closest("[data-workday-date-picker]") as HTMLElement | null;
        if (root) syncWorkdayDatePickerDisplay(root);
      }
    }

    function syncFechasFijas(): void {
      if (!inicio || !fin) return;
      if (isSingleDayHomeOffice) {
        fin.value = inicio.value;
      } else if (isMatrimonioDosDias && inicio.value.trim()) {
        fin.value = calcularRangoMatrimonio(inicio.value, descansosCargados())?.fechaFin ?? "";
      } else if (isDefuncionTresDias && inicio.value.trim()) {
        const formEl = host.querySelector("#rh-nr-form") as HTMLFormElement | null;
        const admin = formEl?.hasAttribute("data-rh-nr-empleado-admin") === true;
        const rango = calcularRangoDefuncion(inicio.value, admin, descansosCargados());
        if (rango) {
          inicio.value = rango.fechaInicio;
          fin.value = rango.fechaFin;
        }
      } else if (isPaternidadSieteDias && inicio.value.trim()) {
        const rango = calcularRangoPaternidad(inicio.value, descansosCargados());
        if (rango) {
          inicio.value = rango.fechaInicio;
          fin.value = rango.fechaFin;
        }
      }
      syncPickerDisplays();
    }

    async function aplicarSeleccionEmpleado(empleadoIdRaw: string): Promise<void> {
      const snapEmp = readFormSnapshot();
      try {
        let applied: boolean;
        if (empleadoIdRaw === "") {
          applied = await refreshContextForEmpleado(null);
        } else {
          const id = Number.parseInt(empleadoIdRaw, 10);
          applied = await refreshContextForEmpleado(Number.isFinite(id) ? id : null);
        }
        if (!applied) return;
        renderForm({
          selectedId: empleadoIdRaw,
          fechaInicio: "",
          fechaFin: "",
          motivo: snapEmp.motivo,
        });
        hideError();
      } catch {
        showError("No se pudo actualizar la información del empleado.");
      }
    }

    if (!host.querySelector("#rh-nr-form[data-rh-nr-revision]")) {
      host.querySelectorAll("[data-rh-nr-tipo]").forEach((btn) => {
        btn.addEventListener(
          "click",
          () => {
            const t = btn.getAttribute("data-rh-nr-tipo");
            if (
              t !== "vacaciones" &&
              t !== "home_office" &&
              t !== "permiso_sin_goce_sueldo"
            ) return;
            if (t === "home_office" && !puedeMostrarHomeOffice()) return;
            tipo = t;
            renderForm({});
          },
          { signal: renderSignal },
        );
      });
      const tipoSelect = host.querySelector("[data-rh-nr-tipo-select]") as HTMLSelectElement | null;
      tipoSelect?.addEventListener(
        "change",
        () => {
          const raw = tipoSelect.value;
          if (
            raw === "vacaciones" ||
            raw === "home_office" ||
            raw === "matrimonio" ||
            raw === "incapacidad_interna" ||
            raw === "defuncion" ||
            raw === "paternidad" ||
            raw === "permiso_sin_goce_sueldo"
          ) {
            if (raw === "home_office" && !puedeMostrarHomeOffice()) return;
            tipo = raw;
            renderForm({});
          }
        },
        { signal: renderSignal },
      );
    }

    host.querySelectorAll('input[name="rh-nr-solicitud-sujeto"]').forEach((inp) => {
      inp.addEventListener(
        "change",
        () => {
          const checked = host.querySelector(
            'input[name="rh-nr-solicitud-sujeto"]:checked',
          ) as HTMLInputElement | null;
          const v = checked?.value;
          if (v !== "personal" && v !== "team") return;
          if (v === solicitudSubjectSupervisor) return;
          solicitudSubjectSupervisor = v;
          empleadoSearchQ = "";
          lastSearchQ = "";
          empleadoListboxOpen = false;
          empleadoSearchLoading = false;
          empleadoHighlightIndex = -1;
          hideError();
          const snapSubject = readFormSnapshot();
          void (async (): Promise<void> => {
            try {
              if (v === "team") {
                empleadosCache = [];
                renderForm({
                  selectedId: "",
                  fechaInicio: "",
                  fechaFin: "",
                  motivo: snapSubject.motivo,
                });
                if (!(await refreshContextForEmpleado(null))) return;
                renderForm({
                  selectedId: "",
                  fechaInicio: "",
                  fechaFin: "",
                  motivo: snapSubject.motivo,
                });
              } else if (supervisorDirResolved != null) {
                if (tipo === "permiso_sin_goce_sueldo") {
                  tipo = "vacaciones";
                }
                empleadosCache = [];
                if (!(await refreshContextForEmpleado(supervisorDirResolved))) return;
                renderForm({
                  selectedId: "",
                  fechaInicio: "",
                  fechaFin: "",
                  motivo: snapSubject.motivo,
                });
              }
            } catch {
              showError("No se pudo actualizar el modo de solicitud.");
            }
          })();
        },
        { signal: renderSignal },
      );
    });

    if (qInput) {
      qInput.addEventListener(
        "input",
        () => {
          empleadoSearchQ = qInput.value;
          const q = qInput.value;
          empleadoListboxOpen = q.trim().length >= 1;
          empleadoHighlightIndex = -1;
          if (searchTimer) clearTimeout(searchTimer);
          if (!empleadoListboxOpen) {
            empleadoSearchLoading = false;
            empleadoSearchSeq += 1;
            syncEmpleadoListboxDom();
            return;
          }
          empleadoSearchLoading = true;
          syncEmpleadoListboxDom();
          const seq = ++empleadoSearchSeq;
          searchTimer = setTimeout(async () => {
            try {
              await loadEmpleados(q);
              if (seq !== empleadoSearchSeq) return;
              const live =
                (host.querySelector("#rh-nr-empleado-q") as HTMLInputElement | null)?.value ?? "";
              if (live !== q) return;
              empleadoSearchLoading = false;
              empleadoListboxOpen = live.trim().length >= 1;
              empleadoHighlightIndex = listaEmpleadosParaSelector().length > 0 ? 0 : -1;
              lastSearchQ = q;
              syncEmpleadoListboxDom();
            } catch {
              if (seq !== empleadoSearchSeq) return;
              empleadoSearchLoading = false;
              syncEmpleadoListboxDom();
              showError("No se pudo cargar el listado de empleados.");
            }
          }, 300);
        },
        { signal: renderSignal },
      );

      qInput.addEventListener(
        "keydown",
        (e: KeyboardEvent) => {
          const pool = listaEmpleadosParaSelector();
          if (e.key === "Escape") {
            if (!empleadoListboxOpen) return;
            e.preventDefault();
            e.stopPropagation();
            empleadoListboxOpen = false;
            empleadoHighlightIndex = -1;
            syncEmpleadoListboxDom();
            return;
          }
          if (!empleadoListboxOpen || pool.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            empleadoHighlightIndex =
              empleadoHighlightIndex < 0 ? 0 : Math.min(pool.length - 1, empleadoHighlightIndex + 1);
            syncEmpleadoListboxDom();
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            empleadoHighlightIndex =
              empleadoHighlightIndex <= 0 ? 0 : empleadoHighlightIndex - 1;
            syncEmpleadoListboxDom();
            return;
          }
          if (e.key === "Enter") {
            if (empleadoHighlightIndex < 0 || empleadoHighlightIndex >= pool.length) return;
            e.preventDefault();
            const picked = pool[empleadoHighlightIndex];
            if (!picked) return;
            empleadoListboxOpen = false;
            empleadoSearchQ = "";
            lastSearchQ = "";
            empleadoHighlightIndex = -1;
            void aplicarSeleccionEmpleado(String(picked.id));
          }
        },
        { signal: renderSignal },
      );

      const comboboxWrap = host.querySelector("[data-rh-nr-empleado-combobox]");
      comboboxWrap?.addEventListener(
        "mousedown",
        (e) => {
          const btn = (e.target as HTMLElement | null)?.closest?.(
            "[data-rh-nr-empleado-pick]",
          ) as HTMLElement | null;
          if (!btn) return;
          e.preventDefault();
          const id = btn.getAttribute("data-rh-nr-empleado-pick") ?? "";
          if (!id) return;
          empleadoListboxOpen = false;
          empleadoSearchQ = "";
          lastSearchQ = "";
          empleadoHighlightIndex = -1;
          void aplicarSeleccionEmpleado(id);
        },
        { signal: renderSignal },
      );

      host.querySelector("[data-rh-nr-empleado-clear]")?.addEventListener(
        "click",
        () => {
          empleadoSearchQ = "";
          lastSearchQ = "";
          empleadoListboxOpen = false;
          empleadoHighlightIndex = -1;
          empleadoSearchSeq += 1;
          void (async () => {
            await aplicarSeleccionEmpleado("");
            restoreEmpleadoSearchFocus();
          })();
        },
        { signal: renderSignal },
      );

      const clickOutside = (e: MouseEvent) => {
        const wrap = host.querySelector("[data-rh-nr-empleado-combobox]");
        if (!wrap || !empleadoListboxOpen) return;
        if (wrap.contains(e.target as Node)) return;
        empleadoListboxOpen = false;
        empleadoHighlightIndex = -1;
        syncEmpleadoListboxDom();
      };
      bindAbortableEvent(
        document,
        "mousedown",
        ((event: MouseEvent) => clickOutside(event)) as EventListener,
        renderSignal,
      );
    }

    let inicioHandle: WorkdayDatePickerHandle | null = null;
    let finHandle: WorkdayDatePickerHandle | null = null;

    function syncDescansosDom(): void {
      const requiereDescansos = tipoRequiereCalendarioDescansos(tipo);
      const dates = requiereDescansos ? descansosCargados() : new Set<string>();
      inicioHandle?.setBlockedDates(dates);
      finHandle?.setBlockedDates(dates);
      const festivos = festivosMapa();
      inicioHandle?.setFestivos(festivos);
      finHandle?.setFestivos(festivos);
      if (requiereDescansos) {
        const loadedMonths = descansosController.getLoadedMonths();
        inicioHandle?.setLoadedMonths(loadedMonths);
        finHandle?.setLoadedMonths(loadedMonths);
      }
      const status = host.querySelector(
        "[data-rh-nr-descansos-load-status]",
      ) as HTMLElement | null;
      const state = requiereDescansos ? descansosController.getState() : "ready";
      if (status) {
        if (state === "loading") {
          status.innerHTML =
            '<p class="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800" role="status">Consultando descansos del empleado…</p>';
        } else if (state === "error") {
          status.innerHTML = `<p class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">${escapeHtml(
            descansosController.getError() || "No se pudieron consultar los descansos. Intenta de nuevo.",
          )}</p>`;
        } else {
          status.innerHTML = "";
        }
      }
      refreshLiveFormState();
    }

    async function cargarFestivosAnios(...anios: number[]): Promise<void> {
      if (!tipoAplicaFestivos(tipo)) return;
      await festivosCache.ensureAnios(...anios);
      if (renderSignal.aborted) return;
      syncDescansosDom();
    }

    async function cargarMes(
      year: number,
      monthIndex: number,
      handle: WorkdayDatePickerHandle | null,
    ): Promise<void> {
      void cargarFestivosAnios(year);
      if (!tipoRequiereCalendarioDescansos(tipo)) return;
      if (!readFormSnapshot().selectedEmpleadoId) return;
      const request = descansosController.loadVisibleMonths(year, monthIndex);
      syncDescansosDom();
      try {
        await request;
        handle?.setBlockedDates(descansosCargados());
      } catch {
        // El error queda visible inline y mantiene el envío bloqueado.
      }
      syncDescansosDom();
    }

    async function cargarDescansosRangoActual(esInicio: boolean): Promise<boolean> {
      if (!tipoRequiereCalendarioDescansos(tipo)) return true;
      if (!inicio?.value) return false;
      const fixed = isMatrimonioDosDias || isDefuncionTresDias || isPaternidadSieteDias;
      const fechaFinCarga = fixed
        ? sumarDiasIso(inicio.value, 365)
        : esInicio
          ? (fin?.value && fin.value >= inicio.value ? fin.value : inicio.value)
          : (fin?.value || inicio.value);
      const request = descansosController.loadRange(inicio.value, fechaFinCarga);
      syncDescansosDom();
      try {
        await request;
      } catch {
        syncDescansosDom();
        return false;
      }
      if (descansosCargados().has(inicio.value)) {
        inicio.value = "";
        if (fin) fin.value = "";
        syncPickerDisplays();
        showError("La fecha inicial no puede ser un descanso.");
        syncDescansosDom();
        return false;
      }
      syncDescansosDom();
      return true;
    }

    async function onFechaInicioChange(): Promise<void> {
      if (!(await cargarDescansosRangoActual(true))) return;
      syncFechasFijas();
      if (tipo === "home_office") {
        const empRaw =
          (host.querySelector("#rh-nr-empleado-id") as HTMLInputElement | null)?.value ||
          (host.querySelector("#rh-nr-empleado") as HTMLSelectElement | null)?.value ||
          "";
        const empId = Number.parseInt(empRaw, 10);
        try {
          const applied = await refreshContextForEmpleado(
            empRaw && Number.isFinite(empId) ? empId : null,
            inicio?.value ?? "",
          );
          if (!applied) return;
        } catch {
          // La validación de Home Office conserva su manejo actual.
        }
        refreshLiveFormState();
      } else {
        refreshLiveFormState();
      }
    }

    async function onFechaFinChange(): Promise<void> {
      if (!(await cargarDescansosRangoActual(false))) return;
      const snap = readFormSnapshot();
      renderForm({
        selectedId: snap.selectedEmpleadoId,
        fechaInicio: snap.fechaInicio,
        fechaFin: snap.fechaFin,
        motivo: snap.motivo,
      });
    }

    const pickers = host.querySelectorAll<HTMLElement>("[data-workday-date-picker]");
    const inicioPicker = pickers[0];
    const finPicker = pickers[1];
    const requiereDescansosPicker = tipoRequiereCalendarioDescansos(tipo);
    const blockedForPicker = requiereDescansosPicker ? descansosCargados() : new Set<string>();
    if (inicioPicker) {
      inicioHandle = bindWorkdayDatePicker(inicioPicker, {
        onChange: () => void onFechaInicioChange(),
        minDate: fechaMinimaParaTipo(tipo),
        blockedDates: blockedForPicker,
        festivos: festivosMapa(),
        ...(requiereDescansosPicker
          ? { loadedMonths: descansosController.getLoadedMonths() }
          : {}),
        onMonthChange: (year, monthIndex) => cargarMes(year, monthIndex, inicioHandle),
        signal: renderSignal,
      });
    }
    if (finPicker) {
      finHandle = bindWorkdayDatePicker(finPicker, {
        onChange: () => void onFechaFinChange(),
        minDate: fechaMinimaParaTipo(tipo),
        blockedDates: blockedForPicker,
        festivos: festivosMapa(),
        ...(requiereDescansosPicker
          ? { loadedMonths: descansosController.getLoadedMonths() }
          : {}),
        onMonthChange: (year, monthIndex) => cargarMes(year, monthIndex, finHandle),
        signal: renderSignal,
      });
    }

    if (requiereDescansosPicker && readFormSnapshot().selectedEmpleadoId.trim()) {
      const now = new Date();
      void cargarMes(now.getFullYear(), now.getMonth(), inicioHandle);
    }
    {
      // Festivos: este año y el siguiente, más el año de las fechas ya capturadas
      // (corrección de una solicitud). Independientes del empleado.
      const hoyAnio = new Date().getFullYear();
      const anios = new Set<number>([hoyAnio, hoyAnio + 1]);
      for (const v of [inicio?.value, fin?.value]) {
        const a = v ? anioDeIso(v) : null;
        if (a != null) anios.add(a);
      }
      void cargarFestivosAnios(...anios);
    }

    motivo?.addEventListener("input", refreshLiveFormState, { signal: renderSignal });
    syncFechasFijas();

    form?.addEventListener(
      "submit",
      async (ev) => {
        ev.preventDefault();
        hideError();
        const fd = new FormData(form);
        const empRaw = String(fd.get("empleado_id") ?? "").trim();
        const empleado_id = Number.parseInt(empRaw, 10);
        if (!empRaw || Number.isNaN(empleado_id)) {
          showError(
            revisionSolicitudId != null ||
              fixedSelfId != null ||
              (showSupervisorSujeto && solicitudSubjectSupervisor === "personal") ?
              "No se pudo validar los datos de la solicitud. Cierra el modal e inténtalo de nuevo."
            : "Selecciona un empleado.",
          );
          return;
        }
        if (
          showSupervisorSujeto &&
          solicitudSubjectSupervisor === "personal" &&
          tipo === "permiso_sin_goce_sueldo"
        ) {
          showError(
            "El permiso sin goce de sueldo no está disponible en solicitudes personales. Elige otro tipo o cambia a «Miembro del equipo».",
          );
          return;
        }
        if (revisionSolicitudId != null) {
          if (revisionEmpleadoId == null || empleado_id !== revisionEmpleadoId) {
            showError("No está permitido modificar el colaborador de la solicitud.");
            return;
          }
          if (tipo !== revisionTipoOriginal) {
            showError("No está permitido modificar el tipo de la solicitud.");
            return;
          }
        } else if (fixedSelfId != null && empleado_id !== fixedSelfId) {
          showError("No está permitido modificar el colaborador de la solicitud.");
          return;
        } else if (
          supervisorDirResolved != null &&
          showSupervisorSujeto &&
          solicitudSubjectSupervisor === "personal" &&
          empleado_id !== supervisorDirResolved
        ) {
          showError("No está permitido modificar el colaborador de la solicitud.");
          return;
        }
        if (tipo === "home_office" || tipo === "permiso_sin_goce_sueldo" || tipo === "defuncion") {
          const esAdmin = await resolverEmpleadoEsAdministrativo(empleado_id);
          empleadoEsAdministrativo = esAdmin;
          if (tipo === "home_office" && (!esAdmin || contextoHoElegible !== true)) {
            showError(MSG_HOME_OFFICE_SOLO_ADMINISTRATIVO);
            return;
          }
        }
        const fecha_inicio_raw = String(fd.get("fecha_inicio") ?? "").trim();
        let fecha_inicio = fecha_inicio_raw;
        const fecha_fin_raw = String(fd.get("fecha_fin") ?? "").trim();
        if (tipoRequiereCalendarioDescansos(tipo) && estadoDescansosActual() !== "ready") {
          showError(
            descansosController.getState() === "error"
              ? "No se pudieron consultar los descansos. Intenta de nuevo."
              : "Espera a que termine la consulta de descansos.",
          );
          return;
        }
        const descansos = tipoRequiereCalendarioDescansos(tipo)
          ? descansosCargados()
          : new Set<string>();
        if (tipoRequiereCalendarioDescansos(tipo) && descansos.has(fecha_inicio)) {
          showError("La fecha inicial no puede ser un descanso.");
          return;
        }
        let fecha_fin =
          tipo === "home_office" ? fecha_inicio
          : tipo === "matrimonio" && fecha_inicio.trim()
            ? (calcularRangoMatrimonio(fecha_inicio, descansos)?.fechaFin ?? "")
          : fecha_fin_raw;
        if (tipo === "defuncion" && fecha_inicio.trim()) {
          const rango = calcularRangoDefuncion(
            fecha_inicio,
            empleadoEsAdministrativo === true,
            descansos,
          );
          if (rango) {
            fecha_inicio = rango.fechaInicio;
            fecha_fin = rango.fechaFin;
          }
        } else if (tipo === "paternidad" && fecha_inicio.trim()) {
          const rango = calcularRangoPaternidad(fecha_inicio, descansos);
          if (rango) {
            fecha_inicio = rango.fechaInicio;
            fecha_fin = rango.fechaFin;
          }
        }
        if (!fecha_inicio || !fecha_fin) {
          showError("Indica fecha de inicio y fecha de fin.");
          return;
        }
        if (tipo === "home_office" && fecha_inicio !== fecha_fin) {
          showError(MENSAJE_HOME_OFFICE_UN_DIA);
          return;
        }
        if (
          tipo === "matrimonio" &&
          !esRangoMatrimonioValido(fecha_inicio, fecha_fin, descansos)
        ) {
          showError(MENSAJE_MATRIMONIO_DOS_DIAS);
          return;
        }
        if (
          tipo === "defuncion" &&
          !esRangoDefuncionValido(
            fecha_inicio,
            fecha_fin,
            empleadoEsAdministrativo === true,
            descansos,
          )
        ) {
          showError(MENSAJE_DEFUNCION_TRES_DIAS);
          return;
        }
        if (
          tipo === "paternidad" &&
          !esRangoPaternidadValido(fecha_inicio, fecha_fin, descansos)
        ) {
          showError(MENSAJE_PATERNIDAD_SIETE_DIAS_HABILES);
          return;
        }
        if (!fechasOrdenValidas(fecha_inicio, fecha_fin)) {
          showError("La fecha de fin no puede ser anterior a la fecha de inicio.");
          return;
        }
        if (
          (tipo === "incapacidad_interna" || tipo === "vacaciones") &&
          resumirRangoSinDescansos(fecha_inicio, fecha_fin, descansos).fechasEfectivas.length === 0
        ) {
          showError("El rango está compuesto únicamente por descansos.");
          return;
        }
        const dias = calcularDiasVacacionesSolicitados(
          fecha_inicio,
          fecha_fin,
          empleadoEsAdministrativo === true &&
            (tipo === "vacaciones" || tipo === "permiso_sin_goce_sueldo"),
          tipo === "vacaciones" ? descansos : new Set(),
        );
        if (dias <= 0) {
          showError("Revisa el rango de fechas.");
          return;
        }
        if (
          tipo === "vacaciones" &&
          empleadoEsAdministrativo === true &&
          rangoIncluyeFinDeSemana(fecha_inicio, fecha_fin)
        ) {
          showError(MENSAJE_VACACIONES_ADMIN_FIN_DE_SEMANA);
          return;
        }
        if (
          tipo === "permiso_sin_goce_sueldo" &&
          empleadoEsAdministrativo === true &&
          rangoIncluyeFinDeSemana(fecha_inicio, fecha_fin)
        ) {
          showError(MENSAJE_PERMISO_SIN_GOCE_ADMIN_FIN_DE_SEMANA);
          return;
        }
        if (
          tipo === "home_office" &&
          rangoIncluyeFinDeSemana(fecha_inicio, fecha_fin)
        ) {
          showError(MENSAJE_HOME_OFFICE_FIN_DE_SEMANA);
          return;
        }
        const motivoRaw = String(fd.get("motivo") ?? "").trim();
        if (tipo === "home_office") {
          if (!(await refreshContextForEmpleado(empleado_id, fecha_inicio))) return;
          if (contextoHoPuedeSolicitarMes === false) {
            showError(MENSAJE_HOME_OFFICE_MES_LIMITE);
            renderForm({
              selectedId: empRaw,
              fechaInicio: fecha_inicio,
              fechaFin: fecha_fin,
              motivo: motivoRaw,
            });
            return;
          }
        }
        if (tipo === "vacaciones") {
          // Refresca el disponible (saldo TRESS − comprometidos) justo antes de validar.
          if (!(await refreshContextForEmpleado(empleado_id))) return;
          if (contextoVac == null) {
            showError(
              "No se pudo verificar el saldo de vacaciones (servicio no disponible). Intenta más tarde.",
            );
            return;
          }
        }
        if (tipo === "vacaciones" && revisionSolicitudId == null && contextoVac != null && contextoVac <= 0) {
          showError("No hay días de vacaciones disponibles para presentar una solicitud.");
          return;
        }
        if (tipo === "vacaciones" && contextoVac != null && dias > contextoVac) {
          showError(`Los días solicitados (${dias}) superan los disponibles (${contextoVac}) para este empleado.`);
          return;
        }
        if (tipo === "permiso_sin_goce_sueldo" && !motivoRaw) {
          showError("Captura el motivo del permiso sin goce de sueldo.");
          return;
        }
        const motivo = motivoRaw === "" ? null : motivoRaw;
        const rangoNominal =
          tipo === "matrimonio"
            ? calcularRangoMatrimonio(fecha_inicio)
            : tipo === "defuncion"
              ? calcularRangoDefuncion(fecha_inicio, empleadoEsAdministrativo === true)
              : tipo === "paternidad"
                ? calcularRangoPaternidad(fecha_inicio)
                : null;
        const fechaFinPayload = rangoNominal?.fechaFin ?? fecha_fin;

        const submitBtn = host.querySelector("#rh-nr-submit") as HTMLButtonElement | null;
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = revisionSolicitudId != null ? "Reenviando…" : "Enviando…";
        }

        const payload: RhNuevaSolicitudPayload = {
          empleado_id,
          tipo,
          fecha_inicio,
          fecha_fin: fechaFinPayload,
          motivo,
          comentarios: null,
        };

        try {
          if (revisionSolicitudId != null) {
            await patchSolicitudRevision(revisionSolicitudId, {
              fecha_inicio,
              fecha_fin: fechaFinPayload,
              motivo,
            });
            showEmpleadosToast(
              options.toastContainer,
              "Solicitud actualizada y reenviada al aprobador.",
              "success",
            );
          } else {
            await enviarRhNuevaSolicitud(payload);
            showEmpleadosToast(options.toastContainer, "Solicitud registrada correctamente.", "success");
          }
          close();
          await options.onSuccess();
        } catch (error) {
          if (isSolicitudesFetchError(error)) {
            const d = typeof error.detail === "string" ? error.detail.trim() : "";
            const mensaje =
              d === SOLICITUD_DUPLICADA_DETAIL ?
                SOLICITUD_DUPLICADA_DETAIL
              : d || "No se pudo completar el envío. Intenta de nuevo.";
            showError(mensaje);
            // Toast fijo encima del layout: el bloque #rh-nr-error puede quedar fuera de vista al hacer scroll.
            showEmpleadosToast(options.toastContainer, mensaje, "error");
          } else {
            const fallback = "No se pudo completar el envío. Intenta de nuevo.";
            showError(fallback);
            showEmpleadosToast(options.toastContainer, fallback, "error");
          }
        } finally {
          if (submitBtn) {
            submitBtn.textContent =
              revisionSolicitudId != null ? "Guardar y reenviar" : "Enviar solicitud";
            applyRhModalLiveFeedback(
              host,
              tipo,
              contextoVac,
              contextoHoPuedeSolicitarMes,
              estadoDescansosActual(),
              descansosCargados(),
              festivosCargados(),
            );
          }
        }
      },
      { signal: renderSignal },
    );
  }

  rootOverlay.addEventListener(
    "click",
    (e) => {
      if (e.target === rootOverlay) close();
    },
    { signal: options.signal },
  );

  host.addEventListener(
    "click",
    (e) => {
      if ((e.target as HTMLElement).closest("[data-rh-nr-close]")) close();
    },
    { signal: options.signal },
  );

  document.addEventListener(
    "keydown",
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !rootOverlay.classList.contains("hidden")) {
        e.preventDefault();
        close();
      }
    },
    { signal: options.signal },
  );

  return {
    open: async (openOpts?: RhNewRequestModalOpenOptions) => {
      hideError();
      revisionSolicitudId = openOpts?.revisarSolicitudId ?? null;
      revisionEmpleadoId = null;
      revisionEmpleadoDisplayLine = "";
      const titleEl = host.querySelector("#rh-nr-title");
      if (titleEl) {
        titleEl.textContent = revisionSolicitudId != null ? "Corregir solicitud" : "Nueva solicitud";
      }
      tipo = "vacaciones";
      empleadoEsAdministrativo = null;
      contextoVac = null;
      contextoHoText = "";
      lastSearchQ = "";
      empleadoSearchQ = "";
      solicitudSubjectSupervisor = "personal";
      rootOverlay.classList.remove("hidden");
      rootOverlay.classList.add("flex");
      document.body.style.overflow = "hidden";
      modalBody.innerHTML = loadingBodyHtml();

      const subEl = host.querySelector("#rh-nr-subtitle");
      if (subEl) {
        subEl.textContent =
          revisionSolicitudId != null ?
            "Actualiza las fechas o el motivo y reenvía la solicitud al aprobador."
          : fixedSelfId != null ?
            "Elige el tipo de solicitud y las fechas. El registro quedará a tu nombre."
          : showSupervisorSujeto ?
            "Indica si la solicitud es para ti o para un colaborador, elige el tipo y completa los datos."
          : "Selecciona el tipo de solicitud y completa los campos requeridos.";
      }

      try {
        if (revisionSolicitudId != null) {
          const empleadoRevision = openOpts?.fixedEmpleadoParaRevision ?? fixedSelfId ?? null;
          if (empleadoRevision == null) {
            modalBody.innerHTML = `<p class="text-sm text-red-700">No se pudo identificar tu perfil de colaborador para corregir la solicitud. Vuelve a iniciar sesión o contacta a RH.</p>
          <button type="button" data-rh-nr-close class="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-semibold">Cerrar</button>`;
            return;
          }
          const sol = await getSolicitudById(revisionSolicitudId);
          if (sol.empleado_id !== empleadoRevision) {
            modalBody.innerHTML = `<p class="text-sm text-red-700">No tienes permiso para editar esta solicitud.</p>
          <button type="button" data-rh-nr-close class="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-semibold">Cerrar</button>`;
            return;
          }
          if (sol.estado !== "changes_requested") {
            modalBody.innerHTML = `<p class="text-sm text-red-700">Esta solicitud ya no está en corrección (${sol.estado}).</p>
          <button type="button" data-rh-nr-close class="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-semibold">Cerrar</button>`;
            return;
          }
          if (
            sol.tipo === "home_office" ||
            sol.tipo === "matrimonio" ||
            sol.tipo === "incapacidad_interna" ||
            sol.tipo === "defuncion" ||
            sol.tipo === "paternidad" ||
            sol.tipo === "permiso_sin_goce_sueldo"
          ) {
            tipo = sol.tipo;
          } else {
            tipo = "vacaciones";
          }
          revisionTipoOriginal = tipo;
          revisionEmpleadoId = empleadoRevision;
          const rawNom = typeof sol.empleado_nombre === "string" ? sol.empleado_nombre.trim() : "";
          revisionEmpleadoDisplayLine =
            rawNom ? formatNombreEmpleadoUi(rawNom).trim() || rawNom : `Empleado #${empleadoRevision}`;
          if (!(await refreshContextForEmpleado(empleadoRevision))) return;
          renderForm({
            fechaInicio: String(sol.fecha_inicio).slice(0, 10),
            fechaFin: String(sol.fecha_fin).slice(0, 10),
            motivo: typeof sol.motivo === "string" ? sol.motivo : "",
            submitLabel: "Guardar y reenviar",
          });
          focusFechaInicioPicker();
          return;
        }

        if (fixedSelfId == null) {
          let prefill = openOpts?.prefillEmpleadoId;
          let selectedId = "";
          const abreSupervisorPersonal =
            showSupervisorSujeto && solicitudSubjectSupervisor === "personal";

          empleadoSearchQ = "";
          lastSearchQ = "";
          empleadoListboxOpen = false;
          empleadoSearchLoading = false;
          empleadoHighlightIndex = -1;

          if (abreSupervisorPersonal) {
            empleadosCache = [];
          } else if (prefill != null) {
            await loadEmpleados(String(prefill));
            const poolFinal = listaEmpleadosParaSelector();
            selectedId = poolFinal.some((u) => u.id === prefill) ? String(prefill) : "";
          }

          const fechaInicial = fechaInicialParaTipo(tipo);
          renderForm({
            selectedId,
            fechaInicio: fechaInicial,
            fechaFin: fechaInicial,
            motivo: "",
          });
          const ctxEmpDir =
            abreSupervisorPersonal && supervisorDirResolved != null
              ? supervisorDirResolved
              : selectedId
                ? Number.parseInt(selectedId, 10)
                : null;
          if (!(await refreshContextForEmpleado(ctxEmpDir))) return;
          if (abreSupervisorPersonal) {
            focusFechaInicioPicker();
          } else {
            (host.querySelector("#rh-nr-empleado-q") as HTMLElement | null)?.focus();
          }
        } else {
          if (!(await refreshContextForEmpleado(fixedSelfId))) return;
          const fechaInicial = fechaInicialParaTipo(tipo);
          renderForm({
            fechaInicio: fechaInicial,
            fechaFin: fechaInicial,
            motivo: "",
          });
          focusFechaInicioPicker();
        }
      } catch (e: unknown) {
        if (
          (isUsuariosFetchError(e) || isAuthFetchError(e)) &&
          e.status === 401
        ) {
          options.onSessionExpired();
          close();
          return;
        }
        modalBody.innerHTML = `<p class="text-sm text-red-700">No se pudo cargar el formulario.</p>
          <button type="button" data-rh-nr-close class="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-semibold">Cerrar</button>`;
      }
    },
    close,
    destroy: () => {
      renderCycle.abort();
      if (searchTimer) clearTimeout(searchTimer);
      host.innerHTML = "";
      document.body.style.overflow = "";
    },
  };
}
