import { formatNombreEmpleadoUi, inicialesDesdeNombreDisplay } from "../../utils/nombreEmpleadoDisplay.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

// Re-exportamos con los nombres legacy para no romper importadores existentes.
export { escapeHtml as escapeComedorHtml } from "../../ui/uiUtils.ts";
export { paginationRange } from "../../ui/uiUtils.ts";

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

export function dietBadgeLabel(type: "normal" | "dieta"): string {
  return type === "dieta" ? "Dieta" : "Normal";
}

/** Badge de estado de reserva — patrón unificado: píldora + dot. */
export function reservationStatusBadge(status: "confirmado" | "cancelado" | "pendiente"): string {
  if (status === "confirmado") {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-900"><span class="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true"></span>${escapeHtml("Confirmado")}</span>`;
  }
  if (status === "cancelado") {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800"><span class="size-1.5 shrink-0 rounded-full bg-red-400" aria-hidden="true"></span>${escapeHtml("Cancelado")}</span>`;
  }
  return `<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900"><span class="size-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true"></span>${escapeHtml("Pendiente")}</span>`;
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
      ? `<img src="${escapeHtml(avatarUrl)}" alt="" class="size-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />`
      : `<span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-leoni-blue-light text-xs font-semibold text-white">${escapeHtml(initials)}</span>`;

  return `
    <div class="flex min-w-0 items-center gap-2.5">
      ${avatar}
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold text-slate-900">${escapeHtml(display)}</p>
        <p class="truncate text-xs text-slate-500">${escapeHtml(empleadoNumero)}</p>
      </div>
    </div>`;
}
