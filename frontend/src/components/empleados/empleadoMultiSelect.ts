/**
 * Selector múltiple de empleados reutilizable (buscador + chips).
 *
 * Reutiliza el catálogo de empleados existente (`getEmpleadosPage`, mismo
 * endpoint `GET /api/v1/empleados`) — no reimplementa búsqueda ni permite
 * registrar personas manualmente. Extraído del patrón inline de eval360
 * (`campanaWizard.ts`) para compartirlo entre features (Juntas, etc.).
 *
 * Uso:
 *   const host = container.querySelector("#mi-host") as HTMLElement;
 *   const ctrl = mountEmpleadoMultiSelect(host, { onChange: () => {...} });
 *   ctrl.getSelected(); // EmpleadoSeleccionado[]
 *   ctrl.destroy();      // al desmontar
 */

import { getEmpleadosPage } from "../../api/empleados.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { BTN_SECONDARY, FIELD_INPUT } from "../../ui/uiTokens.ts";

export type EmpleadoSeleccionado = {
  empleado_id: number;
  nombre: string;
  no_empleado: string;
  extra: string;
};

export type EmpleadoMultiSelectOptions = {
  /** Se invoca cada vez que cambia la lista de seleccionados. */
  onChange?: (seleccionados: EmpleadoSeleccionado[]) => void;
  /** Texto del label del buscador. */
  label?: string;
  /** Placeholder del input de búsqueda. */
  placeholder?: string;
};

export type EmpleadoMultiSelectController = {
  getSelected: () => EmpleadoSeleccionado[];
  setSelected: (items: EmpleadoSeleccionado[]) => void;
  clear: () => void;
  destroy: () => void;
};

type State = {
  query: string;
  buscando: boolean;
  buscado: boolean;
  resultados: EmpleadoSeleccionado[];
  seleccionados: EmpleadoSeleccionado[];
};

export function mountEmpleadoMultiSelect(
  host: HTMLElement,
  opts: EmpleadoMultiSelectOptions = {},
): EmpleadoMultiSelectController {
  const label = opts.label ?? "Buscar empleados";
  const placeholder = opts.placeholder ?? "Nombre o número de empleado";
  const abort = new AbortController();
  const { signal } = abort;
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  const st: State = {
    query: "",
    buscando: false,
    buscado: false,
    resultados: [],
    seleccionados: [],
  };

  function notify(): void {
    opts.onChange?.(st.seleccionados);
  }

  async function buscar(): Promise<void> {
    const q = st.query.trim();
    st.buscando = true;
    st.buscado = true;
    render();
    try {
      const page = await getEmpleadosPage({ page: 1, page_size: 20, q });
      st.resultados = page.items.map((e) => ({
        empleado_id: e.empleado_id,
        nombre: e.nombre,
        no_empleado: e.no_empleado,
        extra: [e.puesto?.descripcion, e.area?.descripcion].filter(Boolean).join(" · "),
      }));
    } catch {
      st.resultados = [];
    }
    st.buscando = false;
    render();
  }

  function scheduleBuscar(): void {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => void buscar(), 300);
  }

  function agregar(emp: EmpleadoSeleccionado): void {
    if (st.seleccionados.some((s) => s.empleado_id === emp.empleado_id)) return;
    st.seleccionados = [...st.seleccionados, emp];
    render();
    notify();
  }

  function quitar(empleadoId: number): void {
    st.seleccionados = st.seleccionados.filter((s) => s.empleado_id !== empleadoId);
    render();
    notify();
  }

  function renderResultados(): string {
    if (st.buscando) {
      return '<p class="px-3 py-3 text-sm text-text-muted">Buscando…</p>';
    }
    if (!st.buscado) {
      return '<p class="px-3 py-3 text-sm text-text-muted">Busca por nombre o número de empleado.</p>';
    }
    const disponibles = st.resultados.filter(
      (r) => !st.seleccionados.some((s) => s.empleado_id === r.empleado_id),
    );
    if (disponibles.length === 0) {
      return '<p class="px-3 py-3 text-sm text-text-muted">Sin resultados disponibles.</p>';
    }
    return disponibles
      .map(
        (r) => `
      <button type="button" class="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
        data-ems="add" data-id="${r.empleado_id}">
        <span class="min-w-0">
          <span class="block truncate text-sm text-text-primary">${escapeHtml(r.nombre)}</span>
          ${r.extra ? `<span class="block truncate text-xs text-text-muted">${escapeHtml(r.extra)}</span>` : ""}
        </span>
        <span class="shrink-0 text-xs font-medium tabular-nums text-text-muted">${escapeHtml(r.no_empleado)}</span>
      </button>`,
      )
      .join("");
  }

  function renderChips(): string {
    if (st.seleccionados.length === 0) {
      return '<span class="text-sm text-text-muted">Aún no hay asistentes.</span>';
    }
    return st.seleccionados
      .map(
        (s) => `
      <span class="inline-flex items-center gap-1.5 rounded-full border border-border bg-slate-50 px-2.5 py-1 text-xs text-text-primary">
        ${escapeHtml(s.nombre)}
        <button type="button" class="text-slate-400 hover:text-red-600" data-ems="del" data-id="${s.empleado_id}" aria-label="Quitar ${escapeHtml(s.nombre)}">✕</button>
      </span>`,
      )
      .join("");
  }

  function render(): void {
    host.innerHTML = `
      <div class="flex items-end gap-2">
        <div class="flex-1">
          <label class="mb-1 block text-xs font-medium text-text-muted">${escapeHtml(label)}</label>
          <input type="text" data-ems-input value="${escapeHtml(st.query)}" class="${FIELD_INPUT}" placeholder="${escapeHtml(placeholder)}" />
        </div>
        <button type="button" class="${BTN_SECONDARY}" data-ems="buscar">Buscar</button>
      </div>
      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <div class="max-h-56 overflow-y-auto rounded-lg border border-border">${renderResultados()}</div>
        <div>
          <p class="mb-2 text-xs font-medium text-text-muted">Asistentes (${st.seleccionados.length})</p>
          <div class="flex flex-wrap gap-2">${renderChips()}</div>
        </div>
      </div>`;
  }

  host.addEventListener(
    "click",
    (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest<HTMLElement>("[data-ems]");
      if (!btn) return;
      const action = btn.dataset.ems;
      if (action === "buscar") {
        void buscar();
        return;
      }
      if (action === "add") {
        const id = Number(btn.dataset.id);
        const emp = st.resultados.find((r) => r.empleado_id === id);
        if (emp) agregar(emp);
        return;
      }
      if (action === "del") {
        quitar(Number(btn.dataset.id));
      }
    },
    { signal },
  );

  host.addEventListener(
    "input",
    (e) => {
      const target = e.target as HTMLElement;
      if (target.hasAttribute("data-ems-input")) {
        st.query = (target as HTMLInputElement).value;
        scheduleBuscar();
      }
    },
    { signal },
  );

  host.addEventListener(
    "keydown",
    (e) => {
      const target = e.target as HTMLElement;
      if (target.hasAttribute("data-ems-input") && (e as KeyboardEvent).key === "Enter") {
        e.preventDefault();
        if (searchTimer) clearTimeout(searchTimer);
        void buscar();
      }
    },
    { signal },
  );

  render();

  return {
    getSelected: () => [...st.seleccionados],
    setSelected: (items: EmpleadoSeleccionado[]) => {
      st.seleccionados = [...items];
      render();
      notify();
    },
    clear: () => {
      st.seleccionados = [];
      st.query = "";
      st.resultados = [];
      st.buscado = false;
      render();
      notify();
    },
    destroy: () => {
      if (searchTimer) clearTimeout(searchTimer);
      abort.abort();
    },
  };
}
