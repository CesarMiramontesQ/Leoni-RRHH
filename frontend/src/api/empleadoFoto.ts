import { fetchWithAuth } from "./http.ts";

const FOTO_TIMEOUT_MS = 12_000;

/** URL del endpoint autenticado (usar con fetchWithAuth, no como src directo). */
export function empleadoFotoApiUrl(empleadoId: number): string {
  return `/api/v1/empleados/${empleadoId}/foto`;
}

const blobUrlByEmpleadoId = new Map<number, string>();
let inflightEmpleadoId: number | null = null;
let inflightAbort: AbortController | null = null;

function revokeBlobUrl(empleadoId: number): void {
  const prev = blobUrlByEmpleadoId.get(empleadoId);
  if (prev) {
    URL.revokeObjectURL(prev);
    blobUrlByEmpleadoId.delete(empleadoId);
  }
}

/** Libera URLs en memoria al salir del detalle o cambiar de empleado. */
export function releaseEmpleadoFotoCache(empleadoId?: number): void {
  if (inflightAbort) {
    inflightAbort.abort();
    inflightAbort = null;
    inflightEmpleadoId = null;
  }
  if (empleadoId === undefined) {
    for (const id of blobUrlByEmpleadoId.keys()) {
      revokeBlobUrl(id);
    }
    return;
  }
  revokeBlobUrl(empleadoId);
}

async function fetchFotoBlob(
  empleadoId: number,
  signal?: AbortSignal,
): Promise<Blob | null> {
  const controller = new AbortController();
  inflightEmpleadoId = empleadoId;
  inflightAbort = controller;

  const onParentAbort = (): void => controller.abort();
  signal?.addEventListener("abort", onParentAbort, { once: true });

  const timeoutId = window.setTimeout(() => controller.abort(), FOTO_TIMEOUT_MS);

  try {
    const res = await fetchWithAuth(empleadoFotoApiUrl(empleadoId), {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const ct = res.headers.get("Content-Type") ?? "";
    if (!ct.startsWith("image/")) return null;
    const blob = await res.blob();
    if (!blob.size) return null;
    return blob;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", onParentAbort);
    if (inflightAbort === controller) {
      inflightAbort = null;
      inflightEmpleadoId = null;
    }
  }
}

/**
 * Intenta mostrar la foto RH en el avatar del header Vista 360.
 * Si falla (404, red, timeout, respuesta inválida), deja el placeholder visible.
 */
export async function loadVista360ProfileFoto(
  root: HTMLElement,
  empleadoId: number,
  signal?: AbortSignal,
): Promise<void> {
  const wrap = root.querySelector<HTMLElement>("[data-v360-profile-avatar]");
  const img = wrap?.querySelector<HTMLImageElement>("[data-v360-profile-avatar-img]");
  const fallback = wrap?.querySelector<HTMLElement>("[data-v360-profile-avatar-fallback]");
  if (!wrap || !img || !fallback) return;

  const cached = blobUrlByEmpleadoId.get(empleadoId);
  if (cached) {
    applyVista360ProfileFoto(img, fallback, cached);
    return;
  }

  if (inflightEmpleadoId !== null && inflightEmpleadoId !== empleadoId) {
    inflightAbort?.abort();
  }

  resetVista360ProfileAvatar(img, fallback);

  const blob = await fetchFotoBlob(empleadoId, signal);
  if (signal?.aborted) return;
  if (!root.contains(wrap)) return;

  if (!blob) {
    resetVista360ProfileAvatar(img, fallback);
    return;
  }

  revokeBlobUrl(empleadoId);
  const url = URL.createObjectURL(blob);
  blobUrlByEmpleadoId.set(empleadoId, url);
  applyVista360ProfileFoto(img, fallback, url);
}

function resetVista360ProfileAvatar(
  img: HTMLImageElement,
  fallback: HTMLElement,
): void {
  img.removeAttribute("src");
  img.classList.add("hidden", "opacity-0");
  img.classList.remove("opacity-100");
  fallback.classList.remove("hidden");
}

function applyVista360ProfileFoto(
  img: HTMLImageElement,
  fallback: HTMLElement,
  objectUrl: string,
): void {
  const onError = (): void => {
    img.removeEventListener("load", onLoad);
    img.removeEventListener("error", onError);
    resetVista360ProfileAvatar(img, fallback);
  };
  const onLoad = (): void => {
    img.removeEventListener("load", onLoad);
    img.removeEventListener("error", onError);
    fallback.classList.add("hidden");
    img.classList.remove("hidden");
    requestAnimationFrame(() => {
      img.classList.remove("opacity-0");
      img.classList.add("opacity-100");
    });
  };

  img.addEventListener("load", onLoad, { once: true });
  img.addEventListener("error", onError, { once: true });
  img.classList.add("opacity-0");
  img.classList.remove("opacity-100");
  img.src = objectUrl;
  if (img.complete && img.naturalWidth > 0) {
    onLoad();
  }
}
