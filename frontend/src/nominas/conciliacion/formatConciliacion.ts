import type { ConciliacionMontosFila } from "./types.ts";

export function formatConciliacionMonto(value: number | null): string {
  if (value == null) return "—";
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

export function formatConciliacionMontoPlain(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function difClass(value: number | null): string {
  if (value == null || value === 0) return "text-text-muted";
  return "font-semibold text-red-700";
}

export function pickMontos(row: ConciliacionMontosFila): ConciliacionMontosFila {
  return {
    nominaAcum: row.nominaAcum,
    tressAcum: row.tressAcum,
    difNomTress: row.difNomTress,
    directosContab: row.directosContab,
    indirectosContab: row.indirectosContab,
    totalContab: row.totalContab,
    difNomContab: row.difNomContab,
  };
}
