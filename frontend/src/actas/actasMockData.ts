export type ActaTipoCodigo = "amonestacion" | "suspension" | "administrativa";
/** `firmada` en UI = acta aprobada (backend signed/archived). `anulada` = cancelled. */
export type ActaEstadoCodigo = "abierta" | "en_proceso" | "firmada" | "anulada";

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
];

export const ACTAS_SUPERVISORES: ReadonlyArray<{ id: string; label: string }> = [];

export const ACTAS_TIPOS: ReadonlyArray<{ id: ActaTipoCodigo; label: string }> = [
  { id: "amonestacion", label: "Amonestación" },
  { id: "suspension", label: "Suspensión" },
  { id: "administrativa", label: "Administrativa" },
];

export const ACTAS_ESTADOS: ReadonlyArray<{ id: ActaEstadoCodigo; label: string }> = [
  { id: "en_proceso", label: "En proceso" },
  { id: "firmada", label: "Aprobada" },
  { id: "anulada", label: "Anulada" },
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
      { id: `testigo-${row.id}`, nombre: "Sin registro", rol: "Testigo" },
      { id: `rh-${row.id}`, nombre: "Sin registro", rol: "Representante RH" },
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
