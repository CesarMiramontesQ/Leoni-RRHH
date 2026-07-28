import { describe, expect, it } from "vitest";
import {
  ajustesCountBadge,
  ajustesEmptyState,
  ajustesSectionCard,
  ajustesTableWrap,
} from "./ajustesSectionUi.ts";

describe("ajustesTableWrap", () => {
  it("marca el contenedor para acotar su altura en Ajustes de puesto", () => {
    expect(ajustesTableWrap("<table></table>")).toContain("ajustes-table-scroll");
  });

  it("conserva el scroll horizontal para las pantallas que reusan el helper", () => {
    // La regla de altura está acotada por id a #puestos-ajustes-root, así que
    // Ajustes de cursos depende de esta clase para las tablas anchas.
    expect(ajustesTableWrap("<table></table>")).toContain("overflow-x-auto");
  });

  it("no envuelve ni altera la tabla que recibe", () => {
    const html = ajustesTableWrap('<table id="x"><tbody></tbody></table>');
    expect(html).toContain('<table id="x"><tbody></tbody></table>');
  });
});

describe("ajustesCountBadge", () => {
  it("muestra el conteo real, que es lo que da contexto cuando la tabla scrollea", () => {
    expect(ajustesCountBadge(13)).toContain("13");
  });

  it("degrada a un placeholder mientras carga", () => {
    expect(ajustesCountBadge(0, true)).toContain("…");
  });
});

describe("ajustesEmptyState", () => {
  it("escapa el mensaje dinamico", () => {
    expect(ajustesEmptyState('<img src=x onerror="alert(1)">')).not.toContain("<img");
  });

  it("acepta un CTA opcional sin romper el bloque", () => {
    expect(ajustesEmptyState("Sin datos", "<button>Crear</button>")).toContain(
      "<button>Crear</button>",
    );
  });
});

describe("ajustesSectionCard", () => {
  it("liga el titulo con la seccion para lectores de pantalla", () => {
    const html = ajustesSectionCard({
      titleId: "mi-titulo",
      title: "Funciones",
      description: "Familias de puesto",
      actionButtonHtml: "",
      bodyHtml: "<p>cuerpo</p>",
    });
    expect(html).toContain('aria-labelledby="mi-titulo"');
    expect(html).toContain('id="mi-titulo"');
  });

  it("escapa titulo y descripcion", () => {
    const html = ajustesSectionCard({
      titleId: "t",
      title: '<img src=x onerror="alert(1)">',
      description: "<script>alert(1)</script>",
      actionButtonHtml: "",
      bodyHtml: "",
    });
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
  });
});
