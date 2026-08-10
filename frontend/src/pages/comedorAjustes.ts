/**
 * Ajustes Comedor (`#/comedor/ajustes`): horario de comida por turno.
 *
 * La lista de turnos sale de `levelup_turnos` (réplica del catálogo de TRESS) y el
 * horario se guarda fila por fila. El acceso lo decide `canAccessComedorAjustesPage`
 * en `mountComedor`; aquí no hay compuerta propia.
 */

import {
  comedorErrorMessage,
  getComedorTurnosHorario,
  guardarComedorTurnoHorario,
  type ComedorTurnoHorarioApi,
} from "../api/comedor.ts";
import {
  renderComedorAjustesTurnos,
  type ComedorAjustesTurnosViewState,
} from "../components/comedor/comedorAjustesTurnos.ts";
import { showEmpleadosToast } from "../components/empleados/toast.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { renderComedorBackBar } from "../navigation/comedorBackLink.ts";

const ROOT_ID = "comedor-ajustes-root";

export function mountComedorAjustes(container: HTMLElement, signal: AbortSignal): void {
  const state: ComedorAjustesTurnosViewState = {
    panelState: "loading",
    items: [],
    incluirInactivos: false,
    guardandoCodigo: null,
    errorMessage: null,
  };

  function paint(): void {
    const root = container.querySelector<HTMLElement>(`#${ROOT_ID}`);
    if (!root) return;
    root.innerHTML = renderComedorAjustesTurnos(state);
  }

  async function loadTurnos(): Promise<void> {
    state.panelState = "loading";
    state.errorMessage = null;
    paint();
    try {
      const rows = await getComedorTurnosHorario(state.incluirInactivos);
      if (signal.aborted) return;
      state.items = rows;
      state.panelState = rows.length > 0 ? "ready" : "empty";
    } catch (error) {
      if (signal.aborted) return;
      state.items = [];
      state.panelState = "error";
      state.errorMessage = comedorErrorMessage(error, "Error al cargar turnos.");
    }
    paint();
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
      showEmpleadosToast(
        container,
        "La hora de inicio debe ser menor que la hora de fin.",
        "error",
      );
      return;
    }

    // Se toca solo esta fila en el DOM en vez de repintar la tabla: un repintado
    // descartaría lo que el usuario ya escribió en las demás filas sin guardar.
    state.guardandoCodigo = tuCodigo;
    boton.disabled = true;
    boton.textContent = "Guardando…";
    try {
      const actualizado = await guardarComedorTurnoHorario(tuCodigo, {
        horaInicioComida: inicio,
        horaFinComida: fin,
      });
      if (signal.aborted) return;
      aplicarActualizacion(actualizado, inputInicio, inputFin);
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
        state.guardandoCodigo = null;
        boton.disabled = false;
        boton.textContent = "Guardar";
      }
    }
  }

  /** Refleja lo que devolvió el servidor en el estado y en la fila, sin recargar la tabla. */
  function aplicarActualizacion(
    actualizado: ComedorTurnoHorarioApi,
    inputInicio: HTMLInputElement | null,
    inputFin: HTMLInputElement | null,
  ): void {
    state.items = state.items.map((item) =>
      item.tu_codigo === actualizado.tu_codigo ? actualizado : item,
    );
    if (inputInicio) inputInicio.value = (actualizado.hora_inicio_comida ?? "").slice(0, 5);
    if (inputFin) inputFin.value = (actualizado.hora_fin_comida ?? "").slice(0, 5);
  }

  mountAppShell(container, {
    pageTitle: "Ajustes Comedor",
    activeNav: "comedor-ajustes",
    mainClass: "py-5 sm:py-6",
    mainHtml: `${renderComedorBackBar()}<div id="${ROOT_ID}">${renderComedorAjustesTurnos(state)}</div>`,
  });

  const root = container.querySelector<HTMLElement>(`#${ROOT_ID}`);

  root?.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-turnos-retry]")) {
        void loadTurnos();
        return;
      }
      const saveBtn = target.closest<HTMLButtonElement>("[data-turno-guardar]");
      if (saveBtn) {
        const tuCodigo = saveBtn.getAttribute("data-turno-guardar") ?? "";
        const fila = saveBtn.closest("tr");
        if (!tuCodigo || !fila || state.guardandoCodigo === tuCodigo) return;
        void guardarFila(fila, saveBtn, tuCodigo);
      }
    },
    { signal },
  );

  root?.addEventListener(
    "change",
    (event) => {
      const target = event.target as HTMLElement;
      const toggle = target.closest<HTMLInputElement>("[data-turnos-incluir-inactivos]");
      if (!toggle) return;
      state.incluirInactivos = toggle.checked;
      void loadTurnos();
    },
    { signal },
  );

  void loadTurnos();
}
