import { formatNombreEmpleadoUi, inicialesDesdeNombreDisplay } from "../../utils/nombreEmpleadoDisplay.ts";

export function escapeComedorHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function formatComedorMonthTitle(year: number, monthIndex: number): string {
  const raw = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(
    new Date(year, monthIndex, 1),
  );
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function addComedorMonths(year: number, monthIndex: number, delta: number): [number, number] {
  const dt = new Date(year, monthIndex + delta, 1);
  return [dt.getFullYear(), dt.getMonth()];
}

export function isoLocalDate(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function paginationRange(totalPages: number, page: number): (number | "ellipsis")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const out: (number | "ellipsis")[] = [];
  const push = (v: number | "ellipsis"): void => {
    if (out[out.length - 1] !== v) out.push(v);
  };
  push(1);
  if (page > 3) push("ellipsis");
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  for (let index = start; index <= end; index += 1) push(index);
  if (page < totalPages - 2) push("ellipsis");
  push(totalPages);
  return out;
}

export function dietBadgeLabel(type: "normal" | "dieta"): string {
  return type === "dieta" ? "Dieta" : "Normal";
}

export function reservationStatusBadge(status: "confirmado" | "cancelado" | "pendiente"): string {
  if (status === "confirmado") {
    return '<span class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900 sm:text-xs">Confirmado</span>';
  }
  if (status === "cancelado") {
    return '<span class="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700 sm:text-xs">Cancelado</span>';
  }
  return '<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700 sm:text-xs">Pendiente</span>';
}

export function reservationDietBadge(type: "normal" | "dieta"): string {
  if (type === "dieta") {
    return '<span class="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">Dieta</span>';
  }
  return '<span class="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">Normal</span>';
}

export function renderEmpleadoAvatarCell(
  empleadoNombre: string,
  empleadoNumero: string,
  avatarUrl: string | null,
): string {
  const display = formatNombreEmpleadoUi(empleadoNombre) || empleadoNombre || "Sin nombre";
  const initials = inicialesDesdeNombreDisplay(display);
  const avatar =
    avatarUrl && avatarUrl.trim()
      ? `<img src="${escapeComedorHtml(avatarUrl)}" alt="" class="size-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />`
      : `<span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-leoni-blue-light text-xs font-semibold text-white">${escapeComedorHtml(initials)}</span>`;

  return `
    <div class="flex min-w-0 items-center gap-2.5">
      ${avatar}
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold text-slate-900">${escapeComedorHtml(display)}</p>
        <p class="truncate text-xs text-slate-500">${escapeComedorHtml(empleadoNumero)}</p>
      </div>
    </div>`;
}
