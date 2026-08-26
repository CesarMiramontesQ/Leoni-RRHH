/**
 * Filtro local del selector de beneficiario en el modal de nueva comida.
 *
 * La lista es el equipo (todo el subárbol), que ya viene cargada: se filtra en memoria y **no** se
 * consulta el directorio. Buscar en el directorio completo ampliaría el alcance del
 * registro más allá del equipo, que es justo lo que acota el endpoint de beneficiarios.
 */
import type { ComedorEmployeeOption } from "./types.ts";

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/**
 * Coincide si **cada** palabra de la búsqueda aparece en el nombre o en el número. Así
 * "lopez ana" encuentra a "Ana López" sin exigir el orden en que está escrito el nombre.
 */
export function filtrarEmpleadosComedor(
  opciones: readonly ComedorEmployeeOption[],
  busqueda: string,
): ComedorEmployeeOption[] {
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [...opciones];

  return opciones.filter((opcion) => {
    const heno = `${normalizar(opcion.nombre)} ${normalizar(opcion.numero)}`;
    return palabras.every((palabra) => heno.includes(palabra));
  });
}
