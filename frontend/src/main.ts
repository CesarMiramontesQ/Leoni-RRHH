import "@tailwindplus/elements";
import "./style.css";
import { refreshAccessTokenSession } from "./api/http.ts";
import { loadRhModulePermissions } from "./auth/rhModulePermissions.ts";
import { getAccessToken, getRefreshToken } from "./auth/session.ts";
import { mountLogin } from "./pages/login.ts";
import { refreshNotificacionesResumen } from "./notificaciones/notificacionesResumenStore.ts";
import { mountAuthenticatedShell } from "./shellRouter.ts";

async function bootstrap(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  if (!getAccessToken() && getRefreshToken()) {
    await refreshAccessTokenSession();
  }
  if (getAccessToken()) {
    void refreshNotificacionesResumen();
    await loadRhModulePermissions();
    mountAuthenticatedShell(app);
    return;
  }
  mountLogin(app);
}

void bootstrap();
