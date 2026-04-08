import type {
  RhIncidenciaEvidenciaItem,
  RhIncidenciaEstadoCodigo,
  RhIncidenciaPersonaInvolucrada,
  RhIncidenciaPrioridadCodigo,
  RhIncidenciaTablaFila,
  RhIncidenciaTipoCodigo,
} from "./types.ts";

const AREAS = ["Logística", "Calidad", "Desarrollo", "Marketing", "RH", "Producción"] as const;
const SUPS: { id: string; nombre: string }[] = [
  { id: "sup-1", nombre: "GARCÍA, CARLOS" },
  { id: "sup-2", nombre: "HERRERA, MARÍA" },
  { id: "sup-3", nombre: "LUNA, ROBERTO" },
  { id: "sup-4", nombre: "MARTÍNEZ, ANA" },
  { id: "sup-5", nombre: "RUIZ, LUIS" },
];

const NOMBRES = [
  "PÉREZ LÓPEZ, JUAN",
  "GÓMEZ SÁNCHEZ, LAURA",
  "TORRES DÍAZ, MIGUEL",
  "RAMÍREZ FLORES, ELENA",
  "JIMÉNEZ CRUZ, DIEGO",
  "MORALES VEGA, PATRICIA",
  "SILVA ORTEGA, FERNANDO",
  "CASTRO REYES, MÓNICA",
  "NÚÑEZ IBARRA, SERGIO",
  "ORTIZ MEDINA, CLAUDIA",
];

const TIPOS: RhIncidenciaTipoCodigo[] = [
  "falta_injustificada",
  "retardo",
  "indisciplina",
  "dano_equipo",
];
const ESTADOS: RhIncidenciaEstadoCodigo[] = ["abierto", "en_investigacion", "cerrado"];
const PRIOS: RhIncidenciaPrioridadCodigo[] = ["baja", "media", "alta", "critica"];

const PUESTOS = [
  "Operador Especialista B",
  "Técnico de calidad",
  "Operador de grúa",
  "Auxiliar administrativo",
  "Supervisor de turno",
] as const;

function evidenciasMock(i: number): RhIncidenciaEvidenciaItem[] {
  const n = (i % 4) + 1;
  const out: RhIncidenciaEvidenciaItem[] = [];
  for (let k = 0; k < Math.min(n, 2); k++) {
    out.push({
      id: `ev-img-${i}-${k}`,
      kind: "imagen",
      nombre: `foto_evento_${k + 1}.jpg`,
      tamano_mb: 0.4 + k * 0.15,
      thumb_url: `https://picsum.photos/seed/leoniinc${i}${k}/320/200`,
    });
  }
  if (i % 3 === 0) {
    out.push({
      id: `ev-pdf-${i}`,
      kind: "pdf",
      nombre: "bitacora_mantenimiento_g12.pdf",
      tamano_mb: 1.2,
    });
  }
  return out;
}

function personalMock(i: number): RhIncidenciaPersonaInvolucrada[] {
  const base: RhIncidenciaPersonaInvolucrada[] = [
    {
      nombre: "JUAN CARLOS MÉNDEZ",
      puesto: "OPERADOR DE GRÚA",
      rol: "testigo",
      foto_url: null,
    },
    {
      nombre: "SOFÍA VILLAGRÁN",
      puesto: "CALIDAD",
      rol: "afectado",
      foto_url: null,
    },
  ];
  if (i % 2 === 0) {
    return [base[0]!];
  }
  return base;
}

function isoDesdeOffsetDias(hoy: Date, offset: number): string {
  const d = new Date(hoy);
  d.setDate(d.getDate() - offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 53 filas mock con distribución variada. */
export function buildRhIncidenciasMockFilas(): RhIncidenciaTablaFila[] {
  const hoy = new Date();
  const rows: RhIncidenciaTablaFila[] = [];
  for (let i = 0; i < 53; i++) {
    const area = AREAS[i % AREAS.length]!;
    const sup = SUPS[i % SUPS.length]!;
    const tipo = TIPOS[i % TIPOS.length]!;
    const estado = ESTADOS[i % ESTADOS.length]!;
    let prioridad = PRIOS[i % PRIOS.length]!;
    if (i % 17 === 0) prioridad = "critica";
    if (i % 11 === 0 && estado === "cerrado") prioridad = "baja";

    const fecha = isoDesdeOffsetDias(hoy, (i * 3) % 400);
    const hora = 8 + (i % 9);
    const min = (i * 7) % 60;
    const base: RhIncidenciaTablaFila = {
      id: 8800 + i,
      empleado_id: `emp-${1001 + i}`,
      empleado_nombre_raw: NOMBRES[i % NOMBRES.length]!,
      foto_url: null,
      numero_folio: `INC-${8840 + i}`,
      area,
      supervisor_id: sup.id,
      supervisor_nombre: sup.nombre,
      tipo,
      fecha,
      estado,
      prioridad,
    };

    const detalleComun = {
      descripcion:
        estado === "cerrado"
          ? "Caso cerrado tras revisión documental y entrevistas. Se aplicó la medida acordada con el área legal y " +
            "se archivó el expediente. Sin observaciones pendientes al cierre."
          : "Se documenta el incidente conforme al protocolo interno. Hechos observados de manera objetiva; " +
            "se solicita revisión por el área correspondiente y seguimiento según matriz de riesgos. " +
            "El colaborador fue informado de los pasos siguientes.",
      lugar: i % 2 === 0 ? `Almacén de MP — Pasillo ${(i % 6) + 1}` : `Línea de producción — Estación ${(i % 4) + 1}`,
      fecha_hora_iso: `${fecha}T${String(hora).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`,
      puesto_empleado: PUESTOS[i % PUESTOS.length]!,
      id_empleado_display: `LNE-${88200 + (i % 900)}`,
      evidencias: evidenciasMock(i),
      personal_involucrado: personalMock(i),
      sla_horas_objetivo: 24,
      sla_segundos_transcurridos:
        estado === "cerrado"
          ? 24 * 3600 + ((i * 413) % 7200)
          : ((i * 1847) % (23 * 3600)) + 3600,
    };

    rows.push({ ...base, ...detalleComun });
  }
  return rows;
}
