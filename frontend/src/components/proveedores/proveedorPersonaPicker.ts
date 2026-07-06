/**
 * Selector encadenado Proveedor → Persona externa.
 *
 * A diferencia de `empleadoMultiSelect` (atado al catálogo Bono), este componente
 * opera sobre el dominio propio de personal externo: un `<select>` de proveedor
 * que, al elegirse, carga las personas de ese proveedor en un segundo `<select>`.
 * Selección única (una persona). Útil para el registro de cursos en «Vencimientos».
 *
 * Uso:
 *   const ctrl = mountProveedorPersonaPicker(host, { onChange });
 *   ctrl.getSelected(); // { proveedor_id, persona_id } | null
 *   ctrl.destroy();
 */

import {
  getPersonasDeProveedor,
  getProveedores,
  type Persona,
  type Proveedor,
} from "../../api/proveedoresExternos.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { RH_LISTADO_LABEL, RH_LISTADO_SELECT, SELECT_CHEVRON } from "../../ui/uiTokens.ts";

export type ProveedorPersonaSeleccion = {
  proveedor_id: number;
  persona_id: number;
};

export type ProveedorPersonaPickerOptions = {
  onChange?: (sel: ProveedorPersonaSeleccion | null) => void;
};

export type ProveedorPersonaPickerController = {
  getSelected: () => ProveedorPersonaSeleccion | null;
  reset: () => void;
  destroy: () => void;
};

function selectField(id: string, label: string, innerOptions: string, disabled = false): string {
  return `
    <div>
      <label for="${id}" class="${RH_LISTADO_LABEL}">${escapeHtml(label)}</label>
      <div class="grid grid-cols-1">
        <select id="${id}" ${disabled ? "disabled" : ""} class="${RH_LISTADO_SELECT} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400">
          ${innerOptions}
        </select>
        ${SELECT_CHEVRON}
      </div>
    </div>`;
}

export function mountProveedorPersonaPicker(
  host: HTMLElement,
  opts: ProveedorPersonaPickerOptions = {},
): ProveedorPersonaPickerController {
  const abort = new AbortController();
  const { signal } = abort;

  let proveedores: Proveedor[] = [];
  let personas: Persona[] = [];
  let proveedorId: number | null = null;
  let personaId: number | null = null;

  function currentSelection(): ProveedorPersonaSeleccion | null {
    if (proveedorId == null || personaId == null) return null;
    return { proveedor_id: proveedorId, persona_id: personaId };
  }

  function notify(): void {
    opts.onChange?.(currentSelection());
  }

  function render(): void {
    const provOptions = [
      `<option value="">Selecciona un contratista…</option>`,
      ...proveedores.map(
        (p) =>
          `<option value="${p.id}" ${p.id === proveedorId ? "selected" : ""}>${escapeHtml(p.nombre)}</option>`,
      ),
    ].join("");

    const personaDisabled = proveedorId == null;
    let personaOptions: string;
    if (personaDisabled) {
      personaOptions = `<option value="">Primero elige un contratista</option>`;
    } else if (personas.length === 0) {
      personaOptions = `<option value="">Este contratista no tiene personas registradas</option>`;
    } else {
      personaOptions = [
        `<option value="">Selecciona una persona…</option>`,
        ...personas.map(
          (p) =>
            `<option value="${p.id}" ${p.id === personaId ? "selected" : ""}>${escapeHtml(
              p.nombre,
            )}${p.identificacion ? ` — ${escapeHtml(p.identificacion)}` : ""}</option>`,
        ),
      ].join("");
    }

    host.innerHTML = `
      <div class="grid gap-3 sm:grid-cols-2">
        ${selectField("ppp-proveedor", "Contratista", provOptions)}
        ${selectField("ppp-persona", "Persona", personaOptions, personaDisabled)}
      </div>`;
  }

  async function loadPersonas(): Promise<void> {
    if (proveedorId == null) {
      personas = [];
      render();
      return;
    }
    try {
      personas = await getPersonasDeProveedor(proveedorId);
    } catch {
      personas = [];
    }
    render();
  }

  host.addEventListener(
    "change",
    (e) => {
      const target = e.target as HTMLSelectElement;
      if (target.id === "ppp-proveedor") {
        const val = Number(target.value);
        proveedorId = Number.isNaN(val) || target.value === "" ? null : val;
        personaId = null;
        notify();
        void loadPersonas();
        return;
      }
      if (target.id === "ppp-persona") {
        const val = Number(target.value);
        personaId = Number.isNaN(val) || target.value === "" ? null : val;
        notify();
      }
    },
    { signal },
  );

  // Carga inicial de proveedores.
  render();
  void (async () => {
    try {
      const res = await getProveedores({ page: 1, page_size: 200 });
      proveedores = res.items;
    } catch {
      proveedores = [];
    }
    render();
  })();

  return {
    getSelected: currentSelection,
    reset: () => {
      proveedorId = null;
      personaId = null;
      personas = [];
      render();
      notify();
    },
    destroy: () => abort.abort(),
  };
}
