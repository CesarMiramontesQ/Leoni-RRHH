/**
 * Menú lateral plano para rol Empleado (sin hubs ni submenús).
 */

import type { AppShellNavItemId } from "./shellNavPolicy.ts";

export type EmpleadoFlatNavKey =
  | "dashboard"
  | "solicitudes"
  | "horas-extra-solicitud"
  | "horas-extra-aprobaciones"
  | "comedor"
  | "mis-encuestas";

export type EmpleadoFlatNavItem = {
  id: AppShellNavItemId;
  key: EmpleadoFlatNavKey;
  href: string;
  label: string;
  svgPaths: string;
};

export const EMPLEADO_FLAT_NAV_ITEMS: readonly EmpleadoFlatNavItem[] = [
  {
    id: "dashboard",
    key: "dashboard",
    href: "#/",
    label: "Dashboard",
    svgPaths: `<path d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "solicitudes",
    key: "solicitudes",
    href: "#/solicitudes",
    label: "Solicitudes",
    svgPaths: `<path d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  // Visible solo con autorización de RH para registrar horas extra (shellNavPolicy).
  {
    id: "horas-extra-solicitud",
    key: "horas-extra-solicitud",
    href: "#/horas-extra/solicitud",
    label: "Horas extra",
    svgPaths: `<path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  // Visible solo si RH designó al empleado como aprobador (shellNavPolicy).
  {
    id: "horas-extra-aprobaciones",
    key: "horas-extra-aprobaciones",
    href: "#/nominas/horas-extra/aprobaciones",
    label: "Aprobar horas extra",
    svgPaths: `<path d="m9 12.75 2.25 2.25 4.5-4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "comedor",
    key: "comedor",
    href: "#/comedor",
    label: "Gestión de Comedor",
    svgPaths: `<path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "mis-encuestas",
    key: "mis-encuestas",
    href: "#/mis-encuestas",
    label: "Mis encuestas",
    svgPaths: `<path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 3h1A2.25 2.25 0 0 1 16.65 3.836m-5.8 0c-.376.023-.75.05-1.124.08C8.095 4.01 7.25 4.973 7.25 6.108V8.25m0 0H5.625c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75" stroke-linecap="round" stroke-linejoin="round" />`,
  },
];
