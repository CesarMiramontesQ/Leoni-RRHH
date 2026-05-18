import { mountAppShell } from "../layouts/appShell.ts";

function stubMain(title: string): string {
  return `
    <div class="rounded-lg border border-border bg-white px-6 py-10 shadow-sm">
      <h1 class="text-lg font-semibold text-text-primary">${title}</h1>
      <p class="mt-2 text-sm text-text-muted">Esta sección está en desarrollo.</p>
    </div>`;
}

export function mountComedorStub(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Comedor",
    activeNav: "comedor",
    mainHtml: stubMain("Comedor"),
  });
}

export function mountNotificacionesStub(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Notificaciones",
    mainHtml: stubMain("Notificaciones"),
  });
}
