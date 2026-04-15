export type ActaTipoCodigo = "amonestacion" | "suspension" | "administrativa";
export type ActaEstadoCodigo = "abierta" | "en_proceso" | "firmada" | "cerrada";

export type ActaTablaFila = {
  id: number;
  folio: string;
  empleado_id: string;
  empleado_nombre_raw: string;
  foto_url: string | null;
  area: string;
  supervisor_id: string;
  supervisor_nombre: string;
  tipo: ActaTipoCodigo;
  fecha: string;
  estado: ActaEstadoCodigo;
};

export type ActaInvolucrado = {
  id: string;
  nombre: string;
  rol: string;
};

export type ActaHistorialEvento = {
  id: string;
  titulo: string;
  descripcion: string;
  fecha_hora: string;
};

export type ActaAdjunto = {
  id: string;
  nombre: string;
  extension: string;
  peso_mb: number;
  preview_color: "blue" | "amber" | "emerald" | "slate";
};

export type ActaDetalle = {
  id: number;
  folio: string;
  titulo_documento: string;
  estado: ActaEstadoCodigo;
  fecha_creacion: string;
  empleado: {
    id: string;
    nombre: string;
    foto_url: string | null;
    area: string;
    puesto: string;
    supervisor_directo: string;
  };
  evento: {
    tipo_incidencia: string;
    fecha_hora: string;
    ubicacion: string;
    descripcion: string;
  };
  involucrados: ActaInvolucrado[];
  historial: ActaHistorialEvento[];
  adjuntos: ActaAdjunto[];
};

export const ACTAS_MOCK_ROWS: readonly ActaTablaFila[] = [
  { id: 1, folio: "ACT-2401", empleado_id: "emp-1001", empleado_nombre_raw: "JUAN PEREZ", foto_url: null, area: "Producción", supervisor_id: "sup-1", supervisor_nombre: "Carlos Pérez", tipo: "amonestacion", fecha: "2026-04-12", estado: "abierta" },
  { id: 2, folio: "ACT-2402", empleado_id: "emp-1002", empleado_nombre_raw: "MARIA LOPEZ", foto_url: null, area: "Calidad", supervisor_id: "sup-2", supervisor_nombre: "Ana Gutiérrez", tipo: "suspension", fecha: "2026-04-10", estado: "en_proceso" },
  { id: 3, folio: "ACT-2403", empleado_id: "emp-1003", empleado_nombre_raw: "LUIS HERNANDEZ", foto_url: null, area: "Logística", supervisor_id: "sup-3", supervisor_nombre: "Miguel Sánchez", tipo: "administrativa", fecha: "2026-04-07", estado: "firmada" },
  { id: 4, folio: "ACT-2404", empleado_id: "emp-1004", empleado_nombre_raw: "DANIELA CRUZ", foto_url: null, area: "Producción", supervisor_id: "sup-1", supervisor_nombre: "Carlos Pérez", tipo: "amonestacion", fecha: "2026-04-05", estado: "cerrada" },
  { id: 5, folio: "ACT-2405", empleado_id: "emp-1005", empleado_nombre_raw: "JESUS MORALES", foto_url: null, area: "Almacén", supervisor_id: "sup-3", supervisor_nombre: "Miguel Sánchez", tipo: "suspension", fecha: "2026-04-02", estado: "abierta" },
  { id: 6, folio: "ACT-2406", empleado_id: "emp-1006", empleado_nombre_raw: "SOFIA RAMIREZ", foto_url: null, area: "Calidad", supervisor_id: "sup-2", supervisor_nombre: "Ana Gutiérrez", tipo: "administrativa", fecha: "2026-03-30", estado: "en_proceso" },
  { id: 7, folio: "ACT-2407", empleado_id: "emp-1007", empleado_nombre_raw: "ANDRES GOMEZ", foto_url: null, area: "Mantenimiento", supervisor_id: "sup-1", supervisor_nombre: "Carlos Pérez", tipo: "amonestacion", fecha: "2026-03-28", estado: "firmada" },
  { id: 8, folio: "ACT-2408", empleado_id: "emp-1008", empleado_nombre_raw: "PAOLA RIVERA", foto_url: null, area: "Producción", supervisor_id: "sup-1", supervisor_nombre: "Carlos Pérez", tipo: "suspension", fecha: "2026-03-24", estado: "cerrada" },
  { id: 9, folio: "ACT-2409", empleado_id: "emp-1009", empleado_nombre_raw: "MARIO TORRES", foto_url: null, area: "Logística", supervisor_id: "sup-3", supervisor_nombre: "Miguel Sánchez", tipo: "administrativa", fecha: "2026-03-20", estado: "abierta" },
  { id: 10, folio: "ACT-2410", empleado_id: "emp-1010", empleado_nombre_raw: "ELENA VARGAS", foto_url: null, area: "Calidad", supervisor_id: "sup-2", supervisor_nombre: "Ana Gutiérrez", tipo: "amonestacion", fecha: "2026-03-15", estado: "firmada" },
  { id: 11, folio: "ACT-2411", empleado_id: "emp-1011", empleado_nombre_raw: "RICARDO FLORES", foto_url: null, area: "Compras", supervisor_id: "sup-2", supervisor_nombre: "Ana Gutiérrez", tipo: "suspension", fecha: "2026-03-10", estado: "cerrada" },
  { id: 12, folio: "ACT-2412", empleado_id: "emp-1012", empleado_nombre_raw: "FERNANDA ORTIZ", foto_url: null, area: "Producción", supervisor_id: "sup-1", supervisor_nombre: "Carlos Pérez", tipo: "administrativa", fecha: "2026-02-26", estado: "en_proceso" },
];

export const ACTAS_SUPERVISORES: ReadonlyArray<{ id: string; label: string }> = [
  { id: "sup-1", label: "Carlos Pérez" },
  { id: "sup-2", label: "Ana Gutiérrez" },
  { id: "sup-3", label: "Miguel Sánchez" },
];

export const ACTAS_TIPOS: ReadonlyArray<{ id: ActaTipoCodigo; label: string }> = [
  { id: "amonestacion", label: "Amonestación" },
  { id: "suspension", label: "Suspensión" },
  { id: "administrativa", label: "Administrativa" },
];

export const ACTAS_ESTADOS: ReadonlyArray<{ id: ActaEstadoCodigo; label: string }> = [
  { id: "abierta", label: "Abierta" },
  { id: "en_proceso", label: "En proceso" },
  { id: "firmada", label: "Firmada" },
  { id: "cerrada", label: "Cerrada" },
];

export const ACTAS_PERIODOS: ReadonlyArray<{ id: "30d" | "90d" | "365d" | "all"; label: string }> = [
  { id: "30d", label: "Últimos 30 días" },
  { id: "90d", label: "Últimos 90 días" },
  { id: "365d", label: "Últimos 12 meses" },
  { id: "all", label: "Todo" },
];

const PUESTOS_MOCK: readonly string[] = [
  "Operador Especializado II",
  "Inspector de Calidad",
  "Auxiliar de Logística",
  "Técnico de Mantenimiento",
  "Analista de Compras",
];

const TIPOS_INCIDENCIA_MOCK: readonly string[] = [
  "Incumplimiento de Seguridad",
  "Retardo Recurrente",
  "Incidencia Administrativa",
  "Falta al Reglamento Interno",
];

const UBICACIONES_MOCK: readonly string[] = [
  "Planta 3 - Línea B",
  "Almacén Central - Andén 2",
  "Área de Ensamble A",
  "Laboratorio de Calidad",
];

function addMinutes(isoDate: string, minutes: number): string {
  const base = new Date(`${isoDate}T08:30:00`);
  base.setMinutes(base.getMinutes() + minutes);
  return base.toISOString();
}

function detallePorFila(row: ActaTablaFila): ActaDetalle {
  const puesto = PUESTOS_MOCK[row.id % PUESTOS_MOCK.length] ?? "Operador";
  const tipoIncidencia = TIPOS_INCIDENCIA_MOCK[row.id % TIPOS_INCIDENCIA_MOCK.length] ?? "Incidencia";
  const ubicacion = UBICACIONES_MOCK[row.id % UBICACIONES_MOCK.length] ?? "Planta principal";
  const creado = addMinutes(row.fecha, row.id * 7);
  const evento = addMinutes(row.fecha, 6 * 60 + row.id * 5);
  const nombreEmpleadoNormalizado = row.empleado_nombre_raw
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return {
    id: row.id,
    folio: row.folio,
    titulo_documento: "Acta Administrativa",
    estado: row.estado,
    fecha_creacion: creado,
    empleado: {
      id: row.empleado_id.toUpperCase(),
      nombre: nombreEmpleadoNormalizado,
      foto_url: row.foto_url,
      area: row.area,
      puesto,
      supervisor_directo: row.supervisor_nombre,
    },
    evento: {
      tipo_incidencia: tipoIncidencia,
      fecha_hora: evento,
      ubicacion,
      descripcion:
        "Durante el turno se detectó una desviación al procedimiento operativo. Se realizó entrevista con el colaborador y se documentaron observaciones de seguridad y cumplimiento para dar seguimiento conforme al reglamento interno.",
    },
    involucrados: [
      { id: `sup-${row.id}`, nombre: row.supervisor_nombre, rol: "Supervisor de Turno (Reportante)" },
      { id: `testigo-${row.id}`, nombre: "Juan Carlos Pérez", rol: "Testigo (Operador Línea C)" },
      { id: `rh-${row.id}`, nombre: "Lic. Ricardo Vega", rol: "Representante RH" },
    ],
    historial: [
      {
        id: `h1-${row.id}`,
        titulo: "Acta creada",
        descripcion: `Creada por ${row.supervisor_nombre}.`,
        fecha_hora: creado,
      },
      {
        id: `h2-${row.id}`,
        titulo: "Pendiente de revisión RH",
        descripcion: "En espera de validación documental.",
        fecha_hora: addMinutes(row.fecha, row.id * 9 + 45),
      },
      {
        id: `h3-${row.id}`,
        titulo: "Seguimiento de evidencias",
        descripcion: "Se adjuntaron archivos de soporte del evento.",
        fecha_hora: addMinutes(row.fecha, row.id * 11 + 120),
      },
    ],
    adjuntos: [
      {
        id: `a1-${row.id}`,
        nombre: `foto_evento_${row.folio.toLowerCase()}.jpg`,
        extension: "JPG",
        peso_mb: 1.7,
        preview_color: "amber",
      },
      {
        id: `a2-${row.id}`,
        nombre: `reporte_supervision_${row.folio.toLowerCase()}.pdf`,
        extension: "PDF",
        peso_mb: 2.4,
        preview_color: "blue",
      },
      {
        id: `a3-${row.id}`,
        nombre: `declaracion_testigo_${row.folio.toLowerCase()}.pdf`,
        extension: "PDF",
        peso_mb: 1.1,
        preview_color: "slate",
      },
    ],
  };
}

const DETALLES_MOCK = new Map<number, ActaDetalle>(ACTAS_MOCK_ROWS.map((row) => [row.id, detallePorFila(row)]));

export function getActaDetalleMockById(id: number): ActaDetalle | null {
  return DETALLES_MOCK.get(id) ?? null;
}

export type FetchActaDetalleMockResult =
  | { ok: true; data: ActaDetalle }
  | { ok: false; status: 404 | 500; message: string; aborted?: boolean };

export async function fetchActaDetalleMockById(
  id: number,
  signal?: AbortSignal,
): Promise<FetchActaDetalleMockResult> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve({ ok: false, status: 500, message: "Solicitud cancelada.", aborted: true });
      return;
    }

    const timeout = window.setTimeout(() => {
      if (signal?.aborted) {
        resolve({ ok: false, status: 500, message: "Solicitud cancelada.", aborted: true });
        return;
      }
      const data = getActaDetalleMockById(id);
      if (!data) {
        resolve({ ok: false, status: 404, message: "No se encontró el acta solicitada." });
        return;
      }
      resolve({ ok: true, data });
    }, 240);

    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        resolve({ ok: false, status: 500, message: "Solicitud cancelada.", aborted: true });
      },
      { once: true },
    );
  });
}
