/**
 * Seccion generica de catalogo para la pantalla de Ajustes de perfiles de puesto.
 *
 * Todos los catalogos del modulo son la misma pantalla: tabla + alta/edicion en
 * modal + borrado con confirmacion, sobre un CRUD de 4 endpoints. Este modulo
 * concentra ese comportamiento para que cada catalogo solo declare sus columnas,
 * sus campos y su API.
 *
 * No inventa estilos: todo sale de `ajustesSectionUi.ts` y de `uiTokens.ts`.
 */

import { escapeHtml } from "../../../ui/uiUtils.ts";
import {
  BTN_DANGER,
  FIELD_FOCUS,
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_BTN_SECONDARY,
  RH_LISTADO_LABEL,
  RH_LISTADO_SELECT,
  SELECT_CHEVRON,
} from "../../../ui/uiTokens.ts";
import {
  AJUSTES_ICON_EDIT,
  AJUSTES_ICON_PLUS,
  AJUSTES_ICON_TRASH,
  AJUSTES_INPUT,
  AJUSTES_MODAL_OVERLAY,
  AJUSTES_MODAL_PANEL,
  AJUSTES_ROW_BTN_DELETE,
  AJUSTES_ROW_BTN_EDIT,
  AJUSTES_TABLE_TD,
  AJUSTES_TABLE_TD_ACTIONS,
  AJUSTES_TABLE_TH,
  ajustesCountBadge,
  ajustesEmptyState,
  ajustesErrorAlert,
  ajustesLoadingState,
  ajustesModalError,
  ajustesSectionCard,
  ajustesTableWrap,
} from "./ajustesSectionUi.ts";

export type CatalogoItem = { id: number };

export type CatalogoOpcion = { value: string; label: string };

type CampoBase = {
  name: string;
  label: string;
  hint?: string;
  /** Los campos "medio" se emparejan de a dos en pantallas anchas. */
  ancho?: "full" | "medio";
};

export type CatalogoCampo =
  | (CampoBase & { tipo: "texto"; minLength?: number; maxLength?: number; requerido?: boolean })
  | (CampoBase & { tipo: "numero"; min?: number; max?: number; requerido?: boolean })
  | (CampoBase & { tipo: "select"; opciones: () => CatalogoOpcion[]; requerido?: boolean });

export type CatalogoColumna<T> = {
  header: string;
  /** Devuelve texto plano; el componente lo escapa. */
  valor: (item: T) => string;
  clase?: string;
};

export type CatalogoSectionConfig<T extends CatalogoItem> = {
  /** Prefijo de los data-attributes y de los ids del DOM. Kebab-case. */
  key: string;
  title: string;
  titleId: string;
  description: string;
  iconHtml: string;
  /** Sustantivo en singular para botones y titulos: "career path". */
  singular: string;
  emptyMessage: string;
  /** Mensaje que reemplaza a la tabla cuando falta un requisito previo. */
  bloqueo?: () => string | null;
  columnas: CatalogoColumna<T>[];
  campos: CatalogoCampo[];
  /** Valores iniciales del formulario de alta. */
  valoresNuevo: () => Record<string, string>;
  /** Valores del formulario al editar un item. */
  valoresEdicion: (item: T) => Record<string, string>;
  /** Etiqueta del item en el modal de borrado. */
  etiqueta: (item: T) => string;
  cargar: () => Promise<T[]>;
  crear: (valores: Record<string, string>) => Promise<unknown>;
  actualizar: (id: number, valores: Record<string, string>) => Promise<unknown>;
  eliminar: (id: number) => Promise<void>;
  /** Validacion previa al envio; devuelve el mensaje de error o null. */
  validar?: (valores: Record<string, string>) => string | null;
  /** Se ejecuta tras cualquier alta, edicion o borrado con exito. */
  alCambiar?: () => void;
};

/**
 * A partir de cuantas filas aparece el buscador de la card.
 *
 * Por debajo de esto la tabla se recorre de un vistazo y el campo solo robaria
 * espacio; por encima, la altura esta acotada y el scroll no deberia ser la
 * unica forma de llegar a una fila.
 */
const FILAS_PARA_BUSCADOR = 8;

type ModalMode = "create" | "edit" | "delete" | null;

function detalleError(e: unknown, fallback: string): string {
  if (typeof e === "object" && e !== null) {
    const d = (e as { detail?: unknown }).detail;
    if (typeof d === "string" && d.trim()) return d.trim();
  }
  return fallback;
}

export function mountCatalogoSection<T extends CatalogoItem>(
  sectionEl: HTMLElement,
  signal: AbortSignal,
  config: CatalogoSectionConfig<T>,
): { recargar: () => Promise<void> } {
  const attr = `data-${config.key}-action`;
  const attrFiltro = `data-${config.key}-filtro`;
  const attrModal = `data-${config.key}-modal`;
  // dataset normaliza kebab-case a camelCase: data-career-path-action -> careerPathAction
  const dsAction = `${config.key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())}Action`;
  const dsModal = `${config.key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())}Modal`;

  let items: T[] = [];
  let loading = true;
  let error = "";
  let modalMode: ModalMode = null;
  let modalSaving = false;
  let editingId: number | null = null;
  let valores: Record<string, string> = {};
  let deletingItem: T | null = null;
  let modalError = "";
  let filtro = "";

  /** Filas visibles: filtra por el texto de las columnas ya renderizadas. */
  function itemsVisibles(): T[] {
    const q = filtro.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      config.columnas.some((c) => c.valor(item).toLowerCase().includes(q)),
    );
  }

  function renderBuscador(): string {
    if (items.length < FILAS_PARA_BUSCADOR) return "";
    return `<div class="border-b border-slate-100 px-4 py-2.5 sm:px-5">
      <label for="${config.key}-filtro" class="sr-only">Buscar ${escapeHtml(config.singular)}</label>
      <input id="${config.key}-filtro" type="search" ${attrFiltro}
        value="${escapeHtml(filtro)}" autocomplete="off"
        placeholder="Buscar entre ${items.length}…"
        class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted ${FIELD_FOCUS}" />
    </div>`;
  }

  const botonNuevo = (extraClase = "") =>
    `<button type="button" ${attr}="create" class="${RH_LISTADO_BTN_PRIMARY} ${extraClase}">${AJUSTES_ICON_PLUS}<span>Nuevo ${escapeHtml(config.singular)}</span></button>`;

  function renderTable(): string {
    if (loading) return ajustesLoadingState(`Cargando ${config.singular}s…`);
    if (error) return ajustesErrorAlert(error);

    const bloqueo = config.bloqueo?.();
    if (bloqueo) return ajustesEmptyState(bloqueo);

    if (items.length === 0) return ajustesEmptyState(config.emptyMessage, botonNuevo());

    const visibles = itemsVisibles();
    if (visibles.length === 0) {
      return (
        renderBuscador() +
        ajustesEmptyState(`Ningún resultado para “${filtro.trim()}”.`)
      );
    }

    const encabezados = config.columnas
      .map((c) => `<th scope="col" class="${AJUSTES_TABLE_TH}">${escapeHtml(c.header)}</th>`)
      .join("");
    const filas = visibles
      .map((item) => {
        const celdas = config.columnas
          .map(
            (c) =>
              `<td class="${AJUSTES_TABLE_TD} ${c.clase ?? ""}">${escapeHtml(c.valor(item))}</td>`,
          )
          .join("");
        return `
      <tr class="border-b border-slate-100/90">
        ${celdas}
        <td class="${AJUSTES_TABLE_TD_ACTIONS}">
          <div class="flex items-center justify-end gap-1">
            <button type="button" ${attr}="edit" data-id="${item.id}" class="${AJUSTES_ROW_BTN_EDIT}" title="Editar">${AJUSTES_ICON_EDIT}</button>
            <button type="button" ${attr}="delete" data-id="${item.id}" class="${AJUSTES_ROW_BTN_DELETE}" title="Eliminar">${AJUSTES_ICON_TRASH}</button>
          </div>
        </td>
      </tr>`;
      })
      .join("");

    return (
      renderBuscador() +
      ajustesTableWrap(`
        <table class="min-w-full text-left">
          <thead>
            <tr class="border-b border-slate-100">
              ${encabezados}
              <th scope="col" class="${AJUSTES_TABLE_TD_ACTIONS} ${AJUSTES_TABLE_TH}"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>`)
    );
  }

  function renderCampo(campo: CatalogoCampo): string {
    const id = `${config.key}-campo-${campo.name}`;
    const valor = valores[campo.name] ?? "";
    const requerido = campo.requerido !== false;
    const marca = requerido ? ` <span class="text-red-600">*</span>` : "";
    const hint = campo.hint
      ? `<p class="mt-1 text-xs text-text-muted">${escapeHtml(campo.hint)}</p>`
      : "";

    let control: string;
    if (campo.tipo === "select") {
      const opciones = campo
        .opciones()
        .map(
          (o) =>
            `<option value="${escapeHtml(o.value)}" ${o.value === valor ? "selected" : ""}>${escapeHtml(o.label)}</option>`,
        )
        .join("");
      control = `<div class="relative">
          <select id="${id}" name="${escapeHtml(campo.name)}" ${requerido ? "required" : ""} class="${RH_LISTADO_SELECT}">${opciones}</select>
          ${SELECT_CHEVRON}
        </div>`;
    } else if (campo.tipo === "numero") {
      control = `<input id="${id}" name="${escapeHtml(campo.name)}" type="number" ${requerido ? "required" : ""}
          ${campo.min != null ? `min="${campo.min}"` : ""} ${campo.max != null ? `max="${campo.max}"` : ""}
          value="${escapeHtml(valor)}" class="${AJUSTES_INPUT}" />`;
    } else {
      control = `<input id="${id}" name="${escapeHtml(campo.name)}" type="text" ${requerido ? "required" : ""}
          ${campo.minLength != null ? `minlength="${campo.minLength}"` : ""}
          ${campo.maxLength != null ? `maxlength="${campo.maxLength}"` : ""}
          value="${escapeHtml(valor)}" class="${AJUSTES_INPUT}" />`;
    }

    return `<div>
        <label for="${id}" class="${RH_LISTADO_LABEL}">${escapeHtml(campo.label)}${marca}</label>
        ${control}
        ${hint}
      </div>`;
  }

  function renderCampos(): string {
    const bloques: string[] = [];
    let i = 0;
    while (i < config.campos.length) {
      const campo = config.campos[i];
      const siguiente = config.campos[i + 1];
      if (campo.ancho === "medio" && siguiente?.ancho === "medio") {
        bloques.push(
          `<div class="grid gap-4 sm:grid-cols-2">${renderCampo(campo)}${renderCampo(siguiente)}</div>`,
        );
        i += 2;
      } else {
        bloques.push(renderCampo(campo));
        i += 1;
      }
    }
    return bloques.join("");
  }

  function renderModal(): string {
    if (!modalMode) return "";
    if (modalMode === "delete" && deletingItem) {
      return `
        <div class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
          <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true" aria-labelledby="${config.key}-delete-title">
            <h3 id="${config.key}-delete-title" class="text-lg font-semibold text-text-primary">Eliminar ${escapeHtml(config.singular)}</h3>
            <p class="mt-2 text-sm text-text-secondary">¿Eliminar <strong>${escapeHtml(config.etiqueta(deletingItem))}</strong>? No podrás eliminarlo si algo lo está usando.</p>
            ${modalError ? ajustesModalError(modalError) : ""}
            <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" ${attrModal}="cancel" class="${RH_LISTADO_BTN_SECONDARY}">Cancelar</button>
              <button type="button" ${attrModal}="confirm-delete" class="${BTN_DANGER}" ${modalSaving ? "disabled" : ""}>${modalSaving ? "Eliminando…" : "Eliminar"}</button>
            </div>
          </div>
        </div>`;
    }
    const title = `${modalMode === "create" ? "Nuevo" : "Editar"} ${config.singular}`;
    return `
      <div class="${AJUSTES_MODAL_OVERLAY}" role="presentation">
        <div class="${AJUSTES_MODAL_PANEL}" role="dialog" aria-modal="true" aria-labelledby="${config.key}-form-title">
          <h3 id="${config.key}-form-title" class="text-lg font-semibold text-text-primary">${escapeHtml(title)}</h3>
          <form id="${config.key}-form" class="mt-4 space-y-4">
            ${renderCampos()}
            ${modalError ? ajustesModalError(modalError) : ""}
            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" ${attrModal}="cancel" class="${RH_LISTADO_BTN_SECONDARY}">Cancelar</button>
              <button type="submit" class="${RH_LISTADO_BTN_PRIMARY}" ${modalSaving ? "disabled" : ""}>${modalSaving ? "Guardando…" : "Guardar"}</button>
            </div>
          </form>
        </div>
      </div>`;
  }

  function paint(): void {
    const bloqueado = !loading && !error && Boolean(config.bloqueo?.());
    sectionEl.innerHTML =
      ajustesSectionCard({
        titleId: config.titleId,
        title: config.title,
        description: config.description,
        iconHtml: config.iconHtml,
        badgeHtml: loading ? ajustesCountBadge(0, true) : ajustesCountBadge(items.length),
        actionButtonHtml: bloqueado ? "" : botonNuevo("shrink-0"),
        bodyHtml: `<div data-catalogo-body>${renderTable()}</div>`,
      }) + renderModal();
  }

  async function load(): Promise<void> {
    loading = true;
    error = "";
    paint();
    try {
      items = await config.cargar();
      loading = false;
      paint();
    } catch (e) {
      loading = false;
      error = detalleError(e, `No se pudieron cargar los ${config.singular}s.`);
      paint();
    }
  }

  function closeModal(): void {
    modalMode = null;
    editingId = null;
    valores = {};
    deletingItem = null;
    modalError = "";
    modalSaving = false;
    paint();
  }

  /** Conserva lo ya escrito al repintar el modal (p. ej. al cambiar un select). */
  function capturarFormulario(): void {
    const form = sectionEl.querySelector<HTMLFormElement>(`#${config.key}-form`);
    if (!form) return;
    const fd = new FormData(form);
    for (const campo of config.campos) {
      valores[campo.name] = String(fd.get(campo.name) ?? "");
    }
  }

  sectionEl.addEventListener(
    "click",
    (ev) => {
      const t = ev.target as HTMLElement;
      const btn = t.closest(`[${attr}]`) as HTMLElement | null;
      if (!btn) {
        const modalBtn = t.closest(`[${attrModal}]`) as HTMLElement | null;
        const accion = modalBtn?.dataset[dsModal];
        if (accion === "cancel") closeModal();
        if (accion === "confirm-delete") void confirmDelete();
        return;
      }
      const action = btn.dataset[dsAction];
      const id = Number(btn.dataset.id);
      if (action === "create") {
        if (config.bloqueo?.()) return;
        modalMode = "create";
        editingId = null;
        valores = config.valoresNuevo();
        modalError = "";
        paint();
        sectionEl
          .querySelector<HTMLElement>(`#${config.key}-form input, #${config.key}-form select`)
          ?.focus();
      } else if (action === "edit" && !Number.isNaN(id)) {
        const item = items.find((i) => i.id === id);
        if (!item) return;
        modalMode = "edit";
        editingId = id;
        valores = config.valoresEdicion(item);
        modalError = "";
        paint();
      } else if (action === "delete" && !Number.isNaN(id)) {
        deletingItem = items.find((i) => i.id === id) ?? null;
        if (!deletingItem) return;
        modalMode = "delete";
        modalError = "";
        paint();
      }
    },
    { signal },
  );

  sectionEl.addEventListener(
    "change",
    (ev) => {
      const select = (ev.target as HTMLElement).closest("select") as HTMLSelectElement | null;
      if (!select || !modalMode || modalMode === "delete") return;
      capturarFormulario();
      paint();
    },
    { signal },
  );

  sectionEl.addEventListener(
    "input",
    (ev) => {
      const input = (ev.target as HTMLElement).closest(
        `[${attrFiltro}]`,
      ) as HTMLInputElement | null;
      if (!input) return;
      filtro = input.value;
      // Se repinta solo el cuerpo: un `paint()` completo recrearia el input y
      // el foco saltaria al primer caracter escrito.
      const cuerpo = sectionEl.querySelector<HTMLElement>("[data-catalogo-body]");
      const scroll = cuerpo?.querySelector<HTMLElement>(".ajustes-table-scroll");
      if (!cuerpo) return;
      const seguiaEnfocado = document.activeElement === input;
      cuerpo.innerHTML = renderTable();
      if (scroll) scroll.scrollTop = 0;
      if (seguiaEnfocado) {
        const nuevo = sectionEl.querySelector<HTMLInputElement>(`[${attrFiltro}]`);
        nuevo?.focus();
        nuevo?.setSelectionRange(nuevo.value.length, nuevo.value.length);
      }
    },
    { signal },
  );

  sectionEl.addEventListener(
    "submit",
    (ev) => {
      const form = (ev.target as HTMLElement).closest(`#${config.key}-form`);
      if (!form) return;
      ev.preventDefault();
      void submitForm(form as HTMLFormElement);
    },
    { signal },
  );

  async function submitForm(form: HTMLFormElement): Promise<void> {
    const fd = new FormData(form);
    const enviados: Record<string, string> = {};
    for (const campo of config.campos) {
      enviados[campo.name] = String(fd.get(campo.name) ?? "").trim();
    }

    const invalido = config.validar?.(enviados);
    if (invalido) {
      valores = enviados;
      modalError = invalido;
      paint();
      return;
    }

    valores = enviados;
    modalSaving = true;
    modalError = "";
    paint();
    try {
      if (modalMode === "create") {
        await config.crear(enviados);
      } else if (modalMode === "edit" && editingId != null) {
        await config.actualizar(editingId, enviados);
      }
      closeModal();
      await load();
      config.alCambiar?.();
    } catch (e) {
      modalSaving = false;
      modalError = detalleError(e, "Error al guardar.");
      paint();
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deletingItem) return;
    modalSaving = true;
    modalError = "";
    paint();
    try {
      await config.eliminar(deletingItem.id);
      closeModal();
      await load();
      config.alCambiar?.();
    } catch (e) {
      modalSaving = false;
      modalError = detalleError(e, "No se pudo eliminar.");
      paint();
    }
  }

  void load();

  return { recargar: load };
}
