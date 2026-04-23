import "@tailwindplus/elements";
import "./style.css";
import { getAccessToken } from "./auth/session.ts";
import { mountLogin } from "./pages/login.ts";
import { refreshNotificacionesResumen } from "./notificaciones/notificacionesResumenStore.ts";
import { mountAuthenticatedShell } from "./shellRouter.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;
if (getAccessToken()) {
  void refreshNotificacionesResumen();
  mountAuthenticatedShell(app);
} else {
  mountLogin(app);
}
