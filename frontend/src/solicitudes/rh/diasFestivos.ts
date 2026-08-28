/**
 * Días festivos de la planta para el modal de solicitudes.
 *
 * Son independientes del empleado, así que se cachean por año (no por mes como los
 * descansos). Aplican solo a vacaciones (bloquean inicio/fin y no descuentan) y a home
 * office (bloquean la fecha); espejo de `MSG_FESTIVO_*` en `solicitud_service.py`.
 */
import { getDiasFestivosPublicos } from "../../api/solicitudes.ts";

const TIPOS_CON_FESTIVOS = new Set<string>(["vacaciones", "home_office"]);

export function tipoAplicaFestivos(tipo: string | null | undefined): boolean {
  return tipo != null && TIPOS_CON_FESTIVOS.has(tipo);
}

export type DiasFestivosFetcher = (
  anio: number,
) => Promise<readonly { fecha: string; descripcion: string }[]>;

export type DiasFestivosCache = {
  /** Carga (una sola vez por año) los años pedidos. Nunca rechaza: un fallo deja el año sin festivos. */
  ensureAnios: (...anios: number[]) => Promise<void>;
  /** ISO → descripción, de todos los años ya cargados. */
  getMap: () => ReadonlyMap<string, string>;
  getSet: () => ReadonlySet<string>;
};

export function anioDeIso(iso: string): number | null {
  const y = Number.parseInt(iso.slice(0, 4), 10);
  return Number.isInteger(y) ? y : null;
}

const defaultFetcher: DiasFestivosFetcher = async (anio) =>
  (await getDiasFestivosPublicos(anio)).items;

export function createDiasFestivosCache(
  fetcher: DiasFestivosFetcher = defaultFetcher,
): DiasFestivosCache {
  const porAnio = new Map<number, Map<string, string>>();
  const enCurso = new Map<number, Promise<void>>();

  function cargar(anio: number): Promise<void> {
    if (porAnio.has(anio)) return Promise.resolve();
    const previa = enCurso.get(anio);
    if (previa) return previa;
    const p = fetcher(anio)
      .then((items) => {
        porAnio.set(anio, new Map(items.map((i) => [i.fecha, i.descripcion])));
      })
      .catch(() => {
        // El backend sigue validando; el calendario solo pierde el color del festivo.
      })
      .finally(() => {
        enCurso.delete(anio);
      });
    enCurso.set(anio, p);
    return p;
  }

  return {
    ensureAnios: async (...anios) => {
      await Promise.all(anios.filter((a) => Number.isInteger(a)).map(cargar));
    },
    getMap: () => {
      const out = new Map<string, string>();
      for (const m of porAnio.values()) for (const [k, v] of m) out.set(k, v);
      return out;
    },
    getSet: () => {
      const out = new Set<string>();
      for (const m of porAnio.values()) for (const k of m.keys()) out.add(k);
      return out;
    },
  };
}

/** Festivos del set que caen dentro del rango inclusivo, ordenados. */
export function festivosEnRango(
  fechaInicio: string,
  fechaFin: string,
  festivos: ReadonlySet<string>,
): string[] {
  if (!fechaInicio || !fechaFin || fechaFin < fechaInicio) return [];
  return [...festivos].filter((f) => f >= fechaInicio && f <= fechaFin).sort();
}
