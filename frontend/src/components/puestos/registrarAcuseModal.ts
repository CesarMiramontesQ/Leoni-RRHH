/**
 * Modal para registrar el acuse (firma del superior) de una asignación de perfil de funciones.
 * Confirmación de un clic: la fecha es la de hoy y el firmante es el usuario actual.
 * La firma del empleado (para llegar a "Acuse completo") se registra en su propia sesión.
 */

import { firmarAcuseAsignacion } from "../../api/puestos.ts";
import { getAccessTokenPayload, getUserDisplayNameFromAccessToken } from "../../auth/jwt.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import {
  MODAL_OVERLAY,
  MODAL_PANEL,
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_BTN_SECONDARY,
  badgeApproved,
} from "../../ui/uiTokens.ts";

export type RegistrarAcuseModalHandle = { open: () => void; close: () => void };
export type RegistrarAcuseModalOptions = {
  perfilId: number;
  asignacionId: number;
  nombreEmpleado: string;
  /** Fecha de firma del superior ya registrada (ISO), si existe. */
  fechaFirmaSuperior: string | null;
  onSuccess: () => void;
};

/** Fecha de hoy en formato `YYYY-MM-DD` usando componentes locales (evita off-by-one por TZ). */
function hoyIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function formatFechaLarga(iso: string): string {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function mountRegistrarAcuseModal(
  container: HTMLElement,
  opts: RegistrarAcuseModalOptions,
): RegistrarAcuseModalHandle {
  const firmante = getUserDisplayNameFromAccessToken();
  const yaFirmado = Boolean(opts.fechaFirmaSuperior);
  let loading = false;
  let error = "";

  function bodyHtml(): string {
    const fechaHoy = formatFechaLarga(hoyIso());
    const yaFirmadoNota = yaFirmado
      ? `<div class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Esta asignación ya tiene el acuse del superior registrado el
          <strong>${escapeHtml(formatFechaLarga(opts.fechaFirmaSuperior as string))}</strong>.
          Puedes volver a registrarlo para actualizar la fecha.
        </div>`
      : "";

    return `
      <div class="space-y-4">
        ${yaFirmadoNota}
        <p class="text-sm leading-relaxed text-text-secondary">
          Se registrará el acuse del <strong>superior</strong> para este colaborador.
          La firma del empleado se registra por separado en su propia sesión.
        </p>
        <dl class="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm">
          <div class="flex items-center justify-between gap-3 py-1">
            <dt class="text-text-muted">Firmante</dt>
            <dd class="font-semibold text-text-primary">${escapeHtml(firmante)}</dd>
          </div>
          <div class="flex items-center justify-between gap-3 py-1">
            <dt class="text-text-muted">Rol del acuse</dt>
            <dd>${badgeApproved("Superior")}</dd>
          </div>
          <div class="flex items-center justify-between gap-3 py-1">
            <dt class="text-text-muted">Fecha</dt>
            <dd class="font-semibold text-text-primary">${escapeHtml(fechaHoy)}</dd>
          </div>
        </dl>
        ${error ? `<p class="text-sm font-medium text-red-700">${escapeHtml(error)}</p>` : ""}
        <div class="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <button type="button" data-acuse-cancel class="${RH_LISTADO_BTN_SECONDARY} w-full sm:w-auto" ${loading ? "disabled" : ""}>Cancelar</button>
          <button type="button" data-acuse-confirm class="${RH_LISTADO_BTN_PRIMARY} w-full sm:w-auto" ${loading ? "disabled" : ""}>
            ${loading ? "Registrando…" : "Confirmar acuse"}
          </button>
        </div>
      </div>`;
  }

  function overlayHtml(): string {
    return `<div id="registrar-acuse-overlay" class="${MODAL_OVERLAY} hidden">
      <div class="${MODAL_PANEL} max-w-md p-6" role="dialog" aria-modal="true" aria-labelledby="registrar-acuse-title">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="registrar-acuse-title" class="text-lg font-semibold text-text-primary">Registrar acuse</h2>
            <p class="text-sm text-text-muted">${escapeHtml(opts.nombreEmpleado)}</p>
          </div>
          <button type="button" data-acuse-close class="rounded-lg p-1 text-text-muted hover:bg-surface" aria-label="Cerrar">✕</button>
        </div>
        <div id="registrar-acuse-body">${bodyHtml()}</div>
      </div></div>`;
  }

  function repaintBody(): void {
    const body = container.querySelector("#registrar-acuse-body");
    if (body) body.innerHTML = bodyHtml();
  }

  function close(): void {
    const overlay = container.querySelector("#registrar-acuse-overlay");
    if (overlay instanceof HTMLElement) {
      overlay.classList.add("hidden");
      overlay.classList.remove("flex");
    }
    document.body.style.overflow = "";
    document.removeEventListener("keydown", escHandler);
  }

  function escHandler(e: KeyboardEvent): void {
    if (e.key === "Escape" && !loading) close();
  }

  async function confirmar(): Promise<void> {
    if (loading) return;
    loading = true;
    error = "";
    repaintBody();
    try {
      const firmaId = String(getAccessTokenPayload()?.sub ?? "").slice(0, 50);
      await firmarAcuseAsignacion(opts.perfilId, opts.asignacionId, {
        fecha_firma_superior: hoyIso(),
        ...(firmaId ? { firma_superior_id: firmaId } : {}),
      });
      close();
      opts.onSuccess();
    } catch (e) {
      error = (e as { detail?: string })?.detail ?? "No se pudo registrar el acuse.";
      loading = false;
      repaintBody();
    }
  }

  function open(): void {
    const overlay = container.querySelector("#registrar-acuse-overlay");
    if (!(overlay instanceof HTMLElement)) return;
    error = "";
    loading = false;
    repaintBody();
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", escHandler);
  }

  container.innerHTML = overlayHtml();

  container.addEventListener("click", (ev) => {
    const t = ev.target as HTMLElement;
    if (t.closest("[data-acuse-close]") || t.closest("[data-acuse-cancel]")) {
      if (!loading) close();
      return;
    }
    if (t.closest("[data-acuse-confirm]")) {
      void confirmar();
      return;
    }
    if (t.id === "registrar-acuse-overlay" && !loading) close();
  });

  return { open, close };
}
