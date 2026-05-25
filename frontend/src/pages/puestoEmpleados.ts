import { mountAppShell } from "../layouts/appShell.ts";
import { getAccessToken } from "../auth/session.ts";
import { BTN_GHOST } from "../ui/uiTokens.ts";

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

export function mountPuestoEmpleados(container: HTMLElement, perfilId: number): void {
  mountAppShell(container, {
    pageTitle: "Empleados del Puesto",
    mainHtml: `
      <div id="puesto-empleados-root" class="space-y-4">
        <div class="flex items-center gap-3">
          <button id="btn-volver" class="${BTN_GHOST} text-sm">← Volver</button>
          <h2 class="text-lg font-bold text-text-primary">Empleados asignados</h2>
        </div>
        <div id="puesto-empleados-header" class="text-sm text-text-muted"></div>
        <div id="puesto-empleados-content">
          <p class="text-sm text-text-muted">Cargando...</p>
        </div>
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
    const area = perfil.area_nombre ? ` · ${perfil.area_nombre}` : "";
    headerEl.innerHTML = `
      <span class="font-semibold text-text-primary">${perfil.nombre}</span>
      <span class="text-slate-400">${area}</span>
    `;
  } catch {
    // silently fail — header is optional context
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

    const rows = asignaciones.map((a) => `
      <tr class="border-b border-slate-100/80 transition-colors hover:bg-slate-50/90">
        <td class="px-4 py-3 text-sm text-text-primary">
          <span class="font-medium">${a.nombre_empleado ?? `Empleado #${a.empleado_id}`}</span>
          ${a.no_empleado ? `<span class="ml-2 text-xs text-slate-400 tabular-nums">${a.no_empleado}</span>` : ""}
        </td>
        <td class="px-4 py-3 text-sm text-slate-600">${a.departamento ?? "—"}</td>
        <td class="px-4 py-3 text-sm">${a.activo ? '<span class="text-emerald-600 font-medium">Activo</span>' : '<span class="text-slate-400">Inactivo</span>'}</td>
        <td class="px-4 py-3 text-sm text-slate-500">${a.fecha_firma_superior ?? "Pendiente"}</td>
        <td class="px-4 py-3 text-sm text-slate-500">${a.fecha_firma_empleado ?? "Pendiente"}</td>
        <td class="px-4 py-3 text-right">
          <a href="#/puestos/${perfilId}/asignaciones/${a.id}" class="text-xs font-semibold text-leoni-blue hover:underline">Ver detalle</a>
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
                <th class="bg-leoni-blue px-4 py-3 text-sm font-semibold">Departamento</th>
                <th class="bg-leoni-blue px-4 py-3 text-sm font-semibold">Estado</th>
                <th class="bg-leoni-blue px-4 py-3 text-sm font-semibold">Firma Superior</th>
                <th class="bg-leoni-blue px-4 py-3 text-sm font-semibold">Firma Empleado</th>
                <th class="bg-leoni-blue px-4 py-3 text-sm font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100/90">${rows}</tbody>
          </table>
        </div>
      </section>`;
  } catch {
    contentEl.innerHTML = `<p class="text-sm text-red-600">Error de conexión</p>`;
  }
}
