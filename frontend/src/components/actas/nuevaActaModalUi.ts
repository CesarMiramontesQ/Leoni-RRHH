import type {
  NuevaActaEmpleadoOption,
  NuevaActaFormData,
  NuevaActaFormErrors,
  NuevaActaSelectOption,
} from "../../actas/nuevaActaModalConfig.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { normalizeTextoBusquedaEmpleado } from "../../utils/empleadoTextoBusqueda.ts";

type BuildNuevaActaFormHtmlParams = {
  formData: NuevaActaFormData;
  errors: NuevaActaFormErrors;
  empleados: readonly NuevaActaEmpleadoOption[];
  empleadoSearchQ: string;
  responsablesRh: readonly NuevaActaSelectOption[];
  isSubmitting: boolean;
  dragActive: boolean;
};

const FUNDAMENTO_LEGAL_OPTIONS: readonly NuevaActaSelectOption[] = [
  { id: "Ley Federal del Trabajo", label: "Ley Federal del Trabajo" },
  { id: "Reglamento Interior de Trabajo", label: "Reglamento Interior de Trabajo" },
];

function renderSelectOptions(
  options: readonly NuevaActaSelectOption[],
  selected: string,
  emptyLabel: string,
  includeEmptyOption = true,
): string {
  const first = includeEmptyOption
    ? `<option value="" ${selected === "" ? "selected" : ""}>${escapeHtml(emptyLabel)}</option>`
    : "";
  const rest = options
    .map((option) => {
      const selectedAttr = option.id === selected ? "selected" : "";
      return `<option value="${escapeHtml(option.id)}" ${selectedAttr}>${escapeHtml(option.label)}</option>`;
    })
    .join("");
  return `${first}${rest}`;
}

function filtrarEmpleados(
  empleados: readonly NuevaActaEmpleadoOption[],
  searchQ: string,
): NuevaActaEmpleadoOption[] {
  const query = normalizeTextoBusquedaEmpleado(searchQ);
  if (!query) return [...empleados];
  return empleados.filter((empleado) => {
    const haystack = normalizeTextoBusquedaEmpleado(
      `${empleado.nombre} ${empleado.numeroEmpleado} ${empleado.id}`,
    );
    return haystack.includes(query);
  });
}

function renderEmpleadoOptions(
  empleados: readonly NuevaActaEmpleadoOption[],
  filteredEmpleados: readonly NuevaActaEmpleadoOption[],
  selectedEmpleadoId: string,
): string {
  const first = `<option value="" ${selectedEmpleadoId === "" ? "selected" : ""}>Selecciona un empleado...</option>`;
  const selectedEmpleado =
    selectedEmpleadoId.trim() === ""
      ? null
      : empleados.find((empleado) => empleado.id === selectedEmpleadoId) ?? null;
  const shouldInjectSelected =
    selectedEmpleado != null && !filteredEmpleados.some((empleado) => empleado.id === selectedEmpleadoId);
  const options = shouldInjectSelected ? [selectedEmpleado, ...filteredEmpleados] : [...filteredEmpleados];
  const rest = options
    .map((empleado) => {
      const selectedAttr = empleado.id === selectedEmpleadoId ? "selected" : "";
      return `<option value="${escapeHtml(empleado.id)}" ${selectedAttr}>${escapeHtml(empleado.nombre)}</option>`;
    })
    .join("");
  const emptyResults =
    options.length === 0
      ? `<option value="" disabled selected>Sin resultados para la búsqueda actual</option>`
      : "";
  return `${first}${emptyResults}${rest}`;
}

function renderFieldError(error: string | undefined): string {
  if (!error) return "";
  return `<p class="mt-1 text-xs font-medium text-red-700" role="alert">${escapeHtml(error)}</p>`;
}

function sectionTitleHtml(id: string, title: string, iconSvg: string): string {
  return `<div class="flex items-center gap-2" id="${id}">
    <span class="inline-flex size-8 items-center justify-center rounded-lg bg-leoni-blue/10 text-leoni-blue" aria-hidden="true">${iconSvg}</span>
    <h3 class="text-sm font-semibold uppercase tracking-[0.08em] text-slate-700">${escapeHtml(title)}</h3>
  </div>`;
}

function uploadZoneText(files: readonly File[]): string {
  if (files.length === 0) return "Arrastra archivos aqui o selecciona desde tu equipo";
  if (files.length === 1) return files[0]?.name ?? "1 archivo seleccionado";
  return `${files.length} archivos seleccionados`;
}

export function nuevaActaModalShellHtml(): string {
  return `
    <div
      id="rh-actas-nueva-modal-overlay"
      class="fixed inset-0 z-70 hidden items-center justify-center bg-slate-900/45 p-4 sm:p-6 backdrop-blur-[2px]"
      role="presentation"
    >
      <div
        id="rh-actas-nueva-modal-panel"
        class="scheme-light flex max-h-[min(94vh,1000px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_26px_70px_-22px_rgba(15,23,42,0.35)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rh-actas-nueva-modal-title"
      >
        <header class="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
          <div class="min-w-0">
            <h2 id="rh-actas-nueva-modal-title" class="text-xl font-bold tracking-tight text-slate-900">Nueva acta disciplinaria</h2>
            <p class="mt-1.5 max-w-3xl text-sm text-slate-500">
              Captura la informacion de la incidencia o falta disciplinaria para generar el registro interno.
            </p>
          </div>
          <button
            type="button"
            data-rh-actas-modal-close
            class="-m-1 flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
            aria-label="Cerrar modal"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-5" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </header>
        <div id="rh-actas-nueva-modal-body" class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6"></div>
      </div>
    </div>`;
}

export function buildNuevaActaFormHtml(params: BuildNuevaActaFormHtmlParams): string {
  const { formData, errors, empleados, empleadoSearchQ, responsablesRh, isSubmitting, dragActive } = params;
  const filteredEmpleados = filtrarEmpleados(empleados, empleadoSearchQ);

  const gridInputClass =
    "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/20";
  const textareaClass =
    "min-h-[9rem] w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/20";
  const errorClass = "border-red-300 focus:border-red-500 focus:ring-red-500/20";

  const empleadoControlClass = `${gridInputClass} ${errors.empleadoId ? errorClass : ""}`;
  const numeroControlClass = `${gridInputClass} bg-slate-50 ${errors.numeroEmpleado ? errorClass : ""}`;
  const areaControlClass = `${gridInputClass} ${errors.areaDepartamento ? errorClass : ""}`;
  const supervisorControlClass = `${gridInputClass} ${errors.supervisorDirecto ? errorClass : ""}`;
  const tipoFaltaControlClass = `min-h-[7rem] w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/20 ${
    errors.tipoFalta ? errorClass : ""
  }`;
  const fundamentoLegalControlClass = `${gridInputClass} ${errors.fundamentoLegal ? errorClass : ""}`;
  const articuloIncisoControlClass = `${gridInputClass} ${errors.articuloInciso ? errorClass : ""}`;
  const fechaControlClass = `${gridInputClass} ${errors.fechaEvento ? errorClass : ""}`;
  const lugarControlClass = `${gridInputClass} ${errors.lugarIncidente ? errorClass : ""}`;
  const descripcionControlClass = `${textareaClass} ${errors.descripcionHechos ? errorClass : ""}`;
  const responsablesControlClass = `${gridInputClass} ${errors.responsableRhId ? errorClass : ""}`;

  const uploadZoneClass = `rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors ${
    dragActive
      ? "border-leoni-blue bg-leoni-blue/5"
      : errors.evidencias
        ? "border-red-300 bg-red-50/30"
        : "border-slate-300 bg-slate-50/40"
  }`;
  const submitText = isSubmitting ? "Guardando..." : "Guardar acta";

  const evidenciaListHtml =
    formData.evidencias.length === 0
      ? `<p class="mt-2 text-xs text-slate-500">Puedes adjuntar PDF, imagen o documentos de soporte.</p>`
      : `<ul class="mt-3 space-y-1 text-left text-xs text-slate-600">${formData.evidencias
          .map(
            (file) =>
              `<li class="rounded-md bg-white px-2.5 py-1.5 ring-1 ring-slate-200/80">${escapeHtml(file.name)}</li>`,
          )
          .join("")}</ul>`;

  return `
    <form id="rh-actas-nueva-form" class="space-y-7" novalidate>
      ${sectionTitleHtml(
        "rh-actas-sec-empleado",
        "Informacion del Empleado",
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6.75a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.118a7.5 7.5 0 0 1 15 0A17.933 17.933 0 0 1 12 21.75a17.933 17.933 0 0 1-7.5-1.632Z" /></svg>`,
      )}
      <section class="rounded-2xl border border-slate-200/90 bg-slate-50/45 p-4 sm:p-5" aria-labelledby="rh-actas-sec-empleado">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label for="rh-actas-form-empleado" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Empleado</label>
            <div class="mb-2">
              <input
                id="rh-actas-form-empleado-busqueda"
                type="search"
                value="${escapeHtml(empleadoSearchQ)}"
                placeholder="Buscar por nombre o no. de empleado..."
                autocomplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="rh-actas-form-empleado"
                data-rh-actas-form-empleado-search
                class="${gridInputClass}"
              />
              <p class="mt-1 text-xs text-slate-500">
                ${escapeHtml(`Mostrando ${filteredEmpleados.length} de ${empleados.length} colaboradores`)}
              </p>
            </div>
            <select
              id="rh-actas-form-empleado"
              name="empleado_id"
              class="${empleadoControlClass}"
              data-rh-actas-form-empleado
              aria-invalid="${errors.empleadoId ? "true" : "false"}"
            >
              ${renderEmpleadoOptions(empleados, filteredEmpleados, formData.empleadoId)}
            </select>
            ${renderFieldError(errors.empleadoId)}
          </div>
          <div>
            <label for="rh-actas-form-numero" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Numero de empleado</label>
            <input
              id="rh-actas-form-numero"
              name="numero_empleado"
              type="text"
              class="${numeroControlClass}"
              value="${escapeHtml(formData.numeroEmpleado)}"
              readonly
              aria-invalid="${errors.numeroEmpleado ? "true" : "false"}"
            />
            ${renderFieldError(errors.numeroEmpleado)}
          </div>
          <div>
            <label for="rh-actas-form-area" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Area / Departamento</label>
            <input
              id="rh-actas-form-area"
              name="area_departamento"
              type="text"
              class="${areaControlClass}"
              value="${escapeHtml(formData.areaDepartamento)}"
              data-rh-actas-form-field="areaDepartamento"
              aria-invalid="${errors.areaDepartamento ? "true" : "false"}"
            />
            ${renderFieldError(errors.areaDepartamento)}
          </div>
          <div>
            <label for="rh-actas-form-supervisor" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Supervisor directo</label>
            <input
              id="rh-actas-form-supervisor"
              name="supervisor_directo"
              type="text"
              class="${supervisorControlClass}"
              value="${escapeHtml(formData.supervisorDirecto)}"
              data-rh-actas-form-field="supervisorDirecto"
              aria-invalid="${errors.supervisorDirecto ? "true" : "false"}"
            />
            ${renderFieldError(errors.supervisorDirecto)}
          </div>
        </div>
      </section>

      ${sectionTitleHtml(
        "rh-actas-sec-incidente",
        "Detalles del Incidente",
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.007v.008H12v-.008ZM10.29 3.86l-7.5 13A1.5 1.5 0 0 0 4.09 19.5h15.82a1.5 1.5 0 0 0 1.3-2.64l-7.5-13a1.5 1.5 0 0 0-2.6 0Z" /></svg>`,
      )}
      <section class="rounded-2xl border border-slate-200/90 bg-slate-50/45 p-4 sm:p-5" aria-labelledby="rh-actas-sec-incidente">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="md:col-span-2">
            <label for="rh-actas-form-tipo-falta" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de falta disciplinaria</label>
            <textarea
              id="rh-actas-form-tipo-falta"
              name="tipo_falta"
              data-rh-actas-form-field="tipoFalta"
              class="${tipoFaltaControlClass}"
              aria-invalid="${errors.tipoFalta ? "true" : "false"}"
              placeholder="Describe de forma detallada el tipo de falta disciplinaria..."
            >${escapeHtml(formData.tipoFalta)}</textarea>
            ${renderFieldError(errors.tipoFalta)}
          </div>
          <div>
            <label for="rh-actas-form-fundamento-legal" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Fundamento legal</label>
            <select
              id="rh-actas-form-fundamento-legal"
              name="fundamento_legal"
              data-rh-actas-form-field="fundamentoLegal"
              class="${fundamentoLegalControlClass}"
              aria-invalid="${errors.fundamentoLegal ? "true" : "false"}"
            >
              ${renderSelectOptions(FUNDAMENTO_LEGAL_OPTIONS, formData.fundamentoLegal, "Selecciona fundamento legal...")}
            </select>
            ${renderFieldError(errors.fundamentoLegal)}
          </div>
          <div>
            <label for="rh-actas-form-articulo-inciso" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Articulo / inciso</label>
            <input
              id="rh-actas-form-articulo-inciso"
              name="articulo_inciso"
              type="text"
              data-rh-actas-form-field="articuloInciso"
              value="${escapeHtml(formData.articuloInciso)}"
              placeholder="Ej. Articulo 47, fraccion II"
              class="${articuloIncisoControlClass}"
              aria-invalid="${errors.articuloInciso ? "true" : "false"}"
            />
            ${renderFieldError(errors.articuloInciso)}
          </div>
          <div class="col-span-1 md:col-span-2">
            <div class="grid grid-cols-2 gap-3 sm:gap-4">
              <div class="min-w-0">
                <label for="rh-actas-form-fecha-evento" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha del evento</label>
                <input
                  id="rh-actas-form-fecha-evento"
                  name="fecha_evento"
                  type="date"
                  data-rh-actas-form-field="fechaEvento"
                  value="${escapeHtml(formData.fechaEvento)}"
                  class="${fechaControlClass}"
                  aria-invalid="${errors.fechaEvento ? "true" : "false"}"
                />
                ${renderFieldError(errors.fechaEvento)}
              </div>
              <div class="min-w-0">
                <label for="rh-actas-form-lugar" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Lugar del incidente</label>
                <input
                  id="rh-actas-form-lugar"
                  name="lugar_incidente"
                  type="text"
                  data-rh-actas-form-field="lugarIncidente"
                  value="${escapeHtml(formData.lugarIncidente)}"
                  placeholder="Ej. Planta Leon"
                  class="${lugarControlClass}"
                  aria-invalid="${errors.lugarIncidente ? "true" : "false"}"
                />
                ${renderFieldError(errors.lugarIncidente)}
              </div>
            </div>
          </div>
          <div class="md:col-span-2">
            <label for="rh-actas-form-descripcion" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Descripcion de los hechos</label>
            <textarea
              id="rh-actas-form-descripcion"
              name="descripcion_hechos"
              data-rh-actas-form-field="descripcionHechos"
              class="${descripcionControlClass}"
              aria-invalid="${errors.descripcionHechos ? "true" : "false"}"
              placeholder="Describe cronologicamente lo ocurrido..."
            >${escapeHtml(formData.descripcionHechos)}</textarea>
            ${renderFieldError(errors.descripcionHechos)}
          </div>
          <div>
            <label for="rh-actas-form-involucrados" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Personas involucradas</label>
            <input
              id="rh-actas-form-involucrados"
              name="personas_involucradas"
              type="text"
              data-rh-actas-form-field="personasInvolucradas"
              value="${escapeHtml(formData.personasInvolucradas)}"
              class="${gridInputClass}"
            />
          </div>
          <div>
            <label for="rh-actas-form-testigos" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Testigos</label>
            <input
              id="rh-actas-form-testigos"
              name="testigos"
              type="text"
              data-rh-actas-form-field="testigos"
              value="${escapeHtml(formData.testigos)}"
              class="${gridInputClass}"
            />
          </div>
        </div>
      </section>

      ${sectionTitleHtml(
        "rh-actas-sec-evidencia",
        "Evidencias y Responsable",
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>`,
      )}
      <section class="rounded-2xl border border-slate-200/90 bg-slate-50/45 p-4 sm:p-5" aria-labelledby="rh-actas-sec-evidencia">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="md:col-span-2">
            <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Evidencias</label>
            <div
              class="${uploadZoneClass}"
              data-rh-actas-dropzone
              aria-describedby="rh-actas-dropzone-help"
            >
              <input id="rh-actas-form-evidencias" type="file" multiple class="hidden" data-rh-actas-file-input />
              <p class="text-sm font-medium text-slate-700">${escapeHtml(uploadZoneText(formData.evidencias))}</p>
              <button
                type="button"
                data-rh-actas-select-files
                class="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:border-leoni-blue/40 hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
              >
                Seleccionar archivos
              </button>
              ${evidenciaListHtml}
            </div>
            <p id="rh-actas-dropzone-help" class="mt-2 text-xs text-slate-500">Arrastra y suelta documentos o usa el selector para adjuntarlos al acta.</p>
            ${renderFieldError(errors.evidencias)}
          </div>
          <div>
            <label for="rh-actas-form-responsable-rh" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Responsable de RH</label>
            <select
              id="rh-actas-form-responsable-rh"
              name="responsable_rh_id"
              data-rh-actas-form-field="responsableRhId"
              class="${responsablesControlClass}"
              aria-invalid="${errors.responsableRhId ? "true" : "false"}"
            >
              ${renderSelectOptions(responsablesRh, formData.responsableRhId, "Selecciona responsable...", false)}
            </select>
            ${renderFieldError(errors.responsableRhId)}
          </div>
        </div>
      </section>

      <footer class="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          data-rh-actas-modal-cancel
          class="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 sm:w-auto"
        >
          Cancelar
        </button>
        <button
          type="submit"
          id="rh-actas-form-submit"
          ${isSubmitting ? "disabled" : ""}
          class="min-h-11 w-full rounded-xl bg-leoni-blue px-6 text-sm font-semibold text-white shadow-md shadow-leoni-blue/20 transition hover:bg-leoni-blue-light focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        >
          ${submitText}
        </button>
      </footer>
    </form>`;
}
