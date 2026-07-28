/**
 * Secciones de Ajustes del Global Grade: el catálogo y las equivalencias
 * Career Level ↔ Global Grade.
 *
 * El Global Grade clasifica el puesto dentro de la estructura organizacional.
 * No expresa sueldo, banda salarial ni compensación.
 */

import {
  createEquivalencia,
  createGlobalGrade,
  deleteEquivalencia,
  deleteGlobalGrade,
  getEquivalencias,
  getGlobalGrades,
  updateEquivalencia,
  updateGlobalGrade,
} from "../../../api/clasificacionPuesto.ts";
import { getGradosPuesto } from "../../../api/gradosPuesto.ts";
import type {
  Equivalencia,
  GlobalGrade,
} from "../../../dashboard/clasificacionPuesto/types.ts";
import type { GradoPuesto } from "../../../dashboard/gradosPuesto/types.ts";
import { AJUSTES_ICON_SCALE, AJUSTES_ICON_TYPE } from "./ajustesSectionUi.ts";
import { mountCatalogoSection } from "./catalogoSection.ts";
import { AJUSTES_CLASIFICACION_CHANGED } from "./clasificacionSections.ts";

/** Se emite al cambiar el catálogo de global grades: las equivalencias dependen de él. */
export const AJUSTES_GLOBAL_GRADES_CHANGED = "ajustes:global-grades-changed";

function notifyGlobalGradesChanged(): void {
  document.dispatchEvent(new CustomEvent(AJUSTES_GLOBAL_GRADES_CHANGED));
}

export function mountGlobalGradesSection(
  sectionEl: HTMLElement,
  signal: AbortSignal,
): void {
  let items: GlobalGrade[] = [];

  mountCatalogoSection<GlobalGrade>(sectionEl, signal, {
    key: "global-grade",
    titleId: "global-grades-section-title",
    title: "Global grades",
    description:
      "Clasificación organizacional del puesto (GG01, GG02…). El formato del código lo define RH; no representa sueldo ni compensación.",
    iconHtml: AJUSTES_ICON_TYPE,
    singular: "global grade",
    emptyMessage: "No hay global grades registrados. Crea el primero.",
    columnas: [
      { header: "Código", valor: (i) => i.codigo, clase: "font-medium tabular-nums" },
      { header: "Nombre", valor: (i) => i.nombre },
      { header: "Descripción", valor: (i) => i.descripcion ?? "—", clase: "text-text-secondary" },
      { header: "Orden", valor: (i) => String(i.orden), clase: "tabular-nums text-text-secondary" },
    ],
    campos: [
      {
        tipo: "texto",
        name: "codigo",
        label: "Código",
        maxLength: 20,
        ancho: "medio",
        hint: "Ej. GG10.",
      },
      {
        tipo: "numero",
        name: "orden",
        label: "Orden",
        min: 1,
        max: 999,
        ancho: "medio",
        hint: "Posición en la estructura.",
      },
      { tipo: "texto", name: "nombre", label: "Nombre", maxLength: 100 },
      {
        tipo: "texto",
        name: "descripcion",
        label: "Descripción",
        requerido: false,
        hint: "Opcional.",
      },
    ],
    valoresNuevo: () => {
      const siguiente = (items.length ? Math.max(...items.map((i) => i.orden)) : 0) + 1;
      return {
        codigo: `GG${String(siguiente).padStart(2, "0")}`,
        nombre: `Global Grade ${siguiente}`,
        descripcion: "",
        orden: String(siguiente),
      };
    },
    valoresEdicion: (i) => ({
      codigo: i.codigo,
      nombre: i.nombre,
      descripcion: i.descripcion ?? "",
      orden: String(i.orden),
    }),
    etiqueta: (i) => `${i.codigo} · ${i.nombre}`,
    cargar: async () => {
      items = await getGlobalGrades();
      return items;
    },
    crear: (v) =>
      createGlobalGrade({
        codigo: v.codigo,
        nombre: v.nombre,
        descripcion: v.descripcion || null,
        orden: Number(v.orden),
      }),
    actualizar: (id, v) =>
      updateGlobalGrade(id, {
        codigo: v.codigo,
        nombre: v.nombre,
        descripcion: v.descripcion || null,
        orden: Number(v.orden),
      }),
    eliminar: deleteGlobalGrade,
    validar: (v) => {
      if (!v.codigo) return "El código es obligatorio (ej. GG10).";
      if (!v.nombre) return "El nombre es obligatorio.";
      const orden = Number(v.orden);
      if (!Number.isFinite(orden) || orden < 1) return "El orden debe ser mayor o igual a 1.";
      return null;
    },
    alCambiar: notifyGlobalGradesChanged,
  });
}

export function mountEquivalenciasSection(
  sectionEl: HTMLElement,
  signal: AbortSignal,
): void {
  let niveles: GradoPuesto[] = [];
  let grades: GlobalGrade[] = [];
  let equivalencias: Equivalencia[] = [];

  /** Niveles que aún no tienen equivalencia: la relación es 1:1 por nivel. */
  function nivelesDisponibles(actualId?: number): GradoPuesto[] {
    const ocupados = new Set(
      equivalencias
        .filter((e) => e.career_level_id !== actualId)
        .map((e) => e.career_level_id),
    );
    return niveles.filter((n) => !ocupados.has(n.id));
  }

  const seccion = mountCatalogoSection<Equivalencia>(sectionEl, signal, {
    key: "equivalencia",
    titleId: "equivalencias-section-title",
    title: "Equivalencias Career Level ↔ Global Grade",
    description:
      "Define qué global grade corresponde a cada career level. Es lo que autocompleta el perfil al elegir el nivel; el sistema nunca lo deduce por número.",
    iconHtml: AJUSTES_ICON_SCALE,
    singular: "equivalencia",
    emptyMessage:
      "No hay equivalencias configuradas. Sin ellas, el global grade del perfil se captura a mano.",
    bloqueo: () => {
      if (niveles.length === 0) {
        return "Primero crea career levels: la equivalencia parte de un nivel.";
      }
      if (grades.length === 0) {
        return "Primero crea global grades: la equivalencia apunta a uno.";
      }
      if (nivelesDisponibles().length === 0 && equivalencias.length > 0) {
        return "Todos los career levels ya tienen equivalencia configurada.";
      }
      return null;
    },
    columnas: [
      {
        header: "Career path",
        valor: (i) => i.career_path_nombre ?? "—",
        clase: "text-text-secondary",
      },
      {
        header: "Career level",
        valor: (i) => i.career_level_codigo ?? String(i.career_level_id),
        clase: "font-medium tabular-nums",
      },
      {
        header: "Global grade",
        valor: (i) => i.global_grade_codigo ?? String(i.global_grade_id),
        clase: "font-medium tabular-nums",
      },
    ],
    campos: [
      {
        tipo: "select",
        name: "career_level_id",
        label: "Career level",
        opciones: () =>
          nivelesDisponibles().map((n) => ({
            value: String(n.id),
            label: `${n.career_path_codigo ?? "?"} · ${n.codigo} — ${n.nombre}`,
          })),
      },
      {
        tipo: "select",
        name: "global_grade_id",
        label: "Global grade",
        opciones: () =>
          grades.map((g) => ({
            value: String(g.id),
            label: `${g.codigo} — ${g.nombre}`,
          })),
      },
    ],
    valoresNuevo: () => {
      const disponibles = nivelesDisponibles();
      return {
        career_level_id: disponibles[0] ? String(disponibles[0].id) : "",
        global_grade_id: grades[0] ? String(grades[0].id) : "",
      };
    },
    valoresEdicion: (i) => ({
      career_level_id: String(i.career_level_id),
      global_grade_id: String(i.global_grade_id),
    }),
    etiqueta: (i) =>
      `${i.career_level_codigo ?? i.career_level_id} → ${i.global_grade_codigo ?? i.global_grade_id}`,
    cargar: async () => {
      const [eqs, nivs, ggs] = await Promise.all([
        getEquivalencias(),
        getGradosPuesto({ page_size: 200 }),
        getGlobalGrades(),
      ]);
      equivalencias = eqs;
      niveles = nivs;
      grades = ggs;
      return eqs;
    },
    crear: (v) =>
      createEquivalencia({
        career_level_id: Number(v.career_level_id),
        global_grade_id: Number(v.global_grade_id),
      }),
    actualizar: (id, v) =>
      updateEquivalencia(id, {
        career_level_id: Number(v.career_level_id),
        global_grade_id: Number(v.global_grade_id),
      }),
    eliminar: deleteEquivalencia,
    validar: (v) => {
      if (!Number(v.career_level_id)) return "Selecciona un career level.";
      if (!Number(v.global_grade_id)) return "Selecciona un global grade.";
      return null;
    },
  });

  // Los selects de esta card dependen de las otras dos: si RH crea un global
  // level o un global grade arriba, aquí tienen que aparecer sin recargar.
  for (const evento of [AJUSTES_CLASIFICACION_CHANGED, AJUSTES_GLOBAL_GRADES_CHANGED]) {
    document.addEventListener(evento, () => void seccion.recargar(), { signal });
  }
}
