import { setSession } from "../auth/session.ts";
import { consumeIdleLogoutNotice } from "../auth/sessionIdle.ts";
import { loadRhModulePermissions, resetRhModulePermissions } from "../auth/rhModulePermissions.ts";
import { loadVistasRol, resetVistasRol } from "../auth/vistaRolPermissions.ts";
import { resolveRhInitialHash } from "../navigation/shellNavPolicy.ts";
import {
  refreshNotificacionesResumen,
  resetNotificacionesResumen,
} from "../notificaciones/notificacionesResumenStore.ts";
import { mountAuthenticatedShell } from "../shellRouter.ts";

const ICON_USER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
  <circle cx="12" cy="7" r="4" />
</svg>`;

const ICON_LOCK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
</svg>`;

export function mountLogin(container: HTMLElement): void {
  container.innerHTML = `
<div class="login-page-root">

  <div class="login-page-form-column">
    <div class="login-page-inner">
      <div class="login-page-card">

        <div>
          <img
            src="/leoni-logo.png"
            alt="Leoni"
            width="200"
            height="48"
            class="login-page-logo"
          />
          <h2 class="login-page-title">
            Acceso al sistema
          </h2>
          <p class="login-page-subtitle">
            Plataforma de Recursos Humanos · Leoni
          </p>
        </div>

        <form id="login-form" class="mt-8 space-y-6">

          <div>
            <label for="login-identifier" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
              Correo o usuario
            </label>
            <div class="login-page-field">
              <span class="login-page-field-icon">${ICON_USER}</span>
              <input
                id="login-identifier"
                type="text"
                name="username"
                required
                autocomplete="username"
                placeholder="correo@leoni.com o usuario de red"
                class="login-page-input"
              />
            </div>
          </div>

          <div>
            <label for="password" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
              Contraseña
            </label>
            <div class="login-page-field">
              <span class="login-page-field-icon">${ICON_LOCK}</span>
              <input
                id="password"
                type="password"
                name="password"
                required
                autocomplete="current-password"
                placeholder="••••••••"
                class="login-page-input"
              />
            </div>
          </div>

          <div id="idle-notice"
               role="status"
               aria-live="polite"
               class="login-page-notice hidden">
            Tu sesión se cerró por inactividad. Vuelve a iniciar sesión.
          </div>

          <div id="error-msg"
               role="alert"
               aria-live="polite"
               class="login-page-error hidden">
          </div>

          <div>
            <button
              type="submit"
              class="login-page-submit"
            >
              Iniciar sesión
            </button>
          </div>

        </form>
      </div>
    </div>
  </div>

  <div class="login-page-hero">
    <img
      src="/login-hero.png"
      alt=""
      class="login-page-hero-img"
    />
    <div class="login-page-hero-overlay" aria-hidden="true"></div>
    <p class="login-page-hero-tagline">
      Gestión RH simple, segura y centralizada.
    </p>
  </div>

</div>
`;

  const form = container.querySelector<HTMLFormElement>("#login-form")!;
  const errorEl = container.querySelector<HTMLDivElement>("#error-msg")!;
  const idleNotice = container.querySelector<HTMLDivElement>("#idle-notice")!;
  const btn = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
  if (consumeIdleLogoutNotice()) {
    idleNotice.classList.remove("hidden");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.add("hidden");
    idleNotice.classList.add("hidden");
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    btn.textContent = "Verificando…";

    const identifier = container.querySelector<HTMLInputElement>("#login-identifier")!.value;
    const password = container.querySelector<HTMLInputElement>("#password")!.value;

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: identifier, password }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { detail?: string };
        errorEl.textContent =
          data?.detail ?? "Credenciales incorrectas. Verifica tu correo o usuario y contraseña.";
        errorEl.classList.remove("hidden");
        return;
      }

      const body = (await res.json()) as {
        access_token: string;
        refresh_token: string;
      };
      setSession({
        access_token: body.access_token,
        refresh_token: body.refresh_token,
      });
      resetNotificacionesResumen();
      resetRhModulePermissions();
      resetVistasRol();
      void refreshNotificacionesResumen();

      await Promise.all([loadRhModulePermissions(), loadVistasRol()]);
      const initialHash = resolveRhInitialHash("#/");
      history.replaceState(null, "", initialHash);
      mountAuthenticatedShell(container);
    } catch {
      errorEl.textContent = "Error de conexión. Verifica que el servidor esté activo.";
      errorEl.classList.remove("hidden");
    } finally {
      if (btn.isConnected) {
        btn.disabled = false;
        btn.removeAttribute("aria-busy");
        btn.textContent = "Iniciar sesión";
      }
    }
  });
}
