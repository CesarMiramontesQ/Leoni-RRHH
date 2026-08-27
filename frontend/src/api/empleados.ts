import { fetchWithAuth } from "./http.ts";
import type {
  CatalogoFiltros,
  UsuarioListItem,
  UsuarioPage,
  UsuarioResumen,
  UsuariosFetchError,
} from "./usuarios.ts";
import { formatNoEmpleadoDisplay } from "../utils/noEmpleadoDisplay.ts";

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

/** El backend expone `no_empleado` como entero; la UI espera string. */
function normalizeUsuarioListItem(item: UsuarioListItem & { no_empleado?: string | number | null }): UsuarioListItem {
  return {
    ...item,
    no_empleado: formatNoEmpleadoDisplay(item.no_empleado) || "",
  };
}

function normalizeUsuarioPage(page: UsuarioPage): UsuarioPage {
  return {
    ...page,
    items: page.items.map((item) =>
      normalizeUsuarioListItem(item as UsuarioListItem & { no_empleado?: string | number | null }),
    ),
  };
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
  /** Solo RH: activos sin líder asignado (mismo criterio que KPI). */
  solo_sin_lider?: boolean;
  /** Solo RH: administrativos activos sin email registrado (mismo criterio que KPI). */
  solo_sin_email?: boolean;
};

export async function getEmpleadosPage(
  params: EmpleadosListParams,
  opts: { signal?: AbortSignal } = {},
): Promise<UsuarioPage> {
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
  if (params.solo_sin_lider === true) sp.set("solo_sin_lider", "true");
  if (params.solo_sin_email === true) sp.set("solo_sin_email", "true");

  const res = await fetchWithAuth(
    `/api/v1/empleados?${sp.toString()}`,
    opts.signal ? { signal: opts.signal } : {},
  );
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return normalizeUsuarioPage((await res.json()) as UsuarioPage);
}

export async function getEmpleadosCatalogoFiltros(): Promise<CatalogoFiltros> {
  const res = await fetchWithAuth("/api/v1/empleados/catalogo-filtros");
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as CatalogoFiltros;
}

export type EmpleadosExportListParams = Omit<EmpleadosListParams, "page" | "page_size">;

/** Todas las filas del listado con los filtros indicados (pagina en bloques de 100). */
export async function fetchAllEmpleadosForExport(
  filters: EmpleadosExportListParams,
): Promise<UsuarioListItem[]> {
  const out: UsuarioListItem[] = [];
  let page = 1;
  const pageSize = 100;
  while (true) {
    const pg = await getEmpleadosPage({ ...filters, page, page_size: pageSize });
    out.push(...pg.items);
    if (pg.items.length === 0 || page * pageSize >= pg.total) break;
    page += 1;
  }
  return out;
}

export type { UsuarioVista360 } from "./vista360.ts";
export { getEmpleadoVista360 } from "./vista360.ts";

export type EmpleadoHomeOfficeDisponibilidad = {
  empleado_id: number;
  /** Administrativo y con regla de HO activa en su área. false ⇒ no se ofrece el tipo. */
  elegible: boolean;
  /** HO activos en el periodo de la regla que contiene la fecha consultada. */
  dias_usados: number;
  puede_solicitar: boolean;
};

export async function getEmpleadoHomeOfficeDisponibilidad(
  empleadoId: number,
  fechaReferencia: string,
  excluirSolicitudId?: number,
): Promise<EmpleadoHomeOfficeDisponibilidad> {
  const sp = new URLSearchParams();
  sp.set("fecha", fechaReferencia);
  if (excluirSolicitudId != null) {
    sp.set("excluir_solicitud_id", String(excluirSolicitudId));
  }
  const res = await fetchWithAuth(
    `/api/v1/empleados/${empleadoId}/home-office/disponibilidad?${sp.toString()}`,
  );
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as EmpleadoHomeOfficeDisponibilidad;
}

export type EmpleadoDescansosResponse = {
  empleado_id: number;
  no_empleado: number;
  fecha_inicio: string;
  fecha_fin: string;
  descansos: string[];
};

export async function getEmpleadoDescansos(
  empleadoId: number,
  fechaInicio: string,
  fechaFin: string,
): Promise<EmpleadoDescansosResponse> {
  const sp = new URLSearchParams({
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
  });
  const res = await fetchWithAuth(
    `/api/v1/empleados/${empleadoId}/descansos?${sp.toString()}`,
  );
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as EmpleadoDescansosResponse;
}
