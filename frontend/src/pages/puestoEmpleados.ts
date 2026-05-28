import { mountAppShell } from "../layouts/appShell.ts";
import { getAccessToken } from "../auth/session.ts";
import { getRolFromAccessToken } from "../auth/jwt.ts";

import { escapeHtml } from "../ui/uiUtils.ts";
import { BTN_GHOST, BTN_PRIMARY, BTN_DANGER } from "../ui/uiTokens.ts";
import { deletePerfilAsignacion, getAsignacionGap, getAsignacionTareasExtra } from "../api/puestos.ts";
import { mountAsignarEmpleadoModal } from "../components/puestos/asignarEmpleadoModal.ts";
import { mountTareasExtraModal } from "../components/puestos/tareasExtraModal.ts";
import { mountEvaluarCualificacionesModal } from "../components/puestos/evaluarCualificacionesModal.ts";
import { mountEvaluarCompetenciasModal } from "../components/puestos/evaluarCompetenciasModal.ts";

interface AsignacionItem {
  id: number;
  empleado_id: number;
  nombre_empleado: string | null;
  no_empleado: string | null;
  departamento: string | null;
  activo: boolean;
  fecha_firma_superior: string | null;
  fecha_firma_empleado: string | null;
}

function isRh(): boolean {
  return getRolFromAccessToken() === "rh";
}

export function mountPuestoEmpleados(container: HTMLElement, perfilId: number): void {
  mountAppShell(container, {
    pageTitle: "Empleados del Puesto",
    mainHtml: `
      <div id="puesto-empleados-root" class="space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <button id="btn-volver" class="${BTN_GHOST} text-sm">← Volver</button>
            <h2 class="text-lg font-bold text-text-primary">Empleados asignados</h2>
          </div>
          ${isRh() ? `<button id="btn-asignar" class="${BTN_PRIMARY} text-sm">+ Asignar empleado</button>` : ""}
        </div>
        <div id="puesto-empleados-header" class="text-sm text-text-muted"></div>
        <div id="puesto-empleados-content">
          <p class="text-sm text-text-muted">Cargando...</p>
        </div>
        <div id="modal-host-asignar"></div>
        <div id="modal-host-tareas-extra"></div>
        <div id="modal-host-evaluar-cual"></div>
        <div id="modal-host-evaluar-comp"></div>
        <div id="modal-host-detalle"></div>
      </div>`,
  });

  const btnVolver = container.querySelector("#btn-volver") as HTMLButtonElement | null;
  if (btnVolver) {
    btnVolver.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.hash = `#/puestos/${perfilId}`;
      }
    });
  }

  // Mount asignar modal (RH only)
  if (isRh()) {
    const modalHost = container.querySelector("#modal-host-asignar") as HTMLElement;
    const asignarModal = mountAsignarEmpleadoModal(modalHost, {
      perfilId,
      onSuccess: () => loadEmpleados(container, perfilId),
    });

    const btnAsignar = container.querySelector("#btn-asignar") as HTMLButtonElement | null;
    if (btnAsignar) {
      btnAsignar.addEventListener("click", () => asignarModal.open());
    }
  }

  loadPerfilHeader(container, perfilId);
  loadEmpleados(container, perfilId);
}

async function loadPerfilHeader(container: HTMLElement, perfilId: number): Promise<void> {
  const headerEl = container.querySelector("#puesto-empleados-header");
  if (!headerEl) return;

  const token = getAccessToken();
  if (!token) return;

  try {
    const res = await fetch(`/api/v1/puestos-perfil/${perfilId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;

    const perfil = await res.json();
    const area = perfil.area_nombre ? ` · ${escapeHtml(perfil.area_nombre)}` : "";
    headerEl.innerHTML = `
      <span class="font-semibold text-text-primary">${escapeHtml(perfil.nombre)}</span>
      <span class="text-slate-400">${area}</span>
    `;
  } catch {
    // header is optional context
  }
}

async function loadEmpleados(container: HTMLElement, perfilId: number): Promise<void> {
  const contentEl = container.querySelector("#puesto-empleados-content");
  if (!contentEl) return;

  const token = getAccessToken();
  if (!token) {
    contentEl.innerHTML = `<p class="text-sm text-red-600">No autenticado</p>`;
    return;
  }

  try {
    const res = await fetch(`/api/v1/perfiles/${perfilId}/asignaciones`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 404) {
      contentEl.innerHTML = `<p class="text-sm text-text-muted">Perfil no encontrado.</p>`;
      return;
    }

    if (!res.ok) {
      contentEl.innerHTML = `<p class="text-sm text-red-600">Error al cargar asignaciones (${res.status})</p>`;
      return;
    }

    const asignaciones: AsignacionItem[] = await res.json();

    if (asignaciones.length === 0) {
      contentEl.innerHTML = `
        <div class="rounded-xl border border-dashed border-border/90 bg-slate-50/40 py-8 text-center">
          <p class="text-sm font-semibold text-text-primary">Sin empleados asignados</p>
          <p class="mt-1.5 text-xs text-text-muted">Aún no se han asignado empleados a este perfil de puesto.</p>
        </div>`;
      return;
    }

    const showActions = isRh();
    const rows = asignaciones.map((a) => `
      <tr class="border-b border-slate-100/80 transition-colors hover:bg-slate-50/90">
        <td class="px-4 py-3 text-sm text-text-primary">
          <span class="font-medium">${escapeHtml(a.nombre_empleado ?? `Empleado #${a.empleado_id}`)}</span>
          ${a.no_empleado ? `<span class="ml-2 text-xs text-slate-400 tabular-nums">${escapeHtml(String(parseInt(a.no_empleado, 10) || a.no_empleado))}</span>` : ""}
        </td>
        <td class="px-4 py-3 text-right space-x-1">
          <button type="button" data-ver-detalle="${a.id}" data-nombre="${escapeHtml(a.nombre_empleado ?? "")}" class="${BTN_GHOST} !px-2 !py-1 text-xs">Ver detalle</button>
          ${showActions && a.activo ? `<button type="button" data-evaluar-cual="${a.id}" data-nombre="${escapeHtml(a.nombre_empleado ?? "")}" class="${BTN_GHOST} !px-2 !py-1 text-xs">Evaluar cual.</button>` : ""}
          ${showActions && a.activo ? `<button type="button" data-evaluar-comp="${a.id}" data-nombre="${escapeHtml(a.nombre_empleado ?? "")}" class="${BTN_GHOST} !px-2 !py-1 text-xs">Evaluar comp.</button>` : ""}
          ${showActions && a.activo ? `<button type="button" data-tareas-extra="${a.id}" data-nombre="${escapeHtml(a.nombre_empleado ?? "")}" class="${BTN_GHOST} !px-2 !py-1 text-xs">Tareas extra</button>` : ""}
          ${showActions && a.activo ? `<button type="button" data-desasignar="${a.id}" class="${BTN_DANGER} !px-2 !py-1 text-xs">Desasignar</button>` : ""}
        </td>
      </tr>
    `).join("");

    contentEl.innerHTML = `
      <p class="text-xs text-slate-500 mb-3">${asignaciones.length} empleado${asignaciones.length !== 1 ? "s" : ""} asignado${asignaciones.length !== 1 ? "s" : ""}</p>
      <section class="overflow-hidden rounded-xl border border-border bg-white shadow-sm ring-1 ring-slate-900/5">
        <div class="overflow-x-auto">
          <table class="min-w-[600px] w-full text-left">
            <thead class="border-b border-leoni-blue-light">
              <tr class="text-white">
                <th class="bg-leoni-blue px-4 py-3 text-sm font-semibold">Empleado</th>
                <th class="bg-leoni-blue px-4 py-3 text-sm font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100/90">${rows}</tbody>
          </table>
        </div>
      </section>`;

    // Bind desasignar buttons
    if (showActions) {
      contentEl.querySelectorAll<HTMLButtonElement>("[data-desasignar]").forEach(btn => {
        btn.addEventListener("click", async () => {
          const asignacionId = Number(btn.dataset.desasignar);
          const confirmed = confirm("¿Desasignar a este empleado del perfil? La asignación se desactivará.");
          if (!confirmed) return;

          btn.disabled = true;
          btn.textContent = "...";
          try {
            await deletePerfilAsignacion(perfilId, asignacionId);
            loadEmpleados(container, perfilId);
          } catch {
            btn.disabled = false;
            btn.textContent = "Desasignar";
            alert("Error al desasignar empleado.");
          }
        });
      });

      // Bind tareas extra buttons
      const modalHost = container.querySelector("#modal-host-tareas-extra") as HTMLElement;
      contentEl.querySelectorAll<HTMLButtonElement>("[data-tareas-extra]").forEach(btn => {
        btn.addEventListener("click", () => {
          const asignacionId = Number(btn.dataset.tareasExtra);
          const nombreEmpleado = btn.dataset.nombre ?? "";
          const modal = mountTareasExtraModal(modalHost, {
            perfilId,
            asignacionId,
            nombreEmpleado,
          });
          modal.open();
        });
      });

      // Bind evaluar cualificaciones buttons
      const evalModalHost = container.querySelector("#modal-host-evaluar-cual") as HTMLElement;
      contentEl.querySelectorAll<HTMLButtonElement>("[data-evaluar-cual]").forEach(btn => {
        btn.addEventListener("click", () => {
          const asignacionId = Number(btn.dataset.evaluarCual);
          const nombreEmpleado = btn.dataset.nombre ?? "";
          const modal = mountEvaluarCualificacionesModal(evalModalHost, {
            perfilId,
            asignacionId,
            nombreEmpleado,
          });
          modal.open();
        });
      });

      // Bind evaluar competencias buttons
      const evalCompHost = container.querySelector("#modal-host-evaluar-comp") as HTMLElement;
      contentEl.querySelectorAll<HTMLButtonElement>("[data-evaluar-comp]").forEach(btn => {
        btn.addEventListener("click", () => {
          const asignacionId = Number(btn.dataset.evaluarComp);
          const nombreEmpleado = btn.dataset.nombre ?? "";
          const modal = mountEvaluarCompetenciasModal(evalCompHost, {
            perfilId,
            asignacionId,
            nombreEmpleado,
          });
          modal.open();
        });
      });
    }

    // Bind "Ver detalle" buttons (available to all roles)
    const detalleHost = container.querySelector("#modal-host-detalle") as HTMLElement;
    contentEl.querySelectorAll<HTMLButtonElement>("[data-ver-detalle]").forEach(btn => {
      btn.addEventListener("click", () => {
        const asignacionId = Number(btn.dataset.verDetalle);
        const nombreEmpleado = btn.dataset.nombre ?? "";
        openDetalleModal(detalleHost, perfilId, asignacionId, nombreEmpleado);
      });
    });
  } catch {
    contentEl.innerHTML = `<p class="text-sm text-red-600">Error de conexión</p>`;
  }
}

async function openDetalleModal(
  host: HTMLElement,
  perfilId: number,
  asignacionId: number,
  nombreEmpleado: string,
): Promise<void> {
  host.innerHTML = `
    <div id="detalle-overlay" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div class="w-full max-w-2xl rounded-xl border border-border bg-white shadow-xl max-h-[90vh] flex flex-col" role="dialog" aria-modal="true">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4 shrink-0">
          <div>
            <h2 class="text-lg font-semibold text-text-primary">Detalle del empleado</h2>
            <p class="text-xs text-slate-500 mt-0.5">${escapeHtml(nombreEmpleado)}</p>
          </div>
          <button type="button" id="detalle-close" class="${BTN_GHOST} !p-1.5" aria-label="Cerrar">
            <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div id="detalle-body" class="flex-1 overflow-y-auto px-5 py-4">
          <p class="text-sm text-text-muted">Cargando...</p>
        </div>
      </div>
    </div>`;

  const overlay = host.querySelector("#detalle-overlay") as HTMLElement;
  const body = host.querySelector("#detalle-body") as HTMLElement;

  function close(): void {
    host.innerHTML = "";
  }

  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  host.querySelector("#detalle-close")!.addEventListener("click", close);
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { e.preventDefault(); close(); document.removeEventListener("keydown", esc); }
  });

  try {
    const [gap, tareasExtra] = await Promise.all([
      getAsignacionGap(perfilId, asignacionId),
      getAsignacionTareasExtra(perfilId, asignacionId),
    ]);

    const r = gap.resumen;
    const cualRows = gap.gap_cualificaciones.map(g => {
      let badge: string;
      if (g.cumple === true) badge = `<span class="text-emerald-600 text-xs font-medium">Cumple</span>`;
      else if (g.cumple === false) badge = `<span class="text-red-600 text-xs font-medium">No cumple</span>`;
      else badge = `<span class="text-amber-600 text-xs font-medium">Pendiente</span>`;
      return `<tr class="border-b border-slate-100"><td class="py-1.5 pr-3 text-sm text-text-primary">${escapeHtml(g.situacion_deseada)}</td><td class="py-1.5 text-right">${badge}</td></tr>`;
    }).join("");

    const compRows = gap.gap_competencias.map(g => {
      const nivel = g.evaluado && g.situacion_actual ? parseInt(g.situacion_actual, 10) : 0;
      const nivelDisplay = isNaN(nivel) ? (g.situacion_actual === "cumple" ? "4" : "0") : String(nivel);
      return `<tr class="border-b border-slate-100"><td class="py-1.5 pr-3 text-sm text-text-primary">${escapeHtml(g.competencia_nombre)}</td><td class="py-1.5 text-right text-xs font-medium text-slate-600">${g.evaluado ? nivelDisplay + "/4" : '<span class="text-amber-600">Pendiente</span>'}</td></tr>`;
    }).join("");

    const tareasRows = tareasExtra.map(t =>
      `<li class="text-sm text-text-primary">${escapeHtml(t.tarea_catalogo_nombre)}</li>`
    ).join("");

    body.innerHTML = `
      <div class="space-y-5">
        <div>
          <h3 class="text-sm font-semibold text-text-primary mb-2">Cualificaciones</h3>
          <p class="text-xs text-slate-500 mb-2">${r.evaluadas_cualificaciones}/${r.total_cualificaciones} evaluadas</p>
          ${cualRows ? `<table class="w-full">${cualRows}</table>` : `<p class="text-xs text-slate-400 italic">Sin cualificaciones</p>`}
        </div>
        <div>
          <h3 class="text-sm font-semibold text-text-primary mb-2">Competencias</h3>
          <p class="text-xs text-slate-500 mb-2">${r.evaluadas_competencias}/${r.total_competencias} evaluadas</p>
          ${compRows ? `<table class="w-full">${compRows}</table>` : `<p class="text-xs text-slate-400 italic">Sin competencias</p>`}
        </div>
        <div>
          <h3 class="text-sm font-semibold text-text-primary mb-2">Tareas extra</h3>
          ${tareasRows ? `<ul class="list-disc pl-4 space-y-1">${tareasRows}</ul>` : `<p class="text-xs text-slate-400 italic">Sin tareas extra asignadas</p>`}
        </div>
      </div>`;
  } catch {
    body.innerHTML = `<p class="text-sm text-red-600">Error al cargar detalle</p>`;
  }
}
