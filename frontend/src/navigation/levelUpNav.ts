/**
 * Navegación agrupada de Level Up: categorías del hub y visibilidad del botón lateral.
 */

import type { AppShellNavItemId } from "./shellNavPolicy.ts";
import { isEmpleadoFlatNavRol, isShellNavItemVisibleForRol, isSupervisorStructuredNavRol } from "./shellNavPolicy.ts";
import { hasExplicitModuleGrant, hasRhModule, isModulosRhEnrolled } from "../auth/rhModulePermissions.ts";
import { isNonRhRhMode, isRhEmpleadoUiMode, isRhOperativoUiMode } from "../auth/rhUiMode.ts";

export type LevelUpNavKey =
  | "level-up"
  | "puestos"
  | "puestos-ajustes"
  | "competencias"
  | "tareas-catalogo"
  | "evaluaciones"
  | "evaluacion-360"
  | "capacidades"
  | "cursos"
  | "cursos-seguimiento"
  | "cursos-ajustes"
  | "cursos-juntas"
  | "sesiones"
  | "opls"
  | "evidencias"
  | "sugerencias"
  | "encuestas";

export type LevelUpAccessItem = {
  id: AppShellNavItemId;
  key: LevelUpNavKey;
  href: string;
  label: string;
  svgPaths: string;
};

export type LevelUpCategory = {
  id: "cursos" | "puestos" | "formacion" | "cumplimiento";
  title: string;
  items: readonly LevelUpAccessItem[];
};

export const LEVEL_UP_CURSOS_SEGUIMIENTO: LevelUpAccessItem = {
  id: "cursos-seguimiento",
  key: "cursos-seguimiento",
  href: "#/cursos/seguimiento",
  label: "Seguimiento",
  svgPaths: `<path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" stroke-linecap="round" stroke-linejoin="round" />`,
};

export const LEVEL_UP_CURSOS: readonly LevelUpAccessItem[] = [
  {
    id: "cursos",
    key: "cursos",
    href: "#/cursos",
    label: "Catálogo de cursos",
    svgPaths: `<path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "sesiones",
    key: "sesiones",
    href: "#/sesiones",
    label: "Sesiones",
    svgPaths: `<path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" stroke-linecap="round" stroke-linejoin="round" />`,
  },
];

export const LEVEL_UP_ENCUESTAS: LevelUpAccessItem = {
  id: "encuestas",
  key: "encuestas",
  href: "#/encuestas",
  label: "Encuestas Post Curso",
  svgPaths: `<path d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" stroke-linecap="round" stroke-linejoin="round" /><path d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" stroke-linecap="round" stroke-linejoin="round" />`,
};

export const LEVEL_UP_JUNTAS: LevelUpAccessItem = {
  id: "cursos-juntas",
  key: "cursos-juntas",
  href: "#/cursos/juntas",
  label: "Juntas",
  svgPaths: `<path d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" stroke-linecap="round" stroke-linejoin="round" />`,
};

export const LEVEL_UP_CURSOS_AJUSTES: LevelUpAccessItem = {
  id: "cursos-ajustes",
  key: "cursos-ajustes",
  href: "#/cursos/ajustes",
  label: "Ajustes de cursos",
  svgPaths: `<path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" stroke-linecap="round" stroke-linejoin="round" /><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" stroke-linecap="round" stroke-linejoin="round" />`,
};

/** Ítems del submenú RH «Cursos» (incluye encuestas movidas desde Level Up). */
export const LEVEL_UP_CURSOS_RH_SIDEBAR: readonly LevelUpAccessItem[] = [
  LEVEL_UP_CURSOS_SEGUIMIENTO,
  ...LEVEL_UP_CURSOS,
  LEVEL_UP_JUNTAS,
  LEVEL_UP_ENCUESTAS,
  LEVEL_UP_CURSOS_AJUSTES,
];

export const LEVEL_UP_PUESTOS: readonly LevelUpAccessItem[] = [
  {
    id: "puestos",
    key: "puestos",
    href: "#/puestos",
    label: "Perfiles de puesto",
    svgPaths: `<path d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "competencias",
    key: "competencias",
    href: "#/competencias",
    label: "Competencias",
    svgPaths: `<path d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M10.875 12h2.25m-2.25 0a1.125 1.125 0 0 1-1.125 1.125M13.125 12c-.621 0-1.125.504-1.125 1.125m0 0v1.5c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-2.25-1.125c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M10.875 15.75h2.25m-2.25 0a1.125 1.125 0 0 1-1.125 1.125M13.125 15.75c-.621 0-1.125.504-1.125 1.125m1.125-1.125c.621 0 1.125.504 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M12 18.375h-1.125m2.25 0h7.5m-9.75 0c-.621 0-1.125-.504-1.125-1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m0-3.75h-7.5m7.5 0c.621 0 1.125.504 1.125 1.125M20.625 15.75c.621 0 1.125.504 1.125 1.125v1.5" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "tareas-catalogo",
    key: "tareas-catalogo",
    href: "#/tareas-catalogo",
    label: "Tareas",
    svgPaths: `<path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 3h1A2.25 2.25 0 0 1 16.65 3.836m-5.8 0c-.376.023-.75.05-1.124.08C8.095 4.01 7.25 4.973 7.25 6.108V8.25m0 0H5.625c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "puestos-ajustes",
    key: "puestos-ajustes",
    href: "#/puestos/ajustes",
    label: "Ajustes perfil de puesto",
    svgPaths: `<path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" stroke-linecap="round" stroke-linejoin="round" /><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
];

const LEVEL_UP_FORMACION: readonly LevelUpAccessItem[] = [
  {
    id: "evaluacion-360",
    key: "evaluacion-360",
    href: "#/level-up/evaluacion-360",
    label: "Evaluación 360°",
    svgPaths: `<path d="M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5ZM12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm0 0v.008H12V15Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "capacidades",
    key: "capacidades",
    href: "#/capacidades",
    label: "Matriz de multihabilidades",
    svgPaths: `<path d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6Zm0 9.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6Zm0 9.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
];

export const LEVEL_UP_CUMPLIMIENTO: readonly LevelUpAccessItem[] = [
  {
    id: "evaluaciones",
    key: "evaluaciones",
    href: "#/evaluaciones",
    label: "Evaluaciones",
    svgPaths: `<path d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.5" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "opls",
    key: "opls",
    href: "#/opls",
    label: "Manejo de OPLs",
    svgPaths: `<path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "evidencias",
    key: "evidencias",
    href: "#/evidencias",
    label: "Motor de Evidencias",
    svgPaths: `<path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  {
    id: "sugerencias",
    key: "sugerencias",
    href: "#/sugerencias",
    label: "Motor de Sugerencias",
    svgPaths: `<path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
  LEVEL_UP_ENCUESTAS,
];

const RH_CUMPLIMIENTO_SIDEBAR_ITEM_KEYS: ReadonlySet<LevelUpNavKey> = new Set([
  "evaluaciones",
  "opls",
  "evidencias",
  "sugerencias",
]);

const RH_CURSOS_SIDEBAR_ITEM_KEYS: ReadonlySet<LevelUpNavKey> = new Set(["encuestas"]);

/** Ítems de cumplimiento movidos al submenú RH «Cumplimiento». */
export const LEVEL_UP_CUMPLIMIENTO_RH_SIDEBAR: readonly LevelUpAccessItem[] =
  LEVEL_UP_CUMPLIMIENTO.filter((item) => RH_CUMPLIMIENTO_SIDEBAR_ITEM_KEYS.has(item.key));

export const LEVEL_UP_CATEGORIES: readonly LevelUpCategory[] = [
  { id: "cursos", title: "Cursos", items: LEVEL_UP_CURSOS },
  { id: "puestos", title: "Puestos", items: LEVEL_UP_PUESTOS },
  { id: "formacion", title: "Formación", items: LEVEL_UP_FORMACION },
  { id: "cumplimiento", title: "Cumplimiento", items: LEVEL_UP_CUMPLIMIENTO },
];

const LEVEL_UP_RESUMEN_ITEM: LevelUpAccessItem = {
  id: "level-up",
  key: "level-up",
  href: "#/level-up/resumen",
  label: "Resumen operativo",
  svgPaths: `<path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" stroke-linecap="round" stroke-linejoin="round" />`,
};

function hasLevelUpResumenModuleAccess(rol: string | null): boolean {
  if (rol === "empleado" || isRhEmpleadoUiMode()) return false;
  if (isRhOperativoUiMode() || isNonRhRhMode()) return hasRhModule("level-up");
  if (isModulosRhEnrolled()) return hasExplicitModuleGrant("level-up");
  return rol === "director" || rol === "gerente";
}

export const LEVEL_UP_SUB_NAV_KEYS: ReadonlySet<LevelUpNavKey> = new Set(
  LEVEL_UP_CATEGORIES.flatMap((category) => category.items.map((item) => item.key)),
);

export const LEVEL_UP_SIDEBAR_ITEM = {
  id: "level-up" as const,
  key: "level-up" as const,
  href: "#/level-up",
  label: "Level Up",
  svgPaths: `<path d="M3.75 13.5 10.5 6.75l2.25 2.25L20.25 3.75M20.25 8.25V3.75h-4.5" stroke-linecap="round" stroke-linejoin="round" /><path d="M4.5 20.25h15a1.5 1.5 0 0 0 1.5-1.5V9.75" stroke-linecap="round" stroke-linejoin="round" />`,
};

function filterVisibleItems(rol: string | null, items: readonly LevelUpAccessItem[]): LevelUpAccessItem[] {
  return items.filter((item) => isShellNavItemVisibleForRol(rol, item.id));
}

export function getVisibleLevelUpCategories(rol: string | null): LevelUpCategory[] {
  return LEVEL_UP_CATEGORIES.map((category) => {
    let items = filterVisibleItems(rol, category.items);
    if (category.id === "cumplimiento" && hasLevelUpResumenModuleAccess(rol)) {
      items = [LEVEL_UP_RESUMEN_ITEM, ...items];
    }
    return { ...category, items };
  }).filter((category) => category.items.length > 0);
}

/** Categorías Level Up visibles en el sidebar RH (sin secciones propias: Cursos, Puestos). */
const RH_SIDEBAR_OWN_SECTION_CATEGORY_IDS = new Set<LevelUpCategory["id"]>(["cursos", "puestos"]);

function filterRhSidebarLevelUpCategory(category: LevelUpCategory): LevelUpCategory {
  if (category.id !== "cumplimiento") return category;
  return {
    ...category,
    items: category.items.filter(
      (item) =>
        !RH_CUMPLIMIENTO_SIDEBAR_ITEM_KEYS.has(item.key) &&
        !RH_CURSOS_SIDEBAR_ITEM_KEYS.has(item.key),
    ),
  };
}

export function getVisibleLevelUpCategoriesForRhSidebar(rol: string | null): LevelUpCategory[] {
  return getVisibleLevelUpCategories(rol)
    .filter((category) => !RH_SIDEBAR_OWN_SECTION_CATEGORY_IDS.has(category.id))
    .map(filterRhSidebarLevelUpCategory)
    .filter((category) => category.items.length > 0);
}

export function isLevelUpHubVisibleForRol(rol: string | null): boolean {
  if (isEmpleadoFlatNavRol(rol) || isSupervisorStructuredNavRol(rol)) return false;
  if (isRhOperativoUiMode()) return false;
  return getVisibleLevelUpCategories(rol).length > 0;
}

export function isLevelUpSubNavKey(key: string | undefined): key is LevelUpNavKey {
  return key != null && LEVEL_UP_SUB_NAV_KEYS.has(key as LevelUpNavKey);
}

export function resolveLevelUpSidebarActiveNav(activeNav: string | undefined): string | undefined {
  if (activeNav === "level-up" || isLevelUpSubNavKey(activeNav)) {
    return "level-up";
  }
  return activeNav;
}
