/**
 * Mapa WTW: la estructura de grados leída como la lámina de Towers.
 *
 * Vive bajo `/api/v1/puestos-perfil` a propósito. Los catálogos que tienen estos
 * datos (career levels, paths, global grades) pertenecen al módulo
 * `puestos-ajustes`, y esta vista debe poder consultarla cualquiera que trabaje
 * con perfiles de puesto.
 */
import { fetchWithAuth } from "./http.ts";
import type {
  WtwGrade,
  WtwMapa,
  WtwNivel,
  WtwNivelSinPosicion,
  WtwPath,
} from "../dashboard/puestos/types.ts";

const BASE = "/api/v1/puestos-perfil";

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { detail?: unknown };
    if (typeof data.detail === "string") return data.detail;
  } catch {
    /* respuesta sin cuerpo JSON */
  }
  return `Error ${res.status}`;
}

function mapGrade(raw: Record<string, unknown>): WtwGrade {
  return {
    id: Number(raw.id ?? 0),
    codigo: String(raw.codigo ?? ""),
    orden: Number(raw.orden ?? 0),
  };
}

function mapNivel(raw: Record<string, unknown>): WtwNivel {
  return {
    id: Number(raw.id ?? 0),
    codigo: String(raw.codigo ?? ""),
    nombre: String(raw.nombre ?? ""),
    posicion_desde: Number(raw.posicion_desde ?? 0),
    posicion_hasta: Number(raw.posicion_hasta ?? 0),
    global_grades: ((raw.global_grades ?? []) as unknown[]).map(String),
  };
}

function mapSinPosicion(raw: Record<string, unknown>): WtwNivelSinPosicion {
  return {
    id: Number(raw.id ?? 0),
    codigo: String(raw.codigo ?? ""),
    nombre: String(raw.nombre ?? ""),
  };
}

function mapPath(raw: Record<string, unknown>): WtwPath {
  return {
    id: Number(raw.id ?? 0),
    codigo: String(raw.codigo ?? ""),
    nombre: String(raw.nombre ?? ""),
    niveles: ((raw.niveles ?? []) as Record<string, unknown>[]).map(mapNivel),
    sin_posicion: ((raw.sin_posicion ?? []) as Record<string, unknown>[]).map(
      mapSinPosicion,
    ),
  };
}

export async function getMapaWtw(): Promise<WtwMapa> {
  const res = await fetchWithAuth(`${BASE}/wtw`);
  if (!res.ok) throw new Error(await readErrorDetail(res));
  const data = (await res.json()) as Record<string, unknown>;
  return {
    global_grades: ((data.global_grades ?? []) as Record<string, unknown>[]).map(
      mapGrade,
    ),
    career_paths: ((data.career_paths ?? []) as Record<string, unknown>[]).map(mapPath),
  };
}
