const KEY_ACCESS = "access_token";
const KEY_REFRESH = "refresh_token";
const KEY_PERSISTENT = "auth_persistent";
/** Preferencia legacy de «Recordarme»; se limpia al migrar. */
const KEY_REMEMBER_PREF = "auth_remember_pref";

export type AuthTokens = {
  access_token: string;
  refresh_token: string;
};

function migratePersistentTokensToSession(): void {
  const localAccess = localStorage.getItem(KEY_ACCESS);
  const localRefresh = localStorage.getItem(KEY_REFRESH);
  const hadPersistent =
    localStorage.getItem(KEY_PERSISTENT) === "1" || Boolean(localAccess || localRefresh);
  if (!hadPersistent) return;

  if (!sessionStorage.getItem(KEY_ACCESS) && localAccess) {
    sessionStorage.setItem(KEY_ACCESS, localAccess);
  }
  if (!sessionStorage.getItem(KEY_REFRESH) && localRefresh) {
    sessionStorage.setItem(KEY_REFRESH, localRefresh);
  }
  localStorage.removeItem(KEY_PERSISTENT);
  localStorage.removeItem(KEY_ACCESS);
  localStorage.removeItem(KEY_REFRESH);
  localStorage.removeItem(KEY_REMEMBER_PREF);
}

export function setSession(tokens: AuthTokens): void {
  localStorage.removeItem(KEY_PERSISTENT);
  localStorage.removeItem(KEY_ACCESS);
  localStorage.removeItem(KEY_REFRESH);
  localStorage.removeItem(KEY_REMEMBER_PREF);
  sessionStorage.setItem(KEY_ACCESS, tokens.access_token);
  sessionStorage.setItem(KEY_REFRESH, tokens.refresh_token);
}

export function getAccessToken(): string | null {
  migratePersistentTokensToSession();
  return sessionStorage.getItem(KEY_ACCESS);
}

export function getRefreshToken(): string | null {
  migratePersistentTokensToSession();
  return sessionStorage.getItem(KEY_REFRESH);
}

export function updateAccessToken(access: string): void {
  migratePersistentTokensToSession();
  sessionStorage.setItem(KEY_ACCESS, access);
  localStorage.removeItem(KEY_ACCESS);
}

export function clearAuth(): void {
  localStorage.removeItem(KEY_PERSISTENT);
  localStorage.removeItem(KEY_ACCESS);
  localStorage.removeItem(KEY_REFRESH);
  localStorage.removeItem(KEY_REMEMBER_PREF);
  sessionStorage.removeItem(KEY_ACCESS);
  sessionStorage.removeItem(KEY_REFRESH);
  void import("./rhUiMode.ts").then(({ resetRhUiMode }) => resetRhUiMode());
  void import("./vistaRolPermissions.ts").then(({ resetVistasRol }) => resetVistasRol());
  void import("../notificaciones/notificacionesResumenStore.ts").then(({ resetNotificacionesResumen }) => {
    resetNotificacionesResumen();
  });
  void import("../pages/dashboard.ts").then(({ resetRhDashboardSessionState }) => {
    resetRhDashboardSessionState();
  });
}
