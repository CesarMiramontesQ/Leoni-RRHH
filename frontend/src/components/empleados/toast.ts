/** Toast breve; se apila sobre el contenedor (p. ej. #empleados-root). */
export function showEmpleadosToast(
  container: HTMLElement,
  message: string,
  variant: "success" | "error",
): void {
  const wrap = document.createElement("div");
  wrap.className = "pointer-events-none fixed bottom-4 right-4 z-[100] flex max-w-sm flex-col gap-2";
  const el = document.createElement("div");
  el.setAttribute("role", "status");
  const base =
    "pointer-events-auto rounded-lg border px-4 py-3 text-sm font-medium shadow-lg transition-opacity";
  el.className =
    variant === "success"
      ? `${base} border-emerald-200 bg-emerald-50 text-emerald-900`
      : `${base} border-red-200 bg-red-50 text-red-900`;
  el.textContent = message;
  wrap.appendChild(el);
  container.appendChild(wrap);
  window.setTimeout(() => {
    wrap.remove();
  }, 4000);
}
