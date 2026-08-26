import { isHorasExtraRegistroAutorizado } from "../auth/jwt.ts";
import { clearAuth } from "../auth/session.ts";
import {
  createHorasExtraSolicitud,
  getHorasExtraSolicitudDetalle,
  getHorasExtraSolicitudEstadisticas,
  getHorasExtraSolicitudOpciones,
  getHorasExtraSolicitudes,
  type HorasExtraDetalleCreate,
  type HorasExtraSolicitudFetchError,
  type HorasExtraSolicitudOpciones,
} from "../api/horasExtraSolicitud.ts";
import { getHorasExtraEstado } from "../api/horasExtraAprobacion.ts";
import {
  buscarEmpleadosEquipo,
  renderEquipoListbox,
  formatHorasCaptura,
  getSemanasPermitidas,
  renderHorasExtraSolicitudPage,
  tipoLabel,
  type HorasExtraEmpleadoFilaForm,
  type HorasExtraSolicitudPageState,
} from "../horasExtra/supervisor/renderHorasExtraSolicitudPage.ts";
import type { HorasExtraTipoSolicitud } from "../api/horasExtraSolicitud.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { htmlAccessDenied } from "../ui/uiTokens.ts";

const DIAS = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
] as const;

function forbiddenHtml(): string {
  return htmlAccessDenied({
    title: "Acceso restringido",
    description:
      "Esta página solo está disponible para empleados autorizados por RH para registrar horas extra (Ajustes de Nóminas).",
  });
}

function initialState(): HorasExtraSolicitudPageState {
  return {
    opciones: null,
    opcionesStatus: "loading",
    estadisticas: null,
    estadisticasStatus: "loading",
    lista: [],
    listaStatus: "loading",
    listaTotal: 0,
    listaPage: 1,
    listaPageSize: 10,
    submitting: false,
    detalleAbierto: null,
    detalleStatus: "idle",
    detalleAprobaciones: undefined,
    empleadosFilas: [],
    selectedEmpleadoId: null,
    formSemana: 1,
    formTipo: "planeado",
    formMotivo: "",
    solicitudModalOpen: false,
  };
}

function resetFormState(
  semanaActual = 1,
): Pick<
  HorasExtraSolicitudPageState,
  | "formError"
  | "submitting"
  | "empleadosFilas"
  | "selectedEmpleadoId"
  | "formSemana"
  | "formTipo"
  | "formMotivo"
  | "solicitudModalOpen"
> {
  return {
    formError: undefined,
    submitting: false,
    empleadosFilas: [],
    selectedEmpleadoId: null,
    formSemana: semanaActual,
    formTipo: "planeado",
    formMotivo: "",
    solicitudModalOpen: false,
  };
}

function syncFormDraftFromDom(
  root: HTMLElement,
  current: HorasExtraSolicitudPageState,
): Pick<HorasExtraSolicitudPageState, "formSemana" | "formTipo" | "formMotivo"> {
  const semanaRaw = root.querySelector<HTMLSelectElement>("#he-sup-semana")?.value ?? "";
  const semana = Number.parseInt(semanaRaw, 10);
  const tipo = root.querySelector<HTMLSelectElement>("#he-sup-tipo")?.value;
  return {
    formSemana: Number.isNaN(semana) ? current.formSemana : semana,
    formTipo: tipo === "espontaneo" ? "espontaneo" : "planeado",
    formMotivo: root.querySelector<HTMLTextAreaElement>("#he-sup-motivo")?.value ?? "",
  };
}

function isAuthError(err: HorasExtraSolicitudFetchError): boolean {
  return err.status === 401;
}

function filaFromEmpleado(
  opciones: HorasExtraSolicitudOpciones,
  empleadoId: number | null,
  prev: HorasExtraEmpleadoFilaForm[],
): HorasExtraEmpleadoFilaForm[] {
  if (!empleadoId) return [];
  const emp = opciones.empleados.find((e) => e.id === empleadoId);
  if (!emp) return [];
  const existing = prev.find((f) => f.empleado_id === emp.id);
  return [
    existing ?? {
      empleado_id: emp.id,
      no_empleado: emp.no_empleado,
      nombre: emp.nombre,
      lunes: "0",
      martes: "0",
      miercoles: "0",
      jueves: "0",
      viernes: "0",
      sabado: "0",
      domingo: "0",
    },
  ];
}

function validateEmpleadoOrganizacion(
  opciones: HorasExtraSolicitudOpciones,
  fila: HorasExtraEmpleadoFilaForm,
): string | null {
  const emp = opciones.empleados.find((e) => e.id === fila.empleado_id);
  if (!emp) return null;
  if (!emp.area_id || !emp.subarea_id || !emp.centrocosto_id) {
    return `El empleado ${emp.no_empleado} no tiene área, subárea o centro de costo asignado.`;
  }
  return null;
}

function validateForm(
  form: HTMLFormElement,
  filas: HorasExtraEmpleadoFilaForm[],
  opciones: HorasExtraSolicitudOpciones | null,
): string | null {
  const semana = Number.parseInt(form.semana.value, 10);
  const semanasPermitidas = opciones ? getSemanasPermitidas(opciones.semana_actual) : [];
  if (
    !form.semana.value ||
    Number.isNaN(semana) ||
    !semanasPermitidas.includes(semana)
  ) {
    return "Selecciona una semana válida.";
  }
  const motivo = (form.elements.namedItem("motivo") as HTMLTextAreaElement | null)?.value.trim();
  if (!motivo) return "El motivo es obligatorio.";
  if (!filas.length) return "Selecciona un colaborador.";
  if (opciones) {
    const orgErr = validateEmpleadoOrganizacion(opciones, filas[0]!);
    if (orgErr) return orgErr;
  }

  let totalGeneral = 0;
  for (const fila of filas) {
    let totalEmpleado = 0;
    for (const dia of DIAS) {
      const raw = fila[dia].trim();
      const val = raw === "" ? 0 : Number.parseFloat(raw);
      if (Number.isNaN(val) || val < 0) {
        return "Las horas deben ser numéricas y mayores o iguales a 0.";
      }
      totalEmpleado += val;
    }
    totalGeneral += totalEmpleado;
  }
  if (totalGeneral <= 0) {
    return "Registra al menos un día con horas mayores a 0.";
  }
  return null;
}

function buildPayload(
  form: HTMLFormElement,
  filas: HorasExtraEmpleadoFilaForm[],
): Parameters<typeof createHorasExtraSolicitud>[0] | null {
  const semana = Number.parseInt(form.semana.value, 10);
  if (Number.isNaN(semana) || semana < 1 || semana > 53) return null;
  const motivo = (form.elements.namedItem("motivo") as HTMLTextAreaElement | null)?.value.trim();
  if (!motivo) return null;
  const empleados: HorasExtraDetalleCreate[] = filas.map((fila) => ({
    empleado_id: fila.empleado_id,
    lunes: Number.parseFloat(fila.lunes) || 0,
    martes: Number.parseFloat(fila.martes) || 0,
    miercoles: Number.parseFloat(fila.miercoles) || 0,
    jueves: Number.parseFloat(fila.jueves) || 0,
    viernes: Number.parseFloat(fila.viernes) || 0,
    sabado: Number.parseFloat(fila.sabado) || 0,
    domingo: Number.parseFloat(fila.domingo) || 0,
  }));
  return {
    semana,
    tipo: form.tipo.value as "planeado" | "espontaneo",
    motivo,
    empleados,
  };
}

type EstadoSolicitudUi = "lista" | "falta-motivo" | "falta-colaborador" | "falta-horas" | "invalido";

function parseHourValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return 0;
  const val = Number.parseFloat(trimmed);
  if (Number.isNaN(val) || val < 0) return null;
  return val;
}

function syncFilasFromDom(
  root: HTMLElement,
  filas: HorasExtraEmpleadoFilaForm[],
): HorasExtraEmpleadoFilaForm[] {
  return filas.map((fila) => {
    const row = root.querySelector<HTMLTableRowElement>(
      `tr[data-he-fila-empleado="${fila.empleado_id}"]`,
    );
    if (!row) return fila;
    const updated = { ...fila };
    for (const dia of DIAS) {
      const input = row.querySelector<HTMLInputElement>(`input[data-he-dia="${dia}"]`);
      if (input) updated[dia] = input.value;
    }
    return updated;
  });
}

function validateHourInput(input: HTMLInputElement): string | null {
  const val = parseHourValue(input.value);
  if (val === null) return "Valor inválido";
  return null;
}

function applyHourFieldUi(input: HTMLInputElement): boolean {
  const err = validateHourInput(input);
  const errorEl = input.closest("td")?.querySelector<HTMLElement>(".he-sup-hora-error") ?? null;
  input.classList.toggle("border-red-400", Boolean(err));
  input.classList.toggle("bg-red-50/40", Boolean(err));
  input.classList.toggle("focus:border-red-500", Boolean(err));
  input.classList.toggle("focus:ring-red-200", Boolean(err));
  if (errorEl) {
    if (err) {
      errorEl.textContent = err;
      errorEl.classList.remove("hidden");
    } else {
      errorEl.textContent = "";
      errorEl.classList.add("hidden");
    }
  }
  return !err;
}

function calcTotalFromInputs(root: HTMLElement): number {
  let general = 0;
  root.querySelectorAll<HTMLInputElement>("input[data-he-dia]").forEach((input) => {
    general += parseHourValue(input.value) ?? 0;
  });
  return general;
}

function recalcTotals(root: HTMLElement): number {
  let general = 0;
  root.querySelectorAll<HTMLTableRowElement>("tr[data-he-fila-empleado]").forEach((row) => {
    const empleadoId = row.dataset.heFilaEmpleado;
    if (!empleadoId) return;
    let total = 0;
    row.querySelectorAll<HTMLInputElement>("input[data-he-dia]").forEach((input) => {
      total += parseHourValue(input.value) ?? 0;
    });
    general += total;
    const cell = root.querySelector(`[data-he-total-empleado="${empleadoId}"]`);
    if (cell) cell.textContent = formatHorasCaptura(total);
  });

  const horasResumen = root.querySelector("#he-sup-resumen-horas");
  if (horasResumen) horasResumen.textContent = formatHorasCaptura(general);
  return general;
}

function updateResumenCard(root: HTMLElement): void {
  const semana = root.querySelector<HTMLSelectElement>("#he-sup-semana")?.value;
  const tipo = root.querySelector<HTMLSelectElement>("#he-sup-tipo")?.value ?? "planeado";
  const empleadoSelect = root.querySelector<HTMLInputElement>("#he-sup-empleado");
  const colaborador =
    root.querySelector<HTMLInputElement>("#he-sup-empleado-q")?.value.split(" · ")[0]?.trim() ||
    "Sin seleccionar";

  const semanaEl = root.querySelector("#he-sup-resumen-semana");
  if (semanaEl && semana) semanaEl.textContent = semana;

  const tipoEl = root.querySelector("#he-sup-resumen-tipo");
  if (tipoEl) tipoEl.textContent = tipoLabel(tipo);

  const colabEl = root.querySelector("#he-sup-resumen-colaborador");
  if (colabEl) {
    colabEl.textContent = empleadoSelect?.value ? colaborador : "Sin seleccionar";
    colabEl.setAttribute("title", colabEl.textContent);
  }
}

function computeEstadoSolicitud(
  root: HTMLElement,
  filas: HorasExtraEmpleadoFilaForm[],
): EstadoSolicitudUi {
  const motivo = (root.querySelector("#he-sup-motivo") as HTMLTextAreaElement | null)?.value.trim();
  if (!motivo) return "falta-motivo";
  if (!filas.length) return "falta-colaborador";

  let hasInvalid = false;
  root.querySelectorAll<HTMLInputElement>("input[data-he-dia]").forEach((input) => {
    if (validateHourInput(input)) hasInvalid = true;
  });
  if (hasInvalid) return "invalido";

  if (calcTotalFromInputs(root) <= 0) return "falta-horas";
  return "lista";
}

function renderEstadoSolicitudUi(estado: EstadoSolicitudUi): { text: string; className: string } {
  switch (estado) {
    case "lista":
      return {
        text: "✓ Lista para guardar",
        className: "text-emerald-800",
      };
    case "falta-motivo":
      return {
        text: "⚠ Falta motivo",
        className: "text-amber-800",
      };
    case "falta-colaborador":
      return {
        text: "⚠ Selecciona un colaborador",
        className: "text-amber-800",
      };
    case "falta-horas":
      return {
        text: "⚠ Faltan horas por capturar",
        className: "text-amber-800",
      };
    default:
      return {
        text: "⚠ Corrige los valores marcados",
        className: "text-red-700",
      };
  }
}

function updateEstadoSolicitud(
  root: HTMLElement,
  filas: HorasExtraEmpleadoFilaForm[],
): EstadoSolicitudUi {
  const estado = computeEstadoSolicitud(root, filas);
  const { text, className } = renderEstadoSolicitudUi(estado);
  const el = root.querySelector("#he-sup-estado-solicitud");
  if (el) {
    el.textContent = text;
    el.className = `mt-3 flex items-center gap-2 text-sm font-medium ${className}`;
  }
  return estado;
}

function updateFormLiveUi(root: HTMLElement, filas: HorasExtraEmpleadoFilaForm[]): void {
  recalcTotals(root);
  updateResumenCard(root);
  updateEstadoSolicitud(root, filas);
}

function clearInlineFormErrors(root: HTMLElement): void {
  root.querySelector("#he-sup-motivo-error")?.classList.add("hidden");
  root.querySelector("#he-sup-empleado-error")?.classList.add("hidden");
  root.querySelectorAll<HTMLElement>(".he-sup-hora-error").forEach((el) => {
    el.textContent = "";
    el.classList.add("hidden");
  });
  root.querySelectorAll<HTMLInputElement>("input[data-he-dia]").forEach((input) => {
    input.classList.remove("border-red-400", "bg-red-50/40", "focus:border-red-500", "focus:ring-red-200");
  });
}

function applySubmitValidationUi(
  root: HTMLElement,
  message: string,
  filas: HorasExtraEmpleadoFilaForm[],
): void {
  clearInlineFormErrors(root);
  if (message === "El motivo es obligatorio.") {
    const motivo = root.querySelector<HTMLTextAreaElement>("#he-sup-motivo");
    const err = root.querySelector("#he-sup-motivo-error");
    motivo?.classList.add("border-red-400");
    if (err) {
      err.textContent = message;
      err.classList.remove("hidden");
    }
    return;
  }
  if (message === "Selecciona un colaborador.") {
    const err = root.querySelector("#he-sup-empleado-error");
    if (err) {
      err.textContent = message;
      err.classList.remove("hidden");
    }
    return;
  }
  if (message.startsWith("El empleado")) {
    const err = root.querySelector("#he-sup-empleado-error");
    if (err) {
      err.textContent = message;
      err.classList.remove("hidden");
    }
    return;
  }
  if (message === "Las horas deben ser numéricas y mayores o iguales a 0.") {
    root.querySelectorAll<HTMLInputElement>("input[data-he-dia]").forEach((input) => {
      applyHourFieldUi(input);
    });
    return;
  }
  if (message === "Registra al menos un día con horas mayores a 0.") {
    updateEstadoSolicitud(root, filas);
  }
}

function bindHorasInputUx(
  root: HTMLElement,
  getFilas: () => HorasExtraEmpleadoFilaForm[],
  onFilasChange: (filas: HorasExtraEmpleadoFilaForm[]) => void,
): void {
  const inputs = [...root.querySelectorAll<HTMLInputElement>("input[data-he-dia]")];
  inputs.forEach((input, index) => {
    input.addEventListener("focus", () => {
      input.select();
    });

    input.addEventListener("input", () => {
      applyHourFieldUi(input);
      const filas = syncFilasFromDom(root, getFilas());
      onFilasChange(filas);
      updateFormLiveUi(root, filas);
    });

    input.addEventListener("keydown", (ev) => {
      if (ev.key !== "Tab" || ev.shiftKey) return;
      const next = inputs[index + 1];
      if (!next) return;
      ev.preventDefault();
      next.focus();
    });
  });
}

export function mountHorasExtraSolicitud(container: HTMLElement): void {
  if (!isHorasExtraRegistroAutorizado()) {
    mountAppShell(container, {
      pageTitle: "Solicitud de horas extra",
      activeNav: "horas-extra-solicitud",
      mainClass: "pt-0 pb-5 sm:pb-6",
      mainHtml: forbiddenHtml(),
    });
    return;
  }

  let state = initialState();
  let opcionesCache: HorasExtraSolicitudOpciones | null = null;

  const render = (): void => {
    if (state.solicitudModalOpen) {
      const pageRoot = container.querySelector("#horas-extra-solicitud-page");
      if (pageRoot) {
        state = { ...state, ...syncFormDraftFromDom(pageRoot as HTMLElement, state) };
      }
    }
    mountAppShell(container, {
      pageTitle: "Solicitud de horas extra",
      activeNav: "horas-extra-solicitud",
      mainClass: "pt-0 pb-5 sm:pb-6",
      mainHtml: renderHorasExtraSolicitudPage(state),
    });
    bindEvents();
  };

  const closeSolicitudModal = (): void => {
    state = {
      ...state,
      ...resetFormState(opcionesCache?.semana_actual ?? state.formSemana),
    };
  };

  const bindEvents = (): void => {
    const root = container.querySelector("#horas-extra-solicitud-page");
    if (!root) return;

    root.querySelector("#he-sup-abrir-solicitud")?.addEventListener("click", () => {
      if (state.opcionesStatus !== "ready" || !opcionesCache) return;
      state = {
        ...state,
        ...resetFormState(opcionesCache.semana_actual),
        solicitudModalOpen: true,
      };
      render();
    });

    const solicitudModal = root.querySelector("#he-sup-solicitud-modal");
    solicitudModal?.addEventListener("click", (ev) => {
      if (ev.target === ev.currentTarget && !state.submitting) {
        closeSolicitudModal();
        render();
      }
    });

    root.querySelector("#he-sup-solicitud-cerrar")?.addEventListener("click", () => {
      if (state.submitting) return;
      closeSolicitudModal();
      render();
    });

    root.querySelector("#he-sup-solicitud-cancelar")?.addEventListener("click", () => {
      if (state.submitting) return;
      closeSolicitudModal();
      render();
    });

    if (!opcionesCache) {
      bindListaEvents(root as HTMLElement);
      return;
    }

    root.querySelector<HTMLSelectElement>("#he-sup-semana")?.addEventListener("change", (ev) => {
      const semana = Number.parseInt((ev.target as HTMLSelectElement).value, 10);
      if (Number.isNaN(semana)) return;
      state = { ...state, formSemana: semana };
      render();
    });

    root.querySelector<HTMLSelectElement>("#he-sup-tipo")?.addEventListener("change", (ev) => {
      const tipo = (ev.target as HTMLSelectElement).value as HorasExtraTipoSolicitud;
      state = {
        ...state,
        formTipo: tipo === "espontaneo" ? "espontaneo" : "planeado",
      };
      updateFormLiveUi(root as HTMLElement, state.empleadosFilas);
    });

    root.querySelector<HTMLTextAreaElement>("#he-sup-motivo")?.addEventListener("input", (ev) => {
      const motivo = ev.target as HTMLTextAreaElement;
      motivo.classList.remove("border-red-400");
      root.querySelector("#he-sup-motivo-error")?.classList.add("hidden");
      state = { ...state, formMotivo: motivo.value };
      updateEstadoSolicitud(root as HTMLElement, state.empleadosFilas);
    });

    const seleccionarEmpleado = (empleadoId: number | null): void => {
      if (!opcionesCache) return;
      state = {
        ...state,
        selectedEmpleadoId: empleadoId,
        empleadosFilas: filaFromEmpleado(opcionesCache, empleadoId, state.empleadosFilas),
      };
      render();
      const pageRoot = container.querySelector("#horas-extra-solicitud-page") as HTMLElement | null;
      if (!pageRoot) return;
      updateFormLiveUi(pageRoot, state.empleadosFilas);
      if (empleadoId) {
        pageRoot.querySelector<HTMLInputElement>("input[data-he-dia]")?.focus();
      } else {
        pageRoot.querySelector<HTMLInputElement>("#he-sup-empleado-q")?.focus();
      }
    };

    // Buscador de colaboradores: filtra en cliente el subárbol que trae /opciones y
    // repinta solo el listbox, para no desmontar el input mientras se escribe.
    const combobox = root.querySelector<HTMLElement>("[data-he-empleado-combobox]");
    const qInput = combobox?.querySelector<HTMLInputElement>("#he-sup-empleado-q") ?? null;
    const pintarListbox = (abierto: boolean): void => {
      if (!combobox || !qInput || !opcionesCache) return;
      const resultado = abierto ? buscarEmpleadosEquipo(opcionesCache.empleados, qInput.value) : null;
      const existente = combobox.querySelector("#he-sup-empleado-listbox");
      const html = renderEquipoListbox(resultado);
      if (existente) existente.outerHTML = html;
      else combobox.insertAdjacentHTML("beforeend", html);
      qInput.setAttribute("aria-expanded", abierto ? "true" : "false");
    };
    if (qInput && !qInput.readOnly) {
      qInput.addEventListener("input", () => {
        root.querySelector("#he-sup-empleado-error")?.classList.add("hidden");
        pintarListbox(true);
      });
      qInput.addEventListener("focus", () => pintarListbox(qInput.value.trim().length > 0));
      qInput.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") pintarListbox(false);
        if (ev.key === "Enter") ev.preventDefault();
      });
    }
    combobox?.addEventListener("mousedown", (ev) => {
      const pick = (ev.target as HTMLElement).closest<HTMLElement>("[data-he-empleado-pick]");
      if (!pick) return;
      ev.preventDefault();
      const id = Number.parseInt(pick.dataset.heEmpleadoPick ?? "", 10);
      if (!Number.isNaN(id)) seleccionarEmpleado(id);
    });
    combobox?.querySelector("[data-he-empleado-clear]")?.addEventListener("click", () => {
      seleccionarEmpleado(null);
    });
    root.addEventListener("mousedown", (ev) => {
      if (combobox && !combobox.contains(ev.target as Node)) pintarListbox(false);
    });

    bindHorasInputUx(
      root as HTMLElement,
      () => state.empleadosFilas,
      (filas) => {
        state = { ...state, empleadosFilas: filas };
      },
    );

    updateFormLiveUi(root as HTMLElement, state.empleadosFilas);

    const form = root.querySelector<HTMLFormElement>("#he-sup-form");
    form?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      state = { ...state, formError: undefined };
      const filasSync = syncFilasFromDom(root as HTMLElement, state.empleadosFilas);
      state = { ...state, empleadosFilas: filasSync };
      const err = validateForm(form, filasSync, opcionesCache);
      if (err) {
        applySubmitValidationUi(root as HTMLElement, err, filasSync);
        updateEstadoSolicitud(root as HTMLElement, filasSync);
        const isFieldLevel =
          err !== "Selecciona una semana válida." &&
          err !== "Datos de formulario inválidos.";
        state = { ...state, formError: isFieldLevel ? undefined : err };
        if (!isFieldLevel) render();
        return;
      }
      const payload = buildPayload(form, filasSync);
      if (!payload) {
        state = { ...state, formError: "Datos de formulario inválidos." };
        render();
        return;
      }
      state = { ...state, submitting: true };
      render();
      try {
        await createHorasExtraSolicitud(payload);
        state = {
          ...state,
          ...resetFormState(opcionesCache?.semana_actual ?? state.formSemana),
          listaSuccess: "Solicitud guardada correctamente.",
        };
        await Promise.all([loadLista(), loadEstadisticas()]);
        render();
      } catch (e) {
        const errObj = e as HorasExtraSolicitudFetchError;
        if (isAuthError(errObj)) {
          clearAuth();
          window.location.hash = "#/login";
          return;
        }
        state = {
          ...state,
          submitting: false,
          formError: errObj.detail ?? "No se pudo guardar la solicitud.",
        };
        render();
      }
    });

    bindListaEvents(root as HTMLElement);
  };

  const bindListaEvents = (root: HTMLElement): void => {
    root.querySelectorAll<HTMLButtonElement>("[data-he-ver-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number.parseInt(btn.dataset.heVerId ?? "0", 10);
        if (!id) return;
        state = {
          ...state,
          detalleAbierto: null,
          detalleStatus: "loading",
          detalleError: undefined,
          detalleAprobaciones: { status: "loading", showHistorial: false },
        };
        render();
        try {
          const [detalleResult, estadoResult] = await Promise.allSettled([
            getHorasExtraSolicitudDetalle(id),
            getHorasExtraEstado(id),
          ]);

          const detalleError =
            detalleResult.status === "rejected"
              ? (detalleResult.reason as HorasExtraSolicitudFetchError).detail ??
                "No se pudo cargar el detalle."
              : undefined;

          const aprobacionesError =
            estadoResult.status === "rejected"
              ? estadoResult.reason &&
                  typeof estadoResult.reason === "object" &&
                  "detail" in estadoResult.reason
                ? String((estadoResult.reason as HorasExtraSolicitudFetchError).detail)
                : "No se pudieron cargar las aprobaciones."
              : undefined;

          const detalleOk = detalleResult.status === "fulfilled" ? detalleResult.value : null;
          const estadoOk = estadoResult.status === "fulfilled" ? estadoResult.value : null;

          if (detalleError) {
            state = {
              ...state,
              detalleStatus: "error",
              detalleError,
              detalleAprobaciones: aprobacionesError
                ? { status: "error", error: aprobacionesError, showHistorial: false }
                : estadoOk
                  ? {
                      status: "idle",
                      firmas: estadoOk.firmas,
                      showHistorial: false,
                    }
                  : { status: "error", error: aprobacionesError ?? "No se pudieron cargar las aprobaciones.", showHistorial: false },
            };
          } else {
            state = {
              ...state,
              detalleAbierto: detalleOk,
              detalleStatus: "idle",
              detalleAprobaciones: aprobacionesError
                ? { status: "error", error: aprobacionesError, showHistorial: false }
                : {
                    status: "idle",
                    firmas: estadoOk?.firmas ?? [],
                    showHistorial: false,
                  },
            };
          }
        } catch (e) {
          const errObj = e as HorasExtraSolicitudFetchError;
          if (isAuthError(errObj)) {
            clearAuth();
            window.location.hash = "#/login";
            return;
          }
          state = {
            ...state,
            detalleStatus: "error",
            detalleError: errObj.detail ?? "No se pudo cargar el detalle.",
            detalleAprobaciones: { status: "error", error: "No se pudieron cargar las aprobaciones.", showHistorial: false },
          };
        }
        render();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-he-detalle-cerrar]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state = { ...state, detalleAbierto: null, detalleStatus: "idle", detalleAprobaciones: undefined };
        render();
      });
    });
    root.querySelector("#he-sup-detalle-backdrop")?.addEventListener("click", (ev) => {
      if (ev.target === ev.currentTarget) {
        state = { ...state, detalleAbierto: null, detalleStatus: "idle", detalleAprobaciones: undefined };
        render();
      }
    });
  };

  const loadOpciones = async (): Promise<void> => {
    try {
      const opciones = await getHorasExtraSolicitudOpciones();
      opcionesCache = opciones;
      state = {
        ...state,
        opciones,
        opcionesStatus: "ready",
        formSemana: state.formSemana || opciones.semana_actual,
      };
    } catch (e) {
      const errObj = e as HorasExtraSolicitudFetchError;
      if (isAuthError(errObj)) {
        clearAuth();
        window.location.hash = "#/login";
        return;
      }
      state = {
        ...state,
        opcionesStatus: "error",
        opcionesError: errObj.detail ?? "Error al cargar catálogos.",
      };
    }
  };

  const loadEstadisticas = async (): Promise<void> => {
    state = { ...state, estadisticasStatus: "loading" };
    try {
      const data = await getHorasExtraSolicitudEstadisticas();
      state = {
        ...state,
        estadisticas: data,
        estadisticasStatus: "ready",
        estadisticasError: undefined,
      };
    } catch (e) {
      const errObj = e as HorasExtraSolicitudFetchError;
      if (isAuthError(errObj)) {
        clearAuth();
        window.location.hash = "#/login";
        return;
      }
      state = {
        ...state,
        estadisticasStatus: "error",
        estadisticasError: errObj.detail ?? "Error al cargar estadísticas.",
      };
    }
  };

  const loadLista = async (): Promise<void> => {
    state = { ...state, listaStatus: "loading" };
    try {
      const data = await getHorasExtraSolicitudes(state.listaPage, state.listaPageSize);
      state = {
        ...state,
        lista: data.items,
        listaTotal: data.total,
        listaPage: data.page,
        listaPageSize: data.page_size,
        listaStatus: "ready",
      };
    } catch (e) {
      const errObj = e as HorasExtraSolicitudFetchError;
      if (isAuthError(errObj)) {
        clearAuth();
        window.location.hash = "#/login";
        return;
      }
      state = {
        ...state,
        listaStatus: "error",
        listaError: errObj.detail ?? "Error al cargar solicitudes.",
      };
    }
  };

  void (async () => {
    render();
    await Promise.all([loadOpciones(), loadLista(), loadEstadisticas()]);
    render();
  })();
}
