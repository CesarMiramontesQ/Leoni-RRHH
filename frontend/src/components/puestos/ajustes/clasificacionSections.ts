/**
 * Secciones de Ajustes para los catalogos de clasificacion de puesto (WTW):
 * Career Paths, Funciones y Disciplinas.
 *
 * Cada una solo declara sus columnas, campos y API; el comportamiento comun
 * (tabla, modal de alta/edicion, borrado) vive en `catalogoSection.ts`.
 */

import {
  createCareerPath,
  createDisciplinaPuesto,
  createFuncionPuesto,
  deleteCareerPath,
  deleteDisciplinaPuesto,
  deleteFuncionPuesto,
  getCareerPaths,
  getDisciplinasPuesto,
  getFuncionesPuesto,
  updateCareerPath,
  updateDisciplinaPuesto,
  updateFuncionPuesto,
} from "../../../api/clasificacionPuesto.ts";
import type {
  CareerPath,
  DisciplinaPuesto,
  FuncionPuesto,
} from "../../../dashboard/clasificacionPuesto/types.ts";
import {
  AJUSTES_ICON_GRADES,
  AJUSTES_ICON_GROUP,
  AJUSTES_ICON_TYPE,
} from "./ajustesSectionUi.ts";
import { mountCatalogoSection } from "./catalogoSection.ts";

/**
 * Cambios en funciones o career paths invalidan lo que muestran otras pantallas
 * (el select de disciplinas, los filtros del listado de perfiles).
 */
export const AJUSTES_CLASIFICACION_CHANGED = "ajustes:clasificacion-changed";

export function notifyAjustesClasificacionChanged(): void {
  document.dispatchEvent(new CustomEvent(AJUSTES_CLASIFICACION_CHANGED));
}

export function mountCareerPathsSection(sectionEl: HTMLElement, signal: AbortSignal): void {
  mountCatalogoSection<CareerPath>(sectionEl, signal, {
    key: "career-path",
    titleId: "career-paths-section-title",
    title: "Career paths",
    description:
      "Trayectorias de la clasificación Towers Watson. El código es el prefijo del career level: P → P10, M → M3. Son alternativas, no una escala: quien ordena es el global grade.",
    iconHtml: AJUSTES_ICON_GRADES,
    singular: "career path",
    emptyMessage: "No hay career paths registrados. Crea Professional y Management para empezar.",
    columnas: [
      { header: "Código", valor: (i) => i.codigo, clase: "font-medium" },
      { header: "Nombre", valor: (i) => i.nombre },
    ],
    campos: [
      {
        tipo: "texto",
        name: "codigo",
        label: "Código",
        maxLength: 10,
        ancho: "medio",
        hint: "Prefijo del career level (P, M).",
      },
      {
        tipo: "texto",
        name: "nombre",
        label: "Nombre",
        minLength: 2,
        maxLength: 100,
        ancho: "medio",
      },
    ],
    valoresNuevo: () => ({ codigo: "", nombre: "" }),
    valoresEdicion: (i) => ({ codigo: i.codigo, nombre: i.nombre }),
    etiqueta: (i) => `${i.nombre} (${i.codigo})`,
    cargar: () => getCareerPaths(),
    crear: (v) => createCareerPath({ codigo: v.codigo, nombre: v.nombre }),
    actualizar: (id, v) => updateCareerPath(id, { codigo: v.codigo, nombre: v.nombre }),
    eliminar: deleteCareerPath,
    validar: (v) => {
      if (!v.codigo) return "El código es obligatorio.";
      if (v.nombre.length < 2) return "El nombre debe tener al menos 2 caracteres.";
      return null;
    },
    alCambiar: notifyAjustesClasificacionChanged,
  });
}

export function mountFuncionesSection(sectionEl: HTMLElement, signal: AbortSignal): void {
  mountCatalogoSection<FuncionPuesto>(sectionEl, signal, {
    key: "funcion-puesto",
    titleId: "funciones-section-title",
    title: "Funciones",
    description:
      "Familias de puesto de la clasificación (Ingeniería, Calidad, Recursos Humanos…). Cada disciplina cuelga de una función.",
    iconHtml: AJUSTES_ICON_GROUP,
    singular: "función",
    emptyMessage: "No hay funciones registradas. Crea la primera.",
    columnas: [
      { header: "Código", valor: (i) => i.codigo, clase: "font-medium" },
      { header: "Nombre", valor: (i) => i.nombre },
    ],
    campos: [
      { tipo: "texto", name: "codigo", label: "Código", maxLength: 20, ancho: "medio" },
      {
        tipo: "texto",
        name: "nombre",
        label: "Nombre",
        minLength: 2,
        maxLength: 100,
        ancho: "medio",
      },
    ],
    valoresNuevo: () => ({ codigo: "", nombre: "" }),
    valoresEdicion: (i) => ({ codigo: i.codigo, nombre: i.nombre }),
    etiqueta: (i) => `${i.nombre} (${i.codigo})`,
    cargar: () => getFuncionesPuesto(),
    crear: (v) => createFuncionPuesto({ codigo: v.codigo, nombre: v.nombre }),
    actualizar: (id, v) => updateFuncionPuesto(id, { codigo: v.codigo, nombre: v.nombre }),
    eliminar: deleteFuncionPuesto,
    validar: (v) => {
      if (!v.codigo) return "El código es obligatorio.";
      if (v.nombre.length < 2) return "El nombre debe tener al menos 2 caracteres.";
      return null;
    },
    alCambiar: notifyAjustesClasificacionChanged,
  });
}

export function mountDisciplinasSection(sectionEl: HTMLElement, signal: AbortSignal): void {
  let funciones: FuncionPuesto[] = [];

  const seccion = mountCatalogoSection<DisciplinaPuesto>(sectionEl, signal, {
    key: "disciplina-puesto",
    titleId: "disciplinas-section-title",
    title: "Disciplinas",
    description:
      "Especialidad dentro de una función (Ingeniería → Automatización, RH → Compensation).",
    iconHtml: AJUSTES_ICON_TYPE,
    singular: "disciplina",
    emptyMessage: "No hay disciplinas registradas. Crea la primera.",
    bloqueo: () =>
      funciones.length === 0
        ? "Primero crea una función: toda disciplina pertenece a una."
        : null,
    columnas: [
      { header: "Nombre", valor: (i) => i.nombre, clase: "font-medium" },
      { header: "Función", valor: (i) => i.funcion_nombre ?? "—", clase: "text-text-secondary" },
      { header: "Código", valor: (i) => i.codigo ?? "—", clase: "text-text-secondary" },
    ],
    campos: [
      {
        tipo: "select",
        name: "funcion_id",
        label: "Función",
        opciones: () => funciones.map((f) => ({ value: String(f.id), label: f.nombre })),
      },
      { tipo: "texto", name: "nombre", label: "Nombre", minLength: 2, maxLength: 100 },
      {
        tipo: "texto",
        name: "codigo",
        label: "Código",
        maxLength: 20,
        requerido: false,
        hint: "Opcional.",
      },
    ],
    valoresNuevo: () => ({
      funcion_id: funciones[0] ? String(funciones[0].id) : "",
      nombre: "",
      codigo: "",
    }),
    valoresEdicion: (i) => ({
      funcion_id: String(i.funcion_id),
      nombre: i.nombre,
      codigo: i.codigo ?? "",
    }),
    etiqueta: (i) => i.nombre,
    cargar: async () => {
      // Las funciones se recargan junto con las disciplinas: el select depende
      // de ellas y la seccion de Funciones puede haber cambiado en paralelo.
      const [disciplinas, fns] = await Promise.all([
        getDisciplinasPuesto(),
        getFuncionesPuesto(),
      ]);
      funciones = fns;
      return disciplinas;
    },
    crear: (v) =>
      createDisciplinaPuesto({
        funcion_id: Number(v.funcion_id),
        nombre: v.nombre,
        codigo: v.codigo || null,
      }),
    actualizar: (id, v) =>
      updateDisciplinaPuesto(id, {
        funcion_id: Number(v.funcion_id),
        nombre: v.nombre,
        codigo: v.codigo || null,
      }),
    eliminar: deleteDisciplinaPuesto,
    validar: (v) => {
      if (!Number(v.funcion_id)) return "Selecciona una función.";
      if (v.nombre.length < 2) return "El nombre debe tener al menos 2 caracteres.";
      return null;
    },
  });

  // Si RH da de alta una funcion en la card de arriba, el select de aqui debe
  // enterarse sin recargar la pagina.
  document.addEventListener(
    AJUSTES_CLASIFICACION_CHANGED,
    () => void seccion.recargar(),
    { signal },
  );
}
