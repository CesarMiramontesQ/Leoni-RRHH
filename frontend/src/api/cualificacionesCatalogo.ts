import { fetchWithAuth } from "./http.ts";
import type {
  CatalogoCompleto,
  CualificacionCatalogo,
  MetodoCalificacion,
  OpcionCalificacion,
  TipoCualificacion,
} from "../dashboard/cualificaciones/types.ts";

export type CatalogoFetchError = { status: number; detail: string };

async function readErrorDetail(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      const d = (parsed as { detail?: unknown }).detail;
      if (typeof d === "string" && d.trim()) return d.trim();
    }
  } catch {
    /* noop */
  }
  return raw.trim() || res.statusText || "Error";
}

function throwIfNotOk(res: Response, detail: string): never {
  throw { status: res.status, detail } as CatalogoFetchError;
}

export async function getCatalogoCompleto(): Promise<CatalogoCompleto> {
  const res = await fetchWithAuth("/api/v1/cualificaciones-catalogo/catalogo-completo");
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return res.json() as Promise<CatalogoCompleto>;
}

export async function getTiposCualificacion(): Promise<TipoCualificacion[]> {
  const res = await fetchWithAuth("/api/v1/cualificaciones-catalogo/tipos?page_size=200");
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  const data = await res.json();
  return (data.items ?? []) as TipoCualificacion[];
}

export async function createTipoCualificacion(body: {
  nombre: string;
  descripcion?: string;
  metodo_calificacion_id: number;
}): Promise<TipoCualificacion> {
  const res = await fetchWithAuth("/api/v1/cualificaciones-catalogo/tipos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return res.json() as Promise<TipoCualificacion>;
}

export async function updateTipoCualificacion(
  id: number,
  body: {
    nombre?: string;
    descripcion?: string;
    metodo_calificacion_id?: number;
    activo?: boolean;
  },
): Promise<TipoCualificacion> {
  const res = await fetchWithAuth(`/api/v1/cualificaciones-catalogo/tipos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return res.json() as Promise<TipoCualificacion>;
}

export async function deleteTipoCualificacion(id: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/cualificaciones-catalogo/tipos/${id}`, { method: "DELETE" });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
}

export async function getMetodosCalificacion(): Promise<MetodoCalificacion[]> {
  const res = await fetchWithAuth("/api/v1/cualificaciones-catalogo/metodos?page_size=200");
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  const data = await res.json();
  return (data.items ?? []) as MetodoCalificacion[];
}

export async function createMetodoCalificacion(body: {
  nombre: string;
  tipo: string;
  descripcion?: string;
  config?: Record<string, unknown>;
}): Promise<MetodoCalificacion> {
  const res = await fetchWithAuth("/api/v1/cualificaciones-catalogo/metodos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return res.json() as Promise<MetodoCalificacion>;
}

export async function updateMetodoCalificacion(
  id: number,
  body: Record<string, unknown>,
): Promise<MetodoCalificacion> {
  const res = await fetchWithAuth(`/api/v1/cualificaciones-catalogo/metodos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return res.json() as Promise<MetodoCalificacion>;
}

export async function deleteMetodoCalificacion(id: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/cualificaciones-catalogo/metodos/${id}`, { method: "DELETE" });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
}

export async function getOpcionesMetodo(metodoId: number): Promise<OpcionCalificacion[]> {
  const res = await fetchWithAuth(`/api/v1/cualificaciones-catalogo/metodos/${metodoId}/opciones`);
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return res.json() as Promise<OpcionCalificacion[]>;
}

export async function createOpcionMetodo(
  metodoId: number,
  body: { etiqueta: string; valor: string; orden?: number; peso?: number | null },
): Promise<OpcionCalificacion> {
  const res = await fetchWithAuth(`/api/v1/cualificaciones-catalogo/metodos/${metodoId}/opciones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return res.json() as Promise<OpcionCalificacion>;
}

export async function updateOpcionMetodo(
  metodoId: number,
  opcionId: number,
  body: Record<string, unknown>,
): Promise<OpcionCalificacion> {
  const res = await fetchWithAuth(
    `/api/v1/cualificaciones-catalogo/metodos/${metodoId}/opciones/${opcionId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return res.json() as Promise<OpcionCalificacion>;
}

export async function deleteOpcionMetodo(metodoId: number, opcionId: number): Promise<void> {
  const res = await fetchWithAuth(
    `/api/v1/cualificaciones-catalogo/metodos/${metodoId}/opciones/${opcionId}`,
    { method: "DELETE" },
  );
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
}

export async function getCualificacionesCatalogo(): Promise<CualificacionCatalogo[]> {
  const res = await fetchWithAuth("/api/v1/cualificaciones-catalogo/cualificaciones?page_size=200");
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  const data = await res.json();
  return (data.items ?? []) as CualificacionCatalogo[];
}

export async function createCualificacionCatalogo(body: {
  tipo_cualificacion_id: number;
  metodo_calificacion_id: number;
  nombre: string;
  descripcion?: string;
  obligatorio?: boolean;
}): Promise<CualificacionCatalogo> {
  const res = await fetchWithAuth("/api/v1/cualificaciones-catalogo/cualificaciones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return res.json() as Promise<CualificacionCatalogo>;
}

export async function updateCualificacionCatalogo(
  id: number,
  body: Record<string, unknown>,
): Promise<CualificacionCatalogo> {
  const res = await fetchWithAuth(`/api/v1/cualificaciones-catalogo/cualificaciones/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return res.json() as Promise<CualificacionCatalogo>;
}

export async function deleteCualificacionCatalogo(id: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/cualificaciones-catalogo/cualificaciones/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
}
