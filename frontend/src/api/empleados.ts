import { fetchWithAuth } from "./http.ts";
import type {
  CatalogoFiltros,
  UsuarioPage,
  UsuarioResumen,
  UsuariosFetchError,
} from "./usuarios.ts";

export type { CatalogoFiltros, UsuarioPage, UsuarioResumen };

async function readErrorDetail(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const j = JSON.parse(raw) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
  } catch {
    /* ignore */
  }
  return raw || res.statusText || "Error";
}

function throwIfNotOk(res: Response, detail: string): never {
  const err: UsuariosFetchError = { status: res.status, detail };
  throw err;
}

export async function getEmpleadosResumen(): Promise<UsuarioResumen> {
  const res = await fetchWithAuth("/api/v1/empleados/resumen");
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as UsuarioResumen;
}

export type EmpleadosListParams = {
  page: number;
  page_size: number;
  q?: string;
  area_id?: number;
  puesto_id?: number | number[];
  /** Solo aplica con rol RH: true = activos, false = no activos, omitir = todos. */
  activo?: boolean;
  /** Solo supervisor/gerente: activo | inactivo | permiso. */
  estatus?: string;
  /** Solo supervisor/gerente: contrato por vencer en 30 días. */
  solo_contratos_por_vencer?: boolean;
};

export async function getEmpleadosPage(params: EmpleadosListParams): Promise<UsuarioPage> {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("page_size", String(params.page_size));
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.area_id != null && !Number.isNaN(params.area_id)) {
    sp.set("area_id", String(params.area_id));
  }
  if (Array.isArray(params.puesto_id)) {
    for (const id of params.puesto_id) {
      if (!Number.isNaN(id)) sp.append("puesto_id", String(id));
    }
  } else if (params.puesto_id != null && !Number.isNaN(params.puesto_id)) {
    sp.set("puesto_id", String(params.puesto_id));
  }
  if (params.activo === true) sp.set("activo", "true");
  if (params.activo === false) sp.set("activo", "false");
  if (params.estatus?.trim()) sp.set("estatus", params.estatus.trim().toLowerCase());
  if (params.solo_contratos_por_vencer === true) sp.set("solo_contratos_por_vencer", "true");

  const res = await fetchWithAuth(`/api/v1/empleados?${sp.toString()}`);
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as UsuarioPage;
}

export async function getEmpleadosCatalogoFiltros(): Promise<CatalogoFiltros> {
  const res = await fetchWithAuth("/api/v1/empleados/catalogo-filtros");
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as CatalogoFiltros;
}

export type { UsuarioVista360 } from "./vista360.ts";
export { getEmpleadoVista360 } from "./vista360.ts";
