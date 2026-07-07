import type { ViajeLaboralListItem } from "../../api/viajesLaborales.ts";
import { badgeHtmlViajeLaboralEstado, fmtViaticos } from "../../viajesLaborales/rh/constants.ts";
import { VL_COPY } from "../../viajesLaborales/rh/viajesLaboralesCopy.ts";
import { escapeHtml, fmtFechaCorta } from "../../ui/uiUtils.ts";
import { formatNombreEmpleadoUi } from "../../utils/nombreEmpleadoDisplay.ts";
import { formatNoEmpleadoDisplay } from "../../utils/noEmpleadoDisplay.ts";
import { MODAL_OVERLAY, MODAL_PANEL, RH_SOLICITUDES_BTN_PRIMARY } from "./rhViajesLaboralesPageStyles.ts";

export type ViajeLaboralDetalleModalOptions = {
  canApprove: boolean;
  onAprobar: (id: number) => Promise<void>;
  onRechazar: (id: number, motivo: string) => Promise<void>;
  onCancelar: (id: number) => Promise<void>;
};

export type ViajeLaboralDetalleModalHandle = {
  open: (viaje: ViajeLaboralListItem) => void;
  close: () => void;
  destroy: () => void;
};

function detailRow(label: string, value: string): string {
  return `<div><dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">${escapeHtml(label)}</dt><dd class="mt-1 text-sm text-slate-900">${value}</dd></div>`;
}

export function mountViajeLaboralDetalleModal(
  host: HTMLElement,
  options: ViajeLaboralDetalleModalOptions,
): ViajeLaboralDetalleModalHandle {
  host.innerHTML = `
    <div id="vl-detalle-overlay" class="${MODAL_OVERLAY} hidden items-center justify-center p-3 sm:p-6">
      <div class="w-full max-w-2xl ${MODAL_PANEL}">
        <header class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 class="text-base font-bold">${escapeHtml(VL_COPY.modalDetalleTitulo)}</h2>
          <button type="button" id="vl-detalle-close" class="size-10 rounded-lg text-slate-400 hover:bg-slate-100">×</button>
        </header>
        <div id="vl-detalle-body" class="space-y-4 px-4 py-4"></div>
        <footer id="vl-detalle-footer" class="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-4 py-3"></footer>
      </div>
    </div>`;

  const overlay = host.querySelector("#vl-detalle-overlay") as HTMLElement;
  const body = host.querySelector("#vl-detalle-body") as HTMLElement;
  const footer = host.querySelector("#vl-detalle-footer") as HTMLElement;
  const closeBtn = host.querySelector("#vl-detalle-close") as HTMLButtonElement;

  let current: ViajeLaboralListItem | null = null;

  function close(): void {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
    current = null;
    body.innerHTML = "";
    footer.innerHTML = "";
  }

  function render(viaje: ViajeLaboralListItem): void {
    const nombre = formatNombreEmpleadoUi(viaje.empleado_nombre ?? "");
    body.innerHTML = `
      <div class="flex items-center gap-2">${badgeHtmlViajeLaboralEstado(viaje.estado)}</div>
      <dl class="grid gap-4 sm:grid-cols-2">
        ${detailRow("Empleado", escapeHtml(`${formatNoEmpleadoDisplay(viaje.numero_empleado)} — ${nombre}`))}
        ${detailRow("Fechas", escapeHtml(`${fmtFechaCorta(viaje.fecha_salida)} – ${fmtFechaCorta(viaje.fecha_regreso)}`))}
        ${detailRow("Origen", escapeHtml(viaje.lugar_origen))}
        ${detailRow("Destino", escapeHtml(viaje.lugar_destino))}
        ${detailRow("Motivo", escapeHtml(viaje.motivo))}
        ${detailRow("Descripción", escapeHtml(viaje.descripcion || "—"))}
        ${detailRow("Transporte", escapeHtml(viaje.medio_transporte))}
        ${detailRow("Hospedaje", escapeHtml(viaje.hospedaje || "—"))}
        ${detailRow("Viáticos estimados", escapeHtml(fmtViaticos(viaje.viaticos_estimados)))}
        ${detailRow("Registrado por", escapeHtml(viaje.registrado_por_nombre ? formatNombreEmpleadoUi(viaje.registrado_por_nombre) : "—"))}
        ${viaje.aprobado_por_nombre ? detailRow("Aprobado/rechazado por", escapeHtml(formatNombreEmpleadoUi(viaje.aprobado_por_nombre))) : ""}
        ${viaje.motivo_rechazo ? detailRow("Motivo de rechazo", escapeHtml(viaje.motivo_rechazo)) : ""}
      </dl>`;

    const actions: string[] = [];
    if (viaje.estado === "pendiente" && options.canApprove) {
      actions.push(
        `<button type="button" data-vl-detalle-action="aprobar" class="${RH_SOLICITUDES_BTN_PRIMARY} min-h-10 px-3 text-sm">${escapeHtml(VL_COPY.accAprobar)}</button>`,
        `<button type="button" data-vl-detalle-action="rechazar" class="rh-sol-btn-secondary min-h-10 rounded px-3 text-sm">${escapeHtml(VL_COPY.accRechazar)}</button>`,
      );
    }
    if (viaje.estado === "pendiente" || viaje.estado === "aprobado") {
      actions.push(
        `<button type="button" data-vl-detalle-action="cancelar" class="rh-sol-btn-secondary min-h-10 rounded px-3 text-sm">${escapeHtml(VL_COPY.accCancelar)}</button>`,
      );
    }
    footer.innerHTML = actions.join("");

    footer.querySelectorAll("[data-vl-detalle-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-vl-detalle-action");
        if (!current || !action) return;
        void handleAction(action, current.id);
      });
    });
  }

  async function handleAction(action: string, id: number): Promise<void> {
    try {
      if (action === "aprobar") {
        await options.onAprobar(id);
      } else if (action === "rechazar") {
        const motivo = window.prompt(VL_COPY.motivoRechazoPlaceholder);
        if (!motivo?.trim()) return;
        await options.onRechazar(id, motivo.trim());
      } else if (action === "cancelar") {
        if (!window.confirm(VL_COPY.confirmCancelar)) return;
        await options.onCancelar(id);
      }
      close();
    } catch {
      /* parent shows toast */
    }
  }

  function open(viaje: ViajeLaboralListItem): void {
    current = viaje;
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
    document.body.style.overflow = "hidden";
    render(viaje);
  }

  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  return { open, close, destroy: () => { close(); host.innerHTML = ""; } };
}
