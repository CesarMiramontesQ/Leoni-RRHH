/**
 * Ajustes Comedor (`#/comedor/ajustes`): administración de comedores + horario de comida
 * por turno, en una sola pantalla con pestañas.
 *
 * Absorbió la antigua pantalla «Comedores» (`#/comedor/gestion`, que ahora redirige aquí).
 * El acceso lo decide `canAccessComedorAjustesPage` en `mountComedor`; aquí no hay
 * compuerta propia.
 *
 * Los comedores se recargan del servidor tras crear/editar. Los turnos NO se repintan al
 * guardar una fila: se actualiza solo esa fila en el DOM, porque un repintado descartaría
 * lo que el usuario ya escribió en las otras filas sin guardar.
 */

import {
  comedorErrorMessage,
  getComedoresActivos,
  getComedorTurnosHorario,
  guardarComedorTurnoHorario,
  type ComedorApiItem,
  type ComedorTurnoHorarioApi,
} from "../api/comedor.ts";
import {
  celdaDuracionHtml,
  renderComedorAjustes,
  toInputTime,
  type AjustesTabId,
  type ComedorAjustesViewState,
  type ComedorFiltroEstado,
  type TurnoFiltroHorario,
} from "../components/comedor/comedorAjustesView.ts";
import { mountComedorCrearComedorModal } from "../components/comedor/comedorCrearComedorModal.ts";
import { mountComedorEditarComedorModal } from "../components/comedor/comedorEditarComedorModal.ts";
import { showEmpleadosToast } from "../components/empleados/toast.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { renderComedorBackBar } from "../navigation/comedorBackLink.ts";

const ROOT_ID = "comedor-ajustes-root";

export function mountComedorAjustes(container: HTMLElement, signal: AbortSignal): void {
  const state: ComedorAjustesViewState = {
    tab: "comedores",
    comedores: {
      panelState: "loading",
      items: [],
      filtroEstado: "todos",
      busqueda: "",
      errorMessage: null,
    },
    turnos: {
      panelState: "loading",
      items: [],
      filtroHorario: "todos",
      busqueda: "",
      incluirInactivos: false,
      soloEnUso: true,
      guardandoCodigo: null,
      errorMessage: null,
      borradores: {},
    },
  };

  function paint(): void {
    const root = container.querySelector<HTMLElement>(`#${ROOT_ID}`);
    if (!root) return;
    root.innerHTML = renderComedorAjustes(state);
  }

  /**
   * Repinta conservando el foco y la posición del cursor del campo de búsqueda: sin esto,
   * `innerHTML` recrea el input y el usuario pierde el caret en cada tecla.
   */
  function paintPreservandoBusqueda(selector: string): void {
    const previo = container.querySelector<HTMLInputElement>(selector);
    const caret = previo?.selectionStart ?? null;
    paint();
    const nuevo = container.querySelector<HTMLInputElement>(selector);
    if (!nuevo) return;
    nuevo.focus();
    if (caret != null) nuevo.setSelectionRange(caret, caret);
  }

  async function loadComedores(): Promise<void> {
    state.comedores.panelState = "loading";
    state.comedores.errorMessage = null;
    paint();
    try {
      const rows = await getComedoresActivos();
      if (signal.aborted) return;
      state.comedores.items = rows;
      state.comedores.panelState = "ready";
    } catch (error) {
      if (signal.aborted) return;
      state.comedores.items = [];
      state.comedores.panelState = "error";
      state.comedores.errorMessage = comedorErrorMessage(error, "Error al cargar comedores.");
    }
    paint();
  }

  async function loadTurnos(): Promise<void> {
    state.turnos.panelState = "loading";
    state.turnos.errorMessage = null;
    paint();
    try {
      const rows = await getComedorTurnosHorario({
        incluirInactivos: state.turnos.incluirInactivos,
        soloEnUso: state.turnos.soloEnUso,
      });
      if (signal.aborted) return;
      state.turnos.items = rows;
      state.turnos.panelState = "ready";
    } catch (error) {
      if (signal.aborted) return;
      state.turnos.items = [];
      state.turnos.panelState = "error";
      state.turnos.errorMessage = comedorErrorMessage(error, "Error al cargar turnos.");
    }
    paint();
  }

  function horasDeLaFila(fila: HTMLTableRowElement): { inicio: string; fin: string } {
    return {
      inicio: fila.querySelector<HTMLInputElement>("[data-turno-hora-inicio]")?.value ?? "",
      fin: fila.querySelector<HTMLInputElement>("[data-turno-hora-fin]")?.value ?? "",
    };
  }

  /**
   * Marca la fila como pendiente sin repintar la tabla. El badge no puede esperar al
   * siguiente render: sirve precisamente mientras el usuario está capturando.
   */
  function marcarFilaSinGuardar(fila: HTMLTableRowElement, sinGuardar: boolean): void {
    fila.classList.toggle("bg-amber-50/40", sinGuardar);
    const existente = fila.querySelector("[data-turno-sin-guardar]");
    if (!sinGuardar) {
      existente?.remove();
      return;
    }
    if (existente) return;
    const marca = document.createElement("span");
    marca.setAttribute("data-turno-sin-guardar", "");
    marca.className = "text-[11px] font-semibold uppercase tracking-wide text-amber-600";
    marca.textContent = "Sin guardar";
    fila.querySelector("td > div")?.appendChild(marca);
  }

  /** Guarda en el estado lo capturado, para que filtrar o buscar no lo descarte. */
  function anotarBorrador(fila: HTMLTableRowElement): void {
    const codigo = fila.getAttribute("data-turno-row");
    if (!codigo) return;
    const { inicio, fin } = horasDeLaFila(fila);
    const item = state.turnos.items.find((i) => i.tu_codigo === codigo);
    const igualAlGuardado =
      item != null &&
      inicio === toInputTime(item.hora_inicio_comida) &&
      fin === toInputTime(item.hora_fin_comida);

    if (igualAlGuardado) delete state.turnos.borradores[codigo];
    else state.turnos.borradores[codigo] = { inicio, fin };
    marcarFilaSinGuardar(fila, !igualAlGuardado);
  }

  /** Recalcula duración y estado de la fila mientras el usuario escribe, sin repintar. */
  function refrescarDuracionFila(fila: HTMLTableRowElement): void {
    const celda = fila.querySelector<HTMLElement>("[data-turno-duracion]");
    if (!celda) return;
    const codigo = fila.getAttribute("data-turno-row") ?? "";
    const item = state.turnos.items.find((i) => i.tu_codigo === codigo);
    const { inicio, fin } = horasDeLaFila(fila);
    celda.innerHTML = celdaDuracionHtml(item?.activo ?? true, inicio, fin);
  }

  async function guardarFila(
    fila: HTMLTableRowElement,
    boton: HTMLButtonElement,
    tuCodigo: string,
  ): Promise<void> {
    const inputInicio = fila.querySelector<HTMLInputElement>("[data-turno-hora-inicio]");
    const inputFin = fila.querySelector<HTMLInputElement>("[data-turno-hora-fin]");
    const inicio = inputInicio?.value ?? "";
    const fin = inputFin?.value ?? "";

    if (!inicio || !fin) {
      showEmpleadosToast(container, "Captura la hora de inicio y la de fin.", "error");
      return;
    }
    // `HH:MM` de 24 h se ordena igual como texto que como hora.
    if (inicio >= fin) {
      showEmpleadosToast(container, "La hora de inicio debe ser menor que la hora de fin.", "error");
      return;
    }

    state.turnos.guardandoCodigo = tuCodigo;
    boton.disabled = true;
    boton.textContent = "Guardando…";
    try {
      const actualizado = await guardarComedorTurnoHorario(tuCodigo, {
        horaInicioComida: inicio,
        horaFinComida: fin,
      });
      if (signal.aborted) return;
      aplicarActualizacion(actualizado, inputInicio, inputFin);
      delete state.turnos.borradores[tuCodigo];
      marcarFilaSinGuardar(fila, false);
      refrescarDuracionFila(fila);
      showEmpleadosToast(container, "Horario de comida actualizado.", "success");
    } catch (error) {
      if (signal.aborted) return;
      showEmpleadosToast(
        container,
        comedorErrorMessage(error, "No se pudo guardar el horario."),
        "error",
      );
    } finally {
      if (!signal.aborted) {
        state.turnos.guardandoCodigo = null;
        boton.disabled = false;
        boton.textContent = "Guardar";
      }
    }
  }

  /** Refleja la respuesta del servidor en el estado y en los inputs de la fila. */
  function aplicarActualizacion(
    actualizado: ComedorTurnoHorarioApi,
    inputInicio: HTMLInputElement | null,
    inputFin: HTMLInputElement | null,
  ): void {
    state.turnos.items = state.turnos.items.map((item) =>
      item.tu_codigo === actualizado.tu_codigo ? actualizado : item,
    );
    if (inputInicio) inputInicio.value = toInputTime(actualizado.hora_inicio_comida);
    if (inputFin) inputFin.value = toInputTime(actualizado.hora_fin_comida);
  }

  mountAppShell(container, {
    pageTitle: "Ajustes Comedor",
    activeNav: "comedor-ajustes",
    mainClass: "py-5 sm:py-6",
    mainHtml: `${renderComedorBackBar()}<div id="${ROOT_ID}">${renderComedorAjustes(state)}</div><div id="comedor-ajustes-crear-host"></div><div id="comedor-ajustes-editar-host"></div>`,
  });

  const root = container.querySelector<HTMLElement>(`#${ROOT_ID}`);
  const crearHost = container.querySelector<HTMLElement>("#comedor-ajustes-crear-host");
  const editarHost = container.querySelector<HTMLElement>("#comedor-ajustes-editar-host");

  const crearModal = crearHost
    ? mountComedorCrearComedorModal(crearHost, {
        toastContainer: container,
        onCreated: async () => {
          await loadComedores();
        },
      })
    : null;
  const editarModal = editarHost
    ? mountComedorEditarComedorModal(editarHost, {
        toastContainer: container,
        onUpdated: async () => {
          await loadComedores();
        },
      })
    : null;

  root?.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement;

      const tabBtn = target.closest<HTMLButtonElement>("[data-tab]");
      if (tabBtn) {
        const tab = tabBtn.getAttribute("data-tab") as AjustesTabId | null;
        if (!tab || tab === state.tab) return;
        state.tab = tab;
        paint();
        // Los turnos se cargan la primera vez que se abre su pestaña.
        if (tab === "horarios" && state.turnos.items.length === 0 && state.turnos.panelState !== "error") {
          void loadTurnos();
        }
        return;
      }

      const retry = target.closest<HTMLButtonElement>("[data-ajustes-retry]");
      if (retry) {
        if (retry.getAttribute("data-ajustes-retry") === "comedores") void loadComedores();
        else void loadTurnos();
        return;
      }

      const filtroEstado = target.closest<HTMLButtonElement>("[data-comedor-filtro-estado]");
      if (filtroEstado) {
        state.comedores.filtroEstado = filtroEstado.getAttribute(
          "data-comedor-filtro-estado",
        ) as ComedorFiltroEstado;
        paint();
        return;
      }

      const filtroHorario = target.closest<HTMLButtonElement>("[data-turno-filtro-horario]");
      if (filtroHorario) {
        state.turnos.filtroHorario = filtroHorario.getAttribute(
          "data-turno-filtro-horario",
        ) as TurnoFiltroHorario;
        paint();
        return;
      }

      if (target.closest("[data-comedor-agregar]")) {
        crearModal?.open();
        return;
      }

      const editBtn = target.closest<HTMLButtonElement>("[data-comedor-editar]");
      if (editBtn) {
        const comedorId = Number.parseInt(editBtn.getAttribute("data-comedor-editar") ?? "", 10);
        if (!Number.isFinite(comedorId)) return;
        const comedor = state.comedores.items.find((item: ComedorApiItem) => item.id === comedorId);
        if (comedor) editarModal?.open(comedor);
        return;
      }

      const saveBtn = target.closest<HTMLButtonElement>("[data-turno-guardar]");
      if (saveBtn) {
        const tuCodigo = saveBtn.getAttribute("data-turno-guardar") ?? "";
        const fila = saveBtn.closest("tr");
        if (!tuCodigo || !fila || state.turnos.guardandoCodigo === tuCodigo) return;
        void guardarFila(fila, saveBtn, tuCodigo);
      }
    },
    { signal },
  );

  root?.addEventListener(
    "input",
    (event) => {
      const target = event.target as HTMLElement;

      // Las búsquedas filtran en cliente: no hay ida al servidor, así que basta repintar.
      const busquedaComedor = target.closest<HTMLInputElement>("[data-comedor-busqueda]");
      if (busquedaComedor) {
        state.comedores.busqueda = busquedaComedor.value;
        paintPreservandoBusqueda("[data-comedor-busqueda]");
        return;
      }
      const busquedaTurno = target.closest<HTMLInputElement>("[data-turno-busqueda]");
      if (busquedaTurno) {
        state.turnos.busqueda = busquedaTurno.value;
        paintPreservandoBusqueda("[data-turno-busqueda]");
        return;
      }

      const horaInput = target.closest<HTMLInputElement>(
        "[data-turno-hora-inicio], [data-turno-hora-fin]",
      );
      if (horaInput) {
        const fila = horaInput.closest("tr");
        if (fila) {
          anotarBorrador(fila);
          refrescarDuracionFila(fila);
        }
      }
    },
    { signal },
  );

  root?.addEventListener(
    "change",
    (event) => {
      const target = event.target as HTMLElement;
      const inactivos = target.closest<HTMLInputElement>("[data-turno-incluir-inactivos]");
      if (inactivos) {
        state.turnos.incluirInactivos = inactivos.checked;
        void loadTurnos();
        return;
      }
      const catalogo = target.closest<HTMLInputElement>("[data-turno-catalogo-completo]");
      if (catalogo) {
        state.turnos.soloEnUso = !catalogo.checked;
        void loadTurnos();
      }
    },
    { signal },
  );

  signal.addEventListener("abort", () => {
    crearModal?.destroy();
    editarModal?.destroy();
  });

  void loadComedores();
}
