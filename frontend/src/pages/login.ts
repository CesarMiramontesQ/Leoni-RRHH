import { setSession } from "../auth/session.ts";
import { mountAuthenticatedShell } from "../shellRouter.ts";

export function mountLogin(container: HTMLElement): void {
  container.innerHTML = `
<div class="flex min-h-full bg-white">

  <div class="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
    <div class="mx-auto w-full max-w-sm lg:w-96">

      <div>
        <img
          src="/leoni-logo.png"
          alt="Leoni"
          width="200"
          height="48"
          class="h-10 w-auto max-w-full object-contain object-left"
        />
        <h2 class="mt-8 text-2xl/9 font-bold tracking-tight text-text-primary">
          Acceso al sistema
        </h2>
        <p class="mt-2 text-sm/6 text-text-muted">
          Plataforma de Recursos Humanos · Leoni
        </p>
      </div>

      <div class="mt-10">
        <form id="login-form" class="space-y-6">

          <div>
            <label for="email" class="block text-sm/6 font-medium text-text-primary">
              Correo electrónico
            </label>
            <div class="mt-2">
              <input
                id="email"
                type="email"
                name="email"
                required
                autocomplete="email"
                placeholder="usuario@leoni.com"
                class="block w-full rounded-md bg-white px-3 py-1.5 text-base text-text-primary
                       outline-1 -outline-offset-1 outline-border
                       placeholder:text-text-muted
                       focus:outline-2 focus:-outline-offset-2 focus:outline-leoni-blue
                       sm:text-sm/6"
              />
            </div>
          </div>

          <div>
            <label for="password" class="block text-sm/6 font-medium text-text-primary">
              Contraseña
            </label>
            <div class="mt-2">
              <input
                id="password"
                type="password"
                name="password"
                required
                autocomplete="current-password"
                placeholder="••••••••"
                class="block w-full rounded-md bg-white px-3 py-1.5 text-base text-text-primary
                       outline-1 -outline-offset-1 outline-border
                       placeholder:text-text-muted
                       focus:outline-2 focus:-outline-offset-2 focus:outline-leoni-blue
                       sm:text-sm/6"
              />
            </div>
          </div>

          <div class="flex items-center justify-between">
            <div class="flex gap-3">
              <div class="flex h-6 shrink-0 items-center">
                <div class="group grid size-4 grid-cols-1">
                  <input
                    id="remember-me"
                    type="checkbox"
                    name="remember-me"
                    class="col-start-1 row-start-1 appearance-none rounded-sm
                           border border-border bg-white
                           checked:border-leoni-blue checked:bg-leoni-blue
                           focus-visible:outline-2 focus-visible:outline-offset-2
                           focus-visible:outline-leoni-blue
                           forced-colors:appearance-auto"
                  />
                  <svg viewBox="0 0 14 14" fill="none"
                       class="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-disabled:stroke-gray-950/25">
                    <path d="M3 8L6 11L11 3.5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                          class="opacity-0 group-has-checked:opacity-100" />
                  </svg>
                </div>
              </div>
              <label for="remember-me" class="block cursor-pointer text-sm/6 text-text-primary select-none">
                Recordarme
              </label>
            </div>

            <div class="text-sm/6">
              <a href="#" class="font-semibold text-leoni-blue transition-colors hover:text-leoni-blue-light">
                ¿Olvidaste tu contraseña?
              </a>
            </div>
          </div>

          <div id="error-msg"
               class="hidden rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          </div>

          <div>
            <button
              type="submit"
              class="flex w-full cursor-pointer justify-center rounded-md bg-leoni-blue px-3 py-1.5
                     text-sm/6 font-semibold text-white shadow-xs
                     transition-colors hover:bg-leoni-blue-light
                     focus-visible:outline-2 focus-visible:outline-offset-2
                     focus-visible:outline-leoni-blue
                     disabled:cursor-not-allowed disabled:opacity-60"
            >
              Iniciar sesión
            </button>
          </div>

        </form>
      </div>
    </div>
  </div>

  <div class="relative hidden min-h-0 w-0 flex-1 lg:block">
    <img
      src="/login-hero.png"
      alt=""
      class="absolute inset-0 size-full object-cover"
    />
  </div>

</div>
`;

  const form = container.querySelector<HTMLFormElement>("#login-form")!;
  const errorEl = container.querySelector<HTMLDivElement>("#error-msg")!;
  const btn = form.querySelector<HTMLButtonElement>("button[type=submit]")!;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.add("hidden");
    btn.disabled = true;
    btn.textContent = "Verificando…";

    const email = container.querySelector<HTMLInputElement>("#email")!.value;
    const password = container.querySelector<HTMLInputElement>("#password")!.value;

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: email, password }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { detail?: string };
        errorEl.textContent =
          data?.detail ?? "Credenciales incorrectas. Verifica tu correo y contraseña.";
        errorEl.classList.remove("hidden");
        return;
      }

      const body = (await res.json()) as {
        access_token: string;
        refresh_token: string;
      };
      const remember =
        container.querySelector<HTMLInputElement>("#remember-me")?.checked ?? false;
      setSession(
        { access_token: body.access_token, refresh_token: body.refresh_token },
        remember,
      );

      window.location.hash = "#/";
      mountAuthenticatedShell(container);
    } catch {
      errorEl.textContent = "Error de conexión. Verifica que el servidor esté activo.";
      errorEl.classList.remove("hidden");
    } finally {
      if (btn.isConnected) {
        btn.disabled = false;
        btn.textContent = "Iniciar sesión";
      }
    }
  });
}
