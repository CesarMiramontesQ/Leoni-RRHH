import { fetchWithAuth } from "./http.ts";
import type { RhIncidenciaListFilters } from "../incidencias/rh/types.ts";
import type { IncidenciasFetchError } from "./incidencias.ts";

export type AgentChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type IncidenciaAgentContextFilters = {
  tipo?: string;
  area?: string;
  subarea?: string;
  no_empleado?: string;
  nombre?: string;
  empleado_id?: number;
  categoria?: string;
  fecha?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  tendencia_agrupacion?: "dia" | "semana" | "mes";
};

export type AgentToolTraceItem = {
  tool: string;
  args: Record<string, unknown>;
  result_preview: string;
  ok: boolean;
};

export type IncidenciaAgentChatResponse = {
  message: AgentChatMessage;
  tool_trace?: AgentToolTraceItem[] | null;
  model: string;
  ollama_available: boolean;
};

async function readErrorDetail(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const parsed = JSON.parse(raw) as { detail?: unknown };
    if (typeof parsed.detail === "string" && parsed.detail.trim()) return parsed.detail.trim();
  } catch {
    /* noop */
  }
  return raw || res.statusText || "Error";
}

export function rhFiltersToAgentContext(
  filters: RhIncidenciaListFilters,
): IncidenciaAgentContextFilters | undefined {
  const out: IncidenciaAgentContextFilters = {};
  if (filters.tipo.trim()) out.tipo = filters.tipo.trim();
  if (filters.area.trim()) out.area = filters.area.trim();
  if (filters.subarea.trim()) out.subarea = filters.subarea.trim();
  if (filters.no_empleado.trim()) out.no_empleado = filters.no_empleado.trim();
  if (filters.nombre.trim()) out.nombre = filters.nombre.trim();
  if (filters.categoria.trim()) out.categoria = filters.categoria.trim();
  if (filters.fecha.trim()) out.fecha = filters.fecha.trim();
  if (filters.fecha_inicio.trim()) out.fecha_inicio = filters.fecha_inicio.trim();
  if (filters.fecha_fin.trim()) out.fecha_fin = filters.fecha_fin.trim();
  const empId = filters.empleado_id.trim();
  if (empId) {
    const n = Number.parseInt(empId, 10);
    if (Number.isFinite(n)) out.empleado_id = n;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function postIncidenciaAgentChat(
  messages: AgentChatMessage[],
  contextFilters?: IncidenciaAgentContextFilters,
  signal?: AbortSignal,
): Promise<IncidenciaAgentChatResponse> {
  const res = await fetchWithAuth("/api/v1/incidencias/agent/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      context_filters: contextFilters ?? undefined,
    }),
    signal,
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw { status: res.status, detail } as IncidenciasFetchError;
  }
  return (await res.json()) as IncidenciaAgentChatResponse;
}
