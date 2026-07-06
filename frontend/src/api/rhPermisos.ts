import { fetchWithAuth } from "./http.ts";

export type RhModuloCatalogItem = {
  key: string;
  label: string;
  group: string;
  nav_item_ids: string[];
};

export type RhPermisosMeResponse = {
  rol: string;
  puede_administrar_permisos_rh: boolean;
  modulos: Record<string, boolean>;
  inscrito: boolean;
  en_lista_permisos: boolean;
};

export type RhUsuarioPermisosItem = {
  empleado_id: number;
  no_empleado: string;
  nombre: string;
  email: string | null;
  rol_nombre: string;
  activo: boolean;
  permisos_personalizados: boolean;
  puede_administrar_permisos_rh: boolean;
  modulos: Record<string, boolean>;
  editable: boolean;
};

export type RhEmpleadoBusquedaItem = {
  empleado_id: number;
  no_empleado: string;
  nombre: string;
  email: string | null;
  rol_nombre: string;
};

export async function fetchRhPermisosMe(): Promise<RhPermisosMeResponse | null> {
  const res = await fetchWithAuth("/api/v1/rh-permisos/me");
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`rh-permisos/me: ${res.status}`);
  return (await res.json()) as RhPermisosMeResponse;
}

export async function fetchRhModulosCatalogo(): Promise<RhModuloCatalogItem[]> {
  const res = await fetchWithAuth("/api/v1/rh-permisos/modulos");
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { detail?: string } | null;
    const detail = err?.detail ?? `HTTP ${res.status}`;
    throw new Error(`No se pudieron cargar los módulos RH (${detail}).`);
  }
  return (await res.json()) as RhModuloCatalogItem[];
}

export async function fetchRhUsuariosPermisos(): Promise<RhUsuarioPermisosItem[]> {
  const res = await fetchWithAuth("/api/v1/rh-permisos/usuarios");
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { detail?: string } | null;
    const detail = err?.detail ?? `HTTP ${res.status}`;
    throw new Error(`No se pudieron cargar los usuarios (${detail}).`);
  }
  return (await res.json()) as RhUsuarioPermisosItem[];
}

export async function buscarEmpleadosParaPermisos(q: string): Promise<RhEmpleadoBusquedaItem[]> {
  const sp = new URLSearchParams({ q });
  const res = await fetchWithAuth(`/api/v1/rh-permisos/empleados-buscar?${sp.toString()}`);
  if (!res.ok) throw new Error(`rh-permisos/empleados-buscar: ${res.status}`);
  return (await res.json()) as RhEmpleadoBusquedaItem[];
}

export async function agregarEmpleadoPermisos(empleadoId: number): Promise<RhUsuarioPermisosItem> {
  const res = await fetchWithAuth(`/api/v1/rh-permisos/usuarios/${empleadoId}`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(err?.detail ?? `rh-permisos/usuarios/${empleadoId}: ${res.status}`);
  }
  return (await res.json()) as RhUsuarioPermisosItem;
}

export async function deleteRhUsuarioPermisos(empleadoId: number): Promise<void> {
  const res = await fetchWithAuth(`/api/v1/rh-permisos/usuarios/${empleadoId}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    const err = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(err?.detail ?? `rh-permisos/usuarios/${empleadoId}: ${res.status}`);
  }
}

export async function updateRhUsuarioPermisos(
  empleadoId: number,
  modulos: Record<string, boolean>,
): Promise<RhUsuarioPermisosItem> {
  const res = await fetchWithAuth(`/api/v1/rh-permisos/usuarios/${empleadoId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modulos }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(err?.detail ?? `rh-permisos/usuarios/${empleadoId}: ${res.status}`);
  }
  return (await res.json()) as RhUsuarioPermisosItem;
}

export async function setRhAdminPermisos(
  empleadoId: number,
  conceder: boolean,
): Promise<RhUsuarioPermisosItem> {
  const res = await fetchWithAuth(`/api/v1/rh-permisos/usuarios/${empleadoId}/admin`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conceder }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(err?.detail ?? `rh-permisos/usuarios/${empleadoId}/admin: ${res.status}`);
  }
  return (await res.json()) as RhUsuarioPermisosItem;
}
