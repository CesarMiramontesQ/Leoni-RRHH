import { describe, expect, it } from "vitest";
import { escapeHtml, fmtFechaCorta, paginationRange } from "./uiUtils.ts";

describe("escapeHtml", () => {
  it("escapa & < > \"", () => {
    expect(escapeHtml('a & b < c > d "e"')).toBe("a &amp; b &lt; c &gt; d &quot;e&quot;");
  });
  it("cadena vacía", () => {
    expect(escapeHtml("")).toBe("");
  });
  it("sin caracteres especiales", () => {
    expect(escapeHtml("hola mundo")).toBe("hola mundo");
  });
});

describe("fmtFechaCorta", () => {
  it("formatea 2025-01-15 en español MX", () => {
    const result = fmtFechaCorta("2025-01-15");
    expect(result).toContain("ene");
    expect(result).toContain("2025");
  });
  it("retorna el input original si el formato es inválido", () => {
    expect(fmtFechaCorta("no-es-fecha")).toBe("no-es-fecha");
    expect(fmtFechaCorta("")).toBe("");
  });
});

describe("paginationRange", () => {
  it("7 páginas o menos: devuelve todos los números", () => {
    expect(paginationRange(5, 3)).toEqual([1, 2, 3, 4, 5]);
  });
  it("8+ páginas en el centro: muestra ellipsis en ambos lados", () => {
    const result = paginationRange(10, 5);
    expect(result[0]).toBe(1);
    expect(result).toContain("ellipsis");
    expect(result[result.length - 1]).toBe(10);
  });
  it("0 páginas devuelve []", () => {
    expect(paginationRange(0, 1)).toEqual([]);
  });
  it("página 1 de 10: no hay ellipsis al inicio", () => {
    const result = paginationRange(10, 1);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(2);
  });
  it("página 10 de 10: no hay ellipsis al final", () => {
    const result = paginationRange(10, 10);
    expect(result[result.length - 1]).toBe(10);
    expect(result[result.length - 2]).toBe(9);
  });
});
