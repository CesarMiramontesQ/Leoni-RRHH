import { describe, expect, it, vi } from "vitest";
import {
  anioDeIso,
  createDiasFestivosCache,
  festivosEnRango,
  tipoAplicaFestivos,
} from "./diasFestivos.ts";

describe("diasFestivos — alcance por tipo", () => {
  it("solo vacaciones y home office consideran festivos", () => {
    expect(tipoAplicaFestivos("vacaciones")).toBe(true);
    expect(tipoAplicaFestivos("home_office")).toBe(true);
    for (const t of ["matrimonio", "defuncion", "paternidad", "permiso_sin_goce_sueldo", "incapacidad_interna", null]) {
      expect(tipoAplicaFestivos(t)).toBe(false);
    }
  });

  it("festivosEnRango filtra y ordena", () => {
    const f = new Set(["2026-12-25", "2026-09-16", "2026-05-01"]);
    expect(festivosEnRango("2026-09-14", "2026-12-31", f)).toEqual(["2026-09-16", "2026-12-25"]);
    expect(festivosEnRango("2026-12-31", "2026-01-01", f)).toEqual([]);
    expect(anioDeIso("2026-09-16")).toBe(2026);
  });
});

describe("diasFestivos — caché por año", () => {
  it("consulta cada año una sola vez y acumula", async () => {
    const fetcher = vi.fn(async (anio: number) => [
      { fecha: `${anio}-09-16`, descripcion: "Independencia" },
    ]);
    const cache = createDiasFestivosCache(fetcher);
    await cache.ensureAnios(2026, 2027);
    await cache.ensureAnios(2026);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(cache.getSet()).toEqual(new Set(["2026-09-16", "2027-09-16"]));
    expect(cache.getMap().get("2026-09-16")).toBe("Independencia");
  });

  it("un fallo del backend deja el año sin festivos y no rechaza", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("503");
    });
    const cache = createDiasFestivosCache(fetcher);
    await expect(cache.ensureAnios(2026)).resolves.toBeUndefined();
    expect(cache.getSet().size).toBe(0);
    // Sin memorizar el fallo: el siguiente intento vuelve a consultar.
    await cache.ensureAnios(2026);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
