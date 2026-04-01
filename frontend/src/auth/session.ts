const KEY_ACCESS = "access_token";
const KEY_REFRESH = "refresh_token";
const KEY_PERSISTENT = "auth_persistent";
const PERSISTENT_VALUE = "1";

export type AuthTokens = {
  access_token: string;
  refresh_token: string;
};

function isPersistent(): boolean {
  return localStorage.getItem(KEY_PERSISTENT) === PERSISTENT_VALUE;
}

function activeStorage(): Storage {
  return isPersistent() ? localStorage : sessionStorage;
}

export function setSession(tokens: AuthTokens, remember: boolean): void {
  if (remember) {
    localStorage.setItem(KEY_PERSISTENT, PERSISTENT_VALUE);
    localStorage.setItem(KEY_ACCESS, tokens.access_token);
    localStorage.setItem(KEY_REFRESH, tokens.refresh_token);
    sessionStorage.removeItem(KEY_ACCESS);
    sessionStorage.removeItem(KEY_REFRESH);
  } else {
    localStorage.removeItem(KEY_PERSISTENT);
    localStorage.removeItem(KEY_ACCESS);
    localStorage.removeItem(KEY_REFRESH);
    sessionStorage.setItem(KEY_ACCESS, tokens.access_token);
    sessionStorage.setItem(KEY_REFRESH, tokens.refresh_token);
  }
}

export function getAccessToken(): string | null {
  if (isPersistent()) {
    return localStorage.getItem(KEY_ACCESS);
  }
  return sessionStorage.getItem(KEY_ACCESS);
}

export function getRefreshToken(): string | null {
  if (isPersistent()) {
    return localStorage.getItem(KEY_REFRESH);
  }
  return sessionStorage.getItem(KEY_REFRESH);
}

export function updateAccessToken(access: string): void {
  activeStorage().setItem(KEY_ACCESS, access);
}

export function clearAuth(): void {
  localStorage.removeItem(KEY_PERSISTENT);
  localStorage.removeItem(KEY_ACCESS);
  localStorage.removeItem(KEY_REFRESH);
  sessionStorage.removeItem(KEY_ACCESS);
  sessionStorage.removeItem(KEY_REFRESH);
}
