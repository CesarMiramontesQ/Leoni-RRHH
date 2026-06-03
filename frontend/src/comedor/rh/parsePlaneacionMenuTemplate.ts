import * as XLSX from "xlsx";
import type { ComedorWeekPlannerDayKey } from "./types.ts";
import {
  appendMenuDetalleItem,
  cloneMenuDiaDetalle,
  createEmptyMenuDiaDetalle,
  templateRowTarget,
  type ComedorMenuDiaDetalle,
} from "./menuDayDetalle.ts";
import {
  WEEK_PLANNER_DAY_KEYS,
  dayKeyFromTemplateHeader,
  isWeekendPlannerDay,
  normalizePlannerLabel,
} from "./weekPlannerDays.ts";

export type PlaneacionMenuTemplateDay = {
  key: ComedorWeekPlannerDayKey;
  menuNormal: string;
  menuDieta: string;
  detalle: ComedorMenuDiaDetalle;
};

export type ParsePlaneacionMenuTemplateResult =
  | { ok: true; days: PlaneacionMenuTemplateDay[] }
  | { ok: false; code: "invalid_file" | "invalid_template" | "incomplete_data" | "processing_error"; message: string };

type ParsedDayRow = {
  menuNormal: string;
  menuDieta: string;
  detalle: ComedorMenuDiaDetalle;
};

function cellText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function sheetToMatrix(workbook: XLSX.WorkBook): string[][] {
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  return rows.map((row) => (Array.isArray(row) ? row.map(cellText) : []));
}

function findHeaderRow(matrix: string[][]): { rowIndex: number; columns: Map<ComedorWeekPlannerDayKey, number> } | null {
  for (let rowIndex = 0; rowIndex < Math.min(matrix.length, 20); rowIndex += 1) {
    const row = matrix[rowIndex] ?? [];
    const columns = new Map<ComedorWeekPlannerDayKey, number>();
    for (let col = 0; col < row.length; col += 1) {
      const dayKey = dayKeyFromTemplateHeader(row[col] ?? "");
      if (dayKey) columns.set(dayKey, col);
    }
    if (columns.size >= 5) {
      return { rowIndex, columns };
    }
  }
  return null;
}

function createEmptyParsedByDay(): Map<ComedorWeekPlannerDayKey, ParsedDayRow> {
  const byDay = new Map<ComedorWeekPlannerDayKey, ParsedDayRow>();
  for (const key of WEEK_PLANNER_DAY_KEYS) {
    byDay.set(key, {
      menuNormal: "",
      menuDieta: "",
      detalle: createEmptyMenuDiaDetalle(),
    });
  }
  return byDay;
}

function parseDataRows(
  matrix: string[][],
  header: { rowIndex: number; columns: Map<ComedorWeekPlannerDayKey, number> },
): Map<ComedorWeekPlannerDayKey, ParsedDayRow> {
  const byDay = createEmptyParsedByDay();

  for (let rowIndex = header.rowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex] ?? [];
    const rowLabel = normalizePlannerLabel(row[0] ?? "");
    if (!rowLabel) continue;

    const target = templateRowTarget(rowLabel);
    if (!target) continue;

    for (const [dayKey, colIndex] of header.columns) {
      const value = cellText(row[colIndex] ?? "");
      const current = byDay.get(dayKey);
      if (!current) continue;

      if (target.kind === "plato") {
        if (target.variant === "normal") current.menuNormal = value;
        else current.menuDieta = value;
      } else {
        appendMenuDetalleItem(current.detalle[target.categoria], value);
      }
    }
  }

  return byDay;
}

function dayHasImportedContent(entry: ParsedDayRow): boolean {
  if (entry.menuNormal.trim() || entry.menuDieta.trim()) return true;
  return Object.values(entry.detalle).some((items) => items.length > 0);
}

function validateImportedDays(byDay: Map<ComedorWeekPlannerDayKey, ParsedDayRow>): string | null {
  const missingLaboral: ComedorWeekPlannerDayKey[] = [];
  const missingWeekend: ComedorWeekPlannerDayKey[] = [];

  for (const key of WEEK_PLANNER_DAY_KEYS) {
    const entry = byDay.get(key);
    if (!entry || !dayHasImportedContent(entry)) continue;
    const hasNormal = Boolean(entry.menuNormal.trim());
    const hasDieta = Boolean(entry.menuDieta.trim());
    if (isWeekendPlannerDay(key)) {
      if (!hasNormal) missingWeekend.push(key);
      continue;
    }
    if (!hasNormal || !hasDieta) missingLaboral.push(key);
  }

  if (missingLaboral.length > 0) {
    return `Datos incompletos: faltan OPCIÓN A y/o OPCIÓN B en ${missingLaboral.join(", ")}.`;
  }
  if (missingWeekend.length > 0) {
    return `Datos incompletos: falta OPCIÓN A en ${missingWeekend.join(", ")}.`;
  }
  return null;
}

export function parsePlaneacionMenuTemplateFromArrayBuffer(
  buffer: ArrayBuffer,
): ParsePlaneacionMenuTemplateResult {
  try {
    const workbook = XLSX.read(buffer, { type: "array" });
    const matrix = sheetToMatrix(workbook);
    if (matrix.length === 0) {
      return {
        ok: false,
        code: "invalid_template",
        message: "La plantilla está vacía o no tiene hojas legibles.",
      };
    }

    const header = findHeaderRow(matrix);
    if (!header) {
      return {
        ok: false,
        code: "invalid_template",
        message:
          "Plantilla inválida: no se encontró la fila de encabezados con los días (Lunes a Domingo).",
      };
    }

    const missingDays = WEEK_PLANNER_DAY_KEYS.filter((key) => !header.columns.has(key));
    if (missingDays.length > 0) {
      return {
        ok: false,
        code: "invalid_template",
        message: `Plantilla inválida: faltan columnas para ${missingDays.join(", ")}.`,
      };
    }

    const byDay = parseDataRows(matrix, header);
    const incompleteMessage = validateImportedDays(byDay);
    if (incompleteMessage) {
      return { ok: false, code: "incomplete_data", message: incompleteMessage };
    }

    const days: PlaneacionMenuTemplateDay[] = WEEK_PLANNER_DAY_KEYS.map((key) => {
      const entry = byDay.get(key)!;
      return {
        key,
        menuNormal: entry.menuNormal.trim(),
        menuDieta: isWeekendPlannerDay(key) ? "" : entry.menuDieta.trim(),
        detalle: cloneMenuDiaDetalle(entry.detalle),
      };
    });

    if (import.meta.env.DEV) {
      console.debug(
        "[planeacion-import] Días detectados en Excel:",
        [...header.columns.keys()],
      );
      console.debug(
        "[planeacion-import] Datos parseados por día:",
        days.map((day) => ({
          key: day.key,
          menuNormal: day.menuNormal.slice(0, 40),
          menuDieta: day.menuDieta.slice(0, 40),
          complementos: day.detalle.complementos.length,
        })),
      );
    }

    return { ok: true, days };
  } catch {
    return {
      ok: false,
      code: "processing_error",
      message: "Error al procesar la plantilla. Verifica que sea un archivo Excel válido.",
    };
  }
}

export async function parsePlaneacionMenuTemplateFile(file: File): Promise<ParsePlaneacionMenuTemplateResult> {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
    return {
      ok: false,
      code: "invalid_file",
      message: "Plantilla inválida: solo se admiten archivos Excel (.xlsx o .xls).",
    };
  }
  try {
    const buffer = await file.arrayBuffer();
    return parsePlaneacionMenuTemplateFromArrayBuffer(buffer);
  } catch {
    return {
      ok: false,
      code: "processing_error",
      message: "No se pudo leer el archivo adjunto.",
    };
  }
}
