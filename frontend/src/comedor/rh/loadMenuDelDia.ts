import {
  eliminarComedorMenuDia,
  getComedorMenuSemana,
  publicarComedorMenu,
} from "../../api/comedor.ts";
import type { ComedorMenuDiaDetalle } from "./menuDayDetalle.ts";
import {
  menuDelDiaHasContent,
  resolveMenuDiaFromSemanaApi,
  type ComedorMenuDelDia,
} from "./resolveMenuDiaFromSemana.ts";
import { mondayIsoFromDateIso } from "./weekRange.ts";

export type ComedorMenuDelDiaLoader = (fechaIso: string) => Promise<ComedorMenuDelDia | null>;

type WeekMenuCacheEntry = {
  items: Awaited<ReturnType<typeof getComedorMenuSemana>>;
};

function detalleToApiPayload(detalle: ComedorMenuDiaDetalle) {
  return {
    sopa_o_crema: [...detalle.sopa_o_crema],
    guarniciones: [...detalle.guarniciones],
    complementos: [...detalle.complementos],
    tortillas: [...detalle.tortillas],
    postres: [...detalle.postres],
    salsas: [...detalle.salsas],
    aguas: [...detalle.aguas],
  };
}

export function menuDetalleHasContent(detalle: ComedorMenuDiaDetalle): boolean {
  return Object.values(detalle).some((items) => items.length > 0);
}

/** Payload de publicación: detalle solo en fila `normal` para evitar duplicados. */
export function buildPublicarMenuPayloadsForDay(day: {
  key: string;
  menuNormal: string;
  menuDieta: string;
  detalle: ComedorMenuDiaDetalle;
}): Array<{ dia: string; tipo: string; descripcion: string; detalle?: ReturnType<typeof detalleToApiPayload> }> {
  const rows: Array<{
    dia: string;
    tipo: string;
    descripcion: string;
    detalle?: ReturnType<typeof detalleToApiPayload>;
  }> = [];
  if (day.menuNormal.trim()) {
    rows.push({
      dia: day.key,
      tipo: "normal",
      descripcion: day.menuNormal.trim(),
      ...(menuDetalleHasContent(day.detalle) ? { detalle: detalleToApiPayload(day.detalle) } : {}),
    });
  }
  if (day.menuDieta.trim()) {
    rows.push({ dia: day.key, tipo: "dieta", descripcion: day.menuDieta.trim() });
  }
  return rows;
}

export type PersistComedorWeekMenuParams = {
  comedorId: number;
  weekStartIso: string;
  dias: ReadonlyArray<{
    key: string;
    menuNormal: string;
    menuDieta: string;
    detalle: ComedorMenuDiaDetalle;
  }>;
  /** Logs temporales de depuración (solo desarrollo). */
  debug?: boolean;
};

export type ComedorDayMenuTipo = "normal" | "dieta";

export type ComedorDayMenuPersistPlan = {
  publicar: ReturnType<typeof buildPublicarMenuPayloadsForDay>;
  /** Tipos que quedaron sin texto y hay que borrar del backend. */
  borrar: ComedorDayMenuTipo[];
};

/**
 * Qué hay que escribir y qué hay que borrar para dejar el día como está en pantalla.
 *
 * `buildPublicarMenuPayloadsForDay` omite los tipos sin texto, lo que basta al publicar una
 * semana nueva pero no al editar: si el usuario vacía la Opción B, la fila anterior seguiría
 * viva en la BD y el empleado la seguiría viendo. Aquí esos tipos entran en `borrar`.
 */
export function buildDayMenuPersistPlan(day: {
  key: string;
  menuNormal: string;
  menuDieta: string;
  detalle: ComedorMenuDiaDetalle;
}): ComedorDayMenuPersistPlan {
  const publicar = buildPublicarMenuPayloadsForDay(day);
  const publicados = new Set(publicar.map((entry) => entry.tipo));
  const borrar = (["normal", "dieta"] as const).filter((tipo) => !publicados.has(tipo));
  return { publicar, borrar: [...borrar] };
}

export type PersistComedorDayMenuParams = {
  comedorId: number;
  weekStartIso: string;
  day: {
    key: string;
    menuNormal: string;
    menuDieta: string;
    detalle: ComedorMenuDiaDetalle;
  };
};

/** Guarda UN día: publica lo que tiene texto y borra lo que quedó vacío. */
export async function persistComedorDayMenu(
  params: PersistComedorDayMenuParams,
): Promise<ComedorDayMenuPersistPlan> {
  const plan = buildDayMenuPersistPlan(params.day);

  // Los borrados van primero y en serie: si el usuario vacía la Opción B y a la vez cambia
  // la A, un borrado tardío podría pisar la publicación recién hecha del mismo día.
  for (const tipo of plan.borrar) {
    await eliminarComedorMenuDia(params.comedorId, params.weekStartIso, params.day.key, tipo);
  }
  await Promise.all(
    plan.publicar.map((entry) =>
      publicarComedorMenu({
        comedorId: params.comedorId,
        semanaIso: params.weekStartIso,
        dia: entry.dia,
        tipo: entry.tipo,
        descripcion: entry.descripcion,
        detalle: entry.detalle,
      }),
    ),
  );
  return plan;
}

/** Persiste todos los días/tipos con contenido vía POST /api/v1/comedor/menu (upsert en backend). */
export async function persistComedorWeekMenu(params: PersistComedorWeekMenuParams): Promise<number> {
  const payloads = params.dias.flatMap((day) => buildPublicarMenuPayloadsForDay(day));
  if (params.debug) {
    console.debug(
      "[planeacion-import] Días en semana:",
      params.dias.map((day) => day.key),
    );
    console.debug(
      "[planeacion-import] Payloads a backend:",
      payloads.map((entry) => ({
        dia: entry.dia,
        tipo: entry.tipo,
        descripcion: entry.descripcion.slice(0, 48),
        tieneDetalle: Boolean(entry.detalle),
      })),
    );
  }
  await Promise.all(
    payloads.map((entry) =>
      publicarComedorMenu({
        comedorId: params.comedorId,
        semanaIso: params.weekStartIso,
        dia: entry.dia,
        tipo: entry.tipo,
        descripcion: entry.descripcion,
        detalle: entry.detalle,
      }),
    ),
  );
  return payloads.length;
}

export function createComedorMenuDelDiaLoader(
  resolveComedorId: () => Promise<number | null>,
): ComedorMenuDelDiaLoader {
  const weekCache = new Map<string, WeekMenuCacheEntry>();

  return async (fechaIso: string) => {
    const trimmed = fechaIso.trim();
    if (!trimmed) return null;
    const comedorId = await resolveComedorId();
    if (comedorId == null) return null;

    const weekStartIso = mondayIsoFromDateIso(trimmed);
    const cacheKey = `${comedorId}:${weekStartIso}`;
    let cached = weekCache.get(cacheKey);
    if (!cached) {
      const items = await getComedorMenuSemana(comedorId, weekStartIso);
      cached = { items };
      weekCache.set(cacheKey, cached);
    }

    const resolved = resolveMenuDiaFromSemanaApi(cached.items, trimmed);
    if (!resolved || !menuDelDiaHasContent(resolved)) return null;
    return resolved;
  };
}
