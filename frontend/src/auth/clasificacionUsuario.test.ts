/**
 * Quién puede ver lo que solo aplica a administrativos.
 *
 * El caso que importa es el del fallo: si `/auth/me` no responde no se sabe la
 * clasificación, y entonces no se muestra —enseñar la tarjeta de Home Office a un
 * operativo es justamente lo que se quería evitar.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuthMe = vi.fn();
const payloadToken = vi.fn(() => ({ sub: "42" }) as Record<string, unknown> | null);

vi.mock("../api/auth.ts", () => ({ getAuthMe: () => getAuthMe() }));
vi.mock("./jwt.ts", () => ({ getAccessTokenPayload: () => payloadToken() }));

const conClasificacion = (significado: string) => ({
  clasificacion: { significado, descripcion: significado[0] },
});

async function cargar() {
  const mod = await import("./clasificacionUsuario.ts");
  mod.resetClasificacionUsuarioCache();
  return mod;
}

beforeEach(() => {
  getAuthMe.mockReset();
  payloadToken.mockReturnValue({ sub: "42" });
});

describe("usuarioActualEsAdministrativo", () => {
  it("es true para clasificación Administrativo", async () => {
    const { usuarioActualEsAdministrativo } = await cargar();
    getAuthMe.mockResolvedValue(conClasificacion("Administrativo"));
    expect(await usuarioActualEsAdministrativo()).toBe(true);
  });

  it("es false para Directo e Indirecto", async () => {
    const { usuarioActualEsAdministrativo, resetClasificacionUsuarioCache } = await cargar();
    for (const clas of ["Directo", "Indirecto"]) {
      resetClasificacionUsuarioCache();
      getAuthMe.mockResolvedValue(conClasificacion(clas));
      expect(await usuarioActualEsAdministrativo()).toBe(false);
    }
  });

  it("es false si el empleado no tiene clasificación", async () => {
    const { usuarioActualEsAdministrativo } = await cargar();
    getAuthMe.mockResolvedValue({ clasificacion: null });
    expect(await usuarioActualEsAdministrativo()).toBe(false);
  });

  it("es false si la consulta falla: ante la duda no se muestra", async () => {
    const { usuarioActualEsAdministrativo } = await cargar();
    getAuthMe.mockRejectedValue({ status: 500, detail: "boom" });
    expect(await usuarioActualEsAdministrativo()).toBe(false);
  });

  it("un fallo no queda cacheado: el siguiente intento vuelve a preguntar", async () => {
    const { usuarioActualEsAdministrativo } = await cargar();
    getAuthMe.mockRejectedValueOnce({ status: 503, detail: "caído" });
    expect(await usuarioActualEsAdministrativo()).toBe(false);
    getAuthMe.mockResolvedValue(conClasificacion("Administrativo"));
    expect(await usuarioActualEsAdministrativo()).toBe(true);
  });

  it("no repite la consulta para el mismo usuario", async () => {
    const { usuarioActualEsAdministrativo } = await cargar();
    getAuthMe.mockResolvedValue(conClasificacion("Administrativo"));
    await usuarioActualEsAdministrativo();
    await usuarioActualEsAdministrativo();
    expect(getAuthMe).toHaveBeenCalledTimes(1);
  });

  it("otro usuario en la misma pestaña no hereda el valor del anterior", async () => {
    const { usuarioActualEsAdministrativo } = await cargar();
    getAuthMe.mockResolvedValue(conClasificacion("Administrativo"));
    expect(await usuarioActualEsAdministrativo()).toBe(true);

    payloadToken.mockReturnValue({ sub: "99" });
    getAuthMe.mockResolvedValue(conClasificacion("Directo"));
    expect(await usuarioActualEsAdministrativo()).toBe(false);
  });
});
