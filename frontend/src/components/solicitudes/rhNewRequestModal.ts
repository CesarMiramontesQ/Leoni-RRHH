/**
 * Modal «Nueva solicitud»: modo RH (selector de colaborador) y modo portal (`fixedEmpleadoDirectoryId`).
 */

import { getEmpleadosPage } from "../../api/empleados.ts";
import {
  getSolicitudById,
  patchSolicitudRevision,
  SOLICITUD_DUPLICADA_DETAIL,
} from "../../api/solicitudes.ts";
import { getUserDisplayNameFromAccessToken } from "../../auth/jwt.ts";
import { formatNombreEmpleadoUi } from "../../utils/nombreEmpleadoDisplay.ts";
import type { UsuarioListItem } from "../../api/usuarios.ts";
import { isUsuariosFetchError } from "../../api/usuarios.ts";
import { calcularDiasSolicitadosInclusive, fechasOrdenValidas } from "../../solicitudes/rh/rhNewRequestDays.ts";
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
} from "./rhNewRequestModalUi.ts";

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
  let revisionTipoOriginal: "vacaciones" | "home_office" = "vacaciones";

  let tipo: "vacaciones" | "home_office" = "vacaciones";
  let empleadosCache: UsuarioListItem[] = [];
  let contextoVac: number | null = null;
  let contextoHoText = "";
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let lastSearchQ = "";
  let empleadoSearchQ = "";

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
    const dias = calcularDiasSolicitadosInclusive(fi, ff);
    const fechasOk = fechasOrdenValidas(fi, ff);
    if (tipo === "vacaciones") {
      card.innerHTML = buildInfoVacacionesHtml(contextoVac, dias, fechasOk);
    } else {
      card.innerHTML = buildInfoHomeOfficeHtml(contextoHoText);
    }
  }

  function refreshLiveFormState(): void {
    updateInfoCard();
    applyRhModalLiveFeedback(host, tipo, contextoVac);
  }

  async function refreshContextForEmpleado(empleadoId: number | null): Promise<void> {
    const ctx = await fetchRhEmpleadoRequestContext(empleadoId);
    contextoVac = ctx.diasVacacionesDisponibles;
    contextoHoText = ctx.homeOfficeResumen;
    updateInfoCard();
    applyRhModalLiveFeedback(host, tipo, contextoVac);
  }

  function readFormSnapshot(): {
    selectedEmpleadoId: string;
    fechaInicio: string;
    fechaFin: string;
    comentarios: string;
  } {
    const hid = (host.querySelector("#rh-nr-empleado-id") as HTMLInputElement | null)?.value ?? "";
    const sel = (host.querySelector("#rh-nr-empleado") as HTMLSelectElement | null)?.value ?? "";
    return {
      selectedEmpleadoId: hid || sel,
      fechaInicio: (host.querySelector("#rh-nr-inicio") as HTMLInputElement | null)?.value ?? "",
      fechaFin: (host.querySelector("#rh-nr-fin") as HTMLInputElement | null)?.value ?? "",
      comentarios: (host.querySelector("#rh-nr-comentarios") as HTMLTextAreaElement | null)?.value ?? "",
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
      comentarios: string;
      submitLabel: string;
    }>,
  ): void {
    const modoRevision = revisionSolicitudId != null;
    const snap = readFormSnapshot();

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
    }

    const selectedEmpleadoId =
      fixedEmpleado != null ? fixedEmpleado.directoryId : (preserve.selectedId ?? snap.selectedEmpleadoId);
    const fechaInicio = preserve.fechaInicio ?? snap.fechaInicio;
    const fechaFin = preserve.fechaFin ?? snap.fechaFin;
    const comentarios = preserve.comentarios ?? snap.comentarios;
    const dias = calcularDiasSolicitadosInclusive(fechaInicio, fechaFin);
    const fechasOk = fechasOrdenValidas(fechaInicio, fechaFin);
    const infoHtml =
      tipo === "vacaciones"
        ? buildInfoVacacionesHtml(contextoVac, dias, fechasOk)
        : buildInfoHomeOfficeHtml(contextoHoText);
    const empleadoSelectorOmitido = fixedEmpleado != null;
    const ui = computeRhModalFormUi(
      tipo,
      contextoVac,
      selectedEmpleadoId,
      fechaInicio,
      fechaFin,
      empleadoSelectorOmitido,
    );
    modalBody.innerHTML = buildFormHtml({
      tipo,
      items: empleadosCache,
      selectedEmpleadoId,
      empleadoSearchQ,
      fechaInicio,
      fechaFin,
      comentarios,
      diasLabel: ui.diasLabel,
      infoHtml,
      resumenState: ui.resumenState,
      resumenHint: ui.resumenHint,
      fechaInInvalid: ui.fechaInInvalid,
      fechaFinInvalid: ui.fechaFinInvalid,
      canSubmit: ui.canSubmit,
      fixedEmpleado,
      modoRevision,
      submitLabel: preserve.submitLabel,
    });
    bindFormInteractions();
    applyRhModalLiveFeedback(host, tipo, contextoVac);
  }

  function bindFormInteractions(): void {
    const form = host.querySelector("#rh-nr-form") as HTMLFormElement | null;
    const qInput = host.querySelector("#rh-nr-empleado-q") as HTMLInputElement | null;
    const sel = host.querySelector("#rh-nr-empleado") as HTMLSelectElement | null;
    const inicio = host.querySelector("#rh-nr-inicio") as HTMLInputElement | null;
    const fin = host.querySelector("#rh-nr-fin") as HTMLInputElement | null;

    if (!host.querySelector("#rh-nr-form[data-rh-nr-revision]")) {
      host.querySelectorAll("[data-rh-nr-tipo]").forEach((btn) => {
        btn.addEventListener(
          "click",
          () => {
            const t = btn.getAttribute("data-rh-nr-tipo");
            if (t !== "vacaciones" && t !== "home_office") return;
            tipo = t;
            renderForm({});
          },
          { signal: options.signal },
        );
      });
    }

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
              void refreshContextForEmpleado(Number.isFinite(pid) ? pid : null);
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
          if (v === "") {
            void refreshContextForEmpleado(null);
          } else {
            const id = Number.parseInt(v, 10);
            void refreshContextForEmpleado(Number.isFinite(id) ? id : null);
          }
          hideError();
        },
        { signal: options.signal },
      );
    }

    inicio?.addEventListener("input", refreshLiveFormState, { signal: options.signal });
    fin?.addEventListener("input", refreshLiveFormState, { signal: options.signal });

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
            revisionSolicitudId != null || fixedSelfId != null ?
              "No se pudo validar los datos de la solicitud. Cierra el modal e inténtalo de nuevo."
            : "Selecciona un empleado.",
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
        }
        const fecha_inicio = String(fd.get("fecha_inicio") ?? "").trim();
        const fecha_fin = String(fd.get("fecha_fin") ?? "").trim();
        if (!fecha_inicio || !fecha_fin) {
          showError("Indica fecha de inicio y fecha de fin.");
          return;
        }
        if (!fechasOrdenValidas(fecha_inicio, fecha_fin)) {
          showError("La fecha de fin no puede ser anterior a la fecha de inicio.");
          return;
        }
        const dias = calcularDiasSolicitadosInclusive(fecha_inicio, fecha_fin);
        if (dias <= 0) {
          showError("Revisa el rango de fechas.");
          return;
        }
        if (tipo === "vacaciones" && contextoVac != null && dias > contextoVac) {
          showError(`Los días solicitados (${dias}) superan los disponibles (${contextoVac}) para este empleado.`);
          return;
        }
        const comentariosRaw = String(fd.get("comentarios") ?? "").trim();
        const comentarios = comentariosRaw === "" ? null : comentariosRaw;

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
          comentarios,
        };

        try {
          if (revisionSolicitudId != null) {
            await patchSolicitudRevision(revisionSolicitudId, {
              fecha_inicio,
              fecha_fin,
              comentarios,
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
            applyRhModalLiveFeedback(host, tipo, contextoVac);
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
      contextoVac = null;
      contextoHoText = "";
      lastSearchQ = "";
      empleadoSearchQ = "";
      rootOverlay.classList.remove("hidden");
      rootOverlay.classList.add("flex");
      document.body.style.overflow = "hidden";
      modalBody.innerHTML = loadingBodyHtml();

      const subEl = host.querySelector("#rh-nr-subtitle");
      if (subEl) {
        subEl.textContent =
          revisionSolicitudId != null ?
            "Actualiza las fechas o comentarios y reenvía la solicitud al aprobador."
          : fixedSelfId != null ?
            "Elige el tipo de solicitud y las fechas. El registro quedará a tu nombre."
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
          tipo = sol.tipo === "home_office" ? "home_office" : "vacaciones";
          revisionTipoOriginal = tipo;
          revisionEmpleadoId = empleadoRevision;
          const rawNom = typeof sol.empleado_nombre === "string" ? sol.empleado_nombre.trim() : "";
          revisionEmpleadoDisplayLine =
            rawNom ? formatNombreEmpleadoUi(rawNom).trim() || rawNom : `Empleado #${empleadoRevision}`;
          await refreshContextForEmpleado(empleadoRevision);
          const com = typeof sol.comentarios === "string" ? sol.comentarios : "";
          renderForm({
            fechaInicio: String(sol.fecha_inicio).slice(0, 10),
            fechaFin: String(sol.fecha_fin).slice(0, 10),
            comentarios: com,
            submitLabel: "Guardar y reenviar",
          });
          (host.querySelector("#rh-nr-inicio") as HTMLElement | null)?.focus();
          return;
        }

        if (fixedSelfId == null) {
          await loadEmpleados("");
          let prefill = openOpts?.prefillEmpleadoId;
          if (prefill != null && !empleadosCache.some((u) => u.id === prefill)) {
            await loadEmpleados(String(prefill));
          }
          const selectedId = prefill != null && empleadosCache.some((u) => u.id === prefill) ? String(prefill) : "";
          const today = new Date();
          const iso = (d: Date) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          renderForm({
            selectedId,
            fechaInicio: iso(today),
            fechaFin: iso(today),
            comentarios: "",
          });
          await refreshContextForEmpleado(selectedId ? Number.parseInt(selectedId, 10) : null);
          (host.querySelector("#rh-nr-empleado") as HTMLElement | null)?.focus();
        } else {
          await refreshContextForEmpleado(fixedSelfId);
          const today = new Date();
          const iso = (d: Date) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          renderForm({
            fechaInicio: iso(today),
            fechaFin: iso(today),
            comentarios: "",
          });
          (host.querySelector("#rh-nr-inicio") as HTMLElement | null)?.focus();
        }
      } catch (e: unknown) {
        if (isUsuariosFetchError(e) && e.status === 401) {
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
