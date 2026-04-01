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
  departamento?: string;
  puesto?: string;
  /** Solo aplica para rol RH (backend ignora en otros roles). */
  activo?: boolean | null;
};

export async function getEmpleadosPage(params: EmpleadosListParams): Promise<UsuarioPage> {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("page_size", String(params.page_size));
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.departamento) sp.set("departamento", params.departamento);
  if (params.puesto) sp.set("puesto", params.puesto);
  if (params.activo === true) sp.set("activo", "true");
  if (params.activo === false) sp.set("activo", "false");

  const res = await fetchWithAuth(`/api/v1/empleados?${sp.toString()}`);
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as UsuarioPage;
}

export async function getEmpleadosCatalogoFiltros(): Promise<CatalogoFiltros> {
  const res = await fetchWithAuth("/api/v1/empleados/catalogo-filtros");
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as CatalogoFiltros;
}
