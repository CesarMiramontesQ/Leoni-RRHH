/**
 * Menú lateral estructurado para rol Supervisor (secciones Laborales y Comedor).
 */

import type { AppShellNavItemId } from "./shellNavPolicy.ts";

export type SupervisorNavKey =
  | "dashboard"
  | "metricas"
  | "incidencias"
  | "faltas-retardos"
  | "solicitudes"
  | "horas-extra-solicitud"
  | "horas-extra-aprobaciones"
  | "comedor"
  | "empleados";

export type SupervisorNavItem = {
  id: AppShellNavItemId;
  key: SupervisorNavKey;
  href: string;
  label: string;
  svgPaths: string;
};

export type SupervisorNavSection = {
  id: string;
  title: string;
  items: readonly SupervisorNavItem[];
};

export const SUPERVISOR_DASHBOARD_ITEM: SupervisorNavItem = {
  id: "dashboard",
  key: "dashboard",
  href: "#/",
  label: "Dashboard",
  svgPaths: `<path d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" stroke-linecap="round" stroke-linejoin="round" />`,
};

export const SUPERVISOR_EMPLEADOS_ITEM: SupervisorNavItem = {
  id: "empleados",
  key: "empleados",
  href: "#/empleados",
  label: "Empleados",
  svgPaths: `<path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" stroke-linecap="round" stroke-linejoin="round" />`,
};

export const SUPERVISOR_NAV_SECTIONS: readonly SupervisorNavSection[] = [
  {
    id: "laborales",
    title: "Laborales",
    items: [
      {
        id: "metricas",
        key: "metricas",
        href: "#/metricas",
        label: "Métricas",
        svgPaths: `<path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" stroke-linecap="round" stroke-linejoin="round" />`,
      },
      {
        id: "incidencias",
        key: "incidencias",
        href: "#/incidencias",
        label: "Incidencias",
        svgPaths: `<path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" stroke-linecap="round" stroke-linejoin="round" />`,
      },
      {
        id: "faltas-retardos",
        key: "faltas-retardos",
        href: "#/faltas-retardos",
        label: "Faltas y retardos",
        svgPaths: `<path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5M12 9.75v.008M12 12.75v.008M12 15.75v.008" stroke-linecap="round" stroke-linejoin="round" />`,
      },
      {
        id: "solicitudes",
        key: "solicitudes",
        href: "#/solicitudes",
        label: "Solicitudes",
        svgPaths: `<path d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" stroke-linecap="round" stroke-linejoin="round" />`,
      },
      {
        id: "horas-extra-solicitud",
        key: "horas-extra-solicitud",
        href: "#/horas-extra/solicitud",
        label: "Horas extra",
        svgPaths: `<path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke-linecap="round" stroke-linejoin="round" />`,
      },
      {
        id: "horas-extra-aprobaciones",
        key: "horas-extra-aprobaciones",
        href: "#/nominas/horas-extra/aprobaciones",
        label: "Aprobar horas extra",
        svgPaths: `<path d="m9 12.75 2.25 2.25 4.5-4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke-linecap="round" stroke-linejoin="round" />`,
      },
    ],
  },
  {
    id: "comedor",
    title: "Comedor",
    items: [
      {
        id: "comedor",
        key: "comedor",
        href: "#/comedor",
        label: "Gestión de comedor",
        svgPaths: `<path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" stroke-linecap="round" stroke-linejoin="round" />`,
      },
    ],
  },
];
