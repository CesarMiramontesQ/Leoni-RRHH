import "@tailwindplus/elements";
import "./style.css";
import { getAccessToken } from "./auth/session.ts";
import { mountLogin } from "./pages/login.ts";
import { mountAuthenticatedShell } from "./shellRouter.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;
if (getAccessToken()) {
  mountAuthenticatedShell(app);
} else {
  mountLogin(app);
}
