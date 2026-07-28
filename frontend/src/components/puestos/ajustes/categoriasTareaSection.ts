/** Seccion de Ajustes para el catalogo de categorias de tarea. */

import {
  createCategoriaTarea,
  deleteCategoriaTarea,
  getCategoriasTarea,
  updateCategoriaTarea,
} from "../../../api/categoriasTarea.ts";
import type { CategoriaTarea } from "../../../dashboard/categoriasTarea/types.ts";
import { AJUSTES_ICON_TYPE } from "./ajustesSectionUi.ts";
import { mountCatalogoSection } from "./catalogoSection.ts";

export function mountCategoriasTareaSection(
  sectionEl: HTMLElement,
  signal: AbortSignal,
): void {
  mountCatalogoSection<CategoriaTarea>(sectionEl, signal, {
    key: "categoria-tarea",
    titleId: "categorias-tarea-section-title",
    title: "Categorías de tarea",
    description:
      "Clasifican las responsabilidades del puesto. Sustituyen al texto libre que se capturaba antes en el catálogo de tareas.",
    iconHtml: AJUSTES_ICON_TYPE,
    singular: "categoría",
    emptyMessage: "No hay categorías de tarea registradas. Crea la primera.",
    columnas: [{ header: "Nombre", valor: (i) => i.nombre, clase: "font-medium" }],
    campos: [{ tipo: "texto", name: "nombre", label: "Nombre", minLength: 2, maxLength: 100 }],
    valoresNuevo: () => ({ nombre: "" }),
    valoresEdicion: (i) => ({ nombre: i.nombre }),
    etiqueta: (i) => i.nombre,
    cargar: () => getCategoriasTarea(),
    crear: (v) => createCategoriaTarea({ nombre: v.nombre }),
    actualizar: (id, v) => updateCategoriaTarea(id, { nombre: v.nombre }),
    eliminar: deleteCategoriaTarea,
    validar: (v) =>
      v.nombre.length < 2 ? "El nombre debe tener al menos 2 caracteres." : null,
  });
}
