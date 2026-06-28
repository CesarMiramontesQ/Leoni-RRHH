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
  fechasOrdenValidas,
  MENSAJE_HOME_OFFICE_FIN_DE_SEMANA,
  MENSAJE_HOME_OFFICE_MES_LIMITE,
  MENSAJE_HOME_OFFICE_SOLO_ADMINISTRATIVO,
  MENSAJE_HOME_OFFICE_UN_DIA,
  MENSAJE_MATRIMONIO_DOS_DIAS,
  MENSAJE_PERMISO_SIN_GOCE_ADMIN_FIN_DE_SEMANA,
  MENSAJE_VACACIONES_ADMIN_FIN_DE_SEMANA,
  esRangoMatrimonioValido,
  rangoIncluyeFinDeSemana,
  sumarDiasIso,
} from "../../solicitudes/rh/rhNewRequestDays.ts";
import { fetchRhEmpleadoRequestContext } from "../../solicitudes/rh/rhNewRequestEmployeeContext.ts";
import {
  enviarRhNuevaSolicitud,
  isSolicitudesFetchError,
  type RhNuevaSolicitudPayload,
} from "../../solicitudes/rh/rhNewRequestSubmit.ts";
import { showEmpleadosToast } from "../empleados/toast.ts";
import {
  applyRhModalLiveFeedback,
  buildFormHtml,
  buildInfoHomeOfficeHtml,
  buildInfoVacacionesHtml,
  computeRhModalFormUi,
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
  /** Panel más ancho (solo UI; p. ej. rol supervisor). */
  wideForSupervisor?: boolean;
  /** Muestra radio «personal / equipo» (supervisor): requiere `supervisorDirectoryId`. */
  supervisorSolicitudSubjectSelector?: boolean;
  /** Id de directorio del supervisor (sesión) para modo personal y filtrado en modo equipo. */
  supervisorDirectoryId?: number;
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

export function mountRhNewRequestModal(host: HTMLElement, options: RhNewRequestModalOptions): RhNewRequestModalHandle {
  const fixedSelfId = options.fixedEmpleadoDirectoryId;
  host.innerHTML = shellHtml({ wideForSupervisor: options.wideForSupervisor === true });
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
  let contextoHoText = "";
  let contextoHoPuedeSolicitarMes: boolean | null = null;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let lastSearchQ = "";
  let empleadoSearchQ = "";
  /** Personal vs equipo (solo supervisor cuando `supervisorSolicitudSubjectSelector`). */
  let solicitudSubjectSupervisor: SupervisorSolicitudSujeto = "personal";

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
    return empleadoEsAdministrativo === true;
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
    if (hit) {
      if (!empleadoEnCache(hit.id)) empleadosCache.push(hit);
      return empleadoAdministrativoDesdeItem(hit);
    }
    return false;
  }

  async function actualizarClasificacionEmpleado(empleadoId: number | null): Promise<void> {
    if (empleadoId == null) {
      empleadoEsAdministrativo = null;
      return;
    }
    empleadoEsAdministrativo = await resolverEmpleadoEsAdministrativo(empleadoId);
  }

  function close(): void {
    rootOverlay.classList.add("hidden");
    rootOverlay.classList.remove("flex");
    document.body.style.overflow = "";
    revisionSolicitudId = null;
    revisionEmpleadoId = null;
    revisionEmpleadoDisplayLine = "";
    if (searchTimer) clearTimeout(searchTimer);
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
      card.innerHTML = buildInfoVacacionesHtml(contextoVac, dias, fechasOk, empleadoEsAdministrativo === true);
    } else if (tipo === "home_office") {
      card.innerHTML = buildInfoHomeOfficeHtml(contextoHoText);
    } else {
      const txt =
        tipo === "matrimonio" ? "Matrimonio: duración fija de 2 días con goce de sueldo."
        : tipo === "defuncion" ? "Defunción: duración fija de 3 días con goce de sueldo."
        : tipo === "paternidad" ? "Paternidad: duración fija de 7 días hábiles con goce de sueldo."
        : tipo === "permiso_sin_goce_sueldo" ?
          empleadoEsAdministrativo === true ?
            "Permiso sin goce de sueldo: registra motivo obligatorio y duración manual. Solo días entre semana (lunes a viernes) para colaboradores administrativos."
          : "Permiso sin goce de sueldo: registra motivo obligatorio y duración manual."
        : "Incapacidad interna: RH define manualmente la duración.";
      card.innerHTML = buildInfoHomeOfficeHtml(txt);
    }
  }

  function refreshLiveFormState(): void {
    updateInfoCard();
    applyRhModalLiveFeedback(host, tipo, contextoVac, contextoHoPuedeSolicitarMes);
  }

  async function refreshContextForEmpleado(
    empleadoId: number | null,
    fechaReferencia?: string,
  ): Promise<void> {
    const fechaRef =
      fechaReferencia?.trim() ||
      (host.querySelector("#rh-nr-inicio") as HTMLInputElement | null)?.value ||
      "";
    const [ctx] = await Promise.all([
      fetchRhEmpleadoRequestContext(empleadoId, {
        fechaReferencia: tipo === "home_office" ? fechaRef : undefined,
        excluirSolicitudId: revisionSolicitudId ?? undefined,
      }),
      actualizarClasificacionEmpleado(empleadoId),
    ]);
    contextoVac = ctx.diasVacacionesDisponibles;
    contextoHoText = ctx.homeOfficeResumen;
    contextoHoPuedeSolicitarMes = ctx.homeOfficePuedeSolicitarMes;
    asegurarTipoSolicitudPermitido();
    updateInfoCard();
    applyRhModalLiveFeedback(host, tipo, contextoVac, contextoHoPuedeSolicitarMes);
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
    const fechaFin =
      singleDayHomeOffice ? fechaInicio
      : matrimonioDosDias && fechaInicio.trim() ? sumarDiasIso(fechaInicio, 1)
      : fechaFinBase;
    const motivoBase = preserve.motivo ?? snap.motivo;
    const motivo =
      hideMotivoVacaciones || hideMotivoEmpleado ? "" : motivoBase;
    const dias = calcularDiasVacacionesSolicitados(
      fechaInicio,
      fechaFin,
      empleadoEsAdministrativo === true &&
        (tipo === "vacaciones" || tipo === "permiso_sin_goce_sueldo"),
    );
    const fechasOk = fechasOrdenValidas(fechaInicio, fechaFin);
    const infoHtml =
      tipo === "vacaciones"
        ? buildInfoVacacionesHtml(contextoVac, dias, fechasOk, empleadoEsAdministrativo === true)
        : tipo === "home_office"
          ? buildInfoHomeOfficeHtml(contextoHoText)
          : buildInfoHomeOfficeHtml(
              tipo === "matrimonio" ? "Matrimonio: duración fija de 2 días con goce de sueldo."
              : tipo === "defuncion" ? "Defunción: duración fija de 3 días con goce de sueldo."
              : tipo === "paternidad" ? "Paternidad: duración fija de 7 días hábiles con goce de sueldo."
              : tipo === "permiso_sin_goce_sueldo" ?
                  empleadoEsAdministrativo === true ?
                    "Permiso sin goce de sueldo: registra motivo obligatorio y duración manual. Solo días entre semana (lunes a viernes) para colaboradores administrativos."
                  : "Permiso sin goce de sueldo: registra motivo obligatorio y duración manual."
              : "Incapacidad interna: RH define manualmente la duración.",
            );
    const empleadoSelectorOmitido = fixedEmpleado != null;
    const ui = computeRhModalFormUi(
      tipo,
      contextoVac,
      selectedEmpleadoId,
      fechaInicio,
      fechaFin,
      motivo,
      empleadoSelectorOmitido,
      modoRevision,
      empleadoEsAdministrativo,
      contextoHoPuedeSolicitarMes,
    );
    const itemsParaSelector = listaEmpleadosParaSelector();

    modalBody.innerHTML = buildFormHtml({
      tipo,
      showPaidLeaveTypes: options.allowPaidLeaveTypes === true,
      showUnpaidLeaveType: options.allowUnpaidLeaveType === true,
      items: itemsParaSelector,
      selectedEmpleadoId,
      empleadoSearchQ,
      fechaInicio,
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
      showMotivoField: !hideMotivoVacaciones && !hideMotivoEmpleado,
      showSupervisorSolicitudSubject: showSupervisorSujeto && !modoRevision,
      supervisorSolicitudSubject: solicitudSubjectSupervisor,
      fixedEmpleadoAyudaOverride: supervisorPersonalMode
        ? "La solicitud queda registrada a tu nombre. No puedes elegir otro colaborador en este modo."
        : undefined,
      empleadoBusquedaAyuda: supervisorSolicitudEquipo ?
        "Busca a un colaborador de tu equipo según tu alcance en el directorio. Tu propio usuario no aparece en el listado."
      : undefined,
      supervisorOcultarPermisoSinGoceEnTipo:
        showSupervisorSujeto && !modoRevision && solicitudSubjectSupervisor === "personal" ? true : undefined,
      showHomeOfficeType: puedeMostrarHomeOffice(),
    });
    bindFormInteractions();
    applyRhModalLiveFeedback(host, tipo, contextoVac, contextoHoPuedeSolicitarMes);
  }

  function bindFormInteractions(): void {
    const form = host.querySelector("#rh-nr-form") as HTMLFormElement | null;
    const qInput = host.querySelector("#rh-nr-empleado-q") as HTMLInputElement | null;
    const sel = host.querySelector("#rh-nr-empleado") as HTMLSelectElement | null;
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

    function syncFechasFijas(): void {
      if (!inicio || !fin) return;
      if (isSingleDayHomeOffice) {
        fin.value = inicio.value;
      } else if (isMatrimonioDosDias && inicio.value.trim()) {
        fin.value = sumarDiasIso(inicio.value, 1);
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
          { signal: options.signal },
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
        { signal: options.signal },
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
          hideError();
          const snapSubject = readFormSnapshot();
          void (async (): Promise<void> => {
            try {
              if (v === "team") {
                await loadEmpleados("");
                renderForm({
                  selectedId: "",
                  fechaInicio: snapSubject.fechaInicio,
                  fechaFin: snapSubject.fechaFin,
                  motivo: snapSubject.motivo,
                });
                await refreshContextForEmpleado(null);
                renderForm({
                  selectedId: "",
                  fechaInicio: snapSubject.fechaInicio,
                  fechaFin: snapSubject.fechaFin,
                  motivo: snapSubject.motivo,
                });
              } else if (supervisorDirResolved != null) {
                if (tipo === "permiso_sin_goce_sueldo") {
                  tipo = "vacaciones";
                }
                empleadosCache = [];
                await refreshContextForEmpleado(supervisorDirResolved);
                renderForm({
                  selectedId: "",
                  fechaInicio: snapSubject.fechaInicio,
                  fechaFin: snapSubject.fechaFin,
                  motivo: snapSubject.motivo,
                });
              }
            } catch {
              showError("No se pudo actualizar el modo de solicitud.");
            }
          })();
        },
        { signal: options.signal },
      );
    });

    if (sel) {
      qInput?.addEventListener(
        "input",
        () => {
          empleadoSearchQ = qInput.value;
          const q = qInput.value;
          if (searchTimer) clearTimeout(searchTimer);
          searchTimer = setTimeout(async () => {
            if (q === lastSearchQ) return;
            lastSearchQ = q;
            try {
              const prev = (host.querySelector("#rh-nr-empleado") as HTMLSelectElement | null)?.value ?? "";
              await loadEmpleados(q);
              renderForm({ selectedId: prev });
              const pid = prev ? Number.parseInt(prev, 10) : NaN;
              await refreshContextForEmpleado(Number.isFinite(pid) ? pid : null);
              renderForm({ selectedId: prev });
            } catch {
              showError("No se pudo cargar el listado de empleados.");
            }
          }, 320);
        },
        { signal: options.signal },
      );

      sel?.addEventListener(
        "change",
        () => {
          const v = sel.value;
          const snapEmp = readFormSnapshot();
          void (async (): Promise<void> => {
            try {
              if (v === "") {
                await refreshContextForEmpleado(null);
              } else {
                const id = Number.parseInt(v, 10);
                await refreshContextForEmpleado(Number.isFinite(id) ? id : null);
              }
              renderForm({
                selectedId: v,
                fechaInicio: snapEmp.fechaInicio,
                fechaFin: snapEmp.fechaFin,
                motivo: snapEmp.motivo,
              });
              hideError();
            } catch {
              showError("No se pudo actualizar la información del empleado.");
            }
          })();
        },
        { signal: options.signal },
      );
    }

    inicio?.addEventListener(
      "input",
      () => {
        syncFechasFijas();
        if (tipo === "home_office") {
          const empRaw =
            (host.querySelector("#rh-nr-empleado-id") as HTMLInputElement | null)?.value ||
            (host.querySelector("#rh-nr-empleado") as HTMLSelectElement | null)?.value ||
            "";
          const empId = Number.parseInt(empRaw, 10);
          void (async (): Promise<void> => {
            try {
              await refreshContextForEmpleado(
                empRaw && Number.isFinite(empId) ? empId : null,
                inicio?.value ?? "",
              );
              refreshLiveFormState();
            } catch {
              refreshLiveFormState();
            }
          })();
        } else {
          refreshLiveFormState();
        }
      },
      { signal: options.signal },
    );
    fin?.addEventListener("input", refreshLiveFormState, { signal: options.signal });
    motivo?.addEventListener("input", refreshLiveFormState, { signal: options.signal });
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
        if (tipo === "home_office" || tipo === "permiso_sin_goce_sueldo") {
          const esAdmin = await resolverEmpleadoEsAdministrativo(empleado_id);
          empleadoEsAdministrativo = esAdmin;
          if (tipo === "home_office" && !esAdmin) {
            showError(MSG_HOME_OFFICE_SOLO_ADMINISTRATIVO);
            return;
          }
        }
        const fecha_inicio = String(fd.get("fecha_inicio") ?? "").trim();
        const fecha_fin_raw = String(fd.get("fecha_fin") ?? "").trim();
        const fecha_fin =
          tipo === "home_office" ? fecha_inicio
          : tipo === "matrimonio" && fecha_inicio.trim() ? sumarDiasIso(fecha_inicio, 1)
          : fecha_fin_raw;
        if (!fecha_inicio || !fecha_fin) {
          showError("Indica fecha de inicio y fecha de fin.");
          return;
        }
        if (tipo === "home_office" && fecha_inicio !== fecha_fin) {
          showError(MENSAJE_HOME_OFFICE_UN_DIA);
          return;
        }
        if (tipo === "matrimonio" && !esRangoMatrimonioValido(fecha_inicio, fecha_fin)) {
          showError(MENSAJE_MATRIMONIO_DOS_DIAS);
          return;
        }
        if (!fechasOrdenValidas(fecha_inicio, fecha_fin)) {
          showError("La fecha de fin no puede ser anterior a la fecha de inicio.");
          return;
        }
        const dias = calcularDiasVacacionesSolicitados(
          fecha_inicio,
          fecha_fin,
          empleadoEsAdministrativo === true &&
            (tipo === "vacaciones" || tipo === "permiso_sin_goce_sueldo"),
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
          await refreshContextForEmpleado(empleado_id, fecha_inicio);
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

        const submitBtn = host.querySelector("#rh-nr-submit") as HTMLButtonElement | null;
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = revisionSolicitudId != null ? "Reenviando…" : "Enviando…";
        }

        const payload: RhNuevaSolicitudPayload = {
          empleado_id,
          tipo,
          fecha_inicio,
          fecha_fin,
          motivo,
          comentarios: null,
        };

        try {
          if (revisionSolicitudId != null) {
            await patchSolicitudRevision(revisionSolicitudId, {
              fecha_inicio,
              fecha_fin,
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
            applyRhModalLiveFeedback(host, tipo, contextoVac, contextoHoPuedeSolicitarMes);
          }
        }
      },
      { signal: options.signal },
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
          await refreshContextForEmpleado(empleadoRevision);
          renderForm({
            fechaInicio: String(sol.fecha_inicio).slice(0, 10),
            fechaFin: String(sol.fecha_fin).slice(0, 10),
            motivo: typeof sol.motivo === "string" ? sol.motivo : "",
            submitLabel: "Guardar y reenviar",
          });
          (host.querySelector("#rh-nr-inicio") as HTMLElement | null)?.focus();
          return;
        }

        if (fixedSelfId == null) {
          let prefill = openOpts?.prefillEmpleadoId;
          let selectedId = "";
          const abreSupervisorPersonal =
            showSupervisorSujeto && solicitudSubjectSupervisor === "personal";

          if (abreSupervisorPersonal) {
            empleadosCache = [];
          } else {
            await loadEmpleados("");
            if (prefill != null && !empleadosCache.some((u) => u.id === prefill)) {
              await loadEmpleados(String(prefill));
            }
            const poolAbierto = listaEmpleadosParaSelector();
            if (prefill != null && !poolAbierto.some((u) => u.id === prefill)) {
              await loadEmpleados(String(prefill));
            }
            const poolFinal = listaEmpleadosParaSelector();
            selectedId =
              prefill != null && poolFinal.some((u) => u.id === prefill) ? String(prefill) : "";
          }

          const today = new Date();
          const iso = (d: Date) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          renderForm({
            selectedId,
            fechaInicio: iso(today),
            fechaFin: iso(today),
            motivo: "",
          });
          const ctxEmpDir =
            abreSupervisorPersonal && supervisorDirResolved != null
              ? supervisorDirResolved
              : selectedId
                ? Number.parseInt(selectedId, 10)
                : null;
          await refreshContextForEmpleado(ctxEmpDir);
          (
            host.querySelector(abreSupervisorPersonal ? "#rh-nr-inicio" : "#rh-nr-empleado") as HTMLElement | null
          )?.focus();
        } else {
          await refreshContextForEmpleado(fixedSelfId);
          const today = new Date();
          const iso = (d: Date) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          renderForm({
            fechaInicio: iso(today),
            fechaFin: iso(today),
            motivo: "",
          });
          (host.querySelector("#rh-nr-inicio") as HTMLElement | null)?.focus();
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
      if (searchTimer) clearTimeout(searchTimer);
      host.innerHTML = "";
      document.body.style.overflow = "";
    },
  };
}
