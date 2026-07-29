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

/**
 * Un career level con el tramo de global grades que abarca.
 *
 * La unidad de esta card es el NIVEL, no el par nivel↔grade: RH piensa «M4
 * equivale a GG17 y GG18», no «dos equivalencias que casualmente comparten
 * nivel». El backend sigue guardando un renglón por par; aquí se agrupan.
 */
type EquivalenciaNivel = {
  /** Es el id del career level: la fila representa al nivel, no a un par. */
  id: number;
  career_path_nombre: string | null;
  career_level_codigo: string;
  grades: { id: number; codigo: string }[];
  /** Id del renglón del backend por cada grade, para poder borrarlo. */
  filas: { grade_id: number; equivalencia_id: number }[];
};

/**
 * Agrupa los renglones del backend (un par nivel↔grade cada uno) por career
 * level, que es la unidad con la que RH piensa.
 *
 * `ordenGrades` son los ids en el orden del catálogo (que ya viene por `orden`),
 * para que el tramo se lea de menor a mayor y no en el orden de captura.
 */
/** Se emite al cambiar las equivalencias: la tabla de career levels muestra el tramo. */
export const AJUSTES_EQUIVALENCIAS_CHANGED = "ajustes:equivalencias-changed";

export function notifyEquivalenciasChanged(): void {
  document.dispatchEvent(new CustomEvent(AJUSTES_EQUIVALENCIAS_CHANGED));
}

export function agruparEquivalenciasPorNivel(
  equivalencias: Equivalencia[],
  ordenGrades: number[],
): EquivalenciaNivel[] {
  const mapa = new Map<number, EquivalenciaNivel>();
  for (const e of equivalencias) {
    let fila = mapa.get(e.career_level_id);
    if (!fila) {
      fila = {
        id: e.career_level_id,
        career_path_nombre: e.career_path_nombre,
        career_level_codigo: e.career_level_codigo ?? String(e.career_level_id),
        grades: [],
        filas: [],
      };
      mapa.set(e.career_level_id, fila);
    }
    fila.grades.push({
      id: e.global_grade_id,
      codigo: e.global_grade_codigo ?? String(e.global_grade_id),
    });
    fila.filas.push({ grade_id: e.global_grade_id, equivalencia_id: e.id });
  }
  const posicion = new Map(ordenGrades.map((id, i) => [id, i]));
  for (const fila of mapa.values()) {
    fila.grades.sort((a, b) => (posicion.get(a.id) ?? 0) - (posicion.get(b.id) ?? 0));
  }
  return [...mapa.values()];
}

/** Ids de los grades marcados en el formulario (viajan separados por coma). */
export function gradesElegidos(valores: Record<string, string>): number[] {
  return (valores.global_grade_ids ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function mountEquivalenciasSection(
  sectionEl: HTMLElement,
  signal: AbortSignal,
): void {
  let niveles: GradoPuesto[] = [];
  let grades: GlobalGrade[] = [];
  let porNivel: EquivalenciaNivel[] = [];

  function nivelPorId(id: number): EquivalenciaNivel | undefined {
    return porNivel.find((n) => n.id === id);
  }

  /**
   * Deja el nivel con exactamente los grades elegidos.
   *
   * Crea los que faltan y borra los que sobran, en vez de editar renglones: así
   * el formulario habla de un tramo y no de pares sueltos.
   */
  async function sincronizar(nivelId: number, elegidos: number[]): Promise<void> {
    const actual = nivelPorId(nivelId);
    const yaEstan = new Set(actual?.grades.map((g) => g.id) ?? []);
    for (const gradeId of elegidos) {
      if (!yaEstan.has(gradeId)) {
        await createEquivalencia({
          career_level_id: nivelId,
          global_grade_id: gradeId,
        });
      }
    }
    const quedan = new Set(elegidos);
    for (const fila of actual?.filas ?? []) {
      if (!quedan.has(fila.grade_id)) await deleteEquivalencia(fila.equivalencia_id);
    }
  }

  const seccion = mountCatalogoSection<EquivalenciaNivel>(sectionEl, signal, {
    key: "equivalencia",
    titleId: "equivalencias-section-title",
    title: "Equivalencias Career Level ↔ Global Grade",
    description:
      "Define qué global grades abarca cada career level. Un nivel puede equivaler a varios (M4 = GG17 y GG18). Es lo que acota el global grade del perfil; el sistema nunca lo deduce por número.",
    iconHtml: AJUSTES_ICON_SCALE,
    singular: "equivalencia",
    emptyMessage:
      "No hay equivalencias configuradas. Sin ellas, el career level no tiene posición y no se puede usar en el rango de un perfil.",
    bloqueo: () => {
      if (niveles.length === 0) {
        return "Primero crea career levels: la equivalencia parte de un nivel.";
      }
      if (grades.length === 0) {
        return "Primero crea global grades: la equivalencia apunta a ellos.";
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
        valor: (i) => i.career_level_codigo,
        clase: "font-medium tabular-nums",
      },
      {
        header: "Global grades",
        valor: (i) => i.grades.map((g) => g.codigo).join(", ") || "—",
        clase: "font-medium tabular-nums",
      },
    ],
    campos: [
      {
        tipo: "select",
        name: "career_level_id",
        label: "Career level",
        opciones: () =>
          niveles.map((n) => ({
            value: String(n.id),
            label: `${n.codigo} — ${n.nombre}`,
          })),
      },
      {
        tipo: "multiselect",
        name: "global_grade_ids",
        label: "Global grades",
        hint: "Marca todos los que abarca el nivel. Con uno solo, el perfil lo autocompleta; con varios, RH elige al clasificar el puesto.",
        opciones: () =>
          grades.map((g) => ({
            value: String(g.id),
            label: `${g.codigo} — ${g.nombre}`,
          })),
      },
    ],
    valoresNuevo: () => ({
      career_level_id: niveles[0] ? String(niveles[0].id) : "",
      global_grade_ids: "",
    }),
    valoresEdicion: (i) => ({
      career_level_id: String(i.id),
      global_grade_ids: i.grades.map((g) => g.id).join(","),
    }),
    etiqueta: (i) =>
      `${i.career_level_codigo} → ${i.grades.map((g) => g.codigo).join(", ")}`,
    cargar: async () => {
      const [eqs, nivs, ggs] = await Promise.all([
        getEquivalencias(),
        getGradosPuesto({ page_size: 200 }),
        getGlobalGrades(),
      ]);
      niveles = nivs;
      grades = ggs;
      porNivel = agruparEquivalenciasPorNivel(eqs, ggs.map((g) => g.id));
      return porNivel;
    },
    crear: (v) => sincronizar(Number(v.career_level_id), gradesElegidos(v)),
    actualizar: async (id, v) => {
      const destino = Number(v.career_level_id);
      // Cambiar el nivel en la edición mueve el tramo entero: se vacía el
      // anterior para no dejar el mismo tramo colgando de dos niveles.
      if (destino !== id) await sincronizar(id, []);
      await sincronizar(destino, gradesElegidos(v));
    },
    eliminar: async (id) => {
      await sincronizar(id, []);
    },
    validar: (v) => {
      if (!Number(v.career_level_id)) return "Selecciona un career level.";
      if (gradesElegidos(v).length === 0) {
        return "Marca al menos un global grade.";
      }
      return null;
    },
    // La tabla de career levels muestra el tramo en su columna «Global grade»:
    // sin esto se quedaba diciendo «Sin equivalencia» hasta recargar la página.
    alCambiar: notifyEquivalenciasChanged,
  });

  // Los selects de esta card dependen de las otras dos: si RH crea un global
  // level o un global grade arriba, aquí tienen que aparecer sin recargar.
  for (const evento of [AJUSTES_CLASIFICACION_CHANGED, AJUSTES_GLOBAL_GRADES_CHANGED]) {
    document.addEventListener(evento, () => void seccion.recargar(), { signal });
  }
}
