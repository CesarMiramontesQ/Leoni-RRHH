import {
  fetchEmpleadoActasPage,
  fetchEmpleadoComedorRegistrosPage,
  fetchEmpleadoIncidenciasPage,
  VISTA360_PAGE_SIZE,
} from "../../api/vista360Tablas.ts";
import { canAccessUsuariosAdmin } from "../../auth/jwt.ts";
import { fmtDateTimeIso, fmtFechaCorta, fmtTablaCelda } from "../../ui/uiUtils.ts";
import type { Vista360TabId } from "./tabs.ts";
import {
  renderVista360Tabla,
  renderVista360TablaEmpty,
  renderVista360TablaError,
  renderVista360TablaLoading,
  type Vista360TablaColumn,
  type Vista360TablaRow,
} from "./vista360RegistrosTabla.ts";

type TabPageState = {
  page: number;
  total: number;
};

const INC_COLS: Vista360TablaColumn[] = [
  { key: "folio", label: "Folio", cellClass: "whitespace-nowrap px-3 py-3 text-sm font-medium text-slate-800 sm:px-4" },
  { key: "tipo", label: "Tipo" },
  { key: "fecha", label: "Fecha" },
  { key: "area", label: "Área" },
  { key: "registro", label: "Registro", cellClass: "whitespace-nowrap px-3 py-3 text-sm text-slate-600 sm:px-4" },
];

const ACTAS_COLS: Vista360TablaColumn[] = [
  { key: "id", label: "ID", cellClass: "whitespace-nowrap px-3 py-3 text-sm font-medium text-slate-800 sm:px-4" },
  { key: "tipo", label: "Tipo de falta" },
  { key: "fecha", label: "Fecha evento" },
  { key: "area", label: "Área" },
  { key: "estado", label: "Estado" },
];

const COMEDOR_COLS: Vista360TablaColumn[] = [
  { key: "fecha", label: "Fecha servicio", cellClass: "whitespace-nowrap px-3 py-3 text-sm text-slate-800 sm:px-4" },
  { key: "comedor", label: "Comedor" },
  { key: "tipo", label: "Tipo comida" },
  { key: "estado", label: "Estado" },
];

function labelEstadoActa(estado: string): string {
  switch (estado) {
    case "draft":
      return "Borrador";
    case "pending_sign":
      return "Pendiente de firma";
    case "signed":
      return "Firmada";
    case "archived":
      return "Archivada";
    case "cancelled":
      return "Cancelada";
    default:
      return estado;
  }
}

function labelEstadoComedor(estado: string): string {
  const e = estado.toLowerCase();
  if (e === "pendiente" || e === "accedido") return "Confirmado";
  if (e === "cancelado") return "Cancelado";
  return estado;
}

function hostEl(root: HTMLElement, tabId: Vista360TabId): HTMLElement | null {
  return root.querySelector(`[data-v360-tabla-host="${tabId}"]`);
}

function normalizePageItems<T>(
  data: { items?: T[] | null; total?: number; page?: number },
  fallbackPage: number,
): { items: T[]; total: number; page: number } {
  return {
    items: Array.isArray(data.items) ? data.items : [],
    total: typeof data.total === "number" && Number.isFinite(data.total) ? data.total : 0,
    page: typeof data.page === "number" && Number.isFinite(data.page) ? data.page : fallbackPage,
  };
}

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "AbortError") return true;
  return (
    e !== null &&
    typeof e === "object" &&
    "name" in e &&
    (e as { name: string }).name === "AbortError"
  );
}

function errorDetail(e: unknown): string {
  if (e && typeof e === "object" && "detail" in e && typeof (e as { detail: string }).detail === "string") {
    return (e as { detail: string }).detail;
  }
  return "No se pudieron cargar los registros.";
}

export function bindVista360RegistrosTablas(opts: {
  root: HTMLElement;
  empleadoId: number;
  noEmpleado: string;
  signal: AbortSignal;
  onTabActivated?: (tab: Vista360TabId) => void;
}): { loadTab: (tab: Vista360TabId) => void } {
  const { root, empleadoId, noEmpleado, signal } = opts;
  const isRh = canAccessUsuariosAdmin();

  const pages: Record<Vista360TabId, TabPageState> = {
    incidencias: { page: 1, total: 0 },
    actas: { page: 1, total: 0 },
    "registros-comedor": { page: 1, total: 0 },
  };

  let loadGen = 0;

  async function renderIncidencias(page: number): Promise<void> {
    const host = hostEl(root, "incidencias");
    if (!host) return;
    host.innerHTML = renderVista360TablaLoading();
    const raw = await fetchEmpleadoIncidenciasPage(empleadoId, page, signal);
    const data = normalizePageItems(raw, page);
    const rows: Vista360TablaRow[] = data.items.map((i) => ({
      folio: `INC-${i.id}`,
      tipo: fmtTablaCelda(i.tipo),
      fecha: i.fecha?.trim() ? fmtFechaCorta(i.fecha.slice(0, 10)) : "—",
      area: fmtTablaCelda(i.area),
      registro: fmtDateTimeIso(i.created_at),
    }));
    pages.incidencias = { page: data.page, total: data.total };
    host.innerHTML = renderVista360Tabla("incidencias", INC_COLS, rows, {
      page: data.page,
      total: data.total,
      pageSize: VISTA360_PAGE_SIZE,
    });
  }

  async function renderActas(page: number): Promise<void> {
    const host = hostEl(root, "actas");
    if (!host) return;
    host.innerHTML = renderVista360TablaLoading();
    const raw = await fetchEmpleadoActasPage(empleadoId, page, signal);
    const data = normalizePageItems(raw, page);
    const rows: Vista360TablaRow[] = data.items.map((a) => ({
      id: String(a.id),
      tipo: fmtTablaCelda(a.tipo_falta),
      fecha: a.fecha_evento ? fmtFechaCorta(String(a.fecha_evento).slice(0, 10)) : "—",
      area: fmtTablaCelda(a.area_departamento),
      estado: labelEstadoActa(a.estado),
    }));
    pages.actas = { page: data.page, total: data.total };
    host.innerHTML = renderVista360Tabla("actas", ACTAS_COLS, rows, {
      page: data.page,
      total: data.total,
      pageSize: VISTA360_PAGE_SIZE,
    });
  }

  async function renderComedor(page: number): Promise<void> {
    const host = hostEl(root, "registros-comedor");
    if (!host) return;
    if (!isRh) {
      host.innerHTML = renderVista360TablaEmpty(
        "Registros de comedor no disponibles",
        "La consulta de registros de comedor en Vista 360 está disponible para usuarios con rol RH.",
      );
      return;
    }
    host.innerHTML = renderVista360TablaLoading();
    const raw = await fetchEmpleadoComedorRegistrosPage(noEmpleado, page);
    const data = normalizePageItems(raw, page);
    const rows: Vista360TablaRow[] = data.items.map((r) => ({
      fecha: r.fecha_servicio ? fmtFechaCorta(String(r.fecha_servicio).slice(0, 10)) : "—",
      comedor: fmtTablaCelda(r.comedor_nombre),
      tipo: fmtTablaCelda(r.tipo_comida),
      estado: labelEstadoComedor(r.estado_acceso),
    }));
    pages["registros-comedor"] = { page: data.page, total: data.total };
    host.innerHTML = renderVista360Tabla("registros-comedor", COMEDOR_COLS, rows, {
      page: data.page,
      total: data.total,
      pageSize: VISTA360_PAGE_SIZE,
    });
  }

  async function loadTab(tab: Vista360TabId): Promise<void> {
    const gen = ++loadGen;
    const host = hostEl(root, tab);
    if (!host) return;
    try {
      const page = pages[tab].page;
      if (tab === "incidencias") await renderIncidencias(page);
      else if (tab === "actas") await renderActas(page);
      else await renderComedor(page);
    } catch (e: unknown) {
      if (signal.aborted || isAbortError(e) || gen !== loadGen) return;
      host.innerHTML = renderVista360TablaError(errorDetail(e));
    }
    opts.onTabActivated?.(tab);
  }

  root.addEventListener(
    "click",
    (ev) => {
      const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>("[data-v360-tabla-page]");
      if (!btn || !root.contains(btn)) return;
      const tabId = btn.getAttribute("data-v360-tabla-page") as Vista360TabId | null;
      const pageRaw = btn.getAttribute("data-v360-page");
      if (!tabId || !pageRaw) return;
      const page = Number.parseInt(pageRaw, 10);
      if (!Number.isFinite(page) || page < 1) return;
      const totalPages = Math.max(1, Math.ceil(pages[tabId].total / VISTA360_PAGE_SIZE) || 1);
      if (page > totalPages) return;
      pages[tabId].page = page;
      void loadTab(tabId);
    },
    { signal },
  );

  return { loadTab };
}
