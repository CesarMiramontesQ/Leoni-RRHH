import type {
  RhIncidenciaEstadoCodigo,
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

    rows.push({
      id: 8800 + i,
      empleado_nombre_raw: NOMBRES[i % NOMBRES.length]!,
      foto_url: null,
      numero_folio: `INC-${8840 + i}`,
      area,
      supervisor_id: sup.id,
      supervisor_nombre: sup.nombre,
      tipo,
      fecha: isoDesdeOffsetDias(hoy, (i * 3) % 400),
      estado,
      prioridad,
    });
  }
  return rows;
}
