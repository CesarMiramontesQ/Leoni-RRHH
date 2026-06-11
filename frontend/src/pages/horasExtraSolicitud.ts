import { getRolFromAccessToken } from "../auth/jwt.ts";
import { clearAuth } from "../auth/session.ts";
import {
  createHorasExtraSolicitud,
  getHorasExtraSolicitudDetalle,
  getHorasExtraSolicitudOpciones,
  getHorasExtraSolicitudes,
  type HorasExtraDetalleCreate,
  type HorasExtraSolicitudFetchError,
  type HorasExtraSolicitudOpciones,
} from "../api/horasExtraSolicitud.ts";
import {
  getSemanasPermitidas,
  renderEmpleadosPickerList,
  renderHorasExtraSolicitudPage,
  type HorasExtraEmpleadoFilaForm,
  type HorasExtraSolicitudPageState,
} from "../horasExtra/supervisor/renderHorasExtraSolicitudPage.ts";
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
    description: "Esta página solo está disponible para usuarios con rol supervisor.",
  });
}

function initialState(): HorasExtraSolicitudPageState {
  return {
    opciones: null,
    opcionesStatus: "loading",
    lista: [],
    listaStatus: "loading",
    listaTotal: 0,
    listaPage: 1,
    listaPageSize: 10,
    submitting: false,
    detalleAbierto: null,
    detalleStatus: "idle",
    empleadosFilas: [],
    selectedEmpleadoIds: [],
    empleadosSearch: "",
    formSemana: 1,
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
  | "selectedEmpleadoIds"
  | "empleadosSearch"
  | "formSemana"
  | "solicitudModalOpen"
> {
  return {
    formError: undefined,
    submitting: false,
    empleadosFilas: [],
    selectedEmpleadoIds: [],
    empleadosSearch: "",
    formSemana: semanaActual,
    solicitudModalOpen: false,
  };
}

function isAuthError(err: HorasExtraSolicitudFetchError): boolean {
  return err.status === 401;
}

function filasFromSelection(
  opciones: HorasExtraSolicitudOpciones,
  selectedIds: number[],
  prev: HorasExtraEmpleadoFilaForm[],
): HorasExtraEmpleadoFilaForm[] {
  const prevMap = new Map(prev.map((f) => [f.empleado_id, f]));
  return selectedIds
    .map((id) => opciones.empleados.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
    .map((emp) => {
      const existing = prevMap.get(emp.id);
      return (
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
        }
      );
    });
}

function validateEmpleadosOrganizacion(
  opciones: HorasExtraSolicitudOpciones,
  filas: HorasExtraEmpleadoFilaForm[],
): string | null {
  if (!filas.length) return null;
  const empleados = filas
    .map((f) => opciones.empleados.find((e) => e.id === f.empleado_id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));

  for (const emp of empleados) {
    if (!emp.area_id || !emp.subarea_id || !emp.centrocosto_id) {
      return `El empleado ${emp.no_empleado} no tiene área, subárea o centro de costo asignado.`;
    }
  }

  const ref = empleados[0];
  if (!ref) return null;
  for (const emp of empleados.slice(1)) {
    if (
      emp.area_id !== ref.area_id ||
      emp.subarea_id !== ref.subarea_id ||
      emp.centrocosto_id !== ref.centrocosto_id
    ) {
      return "Todos los empleados deben compartir área, subárea y centro de costo.";
    }
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
  if (!filas.length) return "Selecciona al menos un empleado.";
  if (opciones) {
    const orgErr = validateEmpleadosOrganizacion(opciones, filas);
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

function recalcTotals(root: HTMLElement): void {
  root.querySelectorAll<HTMLTableRowElement>("tr[data-he-fila-empleado]").forEach((row) => {
    const empleadoId = row.dataset.heFilaEmpleado;
    if (!empleadoId) return;
    let total = 0;
    row.querySelectorAll<HTMLInputElement>("input[data-he-dia]").forEach((input) => {
      total += Number.parseFloat(input.value) || 0;
    });
    const cell = root.querySelector(`[data-he-total-empleado="${empleadoId}"]`);
    if (cell) cell.textContent = total.toFixed(2);
  });

  let general = 0;
  root.querySelectorAll<HTMLElement>("[data-he-total-empleado]").forEach((cell) => {
    general += Number.parseFloat(cell.textContent ?? "0") || 0;
  });
  const generalCell = root.querySelector("#he-sup-total-general");
  if (generalCell) generalCell.textContent = general.toFixed(2);
}

export function mountHorasExtraSolicitud(container: HTMLElement): void {
  if (getRolFromAccessToken() !== "supervisor") {
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
    mountAppShell(container, {
      pageTitle: "Solicitud de horas extra",
      activeNav: "horas-extra-solicitud",
      mainClass: "pt-0 pb-5 sm:pb-6",
      mainHtml: renderHorasExtraSolicitudPage(state),
    });
    bindEvents();
  };

  const patchEmpleadosPicker = (root: HTMLElement): void => {
    const wrap = root.querySelector("#he-sup-empleados-picker-wrap");
    if (!wrap || !opcionesCache) return;
    wrap.innerHTML =
      state.empleadosSearch.trim().length === 0
        ? `<p class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">Empieza escribiendo para buscar un colaborador.</p>`
        : renderEmpleadosPickerList(
            opcionesCache.empleados,
            state.selectedEmpleadoIds,
            state.empleadosSearch,
          );
  };

  const toggleEmpleadoSeleccion = (empleadoId: number): void => {
    if (!opcionesCache) return;
    const selected = new Set(state.selectedEmpleadoIds);
    if (selected.has(empleadoId)) selected.delete(empleadoId);
    else selected.add(empleadoId);
    const ids = [...selected];
    state = {
      ...state,
      selectedEmpleadoIds: ids,
      empleadosFilas: filasFromSelection(opcionesCache, ids, state.empleadosFilas),
    };
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

    root.querySelector("#he-sup-empleados-search")?.addEventListener("input", (ev) => {
      state = {
        ...state,
        empleadosSearch: (ev.target as HTMLInputElement).value,
      };
      patchEmpleadosPicker(root as HTMLElement);
    });

    root.querySelector("#he-sup-empleados-picker-wrap")?.addEventListener("click", (ev) => {
      const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>(
        "[data-he-picker-empleado-id]",
      );
      if (!btn) return;
      const id = Number.parseInt(btn.dataset.hePickerEmpleadoId ?? "0", 10);
      if (!id) return;
      toggleEmpleadoSeleccion(id);
      render();
    });

    root.querySelectorAll<HTMLButtonElement>("[data-he-quitar-empleado]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number.parseInt(btn.dataset.heQuitarEmpleado ?? "0", 10);
        if (!id) return;
        toggleEmpleadoSeleccion(id);
        render();
      });
    });

    root.querySelectorAll<HTMLInputElement>("input[data-he-dia]").forEach((input) => {
      input.addEventListener("input", () => recalcTotals(root as HTMLElement));
    });

    const form = root.querySelector<HTMLFormElement>("#he-sup-form");
    form?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      state = { ...state, formError: undefined };
      const err = validateForm(form, state.empleadosFilas, opcionesCache);
      if (err) {
        state = { ...state, formError: err };
        render();
        return;
      }
      const payload = buildPayload(form, state.empleadosFilas);
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
        await loadLista();
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
        };
        render();
        try {
          const detalle = await getHorasExtraSolicitudDetalle(id);
          state = { ...state, detalleAbierto: detalle, detalleStatus: "idle" };
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
          };
        }
        render();
      });
    });

    root.querySelector("#he-sup-detalle-cerrar")?.addEventListener("click", () => {
      state = { ...state, detalleAbierto: null, detalleStatus: "idle" };
      render();
    });
    root.querySelector("#he-sup-detalle-backdrop")?.addEventListener("click", (ev) => {
      if (ev.target === ev.currentTarget) {
        state = { ...state, detalleAbierto: null, detalleStatus: "idle" };
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
    await Promise.all([loadOpciones(), loadLista()]);
    render();
  })();
}
