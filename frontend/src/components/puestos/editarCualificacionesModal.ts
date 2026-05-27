/**
 * Modal para editar cualificaciones de un perfil de puesto (solo RH).
 * Permite agregar y eliminar cualificaciones inmediatamente.
 */

import {
  getPerfilCualificaciones,
  createPerfilCualificacion,
  deletePerfilCualificacion,
  type PerfilCualificacion,
} from "../../api/puestos.ts";
import { CATALOGO_ESCOLARIDAD, escolaridadLabel } from "../../ui/catalogoEscolaridad.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { BTN_PRIMARY, BTN_DANGER, FIELD_FOCUS, SELECT_CHEVRON } from "../../ui/uiTokens.ts";

export type EditarCualificacionesModalHandle = {
  open: () => void;
  close: () => void;
};

export type EditarCualificacionesModalOptions = {
  perfilId: number;
  onSuccess: () => void;
};

const TIPO_OPTIONS: { value: string; label: string }[] = [
  { value: "estudios_finalizados", label: "Estudios finalizados" },
  { value: "formacion_profesional", label: "Formacion profesional" },
  { value: "ampliacion_formacion", label: "Ampliacion de formacion" },
  { value: "estudios_universitarios", label: "Estudios universitarios" },
  { value: "experiencia_profesional", label: "Experiencia profesional" },
  { value: "experiencia_direccion", label: "Experiencia en direccion" },
  { value: "complementos", label: "Complementos" },
];

const TIPO_LABELS: Record<string, string> = Object.fromEntries(
  TIPO_OPTIONS.map(o => [o.value, o.label]),
);

function overlayHtml(): string {
  return `
    <div
      id="editar-cualificaciones-overlay"
      class="fixed inset-0 z-50 hidden items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <div
        class="w-full max-w-lg rounded-xl border border-border bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-cualificaciones-title"
      >
        <div class="flex items-start justify-between gap-3 mb-4">
          <h2 id="editar-cualificaciones-title" class="text-lg font-semibold text-text-primary">Editar cualificaciones</h2>
          <button
            type="button"
            data-close-cualificaciones-modal
            class="rounded-lg p-1 text-text-muted hover:bg-surface hover:text-text-primary"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <div id="editar-cualificaciones-body">
          <p class="text-sm text-text-muted">Cargando...</p>
        </div>
      </div>
    </div>`;
}

function renderList(cualificaciones: PerfilCualificacion[]): string {
  if (cualificaciones.length === 0) {
    return `<p class="text-sm text-slate-500 italic py-2">Sin cualificaciones registradas.</p>`;
  }
  return `
    <div class="max-h-60 overflow-y-auto divide-y divide-slate-100 mb-4">
      ${cualificaciones.map(c => `
        <div class="flex items-start justify-between gap-2 py-2">
          <div class="min-w-0">
            <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-500">${escapeHtml(TIPO_LABELS[c.tipo] ?? c.tipo)}</span>
            <span class="text-sm text-text-primary">${escapeHtml(c.tipo === "estudios_finalizados" ? escolaridadLabel(c.situacion_deseada) : c.situacion_deseada)}</span>
            ${c.comentarios ? `<span class="block text-xs text-slate-500 mt-0.5">${escapeHtml(c.comentarios)}</span>` : ""}
          </div>
          <button type="button" data-delete-cualificacion="${c.id}" class="${BTN_DANGER} !px-2 !py-1 text-xs shrink-0" title="Eliminar">
            <svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      `).join("")}
    </div>`;
}

function renderForm(): string {
  const tipoOpts = TIPO_OPTIONS.map(o =>
    `<option value="${o.value}">${escapeHtml(o.label)}</option>`
  ).join("");

  return `
    <form id="form-agregar-cualificacion" class="border-t border-slate-200 pt-4 space-y-3">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Agregar cualificacion</p>
      <div>
        <label for="cual-tipo" class="mb-1 block text-xs font-medium text-slate-600">Tipo</label>
        <div class="grid grid-cols-1">
          <select id="cual-tipo" name="tipo" required
            class="col-start-1 row-start-1 block w-full appearance-none rounded-lg border border-border bg-white px-3 py-2 pr-8 text-sm text-text-primary ${FIELD_FOCUS}">
            ${tipoOpts}
          </select>
          ${SELECT_CHEVRON}
        </div>
      </div>
      <div>
        <label for="cual-situacion" class="mb-1 block text-xs font-medium text-slate-600">Situacion deseada</label>
        <div id="cual-situacion-wrap">
          <input id="cual-situacion" name="situacion_deseada" type="text" required
            class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}"
            placeholder="Descripcion de la situacion deseada" />
        </div>
      </div>
      <div>
        <label for="cual-comentarios" class="mb-1 block text-xs font-medium text-slate-600">Comentarios (opcional)</label>
        <textarea id="cual-comentarios" name="comentarios" rows="2"
          class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}"
          placeholder="Comentarios adicionales..."></textarea>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="submit" class="${BTN_PRIMARY} text-sm">Agregar</button>
      </div>
    </form>`;
}

export function mountEditarCualificacionesModal(
  host: HTMLElement,
  options: EditarCualificacionesModalOptions,
): EditarCualificacionesModalHandle {
  host.innerHTML = overlayHtml();

  const overlay = host.querySelector("#editar-cualificaciones-overlay") as HTMLElement;
  const body = host.querySelector("#editar-cualificaciones-body") as HTMLElement;

  let loading = false;

  function close(): void {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", escHandler);
  }

  async function refreshList(): Promise<void> {
    try {
      const items = await getPerfilCualificaciones(options.perfilId);
      body.innerHTML = renderList(items) + renderForm();
      bindForm();
      bindDeleteButtons();
    } catch {
      body.innerHTML = `<p class="text-sm text-red-600">Error al cargar cualificaciones.</p>`;
    }
  }

  function bindDeleteButtons(): void {
    body.querySelectorAll<HTMLButtonElement>("[data-delete-cualificacion]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.deleteCualificacion);
        if (loading) return;
        loading = true;
        btn.disabled = true;
        try {
          await deletePerfilCualificacion(options.perfilId, id);
          options.onSuccess();
          await refreshList();
        } catch {
          // silently fail
        } finally {
          loading = false;
        }
      });
    });
  }

  function bindForm(): void {
    const form = body.querySelector("#form-agregar-cualificacion") as HTMLFormElement | null;
    if (!form) return;

    const tipoSelect = form.querySelector("#cual-tipo") as HTMLSelectElement;
    const wrap = form.querySelector("#cual-situacion-wrap") as HTMLElement;

    function updateSituacionField(): void {
      if (tipoSelect.value === "estudios_finalizados") {
        const opts = CATALOGO_ESCOLARIDAD.map(n =>
          `<option value="${n.key}">${escapeHtml(n.label)}</option>`
        ).join("");
        wrap.innerHTML = `
          <div class="grid grid-cols-1">
            <select id="cual-situacion" name="situacion_deseada" required
              class="col-start-1 row-start-1 block w-full appearance-none rounded-lg border border-border bg-white px-3 py-2 pr-8 text-sm text-text-primary ${FIELD_FOCUS}">
              ${opts}
            </select>
            ${SELECT_CHEVRON}
          </div>`;
      } else {
        wrap.innerHTML = `
          <input id="cual-situacion" name="situacion_deseada" type="text" required
            class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}"
            placeholder="Descripcion de la situacion deseada" />`;
      }
    }

    tipoSelect.addEventListener("change", updateSituacionField);
    updateSituacionField();

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (loading) return;
      loading = true;

      const fd = new FormData(form);
      const tipo = String(fd.get("tipo") ?? "").trim();
      const situacion_deseada = String(fd.get("situacion_deseada") ?? "").trim();
      const comentarios = String(fd.get("comentarios") ?? "").trim() || undefined;

      if (!tipo || !situacion_deseada) { loading = false; return; }

      const submitBtn = form.querySelector<HTMLButtonElement>("button[type=submit]");
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Agregando..."; }

      try {
        await createPerfilCualificacion(options.perfilId, { tipo, situacion_deseada, comentarios });
        options.onSuccess();
        await refreshList();
      } catch {
        // keep form
      } finally {
        loading = false;
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Agregar"; }
      }
    });
  }

  // Close handlers
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  host.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("[data-close-cualificaciones-modal]")) close();
  });

  function escHandler(e: KeyboardEvent): void {
    if (e.key === "Escape" && !overlay.classList.contains("hidden")) {
      e.preventDefault();
      close();
    }
  }

  return {
    open: () => {
      overlay.classList.remove("hidden");
      overlay.classList.add("flex");
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", escHandler);
      body.innerHTML = `<p class="text-sm text-text-muted">Cargando...</p>`;
      refreshList();
    },
    close,
  };
}
