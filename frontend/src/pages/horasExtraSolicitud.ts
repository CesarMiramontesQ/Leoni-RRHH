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
  filterEmpleadosElegibles,
  renderEmpleadosModalList,
  renderHorasExtraSolicitudPage,
  weekInputToMonday,
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
    empleadosModalOpen: false,
    empleadosModalSearch: "",
    empleadosModalDraftIds: [],
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

function validateForm(
  form: HTMLFormElement,
  filas: HorasExtraEmpleadoFilaForm[],
): string | null {
  if (!form.fecha_solicitud.value) return "La fecha de solicitud es obligatoria.";
  if (!form.semana.value) return "La semana es obligatoria.";
  if (!weekInputToMonday(form.semana.value)) return "Selecciona una semana válida.";
  if (!form.departamento_id.value) return "Selecciona un departamento.";
  if (!form.area_id.value) return "Selecciona un área.";
  if (!form.subarea_id.value) return "Selecciona una subárea.";
  if (!form.centrocosto_id.value) return "Selecciona un centro de costo.";
  if (!form.motivo_id.value) return "Selecciona un motivo.";
  if (!filas.length) return "Selecciona al menos un empleado.";

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
  const semanaInicio = weekInputToMonday(form.semana.value);
  if (!semanaInicio) return null;
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
    fecha_solicitud: form.fecha_solicitud.value,
    semana_inicio: semanaInicio,
    tipo: form.tipo.value as "planeado" | "espontaneo",
    departamento_id: Number.parseInt(form.departamento_id.value, 10),
    area_id: Number.parseInt(form.area_id.value, 10),
    subarea_id: Number.parseInt(form.subarea_id.value, 10),
    centrocosto_id: Number.parseInt(form.centrocosto_id.value, 10),
    motivo_id: Number.parseInt(form.motivo_id.value, 10),
    comentarios: form.comentarios.value.trim() || null,
    empleados,
  };
}

function patchSubareas(
  root: HTMLElement,
  opciones: HorasExtraSolicitudOpciones,
  areaId: string,
  selectedSubarea = "",
): void {
  const subSel = root.querySelector<HTMLSelectElement>("#he-sup-subarea");
  if (!subSel) return;
  const items = opciones.subareas.filter((s) => String(s.area_id) === areaId);
  subSel.innerHTML = [
    `<option value="">Seleccionar subárea</option>`,
    ...items.map(
      (s) =>
        `<option value="${s.id}"${selectedSubarea === String(s.id) ? " selected" : ""}>${s.label}</option>`,
    ),
  ].join("");
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

  const patchEmpleadosModalList = (root: HTMLElement): void => {
    const list = root.querySelector("#he-sup-empleados-modal-list");
    const countEl = root.querySelector("#he-sup-empleados-modal-count");
    if (!list || !opcionesCache) return;
    const filtrados = filterEmpleadosElegibles(
      opcionesCache.empleados,
      state.empleadosModalSearch,
    );
    list.innerHTML = renderEmpleadosModalList(filtrados, state.empleadosModalDraftIds);
    if (countEl) {
      const n = state.empleadosModalDraftIds.length;
      countEl.textContent = `${n} seleccionado${n === 1 ? "" : "s"}`;
    }
  };

  const closeEmpleadosModal = (): void => {
    state = {
      ...state,
      empleadosModalOpen: false,
      empleadosModalSearch: "",
      empleadosModalDraftIds: [],
    };
  };

  const bindEvents = (): void => {
    const root = container.querySelector("#horas-extra-solicitud-page");
    if (!root || !opcionesCache) return;

    const areaSel = root.querySelector<HTMLSelectElement>("#he-sup-area");
    areaSel?.addEventListener("change", () => {
      patchSubareas(root as HTMLElement, opcionesCache!, areaSel.value);
    });

    root.querySelector("#he-sup-abrir-empleados")?.addEventListener("click", () => {
      state = {
        ...state,
        empleadosModalOpen: true,
        empleadosModalSearch: "",
        empleadosModalDraftIds: [...state.selectedEmpleadoIds],
      };
      render();
    });

    const modal = root.querySelector("#he-sup-empleados-modal");
    modal?.addEventListener("click", (ev) => {
      if (ev.target === ev.currentTarget) {
        closeEmpleadosModal();
        render();
      }
    });

    root.querySelector("#he-sup-empleados-cerrar")?.addEventListener("click", () => {
      closeEmpleadosModal();
      render();
    });

    root.querySelector("#he-sup-empleados-cancelar")?.addEventListener("click", () => {
      closeEmpleadosModal();
      render();
    });

    root.querySelector("#he-sup-empleados-search")?.addEventListener("input", (ev) => {
      state = {
        ...state,
        empleadosModalSearch: (ev.target as HTMLInputElement).value,
      };
      patchEmpleadosModalList(root as HTMLElement);
    });

    root.querySelector("#he-sup-empleados-modal-list")?.addEventListener("change", (ev) => {
      const cb = (ev.target as HTMLElement).closest<HTMLInputElement>(
        "input[data-he-modal-empleado-id]",
      );
      if (!cb) return;
      const id = Number.parseInt(cb.dataset.heModalEmpleadoId ?? "0", 10);
      if (!id) return;
      const draft = new Set(state.empleadosModalDraftIds);
      if (cb.checked) draft.add(id);
      else draft.delete(id);
      state = { ...state, empleadosModalDraftIds: [...draft] };
      patchEmpleadosModalList(root as HTMLElement);
    });

    root.querySelector("#he-sup-empleados-confirmar")?.addEventListener("click", () => {
      const selected = [...state.empleadosModalDraftIds];
      state = {
        ...state,
        selectedEmpleadoIds: selected,
        empleadosFilas: filasFromSelection(opcionesCache!, selected, state.empleadosFilas),
        empleadosModalOpen: false,
        empleadosModalSearch: "",
        empleadosModalDraftIds: [],
      };
      render();
    });

    root.querySelectorAll<HTMLInputElement>("input[data-he-dia]").forEach((input) => {
      input.addEventListener("input", () => recalcTotals(root as HTMLElement));
    });

    const form = root.querySelector<HTMLFormElement>("#he-sup-form");
    form?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      state = { ...state, formError: undefined, formSuccess: undefined };
      const err = validateForm(form, state.empleadosFilas);
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
          ...initialState(),
          opciones: opcionesCache,
          opcionesStatus: "ready",
          formSuccess: "Solicitud guardada correctamente.",
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
      state = { ...state, opciones, opcionesStatus: "ready" };
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
