/**
 * Semántica visual de la matriz 9-Box (desempeño × potencial).
 *
 * La matriz no es una cuadrícula de nueve categorías sueltas: es una **escala
 * ordinal en dos ejes**, y lo que el lector busca es la esquina buena y la mala.
 * Por eso el color es **divergente** — rojo en la esquina de riesgo, neutro en
 * la antidiagonal, verde en la de talento clave — y no una paleta categórica.
 *
 * El color nunca va solo: cada celda lleva el nombre de su segmento, así que la
 * matriz se lee igual en escala de grises o con daltonismo.
 */
import type { CicloDesempenoBanda } from "../api/cicloDesempeno.ts";

/** `bajo` = 0, `medio` = 1, `alto` = 2. La suma de los dos ejes da el tono. */
const PESO_BANDA: Record<CicloDesempenoBanda, number> = { bajo: 0, medio: 1, alto: 2 };

export type TonoCelda = "riesgo" | "atencion" | "neutro" | "solido" | "estrella";

export interface CeldaVisual {
  /** Nombre del segmento — la etiqueta que hace legible la posición. */
  segmento: string;
  /** Qué significa, para el `title` de la celda. */
  descripcion: string;
  tono: TonoCelda;
  /** Clases del contenedor de la celda (fondo + borde). */
  clases: string;
}

/** Nomenclatura estándar de talento, en el orden `desempeno_potencial`. */
const SEGMENTOS: Record<string, { segmento: string; descripcion: string }> = {
  alto_alto: { segmento: "Estrella", descripcion: "Alto desempeño y alto potencial: sucesión y retención." },
  alto_medio: { segmento: "Alto desempeño", descripcion: "Entrega por encima de lo esperado; potencial por confirmar." },
  alto_bajo: { segmento: "Experto confiable", descripcion: "Domina su puesto; crecimiento en profundidad, no en jerarquía." },
  medio_alto: { segmento: "Alto potencial", descripcion: "Puede dar más de lo que hoy entrega: acelerar desarrollo." },
  medio_medio: { segmento: "Colaborador sólido", descripcion: "El núcleo de la operación: sostener y desarrollar." },
  medio_bajo: { segmento: "Especialista estable", descripcion: "Cumple en su ámbito; foco en mantener el estándar." },
  bajo_alto: { segmento: "Enigma", descripcion: "Potencial visible sin resultados: revisar encaje o barreras." },
  bajo_medio: { segmento: "En desarrollo", descripcion: "Por debajo de lo esperado con margen de mejora: plan de acción." },
  bajo_bajo: { segmento: "Riesgo", descripcion: "Bajo en ambos ejes: decisión de RH y jefatura." },
};

/**
 * Clases por tono. Los tintes salen de los tokens de estado de design.md
 * (`*-bg` / `*-border`), no de hex sueltos, y son suficientemente claros para
 * que el texto de los nombres mantenga contraste encima.
 */
const CLASES_TONO: Record<TonoCelda, string> = {
  riesgo: "border-danger-border bg-danger-bg",
  atencion: "border-warning-border bg-warning-bg",
  neutro: "border-border bg-surface-container-low",
  solido: "border-success-border bg-success-bg",
  // La celda estrella es la única con anillo: es la que se busca primero.
  estrella: "border-success-border bg-success-bg ring-2 ring-success-text/25",
};

function tonoDe(bd: CicloDesempenoBanda, bp: CicloDesempenoBanda): TonoCelda {
  const puntaje = PESO_BANDA[bd] + PESO_BANDA[bp];
  if (puntaje >= 4) return "estrella";
  if (puntaje === 3) return "solido";
  if (puntaje === 2) return "neutro";
  if (puntaje === 1) return "atencion";
  return "riesgo";
}

export function celdaVisual(bd: CicloDesempenoBanda, bp: CicloDesempenoBanda): CeldaVisual {
  const meta = SEGMENTOS[`${bd}_${bp}`];
  const tono = tonoDe(bd, bp);
  return {
    segmento: meta?.segmento ?? `${bd} / ${bp}`,
    descripcion: meta?.descripcion ?? "",
    tono,
    clases: CLASES_TONO[tono],
  };
}

/** Nombres a mostrar dentro de la celda antes de resumir en "+N". */
export const MAX_NOMBRES_CELDA = 4;

/**
 * Reparte los nombres entre los que se pintan y el resto. Sin esto una celda
 * con 30 personas empuja la fila entera y la matriz deja de leerse de un
 * vistazo, que es lo único que un 9-Box tiene que hacer bien.
 */
export function repartirNombres<T>(nombres: T[]): { visibles: T[]; restantes: number } {
  if (nombres.length <= MAX_NOMBRES_CELDA) return { visibles: nombres, restantes: 0 };
  // Se deja un hueco para el "+N", así el bloque siempre ocupa lo mismo.
  const visibles = nombres.slice(0, MAX_NOMBRES_CELDA - 1);
  return { visibles, restantes: nombres.length - visibles.length };
}
