/**
 * Paginación de «Solicitudes de aprobación» en el dashboard de gerente/supervisor.
 *
 * Un gerente ve las pendientes de todo su subárbol, así que la tabla crecía sin límite
 * dentro de una tarjeta pensada para dar un vistazo. Se pagina de 10 en el cliente: el
 * payload ya trae todas las filas, no hay petición extra al cambiar de página.
 */
import { describe, expect, it, vi } from "vitest";

import type { LiderApprovalRequestRow } from "../../dashboard/lider/types.ts";

vi.mock("../../auth/jwt.ts", () => ({
  getEffectiveGestorNavRol: () => "gerente",
  canSeeDashboardTeamCalendar: () => true,
  canAccessLiderTeamDashboard: () => true,
  getEmpleadoIdFromAccessToken: () => 1,
  getRolFromAccessToken: () => "gerente",
}));

function filas(n: number): LiderApprovalRequestRow[] {
  return Array.from({ length: n }, (_, i) => ({
    id: String(i + 1),
    collaborator_name: `COLABORADOR ${i + 1}`,
    collaborator_initials: null,
    request_type: "vacaciones",
    date_range: "01 ene – 05 ene",
    detail: "Vacaciones pendiente",
    status: "Pendiente",
  }));
}

async function render(rows: LiderApprovalRequestRow[], page?: number) {
  const { renderApprovalRequestsCard } = await import("./liderTeamDashboard.ts");
  return renderApprovalRequestsCard(rows, page);
}

/** Cuenta filas de datos (el `<tr>` del encabezado vive en `<thead>` y también cuenta). */
function filasRenderizadas(html: string): number {
  return (html.match(/<tr/g) ?? []).length - 1;
}

describe("paginación de solicitudes de aprobación", () => {
  it("muestra 10 filas aunque lleguen muchas más", async () => {
    const html = await render(filas(37));
    expect(filasRenderizadas(html)).toBe(10);
    expect(html).toContain("COLABORADOR 1<");
    expect(html).toContain("COLABORADOR 10<");
    expect(html).not.toContain("COLABORADOR 11<");
  });

  it("el pie declara el tramo visible y el total", async () => {
    const html = await render(filas(37));
    expect(html).toContain(">1</span>–<span class=\"tabular-nums text-slate-900\">10</span>");
    expect(html).toContain(">37</span> solicitudes");
  });

  it("la última página muestra solo el resto", async () => {
    const html = await render(filas(37), 4);
    expect(filasRenderizadas(html)).toBe(7);
    expect(html).toContain("COLABORADOR 31<");
    expect(html).toContain("COLABORADOR 37<");
  });

  it("una página fuera de rango cae en la última en vez de quedar vacía", async () => {
    const html = await render(filas(37), 99);
    expect(filasRenderizadas(html)).toBe(7);
    expect(html).toContain("COLABORADOR 37<");
  });

  it("sin excedente no aparece el pie: 10 o menos caben en una página", async () => {
    const html = await render(filas(10));
    expect(filasRenderizadas(html)).toBe(10);
    expect(html).not.toContain("data-lider-approval-page");
    expect(html).not.toContain("Mostrando");
  });

  it("sin pendientes se conserva el estado vacío, no una tabla en blanco", async () => {
    const html = await render([]);
    expect(html).toContain("No hay solicitudes pendientes por aprobar");
    expect(html).not.toContain("data-lider-approval-page");
  });
});
