/**
 * Sección «Días festivos» de Configuración laborales.
 *
 * Lista propia de la planta por año: renglón de alta (fecha + descripción), botón para
 * traer los festivos de ley (LFT art. 74, solo los que falten) y tabla con edición
 * inline por fila (descripción + activo). Las filas no se borran: se apagan.
 *
 * Se monta en su propio host, fuera del root que repinta la sección de Home office,
 * para que ninguna de las dos pise los cambios sin guardar de la otra.
 */

import {
  actualizarDiaFestivo,
  cargarDiasFestivosOficiales,
  crearDiaFestivo,
  getDiasFestivos,
  laboralesConfigErrorMessage,
  type DiaFestivoItem,
} from "../../api/laboralesConfig.ts";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  FIELD_FOCUS,
  RH_LISTADO_SURFACE,
  RH_TABLE_HEAD,
} from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { showEmpleadosToast } from "../empleados/toast.ts";

type PanelState = "loading" | "ready" | "error";

type State = {
  panelState: PanelState;
  anio: number;
  items: DiaFestivoItem[];
  errorMessage: string | null;
  guardandoId: number | null;
  creando: boolean;
  cargandoOficiales: boolean;
};

const TD = "px-3 py-2.5 align-middle";
const TEXT_INPUT = `w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm ${FIELD_FOCUS}`;
const SELECT = `appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pr-8 pl-2.5 text-sm text-slate-900 shadow-sm ${FIELD_FOCUS}`;
const CHEVRON = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-gray-500"><path fill-rule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" /></svg>`;

const ANIOS_ATRAS = 1;
const ANIOS_ADELANTE = 2;

function parseIsoLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatFechaLarga(iso: string): string {
  const d = parseIsoLocal(iso);
  if (!d) return iso;
  return d.toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "long" });
}

function formatFechaCorta(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "2-digit" });
}

function estadoBadge(activo: boolean): string {
  return activo
    ? `<span class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Activo</span>`
    : `<span class="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Apagado</span>`;
}

function mensajeAfectadas(n: number): string {
  if (n <= 0) return "";
  return n === 1
    ? " Hay 1 solicitud en curso o aprobada que incluye esta fecha; no se recalcula."
    : ` Hay ${n} solicitudes en curso o aprobadas que incluyen esta fecha; no se recalculan.`;
}

export function renderDiaFestivoRow(item: DiaFestivoItem, guardando: boolean): string {
  return `
    <tr data-festivo-row="${item.id}" class="${item.activo ? "" : "bg-slate-50/60"}">
      <td class="${TD}">
        <div class="flex flex-col gap-0.5">
          <span class="text-sm font-semibold tabular-nums text-text-primary">${escapeHtml(item.fecha)}</span>
          <span class="text-xs capitalize text-text-muted">${escapeHtml(formatFechaLarga(item.fecha))}</span>
        </div>
      </td>
      <td class="${TD}" data-festivo-estado>${estadoBadge(item.activo)}</td>
      <td class="${TD}">
        <input type="text" maxlength="120" value="${escapeHtml(item.descripcion)}" data-festivo-descripcion
          aria-label="Descripción del festivo ${escapeHtml(item.fecha)}" class="${TEXT_INPUT}" />
      </td>
      <td class="${TD}">
        <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" data-festivo-activo ${item.activo ? "checked" : ""}
            class="size-4 rounded border-slate-300 text-leoni-blue focus:ring-leoni-blue" />
          <span>Activo</span>
        </label>
      </td>
      <td class="${TD}">
        <div class="flex flex-col gap-0.5 text-xs text-text-muted">
          <span>${escapeHtml(formatFechaCorta(item.actualizado_en))}</span>
          ${item.actualizado_por ? `<span class="truncate">${escapeHtml(item.actualizado_por)}</span>` : ""}
        </div>
      </td>
      <td class="${TD} text-right">
        <button type="button" data-festivo-guardar="${item.id}" ${guardando ? "disabled" : ""}
          class="${BTN_SECONDARY} !px-3 !py-1.5 disabled:cursor-not-allowed disabled:opacity-60">
          ${guardando ? "Guardando…" : "Guardar"}
        </button>
      </td>
    </tr>`;
}

function renderTabla(state: State): string {
  const head = ["Fecha", "Estado", "Descripción", "", "Actualizado", ""]
    .map((h) => `<th scope="col" class="px-3 py-2.5 font-semibold">${h}</th>`)
    .join("");
  const body =
    state.items.length === 0
      ? `<tr><td colspan="6" class="px-3 py-10 text-center text-sm text-slate-500">Sin festivos capturados para ${state.anio}. Agrega uno o carga los de ley.</td></tr>`
      : state.items.map((i) => renderDiaFestivoRow(i, state.guardandoId === i.id)).join("");
  return `<div class="max-h-[62vh] overflow-auto">
      <table class="min-w-[820px] w-full text-left">
        <thead class="${RH_TABLE_HEAD}"><tr>${head}</tr></thead>
        <tbody class="divide-y divide-slate-100/90">${body}</tbody>
      </table>
    </div>`;
}

function anioOptions(seleccionado: number): string {
  const actual = new Date().getFullYear();
  const desde = Math.min(actual - ANIOS_ATRAS, seleccionado);
  const hasta = Math.max(actual + ANIOS_ADELANTE, seleccionado);
  const out: string[] = [];
  for (let a = desde; a <= hasta; a += 1) {
    out.push(`<option value="${a}" ${a === seleccionado ? "selected" : ""}>${a}</option>`);
  }
  return out.join("");
}

function renderAlta(state: State): string {
  const disabled = state.creando ? "disabled" : "";
  return `
    <form data-festivo-alta class="flex flex-wrap items-end gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3 sm:px-5" novalidate>
      <label class="flex flex-col gap-1 text-xs font-semibold text-text-secondary">
        Fecha
        <input type="date" name="fecha" required ${disabled}
          min="${state.anio}-01-01" max="${state.anio}-12-31" value=""
          class="${TEXT_INPUT} w-44 tabular-nums" />
      </label>
      <label class="flex min-w-[16rem] flex-1 flex-col gap-1 text-xs font-semibold text-text-secondary">
        Descripción
        <input type="text" name="descripcion" required maxlength="120" ${disabled}
          placeholder="p. ej. Día de la Independencia" class="${TEXT_INPUT}" />
      </label>
      <button type="submit" ${disabled} class="${BTN_PRIMARY} !px-4 !py-2 disabled:cursor-not-allowed disabled:opacity-60">
        ${state.creando ? "Agregando…" : "Agregar festivo"}
      </button>
    </form>`;
}

export function renderDiasFestivosPanel(state: State): string {
  const activos = state.items.filter((i) => i.activo).length;
  const resumen =
    state.panelState === "ready"
      ? `<span class="text-xs text-text-muted">${activos} festivo${activos === 1 ? "" : "s"} activo${activos === 1 ? "" : "s"} en ${state.anio}</span>`
      : "";
  const cuerpo =
    state.panelState === "loading"
      ? `<div class="px-3 py-10 text-center text-sm text-slate-500">Cargando festivos…</div>`
      : state.panelState === "error"
        ? `<div class="m-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
             ${escapeHtml(state.errorMessage ?? "Error al cargar.")}
             <button type="button" data-festivo-reintentar class="ml-3 font-semibold underline">Reintentar</button>
           </div>`
        : `${renderAlta(state)}${renderTabla(state)}`;
  return `
    <section class="${RH_LISTADO_SURFACE} overflow-hidden" aria-labelledby="festivos-titulo">
      <header class="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
        <div class="min-w-0">
          <h2 id="festivos-titulo" class="text-base font-semibold text-text-primary">Días festivos</h2>
          <p class="mt-0.5 text-sm text-text-secondary">
            Fechas que no se trabajan en toda la planta. No pueden ser inicio ni fin de unas
            vacaciones, no se descuentan del saldo si caen dentro del rango, y no admiten
            home office. Aplica solo a solicitudes nuevas.
          </p>
          ${resumen}
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div class="relative">
            <select data-festivo-anio aria-label="Año" class="${SELECT} w-28">${anioOptions(state.anio)}</select>
            ${CHEVRON}
          </div>
          <button type="button" data-festivo-cargar-oficiales ${state.cargandoOficiales || state.panelState !== "ready" ? "disabled" : ""}
            class="${BTN_SECONDARY} !px-3 !py-2 disabled:cursor-not-allowed disabled:opacity-60"
            title="Agrega los días de descanso obligatorio de la LFT (art. 74) que aún no estén capturados">
            ${state.cargandoOficiales ? "Cargando…" : `Cargar festivos de ley ${state.anio}`}
          </button>
        </div>
      </header>
      ${cuerpo}
    </section>`;
}

export function mountDiasFestivosSection(host: HTMLElement, signal: AbortSignal): void {
  const state: State = {
    panelState: "loading",
    anio: new Date().getFullYear(),
    items: [],
    errorMessage: null,
    guardandoId: null,
    creando: false,
    cargandoOficiales: false,
  };

  function paint(): void {
    host.innerHTML = renderDiasFestivosPanel(state);
  }

  function ordenar(): void {
    state.items.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  }

  async function load(): Promise<void> {
    state.panelState = "loading";
    state.errorMessage = null;
    paint();
    try {
      const res = await getDiasFestivos(state.anio);
      if (signal.aborted) return;
      state.items = res.items;
      state.panelState = "ready";
    } catch (error) {
      if (signal.aborted) return;
      state.items = [];
      state.panelState = "error";
      state.errorMessage = laboralesConfigErrorMessage(error, "Error al cargar los festivos.");
    }
    paint();
  }

  async function crear(form: HTMLFormElement): Promise<void> {
    if (state.creando) return;
    const fd = new FormData(form);
    const fecha = String(fd.get("fecha") ?? "").trim();
    const descripcion = String(fd.get("descripcion") ?? "").trim();
    if (!parseIsoLocal(fecha)) {
      showEmpleadosToast(host, "Indica una fecha válida.", "error");
      return;
    }
    if (!descripcion) {
      showEmpleadosToast(host, "La descripción es obligatoria.", "error");
      return;
    }
    state.creando = true;
    paint();
    try {
      const res = await crearDiaFestivo({ fecha, descripcion });
      if (signal.aborted) return;
      state.creando = false;
      if (Number.parseInt(fecha.slice(0, 4), 10) === state.anio) {
        state.items.push(res.item);
        ordenar();
      }
      paint();
      const extra = mensajeAfectadas(res.solicitudes_afectadas);
      showEmpleadosToast(
        host,
        `Festivo «${res.item.descripcion}» (${res.item.fecha}) agregado.${extra}`,
        "success",
      );
    } catch (error) {
      if (signal.aborted) return;
      state.creando = false;
      paint();
      showEmpleadosToast(
        host,
        laboralesConfigErrorMessage(error, "No se pudo agregar el festivo."),
        "error",
      );
    }
  }

  async function guardar(id: number): Promise<void> {
    if (state.guardandoId != null) return;
    const row = host.querySelector<HTMLElement>(`[data-festivo-row="${id}"]`);
    if (!row) return;
    const descEl = row.querySelector<HTMLInputElement>("[data-festivo-descripcion]");
    const activoEl = row.querySelector<HTMLInputElement>("[data-festivo-activo]");
    if (!descEl || !activoEl) return;
    const descripcion = descEl.value.trim();
    if (!descripcion) {
      showEmpleadosToast(host, "La descripción es obligatoria.", "error");
      descEl.focus();
      return;
    }
    state.guardandoId = id;
    const btn = row.querySelector<HTMLButtonElement>("[data-festivo-guardar]");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Guardando…";
    }
    try {
      const res = await actualizarDiaFestivo(id, { descripcion, activo: activoEl.checked });
      if (signal.aborted) return;
      const idx = state.items.findIndex((i) => i.id === id);
      if (idx >= 0) state.items[idx] = res.item;
      state.guardandoId = null;
      // Solo esta fila: las demás pueden tener cambios sin guardar.
      row.outerHTML = renderDiaFestivoRow(res.item, false);
      const extra = mensajeAfectadas(res.solicitudes_afectadas);
      showEmpleadosToast(
        host,
        `Festivo ${res.item.fecha} guardado.${extra}`,
        "success",
      );
    } catch (error) {
      if (signal.aborted) return;
      state.guardandoId = null;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Guardar";
      }
      showEmpleadosToast(
        host,
        laboralesConfigErrorMessage(error, "No se pudo guardar el festivo."),
        "error",
      );
    }
  }

  async function cargarOficiales(): Promise<void> {
    if (state.cargandoOficiales || state.panelState !== "ready") return;
    state.cargandoOficiales = true;
    paint();
    try {
      const res = await cargarDiasFestivosOficiales(state.anio);
      if (signal.aborted) return;
      state.cargandoOficiales = false;
      state.items.push(...res.agregados);
      ordenar();
      paint();
      const n = res.agregados.length;
      showEmpleadosToast(
        host,
        n === 0
          ? `Los festivos de ley de ${state.anio} ya estaban capturados.`
          : `Se agregaron ${n} festivo${n === 1 ? "" : "s"} de ley de ${state.anio}${
              res.omitidos ? ` (${res.omitidos} ya existían)` : ""
            }. Revisa y ajusta los que la planta no aplique.`,
        "success",
      );
    } catch (error) {
      if (signal.aborted) return;
      state.cargandoOficiales = false;
      paint();
      showEmpleadosToast(
        host,
        laboralesConfigErrorMessage(error, "No se pudieron cargar los festivos de ley."),
        "error",
      );
    }
  }

  host.addEventListener(
    "click",
    (ev) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      const guardarBtn = target.closest<HTMLElement>("[data-festivo-guardar]");
      if (guardarBtn) {
        const id = Number.parseInt(guardarBtn.getAttribute("data-festivo-guardar") ?? "", 10);
        if (Number.isInteger(id)) void guardar(id);
        return;
      }
      if (target.closest("[data-festivo-cargar-oficiales]")) {
        void cargarOficiales();
        return;
      }
      if (target.closest("[data-festivo-reintentar]")) void load();
    },
    { signal },
  );

  host.addEventListener(
    "submit",
    (ev) => {
      const form = ev.target as HTMLElement | null;
      if (!form?.matches("[data-festivo-alta]")) return;
      ev.preventDefault();
      void crear(form as HTMLFormElement);
    },
    { signal },
  );

  host.addEventListener(
    "change",
    (ev) => {
      const target = ev.target as HTMLElement | null;
      if (!target?.matches("[data-festivo-anio]")) return;
      const anio = Number.parseInt((target as HTMLSelectElement).value, 10);
      if (!Number.isInteger(anio) || anio === state.anio) return;
      state.anio = anio;
      void load();
    },
    { signal },
  );

  void load();
}
