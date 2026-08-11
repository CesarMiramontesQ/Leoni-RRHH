/**
 * Ajustes Comedor (`#/comedor/ajustes`): administración de comedores, ventana de comida
 * por jornada y validación empleado + fecha, en una sola pantalla con pestañas.
 *
 * Absorbió la antigua pantalla «Comedores» (`#/comedor/gestion`, que ahora redirige aquí).
 * El acceso lo decide `canAccessComedorAjustesPage` en `mountComedor`; aquí no hay
 * compuerta propia.
 *
 * Los comedores se recargan del servidor tras crear/editar. Las jornadas NO se repintan al
 * guardar una fila: se actualiza solo esa fila en el DOM, porque un repintado descartaría
 * lo que el usuario ya escribió en las otras filas sin guardar.
 */

import {
  comedorErrorMessage,
  getComedoresActivos,
  getComedorJornadasComida,
  getComedorTurnosComida,
  getComedorVentanaComida,
  guardarComedorJornadaComida,
  type ComedorApiItem,
  type ComedorJornadaComidaApi,
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
      jornadas: [],
      filtroHorario: "todos",
      busqueda: "",
      incluirInactivos: false,
      soloEnUso: true,
      guardandoCodigo: null,
      expandidos: [],
      errorMessage: null,
      borradores: {},
    },
    validacion: {
      noEmpleado: "",
      // `new Date()` local, no UTC: a las 18:00 de México, `toISOString()` ya da mañana.
      fecha: new Date().toLocaleDateString("sv-SE"),
      estado: "idle",
      resultado: null,
      errorMessage: null,
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
      // Las dos tablas de la pestaña se piden juntas: la de jornadas es la editable y la
      // de turnos muestra a qué jornada cae cada día del ciclo.
      const [turnos, jornadas] = await Promise.all([
        getComedorTurnosComida({
          incluirInactivos: state.turnos.incluirInactivos,
          soloEnUso: state.turnos.soloEnUso,
        }),
        getComedorJornadasComida({ soloEnUso: state.turnos.soloEnUso }),
      ]);
      if (signal.aborted) return;
      state.turnos.items = turnos;
      state.turnos.jornadas = jornadas;
      state.turnos.panelState = "ready";
    } catch (error) {
      if (signal.aborted) return;
      state.turnos.items = [];
      state.turnos.jornadas = [];
      state.turnos.panelState = "error";
      state.turnos.errorMessage = comedorErrorMessage(
        error,
        "Error al cargar la configuración de comida.",
      );
    }
    paint();
  }

  async function consultarVentana(): Promise<void> {
    const noEmpleado = Number.parseInt(state.validacion.noEmpleado, 10);
    if (!Number.isFinite(noEmpleado) || noEmpleado <= 0) {
      showEmpleadosToast(container, "Captura un número de empleado válido.", "error");
      return;
    }
    if (!state.validacion.fecha) {
      showEmpleadosToast(container, "Captura una fecha.", "error");
      return;
    }

    state.validacion.estado = "loading";
    state.validacion.errorMessage = null;
    paint();
    try {
      const resultado = await getComedorVentanaComida(noEmpleado, state.validacion.fecha);
      if (signal.aborted) return;
      state.validacion.resultado = resultado;
      state.validacion.estado = "ready";
    } catch (error) {
      if (signal.aborted) return;
      state.validacion.resultado = null;
      state.validacion.estado = "error";
      state.validacion.errorMessage = comedorErrorMessage(
        error,
        "No se pudo consultar la ventana de comida.",
      );
    }
    paint();
  }

  function horasDeLaFila(fila: HTMLTableRowElement): { inicio: string; fin: string } {
    return {
      inicio: fila.querySelector<HTMLInputElement>("[data-jornada-hora-inicio]")?.value ?? "",
      fin: fila.querySelector<HTMLInputElement>("[data-jornada-hora-fin]")?.value ?? "",
    };
  }

  /**
   * Marca la fila como pendiente sin repintar la tabla. El badge no puede esperar al
   * siguiente render: sirve precisamente mientras el usuario está capturando.
   */
  function marcarFilaSinGuardar(fila: HTMLTableRowElement, sinGuardar: boolean): void {
    fila.classList.toggle("bg-amber-50/40", sinGuardar);
    const existente = fila.querySelector("[data-jornada-sin-guardar]");
    if (!sinGuardar) {
      existente?.remove();
      return;
    }
    if (existente) return;
    const marca = document.createElement("span");
    marca.setAttribute("data-jornada-sin-guardar", "");
    marca.className = "text-[11px] font-semibold uppercase tracking-wide text-amber-600";
    marca.textContent = "Sin guardar";
    fila.querySelector("td > div")?.appendChild(marca);
  }

  /** Guarda en el estado lo capturado, para que filtrar o buscar no lo descarte. */
  function anotarBorrador(fila: HTMLTableRowElement): void {
    const codigo = fila.getAttribute("data-jornada-row");
    if (!codigo) return;
    const { inicio, fin } = horasDeLaFila(fila);
    const item = state.turnos.jornadas.find((i) => i.ho_codigo === codigo);
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
    const celda = fila.querySelector<HTMLElement>("[data-jornada-duracion]");
    if (!celda) return;
    const codigo = fila.getAttribute("data-jornada-row") ?? "";
    const item = state.turnos.jornadas.find((i) => i.ho_codigo === codigo);
    const { inicio, fin } = horasDeLaFila(fila);
    celda.innerHTML = celdaDuracionHtml(item?.activo ?? true, inicio, fin);
  }

  async function guardarFila(
    fila: HTMLTableRowElement,
    boton: HTMLButtonElement,
    hoCodigo: string,
  ): Promise<void> {
    const inputInicio = fila.querySelector<HTMLInputElement>("[data-jornada-hora-inicio]");
    const inputFin = fila.querySelector<HTMLInputElement>("[data-jornada-hora-fin]");
    const inicio = inputInicio?.value ?? "";
    const fin = inputFin?.value ?? "";

    if (!inicio || !fin) {
      showEmpleadosToast(container, "Captura la hora de inicio y la de fin.", "error");
      return;
    }
    // No se exige inicio < fin: la jornada de noche come cruzando medianoche. Lo único
    // que no tiene sentido es una ventana de duración cero.
    if (inicio === fin) {
      showEmpleadosToast(container, "La hora de inicio y la de fin no pueden ser iguales.", "error");
      return;
    }

    state.turnos.guardandoCodigo = hoCodigo;
    boton.disabled = true;
    boton.textContent = "Guardando…";
    try {
      const actualizado = await guardarComedorJornadaComida(hoCodigo, {
        horaInicioComida: inicio,
        horaFinComida: fin,
      });
      if (signal.aborted) return;
      aplicarActualizacion(actualizado, inputInicio, inputFin);
      delete state.turnos.borradores[hoCodigo];
      marcarFilaSinGuardar(fila, false);
      refrescarDuracionFila(fila);
      // El alcance del cambio es lo que hace revisable una ventana compartida.
      const turnos = actualizado.turnos.length;
      showEmpleadosToast(
        container,
        turnos > 0
          ? `Jornada ${hoCodigo} actualizada — afecta a ${actualizado.turnos.join(", ")}.`
          : `Jornada ${hoCodigo} actualizada.`,
        "success",
      );
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

  /**
   * Refleja la respuesta del servidor en el estado y en los inputs de la fila.
   *
   * También refresca los bloques del ciclo de los turnos que usan esa jornada: si no, el
   * detalle expandido seguiría diciendo «Sin configurar» después de guardarla.
   */
  function aplicarActualizacion(
    actualizado: ComedorJornadaComidaApi,
    inputInicio: HTMLInputElement | null,
    inputFin: HTMLInputElement | null,
  ): void {
    state.turnos.jornadas = state.turnos.jornadas.map((item) =>
      item.ho_codigo === actualizado.ho_codigo ? actualizado : item,
    );
    state.turnos.items = state.turnos.items.map((turno) => {
      if (!turno.jornadas.includes(actualizado.ho_codigo)) return turno;
      const bloques = turno.bloques.map((b) =>
        b.ho_codigo === actualizado.ho_codigo && b.estatus === "LABORABLE"
          ? {
              ...b,
              hora_inicio_comida: actualizado.hora_inicio_comida,
              hora_fin_comida: actualizado.hora_fin_comida,
              configurada: true,
            }
          : b,
      );
      const configuradas = new Set(
        bloques.filter((b) => b.configurada && b.ho_codigo).map((b) => b.ho_codigo as string),
      );
      return { ...turno, bloques, jornadas_configuradas: configuradas.size };
    });
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
        // Las jornadas se cargan la primera vez que se abre su pestaña.
        if (
          tab === "horarios" &&
          state.turnos.jornadas.length === 0 &&
          state.turnos.panelState !== "error"
        ) {
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

      const expandBtn = target.closest<HTMLButtonElement>("[data-turno-expandir]");
      if (expandBtn) {
        const tuCodigo = expandBtn.getAttribute("data-turno-expandir") ?? "";
        if (!tuCodigo) return;
        state.turnos.expandidos = state.turnos.expandidos.includes(tuCodigo)
          ? state.turnos.expandidos.filter((c) => c !== tuCodigo)
          : [...state.turnos.expandidos, tuCodigo];
        paint();
        return;
      }

      // Desde el ciclo de un turno se salta a la fila de la jornada, en vez de abrir un
      // segundo campo para el mismo dato: la jornada se edita en un solo lugar.
      const irBtn = target.closest<HTMLButtonElement>("[data-jornada-ir]");
      if (irBtn) {
        const hoCodigo = irBtn.getAttribute("data-jornada-ir") ?? "";
        const fila = root?.querySelector<HTMLElement>(
          `[data-jornada-row="${CSS.escape(hoCodigo)}"]`,
        );
        if (!fila) return;
        fila.scrollIntoView({ behavior: "smooth", block: "center" });
        fila.querySelector<HTMLInputElement>("[data-jornada-hora-inicio]")?.focus();
        fila.classList.add("ring-2", "ring-leoni-blue/60");
        window.setTimeout(() => fila.classList.remove("ring-2", "ring-leoni-blue/60"), 2000);
        return;
      }

      if (target.closest("[data-validacion-consultar]")) {
        void consultarVentana();
        return;
      }

      const saveBtn = target.closest<HTMLButtonElement>("[data-jornada-guardar]");
      if (saveBtn) {
        const hoCodigo = saveBtn.getAttribute("data-jornada-guardar") ?? "";
        const fila = saveBtn.closest("tr");
        if (!hoCodigo || !fila || state.turnos.guardandoCodigo === hoCodigo) return;
        void guardarFila(fila, saveBtn, hoCodigo);
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

      // El formulario de validación no repinta mientras se escribe: perdería el foco.
      const validacionEmpleado = target.closest<HTMLInputElement>("[data-validacion-empleado]");
      if (validacionEmpleado) {
        state.validacion.noEmpleado = validacionEmpleado.value;
        return;
      }
      const validacionFecha = target.closest<HTMLInputElement>("[data-validacion-fecha]");
      if (validacionFecha) {
        state.validacion.fecha = validacionFecha.value;
        return;
      }

      const horaInput = target.closest<HTMLInputElement>(
        "[data-jornada-hora-inicio], [data-jornada-hora-fin]",
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
