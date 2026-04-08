import { INC_COPY } from "./incidenciasCopy.ts";
import { formatNombreEmpleadoUi } from "../../utils/nombreEmpleadoDisplay.ts";
import type { RhIncidenciaFilterOptions, RhIncidenciaTablaFila } from "./types.ts";

function areaIdFromLabel(label: string): string {
  return `area:${label}`;
}

export function buildRhIncidenciaFilterOptions(rows: readonly RhIncidenciaTablaFila[]): RhIncidenciaFilterOptions {
  const areas = new Map<string, string>();
  const sups = new Map<string, string>();

  for (const r of rows) {
    if (r.area.trim()) areas.set(r.area, r.area);
    const sid = r.supervisor_id;
    const rawName = r.supervisor_nombre.trim();
    const label = formatNombreEmpleadoUi(rawName) || rawName || INC_COPY.optCualquierSupervisor;
    sups.set(sid, label);
  }

  const areaList = [...areas.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "es"))
    .map(([label]) => ({ id: areaIdFromLabel(label), label }));

  const supList = [...sups.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "es"))
    .map(([id, label]) => ({ id, label }));

  return {
    areas: areaList,
    supervisores: supList,
    tipos: [
      { id: "falta_injustificada", label: "Falta injustificada" },
      { id: "retardo", label: "Retardo" },
      { id: "indisciplina", label: "Indisciplina" },
      { id: "dano_equipo", label: "Daño a equipo" },
    ],
    estados: [
      { id: "abierto", label: "Abierto" },
      { id: "en_investigacion", label: "En investigación" },
      { id: "cerrado", label: INC_COPY.estadoCerrada },
    ],
    periodos: [
      { id: "30d", label: INC_COPY.optUltimos30 },
      { id: "90d", label: INC_COPY.optUltimos90 },
      { id: "365d", label: INC_COPY.optAnio },
      { id: "all", label: INC_COPY.optTodoPeriodo },
    ],
  };
}

export function areaLabelFromFilterId(areaId: string): string {
  if (!areaId.startsWith("area:")) return "";
  return areaId.slice("area:".length);
}
