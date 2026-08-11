/**
 * Descarga completa de los registros del rango para el tablero de reporte.
 *
 * El tablero necesita **todas** las filas en el cliente: agrupa por área, filtra por
 * comedor, ordena el detalle y exporta a Excel. Lo que se arregla aquí es cómo se traen.
 *
 * Antes pedía lotes de 50 en un bucle secuencial: un mes de operación —unas 13 000 filas
 * con 812 empleados— eran 258 idas al servidor, una tras otra, cada una con su
 * verificación de token y su serialización. La consulta nunca fue el problema (1,2 ms el
 * conteo y 5,8 ms la página); el costo era el número de viajes.
 *
 * Ahora la primera petición trae un lote grande y, con el `total` que responde, calcula
 * cuántas faltan y las lanza en paralelo con un límite de concurrencia. Las mismas 13 000
 * filas pasan de 258 peticiones en serie a 13 en ~3 tandas.
 *
 * La paginación por `offset` es segura para paralelizar porque el servidor ordena por
 * `(fecha_servicio, id)`, que es único y estable: dos páginas nunca devuelven la misma
 * fila ni se saltan ninguna.
 */

/** Lo que necesita esta descarga de una página; el resto de la respuesta no le importa. */
export type PaginaRegistros<T> = {
  items: readonly T[];
  total: number;
};

export type FetchPagina<T> = (page: number, pageSize: number) => Promise<PaginaRegistros<T>>;

export type OpcionesDescarga = {
  /** Filas por petición. El backend acepta 5, 10, 50, 500 y 1000. */
  pageSize?: number;
  /** Peticiones simultáneas. Suficiente para saturar la red sin ahogar al servidor. */
  concurrencia?: number;
  /** Tope de seguridad para que un rango enorme no dispare miles de peticiones. */
  maxPaginas?: number;
};

const PAGE_SIZE_POR_DEFECTO = 1000;
const CONCURRENCIA_POR_DEFECTO = 4;
const MAX_PAGINAS_POR_DEFECTO = 400;

/**
 * Trae todas las filas del rango, en orden.
 *
 * `fetchPagina` se recibe como parámetro para que esto sea probable sin red.
 */
export async function fetchTodosLosRegistrosReporte<T>(
  fetchPagina: FetchPagina<T>,
  opciones: OpcionesDescarga = {},
): Promise<T[]> {
  const pageSize = opciones.pageSize ?? PAGE_SIZE_POR_DEFECTO;
  const concurrencia = Math.max(1, opciones.concurrencia ?? CONCURRENCIA_POR_DEFECTO);
  const maxPaginas = opciones.maxPaginas ?? MAX_PAGINAS_POR_DEFECTO;

  const primera = await fetchPagina(1, pageSize);
  const total = primera.total;
  // Un servidor que devuelve menos filas de las pedidas ya agotó el rango, aunque su
  // `total` diga otra cosa: sin esta salida un `total` inconsistente pediría páginas
  // vacías hasta el tope.
  if (primera.items.length < pageSize || primera.items.length >= total) {
    return [...primera.items];
  }

  const paginasTotales = Math.min(Math.ceil(total / pageSize), maxPaginas);
  const restantes: number[] = [];
  for (let p = 2; p <= paginasTotales; p += 1) restantes.push(p);

  // Se indexa por número de página para reensamblar en orden aunque las respuestas
  // lleguen desordenadas, que es lo normal al pedirlas en paralelo.
  const porPagina = new Map<number, readonly T[]>([[1, primera.items]]);
  let siguiente = 0;
  async function trabajador(): Promise<void> {
    while (siguiente < restantes.length) {
      const page = restantes[siguiente];
      siguiente += 1;
      const resp = await fetchPagina(page, pageSize);
      porPagina.set(page, resp.items);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrencia, restantes.length) }, () => trabajador()),
  );

  const todas: T[] = [];
  for (let p = 1; p <= paginasTotales; p += 1) {
    const items = porPagina.get(p);
    if (items) todas.push(...items);
  }
  return todas;
}
