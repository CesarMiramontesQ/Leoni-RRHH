/** Shell centrado para pantallas de autenticación (login, registro, etc.). */
export function authLayout(innerHtml: string): string {
  return `
  <div class="min-h-screen flex items-center justify-center bg-surface">
    ${innerHtml}
  </div>`;
}
