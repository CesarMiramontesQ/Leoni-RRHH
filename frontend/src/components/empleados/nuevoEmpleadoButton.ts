/** Botón de acción RH — alta de empleado (abre modal en la pantalla de empleados). */
export function renderNuevoEmpleadoButton(): string {
  return `
    <button
      type="button"
      id="btn-nuevo-empleado"
      class="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-leoni-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-leoni-blue-light focus:outline-none focus:ring-2 focus:ring-leoni-blue focus:ring-offset-2"
    >
      <span>Nuevo Empleado</span>
      <span class="text-base font-normal leading-none" aria-hidden="true">+</span>
    </button>`;
}
