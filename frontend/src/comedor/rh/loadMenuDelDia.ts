import { getComedorMenuSemana } from "../../api/comedor.ts";
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
