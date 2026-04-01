/** Toast breve con ícono, fade animation y botón de cierre. */
export function showEmpleadosToast(
  container: HTMLElement,
  message: string,
  variant: "success" | "error",
): void {
  const wrap = document.createElement("div");
  wrap.className = "pointer-events-none fixed bottom-4 right-4 z-[100] flex max-w-sm flex-col gap-2";

  const el = document.createElement("div");
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");

  const base =
    "pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg opacity-0 translate-y-2 transition-all duration-150 ease-out";
  const successIcon = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-5 shrink-0 text-emerald-500 mt-0.5" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clip-rule="evenodd"/></svg>`;
  const errorIcon = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-5 shrink-0 text-red-500 mt-0.5" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clip-rule="evenodd"/></svg>`;
  const closeBtn = `<button type="button" class="ml-auto shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-current" aria-label="Cerrar">
    <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"/></svg>
  </button>`;

  el.className =
    variant === "success"
      ? `${base} border-emerald-200 bg-emerald-50 text-emerald-900`
      : `${base} border-red-200 bg-red-50 text-red-900`;

  el.innerHTML = `${variant === "success" ? successIcon : errorIcon}<span class="flex-1">${message}</span>${closeBtn}`;
  wrap.appendChild(el);
  container.appendChild(wrap);

  // Fade in
  requestAnimationFrame(() => {
    el.classList.remove("opacity-0", "translate-y-2");
  });

  function dismiss(): void {
    el.classList.add("opacity-0", "translate-y-2");
    window.setTimeout(() => wrap.remove(), 150);
  }

  el.querySelector("button")?.addEventListener("click", dismiss);
  window.setTimeout(dismiss, 4000);
}
