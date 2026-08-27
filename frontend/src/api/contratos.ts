/**
 * Contratos del personal (`/api/v1/contratos`): vencimientos leídos de la caché en Bono
 * (`levelup_empleados_tress`, sync diario 04:10). Solo RH con el módulo `contratos`.
 */
import { fetchWithAuth } from "./http.ts";

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

export class ContratosFetchError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ContratosFetchError";
    this.status = status;
  }
}

async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  throw new ContratosFetchError(res.status, await readErrorDetail(res));
}

/** Excluyentes: las tarjetas suman el total. */
export type EstatusContrato = "vencido" | "por_vencer" | "vigente" | "indefinido" | "sin_dato";

export const ESTATUS_CONTRATO: readonly EstatusContrato[] = [
  "vencido",
  "por_vencer",
  "vigente",
  "indefinido",
  "sin_dato",
];

export const VENTANA_DIAS_DEFAULT = 30;
export const VENTANA_DIAS_OPCIONES: readonly number[] = [15, 30, 60, 90];

export type ContratoEmpleadoResumen = {
  contrato_codigo: string | null;
  contrato_descripcion: string | null;
  /** 0 = indefinido; null = código sin catálogo. */
  contrato_dias: number | null;
  fecha_contrato: string | null;
  fecha_vencimiento: string | null;
  /** Negativo si ya venció; null si no vence o no hay dato. */
  dias_restantes: number | null;
  estatus: EstatusContrato;
  sincronizado_en: string | null;
};

export type ContratoEmpleadoItem = ContratoEmpleadoResumen & {
  empleado_id: number;
  no_empleado: number;
  nombre: string;
  area: string | null;
  puesto: string | null;
  supervisor: string | null;
};

export type ContratosListResponse = {
  items: ContratoEmpleadoItem[];
  total: number;
  page: number;
  page_size: number;
  ventana_dias: number;
};

export type ContratosKpisResponse = {
  vencidos: number;
  por_vencer: number;
  vigentes: number;
  indefinidos: number;
  sin_dato: number;
  total: number;
  ventana_dias: number;
};

export type ContratoAreaOption = { area_id: number; descripcion: string };

export type ContratosFiltros = {
  ventana_dias: number;
  estatus: EstatusContrato | "";
  area_id: number | null;
  q: string;
};

const BASE = "/api/v1/contratos";

function paramsFiltros(f: ContratosFiltros, conEstatus: boolean): URLSearchParams {
  const sp = new URLSearchParams();
  sp.set("ventana_dias", String(f.ventana_dias));
  if (conEstatus && f.estatus) sp.set("estatus", f.estatus);
  if (f.area_id != null) sp.set("area_id", String(f.area_id));
  if (f.q.trim()) sp.set("q", f.q.trim());
  return sp;
}

export async function getContratos(
  f: ContratosFiltros,
  page: number,
  pageSize: number,
): Promise<ContratosListResponse> {
  const sp = paramsFiltros(f, true);
  sp.set("page", String(page));
  sp.set("page_size", String(pageSize));
  const res = await fetchWithAuth(`${BASE}?${sp.toString()}`);
  await throwIfNotOk(res);
  return (await res.json()) as ContratosListResponse;
}

export async function getContratosKpis(f: ContratosFiltros): Promise<ContratosKpisResponse> {
  const res = await fetchWithAuth(`${BASE}/kpis?${paramsFiltros(f, false).toString()}`);
  await throwIfNotOk(res);
  return (await res.json()) as ContratosKpisResponse;
}

export async function getContratosAreas(): Promise<ContratoAreaOption[]> {
  const res = await fetchWithAuth(`${BASE}/areas`);
  await throwIfNotOk(res);
  return (await res.json()) as ContratoAreaOption[];
}

/** Descarga el CSV del listado filtrado (todas las páginas). */
export async function descargarContratosCsv(f: ContratosFiltros): Promise<Blob> {
  const res = await fetchWithAuth(`${BASE}/export.csv?${paramsFiltros(f, true).toString()}`);
  await throwIfNotOk(res);
  return await res.blob();
}

export function contratosErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ContratosFetchError) return error.message || fallback;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Etiqueta y tonos del badge de estatus (semánticos, ver design.md 8.5). */
export function estatusContratoMeta(estatus: EstatusContrato): { label: string; cls: string; dot: string } {
  switch (estatus) {
    case "vencido":
      return { label: "Vencido", cls: "border-red-200 bg-red-50 text-red-800", dot: "bg-red-500" };
    case "por_vencer":
      return { label: "Por vencer", cls: "border-amber-200 bg-amber-50 text-amber-900", dot: "bg-amber-400" };
    case "vigente":
      return { label: "Vigente", cls: "border-emerald-200 bg-emerald-50 text-emerald-900", dot: "bg-emerald-500" };
    case "indefinido":
      return { label: "Indefinido", cls: "border-sky-200 bg-sky-50 text-sky-900", dot: "bg-sky-500" };
    default:
      return { label: "Sin dato", cls: "border-slate-200 bg-slate-100 text-slate-700", dot: "bg-slate-400" };
  }
}

export function estatusContratoBadge(estatus: EstatusContrato): string {
  const m = estatusContratoMeta(estatus);
  return `<span class="inline-flex items-center gap-1.5 rounded-full border ${m.cls} px-2 py-0.5 text-xs font-semibold"><span class="size-1.5 shrink-0 rounded-full ${m.dot}" aria-hidden="true"></span>${m.label}</span>`;
}

/** «En 12 d» / «Hace 12 d» / «Hoy»; vacío cuando no aplica. */
export function diasRestantesTexto(dias: number | null): string {
  if (dias == null) return "";
  if (dias === 0) return "Hoy";
  if (dias > 0) return `En ${dias} d`;
  return `Hace ${Math.abs(dias)} d`;
}
