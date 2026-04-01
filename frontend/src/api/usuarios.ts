/** Tipos compartidos (directorio en GET /api/v1/empleados; CRUD en /api/v1/usuarios). */

export type UsuarioResumen = {
  total_plantilla: number;
  activos: number;
  capacitacion_pendiente: number;
  practicantes: number;
  porcentaje_operatividad: number;
};

export type RolBrief = { id: number; nombre: string };

export type UsuarioListItem = {
  id: number;
  num_empleado: string;
  nombre: string;
  apellido: string;
  email: string;
  departamento: string | null;
  puesto: string | null;
  rol_id: number;
  rol: RolBrief | null;
  supervisor_id: number | null;
  supervisor_nombre: string | null;
  activo: boolean;
  fecha_ingreso: string | null;
  created_at: string;
};

export type UsuarioPage = {
  items: UsuarioListItem[];
  total: number;
  page: number;
  page_size: number;
};

export type CatalogoFiltros = {
  departamentos: string[];
  puestos: string[];
};

export type UsuariosFetchError = {
  status: number;
  detail: string;
};

export function isUsuariosFetchError(e: unknown): e is UsuariosFetchError {
  return (
    typeof e === "object" &&
    e !== null &&
    "status" in e &&
    "detail" in e &&
    typeof (e as UsuariosFetchError).detail === "string"
  );
}
