/**
 * Opciones del filtro por área de la pantalla de Ciclo de Desempeño.
 *
 * El área viaja dentro de cada resultado (`CicloDesempenoResultadoResponse`),
 * así que el selector se arma con lo que ya llegó — sin un endpoint de
 * catálogo, que además tendría que vivir bajo el prefijo de este módulo para
 * no darle 403 a quien solo tiene `ciclo-desempeno`.
 */

export interface AreaOpcion {
  id: number;
  nombre: string;
}

interface ConArea {
  area_id: number | null;
  area_nombre: string | null;
}

/**
 * Une las opciones ya conocidas con las áreas de estos resultados, ordenadas
 * por nombre. **Nunca quita opciones**: los resultados que llegan ya filtrados
 * por un área traen solo esa: si la lista se recalculara desde cero, elegir un
 * área dejaría esa única opción y no habría forma de volver a otra.
 */
export function mezclarAreasOpciones(previas: AreaOpcion[], resultados: ConArea[]): AreaOpcion[] {
  const porId = new Map<number, string>(previas.map((a) => [a.id, a.nombre]));
  for (const r of resultados) {
    if (r.area_id === null) continue; // empleado sin área asignada
    porId.set(r.area_id, r.area_nombre ?? `Área ${r.area_id}`);
  }
  return [...porId]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
