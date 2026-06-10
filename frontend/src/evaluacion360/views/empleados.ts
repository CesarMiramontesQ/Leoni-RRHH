import { escapeHtml } from "../../ui/uiUtils.ts";
import type { Eval360Filters } from "../types.ts";
import { renderEval360Filters } from "../filters.ts";
import { filterEmpleadosEval360, MOCK_EMPLEADOS_EVAL360 } from "../rhDashboardData.ts";
import { renderEmpleadosEval360Table } from "./empleadosTable.ts";

export interface EmpleadosViewOpts {
  filters: Eval360Filters;
  search: string;
}

export function renderEval360Empleados(opts: EmpleadosViewOpts): string {
  const filtered = filterEmpleadosEval360(MOCK_EMPLEADOS_EVAL360, opts.filters, opts.search);

  return `
    ${renderEval360Filters(opts.filters)}

    <section class="mt-6" aria-labelledby="e360-seccion-empleados">
      <h2 id="e360-seccion-empleados" class="text-sm font-semibold text-text-primary">Empleados</h2>
      <p class="mt-0.5 text-xs text-text-muted">${filtered.length} colaboradores evaluados · acceda al detalle en Resultados</p>
      <div class="mt-4 rounded-xl border border-border bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <label class="mb-1 block text-xs font-medium text-text-muted">Buscar empleado</label>
        <input
          type="search"
          name="e360-search"
          value="${escapeHtml(opts.search)}"
          placeholder="Nombre, número, puesto o área…"
          class="w-full max-w-xl rounded-lg border border-border px-3 py-2 text-sm"
          data-input="e360-search"
        />
        <div class="mt-4">${renderEmpleadosEval360Table(filtered)}</div>
      </div>
    </section>`;
}
