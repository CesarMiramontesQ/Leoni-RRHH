function parseDate(iso: string): Date | null {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function calendarYesterday(ref: Date): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  d.setDate(d.getDate() - 1);
  return d;
}

/** Fecha legible en español: Hoy/Ayer o fecha corta + hora con formato 12 h. */
export function formatNotificationFriendlyDate(iso: string, now: Date = new Date()): string {
  const d = parseDate(iso);
  if (!d) return iso;

  const timeStr = d.toLocaleTimeString("es-MX", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (sameCalendarDay(dDay, nowDay)) return `Hoy, ${timeStr}`;

  const yDay = calendarYesterday(nowDay);
  if (sameCalendarDay(dDay, yDay)) return `Ayer, ${timeStr}`;

  const datePart = d.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${datePart}, ${timeStr}`;
}
