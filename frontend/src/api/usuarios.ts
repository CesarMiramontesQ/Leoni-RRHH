/** Tipos compartidos (directorio en GET /api/v1/empleados; CRUD en /api/v1/usuarios). */

export type EmpleadoDistribucionItem = {
  label: string;
  total: number;
};

export type EmpleadosClasificacionTipo = "administrativo" | "directo" | "indirecto";

export type EmpleadosPorClasificacionAreaSerie = {
  tipo: EmpleadosClasificacionTipo;
  clasificacion_id: number | null;
  clasificacion_descripcion: string;
  por_area: readonly EmpleadoDistribucionItem[];
};

export type UsuarioResumen = {
  total_plantilla: number;
  activos: number;
  inactivos: number;
  sin_lider_asignado: number;
  /** Administrativos activos sin correo registrado (empleado.email ni tabla emails). */
  sin_email_administrativo: number;
  practicantes: number;
  porcentaje_operatividad: number;
  /** Activos en el alcance del rol (plantilla completa para RH; equipo para supervisor/gerente). */
  colaboradores_total: number;
  /** Contratos con fin en los próximos 30 días (mismo alcance). */
  contratos_por_vencer: number;
  /** Activos por área, desglosados por clasificación (solo resumen RH / plantilla completa). */
  empleados_por_clasificacion_y_area?: readonly EmpleadosPorClasificacionAreaSerie[];
};

export type RolBrief = { id: number; nombre: string };

export type CatalogoBase = { descripcion: string; estatus_id: number };

export type AreaResponse = CatalogoBase & { area_id: number };

export type PuestoResponse = CatalogoBase & { puesto_id: number; area_id?: number | null };

export type SubareaResponse = CatalogoBase & { subarea_id: number; area_id: number };

export type EstadoEmpleadoResponse = CatalogoBase & { estado_id: number };

export type CategoriaResponse = {
  categoria_id: number;
  nivel?: string | null;
  descripcion?: string | null;
  estatus_id: number;
};

export type ClasificacionEmpleadoResponse = CatalogoBase & {
  clasificacion_id: number;
  significado?: string | null;
};

/** Fila de listado / UsuarioResponse del API. */
export type UsuarioListItem = {
  id: number;
  empleado_id: number;
  no_empleado: string;
  nombre: string;
  email: string | null;
  rol_id: number;
  rol: RolBrief | null;
  estado: EstadoEmpleadoResponse | null;
  area: AreaResponse | null;
  subarea: SubareaResponse | null;
  puesto: PuestoResponse | null;
  categoria: CategoriaResponse | null;
  clasificacion: ClasificacionEmpleadoResponse | null;
  lider_id: number | null;
  /** URL o ruta de foto de perfil (listado directorio). */
  foto?: string | null;
  /** Solo en GET /empleados (listado). */
  lider_nombre?: string | null;
  registro: string | null;
  created_at: string;
};

export type UsuarioPage = {
  items: UsuarioListItem[];
  total: number;
  page: number;
  page_size: number;
};

export type CatalogoFiltros = {
  areas: AreaResponse[];
  puestos: PuestoResponse[];
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
