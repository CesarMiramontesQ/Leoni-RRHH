/**
 * Modal para editar cualificaciones de un perfil de puesto (RH o supervisor).
 * Selección desde tipos de cualificación + criterio dinámico según método configurado.
 */

import { getTiposCualificacion } from "../../api/cualificacionesCatalogo.ts";
import type { CatalogoFetchError } from "../../api/cualificacionesCatalogo.ts";
import {
  createPerfilCualificacion,
  deletePerfilCualificacion,
  getPerfilCualificaciones,
  type PerfilCualificacion,
} from "../../api/puestos.ts";
import type { TipoCualificacion } from "../../dashboard/cualificaciones/types.ts";
import {
  labelCriterio,
  readCriterioFromForm,
  renderCriterioFieldsHtml,
} from "./cualificacionCriterioFields.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { FIELD_FOCUS, MODAL_OVERLAY, MODAL_PANEL, RH_LISTADO_BTN_PRIMARY, RH_LISTADO_SELECT, SELECT_CHEVRON } from "../../ui/uiTokens.ts";

export type EditarCualificacionesModalHandle = { open: () => void; close: () => void };
export type EditarCualificacionesModalOptions = { perfilId: number; onSuccess: () => void };

export function mountEditarCualificacionesModal(
  container: HTMLElement,
  opts: EditarCualificacionesModalOptions,
): EditarCualificacionesModalHandle {
  let tiposItems: TipoCualificacion[] = [];
  let cualificaciones: PerfilCualificacion[] = [];
  let selectedTipoId: number | null = null;
  let loading = false;
  let error = "";

  function overlayHtml(): string {
    return `<div id="editar-cualificaciones-overlay" class="${MODAL_OVERLAY} hidden">
      <div class="${MODAL_PANEL} max-w-lg p-6">
        <div class="mb-4 flex items-start justify-between">
          <h2 class="text-lg font-semibold text-text-primary">Editar cualificaciones</h2>
          <button type="button" data-close-cualificaciones-modal class="rounded-lg p-1 text-text-muted hover:bg-surface">✕</button>
        </div>
        <div id="editar-cualificaciones-body"><p class="text-sm text-text-muted">Cargando…</p></div>
      </div></div>`;
  }

  function selectedTipo(): TipoCualificacion | null {
    if (!selectedTipoId) return null;
    return tiposItems.find((t) => t.id === selectedTipoId) ?? null;
  }

  function assignedCatalogIds(): Set<number> {
    return new Set(
      cualificaciones
        .map((c) => c.cualificacion_catalogo_id)
        .filter((id): id is number => typeof id === "number" && id > 0),
    );
  }

  function disponiblesTipos(): TipoCualificacion[] {
    const assigned = assignedCatalogIds();
    return tiposItems.filter(
      (t) =>
        t.activo !== false &&
        t.cualificacion_catalogo_id != null &&
        !assigned.has(t.cualificacion_catalogo_id),
    );
  }

  function renderList(): string {
    if (cualificaciones.length === 0) {
      return `<p class="text-sm italic text-slate-500 py-2">Sin cualificaciones registradas en este perfil.</p>`;
    }
    return `<div class="mb-4 max-h-48 overflow-y-auto divide-y divide-slate-100">
      ${cualificaciones
        .map(
          (c) => `
        <div class="flex items-start justify-between gap-2 py-2">
          <div>
            <p class="text-sm font-medium text-text-primary">${escapeHtml(c.cualificacion_nombre)}</p>
            <p class="text-xs text-text-muted">${escapeHtml(c.tipo_nombre)}</p>
            <p class="text-xs text-slate-600">${escapeHtml(labelCriterio(c.criterio_requerido, c.opciones))}</p>
          </div>
          <button type="button" data-delete-cual="${c.id}" class="text-xs text-red-600 hover:underline">Eliminar</button>
        </div>`,
        )
        .join("")}
    </div>`;
  }

  function renderTiposHint(disponibles: TipoCualificacion[]): string {
    if (loading) return "";
    if (error) return "";
    if (tiposItems.length === 0) {
      return `<p class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        No hay cualificaciones configuradas. Créalas en <a href="#/puestos/ajustes" class="font-semibold underline">Ajustes de Puestos → Cualificaciones</a>.
      </p>`;
    }
    if (disponibles.length === 0) {
      return `<p class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-text-secondary">
        Todas las cualificaciones ya están asignadas a este perfil.
      </p>`;
    }
    return "";
  }

  function renderForm(): string {
    const disponibles = disponiblesTipos();
    const options = disponibles
      .map(
        (t) =>
          `<option value="${t.id}" ${selectedTipoId === t.id ? "selected" : ""}>${escapeHtml(t.nombre)}</option>`,
      )
      .join("");
    const sel = selectedTipo();
    const criterioHtml = sel
      ? renderCriterioFieldsHtml({
          prefix: "add-cual",
          config: sel.metodo_config,
          opciones: sel.opciones,
          mode: "requerido",
        })
      : "";
    const hint = renderTiposHint(disponibles);
    const canAdd = !loading && disponibles.length > 0;

    return `
      <form id="add-cualificacion-form" class="border-t border-slate-100 pt-4 space-y-3">
        <h3 class="text-sm font-semibold text-text-primary">Agregar cualificación</h3>
        ${hint}
        <div>
          <label class="text-xs font-medium text-text-muted">Cualificación</label>
          <div class="relative mt-1 grid grid-cols-1">
            <select id="cual-tipo-select" class="${RH_LISTADO_SELECT} ${FIELD_FOCUS}" ${canAdd ? "" : "disabled"}>
              <option value="">${disponibles.length ? "Seleccionar…" : "Sin opciones disponibles"}</option>${options}
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        <div id="criterio-fields-wrap">${criterioHtml}</div>
        ${error ? `<p class="text-sm text-red-700">${escapeHtml(error)}</p>` : ""}
        <button type="submit" class="${RH_LISTADO_BTN_PRIMARY} w-full" ${loading || !canAdd ? "disabled" : ""}>${loading ? "Guardando…" : "Agregar"}</button>
      </form>`;
  }

  function paintBody(): void {
    const body = container.querySelector("#editar-cualificaciones-body");
    if (!body) return;
    if (loading && tiposItems.length === 0 && cualificaciones.length === 0) {
      body.innerHTML = `<p class="text-sm text-text-muted">Cargando cualificaciones…</p>`;
      return;
    }
    body.innerHTML = `${renderList()}${renderForm()}`;
  }

  async function loadData(): Promise<void> {
    loading = true;
    error = "";
    paintBody();
    try {
      const [items, perfilItems] = await Promise.all([
        getTiposCualificacion(),
        getPerfilCualificaciones(opts.perfilId),
      ]);
      tiposItems = items;
      cualificaciones = perfilItems;
      if (!selectedTipoId || !items.some((t) => t.id === selectedTipoId)) {
        selectedTipoId = null;
      }
    } catch (e) {
      const err = e as CatalogoFetchError;
      error = err.detail ?? "No se pudo cargar las cualificaciones.";
      tiposItems = [];
      cualificaciones = [];
    } finally {
      loading = false;
      paintBody();
    }
  }

  async function open(): Promise<void> {
    const overlay = container.querySelector("#editar-cualificaciones-overlay");
    if (!(overlay instanceof HTMLElement)) return;
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
    error = "";
    selectedTipoId = null;
    await loadData();
  }

  function close(): void {
    const overlay = container.querySelector("#editar-cualificaciones-overlay");
    if (overlay instanceof HTMLElement) {
      overlay.classList.add("hidden");
      overlay.classList.remove("flex");
    }
  }

  container.innerHTML = overlayHtml();

  container.addEventListener("click", async (ev) => {
    const t = ev.target as HTMLElement;
    if (t.closest("[data-close-cualificaciones-modal]")) {
      close();
      return;
    }
    const delBtn = t.closest("[data-delete-cual]") as HTMLElement | null;
    if (delBtn) {
      const id = Number(delBtn.dataset.deleteCual);
      if (!confirm("¿Eliminar esta cualificación del perfil?")) return;
      try {
        await deletePerfilCualificacion(opts.perfilId, id);
        opts.onSuccess();
        await loadData();
      } catch {
        error = "No se pudo eliminar.";
        paintBody();
      }
    }
  });

  container.addEventListener("change", (ev) => {
    const sel = (ev.target as HTMLElement).closest("#cual-tipo-select") as HTMLSelectElement | null;
    if (!sel) return;
    selectedTipoId = sel.value ? Number(sel.value) : null;
    paintBody();
  });

  container.addEventListener("submit", async (ev) => {
    const form = (ev.target as HTMLElement).closest("#add-cualificacion-form");
    if (!form) return;
    ev.preventDefault();
    const tipo = selectedTipo();
    if (!tipo?.cualificacion_catalogo_id) {
      error = "Selecciona una cualificación.";
      paintBody();
      return;
    }
    const wrap = form.querySelector("#criterio-fields-wrap");
    if (!(wrap instanceof HTMLElement)) return;
    const criterio = readCriterioFromForm(wrap);
    loading = true;
    error = "";
    paintBody();
    try {
      await createPerfilCualificacion(opts.perfilId, {
        cualificacion_catalogo_id: tipo.cualificacion_catalogo_id,
        criterio_requerido: criterio,
      });
      selectedTipoId = null;
      opts.onSuccess();
      await loadData();
    } catch (e) {
      error = (e as CatalogoFetchError).detail ?? "Error al guardar.";
      paintBody();
    } finally {
      loading = false;
    }
  });

  return { open: () => void open(), close };
}
