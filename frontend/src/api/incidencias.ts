import { fetchWithAuth } from "./http.ts";
import type { RhIncidenciaEstadoCodigo, RhIncidenciaTablaFila, RhIncidenciaTipoCodigo } from "../incidencias/rh/types.ts";

type IncidenciaApiItem = {
  id: number;
  empleado_id: number;
  tipo: string;
  estado: string;
  created_at: string;
};

type IncidenciasApiPage = {
  items: IncidenciaApiItem[];
  next_cursor: number | null;
  total: number;
};

export type IncidenciasFetchError = {
  status: number;
  detail: string;
};

async function readErrorDetail(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const parsed = JSON.parse(raw) as { detail?: unknown };
    if (typeof parsed.detail === "string" && parsed.detail.trim()) return parsed.detail.trim();
  } catch {
    /* noop */
  }
  return raw || res.statusText || "Error";
}

function toTipo(tipo: string): RhIncidenciaTipoCodigo {
  if (tipo === "retardo") return "retardo";
  if (tipo === "dano_equipo") return "dano_equipo";
  if (tipo === "indisciplina") return "indisciplina";
  return "falta_injustificada";
}

function toEstado(estado: string): RhIncidenciaEstadoCodigo {
  if (estado === "cerrado" || estado === "closed" || estado === "resolved") return "cerrado";
  if (estado === "en_investigacion" || estado === "in_review") return "en_investigacion";
  return "abierto";
}

function toFila(item: IncidenciaApiItem): RhIncidenciaTablaFila {
  return {
    id: item.id,
    empleado_id: String(item.empleado_id),
    empleado_nombre_raw: `Empleado #${item.empleado_id}`,
    foto_url: null,
    numero_folio: `INC-${item.id}`,
    area: "Sin área",
    supervisor_id: "",
    supervisor_nombre: "Sin supervisor",
    tipo: toTipo(item.tipo),
    fecha: item.created_at.slice(0, 10),
    estado: toEstado(item.estado),
    prioridad: "media",
  };
}

export async function getIncidenciasRows(limit = 100): Promise<RhIncidenciaTablaFila[]> {
  const res = await fetchWithAuth(`/api/v1/incidencias?limit=${limit}`);
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as IncidenciasFetchError;
  }
  const page = (await res.json()) as IncidenciasApiPage;
  return page.items.map(toFila);
}
