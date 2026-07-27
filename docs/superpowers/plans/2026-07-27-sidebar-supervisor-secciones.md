# Sidebar del supervisor en secciones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Partir los 17 ítems de la sección "Laborales" del supervisor en cinco secciones — dos estáticas para el trabajo de equipo y tres plegables para lo personal — y alinear las etiquetas personales con el menú del empleado.

**Architecture:** `supervisorNav.ts` gana `tipo` e `iconSvgPaths` por sección y una función `getVisibleSupervisorNavSections(rol)` que filtra por permiso, espejo de la del empleado. En `appShell.ts` se generaliza el renderizador plegable que hoy solo sirve a RH para que lo pueda usar cualquier rol, y el render del supervisor elige entre estático y plegable según el tipo.

**Tech Stack:** TypeScript, Vite, Vitest (`environment: "node"`, sin DOM), Tailwind vía clases en strings.

## Global Constraints

- **Ninguna regla de visibilidad cambia.** `frontend/src/navigation/shellNavPolicy.ts` y `SUPERVISOR_VISIBLE_NAV_IDS` no se editan en ningún task.
- Los `id`, `key`, `href` y `svgPaths` de cada ítem se conservan **exactos**. Solo cambian `label`, el orden y la agrupación.
- **El sidebar de RH operativo y el del empleado no deben cambiar en nada.** El Task 2 refactoriza código que RH usa hoy; su HTML de salida debe quedar byte a byte igual.
- Toda clase CSS nueva está prohibida: se reusan `navSectionHeadingClass`, `rhSectionSummaryClass`, `rhPrimaryIcon`, `rhPrimaryChevronIcon` y `rhPrimaryLabelClass`, que ya existen en `appShell.ts`.
- El menú lo comparten `supervisor`, `gerente` y los usuarios RH en Modo líder / Modo gerente / Modo gestor de equipo (`isSupervisorStructuredNavRol`). No se bifurca por rol.
- Comandos desde `/Users/alex/Foundation/Clientes/Leoni/Leoni-RRHH` (no hay Node local):
  - `docker-compose exec frontend npm run test`
  - `docker-compose exec frontend npm run typecheck` — **éste es el gate real**; `npm run build` usa vite/rolldown y **no typechequea**. La rama parte de 37 errores preexistentes: ningún task debe agregar uno.
- Commits en Conventional Commits, en español, sin iniciales. Rama actual: `feat/cm/sidebar-supervisor-secciones`.

**Estructura final** (fuente de verdad para todos los tasks):

| Sección | `id` | `tipo` | Ítems, en orden |
|---|---|---|---|
| *(suelto)* | — | — | `dashboard` |
| Mi equipo | `equipo` | estatica | `empleados`, `metricas`, `incidencias`, `faltas-retardos`, `solicitudes`, `viajes-laborales` |
| Talento del equipo | `talento-equipo` | estatica | `dashboard-talento`, `metas`, `ciclo-desempeno`, `historial-objetivo` |
| Mis trámites | `tramites` | plegable | `horas-extra-solicitud`, `comedor` |
| Pendientes | `pendientes` | plegable | `mis-firmas`, `mis-aprobaciones-opl`, `horas-extra-aprobaciones`, `mis-encuestas`, `mis-encuestas-rh` |
| Mi desarrollo | `desarrollo` | plegable | `mis-metas`, `mi-desempeno` |

**Etiquetas que cambian** (el resto se conserva tal cual):

| `id` | label nuevo | label anterior |
|---|---|---|
| `mis-aprobaciones-opl` | Aprobaciones de OPL | Mis aprobaciones |
| `mis-encuestas` | Encuestas de curso | Mis encuestas |
| `mis-encuestas-rh` | Encuestas de RH | Mis encuestas RH |
| `comedor` | Comedor | Gestión de comedor |

**Iconos de las secciones plegables** — se copia verbatim el `svgPaths` del primer ítem de cada una, igual que hace `rhNav.ts`:

| Sección | Icono copiado de |
|---|---|
| Mis trámites | `horas-extra-solicitud` (reloj) |
| Pendientes | `mis-firmas` (pluma) |
| Mi desarrollo | `mis-metas` |

---

### Task 1: Secciones en `supervisorNav.ts`

**Files:**
- Modify: `frontend/src/navigation/supervisorNav.ts` (archivo completo)
- Test: `frontend/src/navigation/supervisorNav.test.ts` (crear)

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces:
  - `export type SupervisorNavSection = { id: string; title: string; tipo: "estatica" | "plegable"; iconSvgPaths?: string; items: readonly SupervisorNavItem[] }` — `iconSvgPaths` es obligatorio en la práctica para las plegables y ausente en las estáticas.
  - `export const SUPERVISOR_NAV_SECTIONS: readonly SupervisorNavSection[]` — las cinco secciones de la tabla de Global Constraints.
  - `export function getVisibleSupervisorNavSections(rol: string | null): SupervisorNavSection[]` — filtra ítems por `isShellNavItemVisibleForRol` y descarta las secciones vacías.
  - `export const SUPERVISOR_DASHBOARD_ITEM` no cambia.
  - `export const SUPERVISOR_EMPLEADOS_ITEM` **se conserva en este task**: `appShell.ts::footerGestionHtml` todavía lo importa y el build se rompería sin él. El Task 3 lo retira.
  - El tipo `SupervisorNavItem` no cambia; `SupervisorNavKey` tampoco (ya incluye `empleados`).

- [ ] **Step 1: Escribir el test que falla**

Crear `frontend/src/navigation/supervisorNav.test.ts`. Los mocks son los de `empleadoNav.test.ts:7-28`, cambiando el rol a `"supervisor"`:

```ts
/**
 * El menú del supervisor separa el trabajo del equipo (estático, diario) de sus
 * propias páginas (plegable, secundario). Lo que se protege aquí es que reagrupar
 * no agregue ni quite accesos, que cada página caiga donde el supervisor la va a
 * buscar, y que las plegables tengan icono — sin él desaparecen en el rail de tablet.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

let heAprobador = false;
let heAutorizado = false;

vi.mock("../auth/jwt.ts", () => ({
  getRolFromAccessToken: () => "supervisor",
  getRhGestorAlcanceFromToken: () => null,
  getAccessTokenPayload: () => null,
  isHorasExtraAprobador: () => heAprobador,
  isHorasExtraRegistroAutorizado: () => heAutorizado,
}));

vi.mock("../auth/rhUiMode.ts", () => ({
  isAdminUser: () => false,
  isNonRhRhMode: () => false,
  isRhDirectorUiMode: () => false,
  isRhEmpleadoUiMode: () => false,
  isRhGerenteUiMode: () => false,
  isRhGestorTeamUiMode: () => false,
  isRhLiderUiMode: () => false,
  isRhOperativoUiMode: () => false,
}));

import {
  SUPERVISOR_DASHBOARD_ITEM,
  SUPERVISOR_NAV_SECTIONS,
  getVisibleSupervisorNavSections,
} from "./supervisorNav.ts";

/** Todo lo que el menú ofrece, sin filtrar por permiso. */
const TODOS = [
  SUPERVISOR_DASHBOARD_ITEM,
  ...SUPERVISOR_NAV_SECTIONS.flatMap((s) => s.items),
];

describe("SUPERVISOR_NAV_SECTIONS", () => {
  it("tiene las cinco secciones en orden", () => {
    expect(SUPERVISOR_NAV_SECTIONS.map((s) => s.id)).toEqual([
      "equipo",
      "talento-equipo",
      "tramites",
      "pendientes",
      "desarrollo",
    ]);
    expect(SUPERVISOR_NAV_SECTIONS.map((s) => s.title)).toEqual([
      "Mi equipo",
      "Talento del equipo",
      "Mis trámites",
      "Pendientes",
      "Mi desarrollo",
    ]);
  });

  it("deja estático lo del equipo y plegable lo personal", () => {
    expect(SUPERVISOR_NAV_SECTIONS.map((s) => s.tipo)).toEqual([
      "estatica",
      "estatica",
      "plegable",
      "plegable",
      "plegable",
    ]);
  });

  it("da icono a toda sección plegable y solo a ésas", () => {
    // Sin icono, una sección cerrada desaparece en el rail de tablet
    // (el encabezado lleva md:max-lg:hidden) y sus ítems quedan inalcanzables.
    for (const seccion of SUPERVISOR_NAV_SECTIONS) {
      if (seccion.tipo === "plegable") {
        expect(seccion.iconSvgPaths, seccion.id).toBeTruthy();
      } else {
        expect(seccion.iconSvgPaths, seccion.id).toBeUndefined();
      }
    }
  });

  it("coloca cada ítem en su sección, en orden", () => {
    const porSeccion = Object.fromEntries(
      SUPERVISOR_NAV_SECTIONS.map((s) => [s.id, s.items.map((i) => i.id)]),
    );
    expect(porSeccion.equipo).toEqual([
      "empleados",
      "metricas",
      "incidencias",
      "faltas-retardos",
      "solicitudes",
      "viajes-laborales",
    ]);
    expect(porSeccion["talento-equipo"]).toEqual([
      "dashboard-talento",
      "metas",
      "ciclo-desempeno",
      "historial-objetivo",
    ]);
    expect(porSeccion.tramites).toEqual(["horas-extra-solicitud", "comedor"]);
    expect(porSeccion.pendientes).toEqual([
      "mis-firmas",
      "mis-aprobaciones-opl",
      "horas-extra-aprobaciones",
      "mis-encuestas",
      "mis-encuestas-rh",
    ]);
    expect(porSeccion.desarrollo).toEqual(["mis-metas", "mi-desempeno"]);
  });

  it("deja el dashboard fuera de las secciones", () => {
    expect(SUPERVISOR_DASHBOARD_ITEM.id).toBe("dashboard");
    const enSecciones = SUPERVISOR_NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.id));
    expect(enSecciones).not.toContain("dashboard");
  });

  it("reagrupar no agregó ni quitó accesos", () => {
    // Los 20 ids que el supervisor alcanzaba antes: 18 de las secciones viejas,
    // más el dashboard y `empleados`, que vivía anclado al pie.
    expect(TODOS.map((i) => i.id).sort()).toEqual(
      [
        "ciclo-desempeno",
        "comedor",
        "dashboard",
        "dashboard-talento",
        "empleados",
        "faltas-retardos",
        "historial-objetivo",
        "horas-extra-aprobaciones",
        "horas-extra-solicitud",
        "incidencias",
        "metas",
        "metricas",
        "mi-desempeno",
        "mis-aprobaciones-opl",
        "mis-encuestas",
        "mis-encuestas-rh",
        "mis-firmas",
        "mis-metas",
        "solicitudes",
        "viajes-laborales",
      ].sort(),
    );
  });

  it("alinea las etiquetas personales con el menú del empleado", () => {
    const label = (id: string) => TODOS.find((i) => i.id === id)?.label;
    expect(label("mis-aprobaciones-opl")).toBe("Aprobaciones de OPL");
    expect(label("mis-encuestas")).toBe("Encuestas de curso");
    expect(label("mis-encuestas-rh")).toBe("Encuestas de RH");
    expect(label("comedor")).toBe("Comedor");
  });

  it("no repite ítems entre secciones", () => {
    const ids = SUPERVISOR_NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getVisibleSupervisorNavSections", () => {
  beforeEach(() => {
    heAprobador = false;
    heAutorizado = false;
  });

  it("sin permisos de horas extra, oculta los dos ítems y conserva el resto", () => {
    const porSeccion = Object.fromEntries(
      getVisibleSupervisorNavSections("supervisor").map((s) => [s.id, s.items.map((i) => i.id)]),
    );
    expect(porSeccion.tramites).toEqual(["comedor"]);
    expect(porSeccion.pendientes).toEqual([
      "mis-firmas",
      "mis-aprobaciones-opl",
      "mis-encuestas",
      "mis-encuestas-rh",
    ]);
    expect(porSeccion.equipo).toHaveLength(6);
  });

  it("con permiso de registro, Horas extra vuelve a Mis trámites en su posición", () => {
    heAutorizado = true;
    const tramites = getVisibleSupervisorNavSections("supervisor").find((s) => s.id === "tramites");
    expect(tramites?.items.map((i) => i.id)).toEqual(["horas-extra-solicitud", "comedor"]);
  });

  it("con permiso de aprobación, Aprobar horas extra vuelve a Pendientes", () => {
    heAprobador = true;
    const pendientes = getVisibleSupervisorNavSections("supervisor").find(
      (s) => s.id === "pendientes",
    );
    expect(pendientes?.items.map((i) => i.id)).toContain("horas-extra-aprobaciones");
  });

  it("nunca devuelve una sección vacía", () => {
    const secciones = getVisibleSupervisorNavSections("supervisor");
    expect(secciones.length).toBe(5);
    for (const seccion of secciones) {
      expect(seccion.items.length).toBeGreaterThan(0);
    }
  });

  it("aplica de verdad el filtro por rol", () => {
    // `metricas` está en SUPERVISOR_VISIBLE_NAV_IDS pero no en EMPLEADO_VISIBLE_NAV_IDS
    // (shellNavPolicy.ts): con rol empleado tiene que desaparecer del menú.
    const conSupervisor = getVisibleSupervisorNavSections("supervisor").flatMap((s) =>
      s.items.map((i) => i.id),
    );
    const conEmpleado = getVisibleSupervisorNavSections("empleado").flatMap((s) =>
      s.items.map((i) => i.id),
    );
    expect(conSupervisor).toContain("metricas");
    expect(conEmpleado).not.toContain("metricas");
    expect(conEmpleado.length).toBeLessThan(conSupervisor.length);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `docker-compose exec frontend npm run test -- supervisorNav`
Expected: FAIL — `getVisibleSupervisorNavSections` no existe y las secciones no coinciden.

- [ ] **Step 3: Reescribir `supervisorNav.ts`**

Esto es un **movimiento de bloques, no una reescritura**. Cada uno de los 18 objetos literales que hoy viven en `SUPERVISOR_NAV_SECTIONS` se corta y se pega dentro de la sección que le toca, con sus cuatro campos intactos (`id`, `key`, `href`, `svgPaths`) y cambiando **solo** `label` en los cuatro casos de la tabla de Global Constraints. El objeto de `empleados` sale de `SUPERVISOR_EMPLEADOS_ITEM` y se **copia** dentro de "Mi equipo" (la constante sigue existiendo hasta el Task 3). Ningún `svgPaths` se reescribe ni se reindenta.

Estructura resultante:

```ts
/**
 * Menú lateral de Supervisor y Gerente: el trabajo del equipo va en secciones
 * estáticas (uso diario, sin coste de clic) y las páginas propias en secciones
 * plegables, que para este rol son secundarias.
 */

import type { AppShellNavItemId } from "./shellNavPolicy.ts";
import { isShellNavItemVisibleForRol } from "./shellNavPolicy.ts";

// … SupervisorNavKey y SupervisorNavItem sin cambios …

export type SupervisorNavSection = {
  id: string;
  title: string;
  tipo: "estatica" | "plegable";
  /** Obligatorio en las plegables: es lo único que sobrevive en el rail de tablet. */
  iconSvgPaths?: string;
  items: readonly SupervisorNavItem[];
};

// … SUPERVISOR_DASHBOARD_ITEM y SUPERVISOR_EMPLEADOS_ITEM sin cambios …

export const SUPERVISOR_NAV_SECTIONS: readonly SupervisorNavSection[] = [
  {
    id: "equipo",
    title: "Mi equipo",
    tipo: "estatica",
    items: [
      // Los objetos: empleados, metricas, incidencias, faltas-retardos,
      // solicitudes, viajes-laborales — en ese orden.
    ],
  },
  {
    id: "talento-equipo",
    title: "Talento del equipo",
    tipo: "estatica",
    items: [
      // Los objetos: dashboard-talento, metas, ciclo-desempeno, historial-objetivo.
    ],
  },
  {
    id: "tramites",
    title: "Mis trámites",
    tipo: "plegable",
    iconSvgPaths: /* el svgPaths de horas-extra-solicitud, copiado */,
    items: [
      // Los objetos: horas-extra-solicitud, comedor. `comedor` sale de la
      // sección "Comedor" vieja y su label pasa a "Comedor".
    ],
  },
  {
    id: "pendientes",
    title: "Pendientes",
    tipo: "plegable",
    iconSvgPaths: /* el svgPaths de mis-firmas, copiado */,
    items: [
      // Los objetos: mis-firmas, mis-aprobaciones-opl, horas-extra-aprobaciones,
      // mis-encuestas, mis-encuestas-rh.
    ],
  },
  {
    id: "desarrollo",
    title: "Mi desarrollo",
    tipo: "plegable",
    iconSvgPaths: /* el svgPaths de mis-metas, copiado */,
    items: [
      // Los objetos: mis-metas, mi-desempeno.
    ],
  },
];

/** Secciones con sus ítems ya filtrados por rol/permiso; descarta las que quedan vacías. */
export function getVisibleSupervisorNavSections(rol: string | null): SupervisorNavSection[] {
  return SUPERVISOR_NAV_SECTIONS.map((seccion) => ({
    ...seccion,
    items: seccion.items.filter((item) => isShellNavItemVisibleForRol(rol, item.id)),
  })).filter((seccion) => seccion.items.length > 0);
}
```

Conservar los comentarios de condicionalidad si existen, movidos junto a su ítem.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `docker-compose exec frontend npm run test -- supervisorNav`
Expected: PASS, 13 tests.

- [ ] **Step 5: Correr la suite completa y el typecheck**

Run: `docker-compose exec frontend npm run test && docker-compose exec frontend npm run typecheck`
Expected: suite verde; typecheck con 37 errores, ninguno nuevo y ninguno en los archivos tocados. Si algún test de `shellNavPolicy.*` falla, es señal de que se tocó una regla de visibilidad — revertir esa parte, no adaptar el test.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/navigation/supervisorNav.ts frontend/src/navigation/supervisorNav.test.ts
git commit -m "refactor(nav): agrupar el menú del supervisor en secciones"
```

---

### Task 2: Generalizar el renderizador plegable

**Files:**
- Modify: `frontend/src/layouts/appShell.ts:216-258` (los dos helpers), `:284-286` (el llamador de RH), `:44` (import)
- Modify: `frontend/src/navigation/rhNav.ts:188-194` (borrar `rhNavSectionContainsActiveKey`)

**Interfaces:**
- Consumes: nada del Task 1.
- Produces:
  - `renderCollapsibleNavSection(sectionId: string, title: string, iconSvgPaths: string, items: readonly SidebarNavItemShape[], activeNav: SidebarNavKey | undefined, rol: string | null): string` — antes `renderRhCollapsibleSection`.
  - `type SidebarNavKey = ShellNavKey | RhNavKey` — tipo local de `appShell.ts`. **Hace falta la unión:** `RhNavKey` tiene dos miembros (`cursos-ajustes` y `personal-externo`) que no existen en `ShellNavKey`, así que tipar solo con `ShellNavKey` rompería los ítems de RH.
  - `type SidebarNavItemShape = { id: AppShellNavItemId; key: SidebarNavKey; href: string; label: string; svgPaths: string }` — tipo local de `appShell.ts`.

Este task es **puro refactor**: el HTML que genera el sidebar de RH debe quedar idéntico. No toca al supervisor todavía.

- [ ] **Step 1: Aflojar el tipo del ítem de submenú**

`rhSubNavItemLi` (`appShell.ts:216`) recibe hoy `item: RhNavItem`. Cambiar la firma a la forma suelta, dejando el cuerpo igual:

```ts
/** `RhNavKey` aporta `cursos-ajustes` y `personal-externo`, que no están en `ShellNavKey`. */
type SidebarNavKey = ShellNavKey | RhNavKey;

type SidebarNavItemShape = {
  id: AppShellNavItemId;
  key: SidebarNavKey;
  href: string;
  label: string;
  svgPaths: string;
};

function rhSubNavItemLi(
  activeNav: SidebarNavKey | undefined,
  rol: string | null,
  item: SidebarNavItemShape,
): string {
```

`RhNavKey` ya está importado en `appShell.ts`. Los dos llamadores siguen compilando sin cast: `renderRhStructuredSidebarSections` pasa un `RhNavKey` y el supervisor un `ShellNavKey`, y ambos son asignables a la unión.

- [ ] **Step 2: Generalizar la sección plegable**

Reemplazar `renderRhCollapsibleSection` (`appShell.ts:233-258`) por esta versión, que recibe los campos sueltos y calcula la apertura sin depender de `rhNavSectionContainsActiveKey`. El HTML es el mismo, carácter por carácter:

```ts
function renderCollapsibleNavSection(
  sectionId: string,
  title: string,
  iconSvgPaths: string,
  items: readonly SidebarNavItemShape[],
  activeNav: SidebarNavKey | undefined,
  rol: string | null,
): string {
  const subLis = items.map((item) => rhSubNavItemLi(activeNav, rol, item)).filter(Boolean);
  if (subLis.length === 0) return "";

  const isOpen = activeNav != null && items.some((item) => item.key === activeNav);
  const panelId = `shell-rh-nav-panel-${sectionId}`;

  return `<li>
    <details class="group/rh-nav-section" ${isOpen ? "open" : ""}>
      <summary class="${rhSectionSummaryClass} ${navInactive}" aria-controls="${panelId}">
        <span class="flex min-w-0 flex-1 items-center gap-x-3">
          ${rhPrimaryIcon(iconSvgPaths, false)}
          <span class="${rhPrimaryLabelClass}">${title}</span>
        </span>
        ${rhPrimaryChevronIcon}
      </summary>
      <ul id="${panelId}" role="list" class="space-y-0.5 py-0.5 pl-9 md:max-lg:pl-0 lg:border-l lg:border-shell-active-ring/80 lg:ml-5 lg:pl-2">
        ${subLis.join("")}
      </ul>
    </details>
  </li>`;
}
```

- [ ] **Step 3: Adaptar el llamador de RH**

En `renderRhStructuredSidebarSections` (`appShell.ts:284-286`):

```ts
  const sectionLis = getVisibleRhNavSections(rol)
    .map((section) =>
      renderCollapsibleNavSection(
        section.id,
        section.title,
        section.iconSvgPaths,
        section.items,
        activeNav,
        rol,
      ),
    )
    .join("");
```

- [ ] **Step 4: Borrar el helper que quedó sin consumidores**

`rhNavSectionContainsActiveKey` (`rhNav.ts:188-194`) era el único uso de la lógica de apertura y ahora vive dentro de `renderCollapsibleNavSection`. Confirmar y borrar:

```bash
cd frontend/src && grep -rn "rhNavSectionContainsActiveKey" .
```
Expected tras el cambio: solo la definición en `navigation/rhNav.ts`. Si aparece otro consumidor, **detenerse y reportarlo** en vez de borrar. Si no, borrar la función y su import en `appShell.ts:44`.

- [ ] **Step 5: Verificar que el sidebar de RH no cambió**

Run: `docker-compose exec frontend npm run test && docker-compose exec frontend npm run typecheck`
Expected: suite verde (incluidos `rhNav.test.ts` y `shellNavPolicy.rhMode.test.ts`); typecheck en 37 errores, ninguno nuevo.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/layouts/appShell.ts frontend/src/navigation/rhNav.ts
git commit -m "refactor(nav): generalizar el renderizador de secciones plegables"
```

---

### Task 3: Renderizar el sidebar del supervisor

**Files:**
- Modify: `frontend/src/layouts/appShell.ts:427-439` (`renderSupervisorSidebarSections`), `:378-395` (`footerGestionHtml`), imports
- Modify: `frontend/src/navigation/supervisorNav.ts` (quitar `SUPERVISOR_EMPLEADOS_ITEM`)

**Interfaces:**
- Consumes: `SUPERVISOR_DASHBOARD_ITEM` y `getVisibleSupervisorNavSections(rol)` del Task 1; `renderCollapsibleNavSection` y `renderFlatNavSection` del Task 2.
- Produces: nada que otro task consuma.

- [ ] **Step 1: Cambiar el import del nav del supervisor**

En `appShell.ts`, sustituir el import de `SUPERVISOR_NAV_SECTIONS` y `SUPERVISOR_EMPLEADOS_ITEM` por:

```ts
import { SUPERVISOR_DASHBOARD_ITEM, getVisibleSupervisorNavSections } from "../navigation/supervisorNav.ts";
```

- [ ] **Step 2: Renderizar según el tipo de sección**

Reemplazar el cuerpo de `renderSupervisorSidebarSections` (`appShell.ts:427-439`):

```ts
function renderSupervisorSidebarSections(activeNav: ShellNavKey | undefined, rol: string | null): string {
  const dashboardLi = navItemLi(activeNav, rol, {
    id: SUPERVISOR_DASHBOARD_ITEM.id,
    key: SUPERVISOR_DASHBOARD_ITEM.key,
    hrefFor: () => SUPERVISOR_DASHBOARD_ITEM.href,
    label: SUPERVISOR_DASHBOARD_ITEM.label,
    svgPaths: SUPERVISOR_DASHBOARD_ITEM.svgPaths,
  });
  const sectionLis = getVisibleSupervisorNavSections(rol)
    .map((section) =>
      section.tipo === "plegable" ?
        renderCollapsibleNavSection(
          section.id,
          section.title,
          section.iconSvgPaths ?? "",
          section.items,
          activeNav,
          rol,
        )
      : renderFlatNavSection(section.id, section.title, section.items, activeNav, rol),
    )
    .join("");
  return `${dashboardLi ? `<li><ul role="list" class="-mx-2 space-y-0.5 md:max-lg:-mx-0">${dashboardLi}</ul></li>` : ""}${sectionLis}`;
}
```

- [ ] **Step 3: Quitar el pie de Empleados para este rol**

`Empleados` ahora vive dentro de "Mi equipo", así que el pie anclado lo duplicaría. En `footerGestionHtml` (`appShell.ts:378-395`), devolver `""` también para los roles con sidebar de supervisor, y borrar la rama que usaba `SUPERVISOR_EMPLEADOS_ITEM`:

```ts
function footerGestionHtml(activeNav: ShellNavKey | undefined, rol: string | null): string {
  if (isRhStructuredNavRol(rol)) return "";
  // El supervisor lleva `Empleados` dentro de la sección "Mi equipo".
  if (isSupervisorStructuredNavRol(rol)) return "";
  const empleadosLi = navItemLi(activeNav, rol, NAV_EMPLEADOS);
  if (empleadosLi.trim() === "") return "";
  return `<li class="mt-auto pt-6">
    <ul role="list" class="-mx-2 space-y-1 md:max-lg:-mx-0">
      ${empleadosLi}
    </ul>
  </li>`;
}
```

- [ ] **Step 4: Borrar `SUPERVISOR_EMPLEADOS_ITEM`**

Confirmar que ya nadie lo usa y borrarlo de `supervisorNav.ts`:

```bash
cd frontend/src && grep -rn "SUPERVISOR_EMPLEADOS_ITEM" .
```
Expected: solo la definición en `navigation/supervisorNav.ts`. Si aparece otro consumidor, **detenerse y reportarlo**.

- [ ] **Step 5: Verificar build y tests**

Run: `docker-compose exec frontend npm run test && docker-compose exec frontend npm run typecheck`
Expected: suite verde; typecheck en 37 errores, ninguno nuevo.

- [ ] **Step 6: Verificar en el navegador con un usuario supervisor**

Con los contenedores arriba (`docker-compose up -d`), entrar a http://localhost:5173 con un usuario de rol `supervisor` y confirmar:
- Dashboard suelto arriba; luego MI EQUIPO y TALENTO DEL EQUIPO con todos sus ítems visibles.
- Tres filas plegadas debajo (Mis trámites, Pendientes, Mi desarrollo), cada una con su icono y su chevron.
- Al entrar a una página personal (p.ej. `#/mis-firmas`), su sección aparece **abierta** y el ítem marcado activo.
- `Empleados` aparece dentro de "Mi equipo" y **ya no** anclado al pie.
- Rango tablet (768–1023 px): las secciones plegadas se ven como iconos clicables; las estáticas pierden su título y quedan solo los iconos de sus ítems.
- Móvil (<768 px): el drawer abre con las cinco secciones.

Si no hay credenciales de un usuario supervisor, **no inventar que se verificó**: reportar el paso como no ejecutado.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/layouts/appShell.ts frontend/src/navigation/supervisorNav.ts
git commit -m "feat(nav): renderizar el sidebar del supervisor por secciones"
```

---

### Task 4: Corregir `design.md` §8.1

**Files:**
- Modify: `design.md` (bloque "Secciones del sidebar" y la línea de `supervisor` en "Role-based")

**Interfaces:**
- Consumes: la estructura final del Task 1. Produces: nada de código.

- [ ] **Step 1: Reemplazar el criterio de la tabla**

La tabla actual dice que la variante depende del volumen de ítems ("≤ ~15 → estática, > ~15 → colapsable"). Ese criterio resultó equivocado: el supervisor tiene 19 ítems y mezcla ambas. Sustituir el bloque completo por:

```markdown
**Secciones del sidebar**: dos variantes, y un mismo menú puede mezclarlas.

| Variante | Cuándo | Implementación |
|---|---|---|
| Estática | Lo que el rol usa a diario | Encabezado `navSectionHeadingClass` + `<ul>`. Todo visible, sin taps extra. |
| Plegable | Lo secundario para ese rol | `<details>` por sección, abierta la que contiene la ruta activa. |

El criterio es **la frecuencia de uso, no el número de ítems**: el supervisor tiene sus dos secciones de equipo estáticas y las tres personales plegables, aunque sumen 19 ítems.

Toda sección plegable **necesita icono**. El encabezado estático lleva `md:max-lg:hidden`, así que en el rail de tablet desaparece; una sección plegable sin icono se quedaría sin ningún control visible y sus ítems serían inalcanzables. El icono se toma del primer ítem de la sección.
```

- [ ] **Step 2: Actualizar la línea de `supervisor` en "Role-based"**

Dice "todo excepto actas, reportes". Sustituirla por:

```markdown
- `supervisor` (y `gerente`): cinco secciones — **Mi equipo** y **Talento del equipo** estáticas, **Mis trámites**, **Pendientes** y **Mi desarrollo** plegables, con Dashboard suelto arriba. No ve actas ni reportes.
```

- [ ] **Step 3: Commit**

```bash
git add design.md
git commit -m "docs(design): corregir el criterio de secciones del sidebar"
```

---

## Verificación final

1. `docker-compose exec frontend npm run test` — verde, incluidos los 13 tests nuevos de `supervisorNav.test.ts`.
2. `docker-compose exec frontend npm run typecheck` — 37 errores, ninguno nuevo.
3. En el navegador con rol `supervisor`: lo del Step 6 del Task 3.
4. Con rol `gerente`: mismo sidebar agrupado (comparte `isSupervisorStructuredNavRol`).
5. Con un usuario RH en **Modo operativo**: su sidebar de acordeón no cambió — es la regresión más probable, porque el Task 2 refactoriza el renderizador que RH usa.
6. Con rol `empleado`: su sidebar de tres secciones tampoco cambió.
