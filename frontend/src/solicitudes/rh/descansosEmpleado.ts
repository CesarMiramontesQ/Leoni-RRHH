import { getEmpleadoDescansos } from "../../api/empleados.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

export type DescansosLoadState = "idle" | "loading" | "ready" | "error";
export type DescansosMonthFetcher = (
  empleadoId: number,
  fechaInicio: string,
  fechaFin: string,
) => Promise<readonly string[]>;

/** Tipos cuyo calendario/envío depende de descansos TRESS (fail-closed). */
const TIPOS_CALENDARIO_DESCANSOS = new Set<string>([
  "matrimonio",
  "defuncion",
  "paternidad",
  "suspension",
  "incapacidad_interna",
]);

/** Vacaciones, home office y permiso sin goce no dependen del calendario TRESS. */
export function tipoRequiereCalendarioDescansos(
  tipo: string | null | undefined,
): boolean {
  return tipo != null && TIPOS_CALENDARIO_DESCANSOS.has(tipo);
}

export type DescansosEmpleadoController = {
  setEmpleado: (empleadoId: number | null) => void;
  loadMonth: (year: number, monthIndex: number) => Promise<Set<string>>;
  loadVisibleMonths: (year: number, monthIndex: number) => Promise<Set<string>>;
  loadRange: (fechaInicio: string, fechaFin: string) => Promise<Set<string>>;
  hasRangeLoaded: (fechaInicio: string, fechaFin: string) => boolean;
  getLoadedDates: () => Set<string>;
  getLoadedMonths: () => Set<string>;
  getState: () => DescansosLoadState;
  getError: () => string;
  subscribe: (listener: () => void) => () => void;
};

export type LatestRequestSequence = {
  next: () => number;
  isCurrent: (token: number) => boolean;
  invalidate: () => void;
};

export function createLatestRequestSequence(): LatestRequestSequence {
  let current = 0;
  return {
    next: () => {
      current += 1;
      return current;
    },
    isCurrent: (token) => token === current,
    invalidate: () => {
      current += 1;
    },
  };
}

export function buildDescansosFeedback(
  state: DescansosLoadState,
  error: string,
  fechasExcluidas: readonly string[],
): { loadHtml: string; effectiveSummaryHtml: string } {
  const loadHtml =
    state === "loading"
      ? '<p class="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800" role="status">Consultando descansos del empleado…</p>'
      : state === "error"
        ? `<p class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">${escapeHtml(
            error || "No se pudieron consultar los descansos. Intenta de nuevo.",
          )}</p>`
        : "";
  const effectiveSummaryHtml =
    fechasExcluidas.length > 0
      ? `<p class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Se excluirán por descanso: ${escapeHtml(
          fechasExcluidas.join(", "),
        )}.</p>`
      : "";
  return { loadHtml, effectiveSummaryHtml };
}

function isoDate(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthBounds(year: number, monthIndex: number): [string, string] {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  return [isoDate(year, monthIndex, 1), isoDate(year, monthIndex, last)];
}

function parseIso(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

const defaultFetcher: DescansosMonthFetcher = async (empleadoId, fechaInicio, fechaFin) => {
  const response = await getEmpleadoDescansos(empleadoId, fechaInicio, fechaFin);
  return response.descansos;
};

export function createDescansosEmpleadoController(
  fetchMonth: DescansosMonthFetcher = defaultFetcher,
): DescansosEmpleadoController {
  let empleadoId: number | null = null;
  let generation = 0;
  let state: DescansosLoadState = "idle";
  let error = "";
  let activeRequests = 0;
  let requestFailed = false;
  const cache = new Map<string, Set<string>>();
  const inFlight = new Map<string, Promise<Set<string>>>();
  const listeners = new Set<() => void>();

  const notify = (): void => {
    for (const listener of listeners) listener();
  };

  const updateState = (next: DescansosLoadState, nextError = ""): void => {
    state = next;
    error = nextError;
    notify();
  };

  function setEmpleado(nextEmpleadoId: number | null): void {
    if (nextEmpleadoId === empleadoId) return;
    empleadoId = nextEmpleadoId;
    generation += 1;
    cache.clear();
    inFlight.clear();
    activeRequests = 0;
    requestFailed = false;
    updateState("idle");
  }

  async function loadMonth(year: number, monthIndex: number): Promise<Set<string>> {
    if (empleadoId == null) return new Set();
    const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    const cached = cache.get(key);
    if (cached) return new Set(cached);
    const pending = inFlight.get(key);
    if (pending) return pending.then((dates) => new Set(dates));

    const requestGeneration = generation;
    const requestEmpleadoId = empleadoId;
    const [fechaInicio, fechaFin] = monthBounds(year, monthIndex);
    if (activeRequests === 0) requestFailed = false;
    activeRequests += 1;
    updateState("loading");
    const request = fetchMonth(requestEmpleadoId, fechaInicio, fechaFin)
      .then((dates) => {
        const result = new Set(dates);
        if (requestGeneration === generation && requestEmpleadoId === empleadoId) {
          cache.set(key, result);
        }
        return new Set(result);
      })
      .catch((cause: unknown) => {
        if (requestGeneration === generation && requestEmpleadoId === empleadoId) {
          requestFailed = true;
          const detail =
            cause && typeof cause === "object" && "detail" in cause
              ? String((cause as { detail: unknown }).detail)
              : "No se pudieron consultar los descansos.";
          updateState("error", detail);
        }
        throw cause;
      })
      .finally(() => {
        if (inFlight.get(key) === request) inFlight.delete(key);
        if (requestGeneration === generation && requestEmpleadoId === empleadoId) {
          activeRequests = Math.max(0, activeRequests - 1);
          if (activeRequests === 0 && !requestFailed) updateState("ready");
        }
      });
    inFlight.set(key, request);
    return request.then((dates) => new Set(dates));
  }

  async function loadRange(fechaInicio: string, fechaFin: string): Promise<Set<string>> {
    const start = parseIso(fechaInicio);
    const end = parseIso(fechaFin);
    if (!start || !end || end < start) throw new Error("Rango de descansos inválido.");
    const totalDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (totalDays > 366) throw new Error("El rango máximo para descansos es de 366 días.");

    const loads: Promise<Set<string>>[] = [];
    let year = start.getFullYear();
    let month = start.getMonth();
    while (year < end.getFullYear() || (year === end.getFullYear() && month <= end.getMonth())) {
      loads.push(loadMonth(year, month));
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
    const result = new Set<string>();
    for (const dates of await Promise.all(loads)) {
      for (const date of dates) {
        if (date >= fechaInicio && date <= fechaFin) result.add(date);
      }
    }
    return result;
  }

  async function loadVisibleMonths(year: number, monthIndex: number): Promise<Set<string>> {
    const loads: Promise<Set<string>>[] = [];
    for (const delta of [-1, 0, 1]) {
      const date = new Date(year, monthIndex + delta, 1);
      loads.push(loadMonth(date.getFullYear(), date.getMonth()));
    }
    const result = new Set<string>();
    for (const dates of await Promise.all(loads)) {
      for (const date of dates) result.add(date);
    }
    return result;
  }

  return {
    setEmpleado,
    loadMonth,
    loadVisibleMonths,
    loadRange,
    hasRangeLoaded: (fechaInicio, fechaFin) => {
      const start = parseIso(fechaInicio);
      const end = parseIso(fechaFin);
      if (!start || !end || end < start) return false;
      let year = start.getFullYear();
      let month = start.getMonth();
      while (year < end.getFullYear() || (year === end.getFullYear() && month <= end.getMonth())) {
        const key = `${year}-${String(month + 1).padStart(2, "0")}`;
        if (!cache.has(key)) return false;
        month += 1;
        if (month > 11) {
          month = 0;
          year += 1;
        }
      }
      return true;
    },
    getLoadedDates: () => {
      const result = new Set<string>();
      for (const dates of cache.values()) {
        for (const date of dates) result.add(date);
      }
      return result;
    },
    getLoadedMonths: () => new Set(cache.keys()),
    getState: () => state,
    getError: () => error,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
