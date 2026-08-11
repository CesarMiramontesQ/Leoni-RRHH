import { describe, expect, it } from "vitest";

import {
  fetchTodosLosRegistrosReporte,
  type FetchPagina,
} from "./fetchRegistrosReporte.ts";

type Fila = { id: number };

/** Servidor simulado: `total` filas, paginación por offset con orden estable. */
function servidor(total: number, opts: { registro?: number[][]; retraso?: (p: number) => number } = {}) {
  const llamadas: number[] = [];
  let simultaneas = 0;
  let picoSimultaneas = 0;

  const fetchPagina: FetchPagina<Fila> = async (page, pageSize) => {
    llamadas.push(page);
    simultaneas += 1;
    picoSimultaneas = Math.max(picoSimultaneas, simultaneas);
    // Las páginas altas responden primero: fuerza el desorden que produce el paralelismo.
    const ms = opts.retraso ? opts.retraso(page) : 0;
    await new Promise((r) => setTimeout(r, ms));
    simultaneas -= 1;
    const offset = (page - 1) * pageSize;
    const items = Array.from(
      { length: Math.max(0, Math.min(pageSize, total - offset)) },
      (_, i) => ({ id: offset + i + 1 }),
    );
    return { items, total };
  };

  return {
    fetchPagina,
    get llamadas() {
      return llamadas;
    },
    get picoSimultaneas() {
      return picoSimultaneas;
    },
  };
}

describe("fetchTodosLosRegistrosReporte", () => {
  it("trae todas las filas del rango", async () => {
    const s = servidor(12855);
    const filas = await fetchTodosLosRegistrosReporte(s.fetchPagina, { pageSize: 1000 });

    expect(filas).toHaveLength(12855);
    expect(filas[0].id).toBe(1);
    expect(filas[12854].id).toBe(12855);
  });

  it("las devuelve en orden aunque las respuestas lleguen desordenadas", async () => {
    // Es el riesgo real de paralelizar: sin reensamblar por número de página, el detalle
    // y el Excel saldrían barajados.
    const s = servidor(5000, { retraso: (p) => (6 - p) * 5 });
    const filas = await fetchTodosLosRegistrosReporte(s.fetchPagina, {
      pageSize: 1000,
      concurrencia: 4,
    });

    expect(filas.map((f) => f.id)).toEqual(Array.from({ length: 5000 }, (_, i) => i + 1));
  });

  it("no pide ninguna fila dos veces ni se salta ninguna", async () => {
    const s = servidor(3333);
    const filas = await fetchTodosLosRegistrosReporte(s.fetchPagina, { pageSize: 500 });

    expect(new Set(filas.map((f) => f.id)).size).toBe(3333);
    expect(new Set(s.llamadas).size).toBe(s.llamadas.length); // ninguna página repetida
  });

  it("reduce drásticamente el número de peticiones", async () => {
    // Un mes de operación: antes eran 258 peticiones secuenciales de 50.
    const s = servidor(12855);
    await fetchTodosLosRegistrosReporte(s.fetchPagina, { pageSize: 1000 });

    expect(s.llamadas).toHaveLength(13);
  });

  it("respeta el límite de concurrencia", async () => {
    const s = servidor(10000, { retraso: () => 5 });
    await fetchTodosLosRegistrosReporte(s.fetchPagina, { pageSize: 1000, concurrencia: 3 });

    expect(s.picoSimultaneas).toBeLessThanOrEqual(3);
  });

  it("con una sola página no lanza peticiones de más", async () => {
    const s = servidor(120);
    const filas = await fetchTodosLosRegistrosReporte(s.fetchPagina, { pageSize: 1000 });

    expect(filas).toHaveLength(120);
    expect(s.llamadas).toEqual([1]);
  });

  it("con el rango vacío devuelve vacío sin insistir", async () => {
    const s = servidor(0);
    const filas = await fetchTodosLosRegistrosReporte(s.fetchPagina, { pageSize: 1000 });

    expect(filas).toEqual([]);
    expect(s.llamadas).toEqual([1]);
  });

  it("se detiene si el servidor devuelve menos filas de las que promete", async () => {
    // Un `total` inconsistente pedía páginas vacías hasta el tope de seguridad.
    const fetchPagina: FetchPagina<Fila> = async (page, pageSize) => ({
      items: page === 1 ? [{ id: 1 }, { id: 2 }] : [],
      total: 99999,
    });
    const filas = await fetchTodosLosRegistrosReporte(fetchPagina, { pageSize: 1000 });

    expect(filas).toHaveLength(2);
  });

  it("no supera el tope de páginas de seguridad", async () => {
    const s = servidor(1_000_000);
    await fetchTodosLosRegistrosReporte(s.fetchPagina, { pageSize: 1000, maxPaginas: 5 });

    expect(s.llamadas).toHaveLength(5);
  });
});

describe("cuando el servidor no honra el tamaño de lote pedido", () => {
  it("no corta la descarga: usa el page_size que reporta el servidor", async () => {
    // Regresión real: el cliente de API recortaba el page_size a 50 aunque aquí se
    // pidieran 1000. La guarda de «vino menos de lo que pedí» lo tomaba como fin del
    // rango y el tablero se quedaba con 50 de 12 855 filas, sin ningún error visible.
    const total = 12855;
    const TOPE_REAL = 50;
    const llamadas: number[] = [];
    const fetchPagina: FetchPagina<{ id: number }> = async (page, pageSize) => {
      llamadas.push(page);
      const usado = Math.min(pageSize, TOPE_REAL);
      const offset = (page - 1) * usado;
      return {
        items: Array.from({ length: Math.max(0, Math.min(usado, total - offset)) }, (_, i) => ({
          id: offset + i + 1,
        })),
        total,
        // El servidor declara el tamaño que realmente aplicó.
        page_size: usado,
      };
    };

    const filas = await fetchTodosLosRegistrosReporte(fetchPagina, { pageSize: 1000 });

    expect(filas).toHaveLength(total);
    expect(llamadas.length).toBe(Math.ceil(total / TOPE_REAL));
  });
});
