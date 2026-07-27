# Sidebar del empleado en secciones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agrupar los 12 ítems planos del sidebar del rol empleado en tres secciones (Mis trámites / Pendientes / Mi desarrollo) y renombrar las etiquetas que engañan.

**Architecture:** `empleadoNav.ts` pasa de exportar una lista plana a exportar secciones; la lista plana sobrevive como flatten derivado para no romper consumidores. `appShell.ts` reusa el renderizador de sección estática que ya usa supervisor. No se crea componente ni token de diseño nuevo, no se toca ninguna regla de visibilidad.

**Tech Stack:** TypeScript, Vite, Vitest (`environment: "node"`, sin DOM), Tailwind vía clases en strings.

## Global Constraints

- **Ninguna regla de visibilidad cambia.** `shellNavPolicy.isShellNavItemVisibleForRol` y `EMPLEADO_VISIBLE_NAV_IDS` no se editan en ningún task.
- Los `id`, `key`, `href` y `svgPaths` de cada ítem se conservan **exactos**. Solo cambian `label`, el orden y la agrupación.
- El menú lo comparten el rol `empleado` y un usuario RH en Modo empleado (`isEmpleadoFlatNavRol`). No hay bifurcación entre ambos.
- Toda clase CSS nueva está prohibida: se reusa `navSectionHeadingClass` (`appShell.ts:166`), que ya trae `md:max-lg:hidden` para el rail de tablet.
- Tests desde Docker: `docker-compose exec frontend npm run test`. Build: `docker-compose exec frontend npm run build`.
- Commits en Conventional Commits, sin iniciales. Rama actual: `feat/cm/sidebar-empleado-secciones`.

**Etiquetas finales** (fuente de verdad para todos los tasks):

| `id` | label nuevo | label anterior |
|---|---|---|
| `dashboard` | Dashboard | *(igual)* |
| `solicitudes` | Solicitudes | *(igual)* |
| `horas-extra-solicitud` | Horas extra | *(igual)* |
| `comedor` | Comedor | Gestión de Comedor |
| `mis-firmas` | Mis firmas | *(igual)* |
| `mis-aprobaciones-opl` | Aprobaciones de OPL | Mis aprobaciones |
| `horas-extra-aprobaciones` | Aprobar horas extra | *(igual)* |
| `mis-encuestas` | Encuestas de curso | Mis encuestas |
| `mis-encuestas-rh` | Encuestas de RH | Mis encuestas RH |
| `mis-evaluaciones` | Evaluaciones 360 | Mis Evaluaciones |
| `mis-metas` | Mis metas | *(igual)* |
| `mi-desempeno` | Mi desempeño | *(igual)* |

---

### Task 1: Secciones en `empleadoNav.ts`

**Files:**
- Modify: `frontend/src/navigation/empleadoNav.ts` (archivo completo)
- Test: `frontend/src/navigation/empleadoNav.test.ts` (crear)

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces:
  - `export type EmpleadoNavSection = { id: string; title: string; items: readonly EmpleadoFlatNavItem[] }`
  - `export const EMPLEADO_NAV_SECTIONS: readonly EmpleadoNavSection[]` — tres secciones con `id` `"tramites" | "pendientes" | "desarrollo"`.
  - `export const EMPLEADO_DASHBOARD_ITEM: EmpleadoFlatNavItem` — el ítem suelto que va arriba, fuera de toda sección.
  - `export function getVisibleEmpleadoNavSections(rol: string | null): EmpleadoNavSection[]` — filtra los ítems por `isShellNavItemVisibleForRol` y descarta las secciones que quedan vacías. Espejo exacto de `rhNav.ts::getVisibleRhNavSections`.
  - `export const EMPLEADO_FLAT_NAV_ITEMS` sobrevive **solo como puente de compilación**, ahora derivado: `appShell.ts:454` y `shellSidebar.ts:229` aún lo importan y se cambian en Tasks 2 y 3. El Task 3 lo borra, ya sin consumidores. Los tests nuevos **no** deben usarlo.
  - Los tipos `EmpleadoFlatNavKey` y `EmpleadoFlatNavItem` no cambian.

- [ ] **Step 1: Escribir el test que falla**

Crear `frontend/src/navigation/empleadoNav.test.ts`. Los mocks siguen el patrón de `rhNav.test.ts:1-38`: `isHorasExtraAprobador` e `isHorasExtraRegistroAutorizado` se leen de variables mutables para poder mover los permisos de horas extra por test.

```ts
/**
 * El menú del empleado se agrupa por momento de uso. Lo que se protege aquí es
 * que agrupar no agregue ni quite accesos, que cada página caiga en la sección
 * donde el empleado la va a buscar, y que quitar los permisos de horas extra no
 * deje secciones vacías ni huecos.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();

vi.stubGlobal("sessionStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
});

let heAprobador = false;
let heAutorizado = false;

vi.mock("../auth/jwt.ts", () => ({
  getRolFromAccessToken: () => "empleado",
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
  EMPLEADO_DASHBOARD_ITEM,
  EMPLEADO_NAV_SECTIONS,
  getVisibleEmpleadoNavSections,
} from "./empleadoNav.ts";

/** Todo lo que el menú ofrece, sin filtrar por permiso. */
const TODOS = [
  EMPLEADO_DASHBOARD_ITEM,
  ...EMPLEADO_NAV_SECTIONS.flatMap((s) => s.items),
];

describe("EMPLEADO_NAV_SECTIONS", () => {
  it("tiene las tres secciones en orden", () => {
    expect(EMPLEADO_NAV_SECTIONS.map((s) => s.id)).toEqual([
      "tramites",
      "pendientes",
      "desarrollo",
    ]);
    expect(EMPLEADO_NAV_SECTIONS.map((s) => s.title)).toEqual([
      "Mis trámites",
      "Pendientes",
      "Mi desarrollo",
    ]);
  });

  it("coloca cada ítem en su sección, en orden", () => {
    const porSeccion = Object.fromEntries(
      EMPLEADO_NAV_SECTIONS.map((s) => [s.id, s.items.map((i) => i.id)]),
    );
    expect(porSeccion.tramites).toEqual([
      "solicitudes",
      "horas-extra-solicitud",
      "comedor",
    ]);
    expect(porSeccion.pendientes).toEqual([
      "mis-firmas",
      "mis-aprobaciones-opl",
      "horas-extra-aprobaciones",
      "mis-encuestas",
      "mis-encuestas-rh",
      "mis-evaluaciones",
    ]);
    expect(porSeccion.desarrollo).toEqual(["mis-metas", "mi-desempeno"]);
  });

  it("deja el dashboard fuera de las secciones", () => {
    expect(EMPLEADO_DASHBOARD_ITEM.id).toBe("dashboard");
    expect(EMPLEADO_DASHBOARD_ITEM.href).toBe("#/");
    const enSecciones = EMPLEADO_NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.id));
    expect(enSecciones).not.toContain("dashboard");
  });

  it("agrupar no agregó ni quitó accesos", () => {
    // Los 12 ids que el empleado veía antes del cambio.
    expect(TODOS.map((i) => i.id).sort()).toEqual(
      [
        "comedor",
        "dashboard",
        "horas-extra-aprobaciones",
        "horas-extra-solicitud",
        "mi-desempeno",
        "mis-aprobaciones-opl",
        "mis-encuestas",
        "mis-encuestas-rh",
        "mis-evaluaciones",
        "mis-firmas",
        "mis-metas",
        "solicitudes",
      ].sort(),
    );
  });

  it("renombra las etiquetas que engañaban", () => {
    const label = (id: string) => TODOS.find((i) => i.id === id)?.label;
    expect(label("comedor")).toBe("Comedor");
    expect(label("mis-aprobaciones-opl")).toBe("Aprobaciones de OPL");
    expect(label("mis-encuestas")).toBe("Encuestas de curso");
    expect(label("mis-encuestas-rh")).toBe("Encuestas de RH");
    expect(label("mis-evaluaciones")).toBe("Evaluaciones 360");
  });

  it("no repite ítems entre secciones", () => {
    const ids = EMPLEADO_NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getVisibleEmpleadoNavSections", () => {
  beforeEach(() => {
    storage.clear();
    heAprobador = false;
    heAutorizado = false;
  });

  it("sin permisos de horas extra, oculta los dos ítems y conserva el resto", () => {
    const secciones = getVisibleEmpleadoNavSections("empleado");
    const porSeccion = Object.fromEntries(
      secciones.map((s) => [s.id, s.items.map((i) => i.id)]),
    );
    expect(porSeccion.tramites).toEqual(["solicitudes", "comedor"]);
    expect(porSeccion.pendientes).toEqual([
      "mis-firmas",
      "mis-aprobaciones-opl",
      "mis-encuestas",
      "mis-encuestas-rh",
      "mis-evaluaciones",
    ]);
    expect(porSeccion.desarrollo).toEqual(["mis-metas", "mi-desempeno"]);
  });

  it("con permiso de registro, Horas extra vuelve a Mis trámites en su posición", () => {
    heAutorizado = true;
    const tramites = getVisibleEmpleadoNavSections("empleado").find((s) => s.id === "tramites");
    expect(tramites?.items.map((i) => i.id)).toEqual([
      "solicitudes",
      "horas-extra-solicitud",
      "comedor",
    ]);
  });

  it("con permiso de aprobación, Aprobar horas extra vuelve a Pendientes", () => {
    heAprobador = true;
    const pendientes = getVisibleEmpleadoNavSections("empleado").find((s) => s.id === "pendientes");
    expect(pendientes?.items.map((i) => i.id)).toContain("horas-extra-aprobaciones");
  });

  it("nunca devuelve una sección vacía", () => {
    for (const seccion of getVisibleEmpleadoNavSections("empleado")) {
      expect(seccion.items.length).toBeGreaterThan(0);
    }
  });

  it("no cuela ítems que el rol no puede ver", () => {
    const ids = getVisibleEmpleadoNavSections("empleado").flatMap((s) =>
      s.items.map((i) => i.id),
    );
    expect(ids).not.toContain("incidencias");
    expect(ids).not.toContain("empleados");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `docker-compose exec frontend npm run test -- empleadoNav`
Expected: FAIL — `EMPLEADO_NAV_SECTIONS`, `EMPLEADO_DASHBOARD_ITEM` y `getVisibleEmpleadoNavSections` no existen.

- [ ] **Step 3: Reescribir `empleadoNav.ts`**

Esto es un **movimiento de bloques, no una reescritura**. Cada uno de los 12 objetos literales que hoy viven en `EMPLEADO_FLAT_NAV_ITEMS` se corta y se pega dentro de la sección que le toca, con sus cuatro campos intactos (`id`, `key`, `href`, `svgPaths`) y cambiando **solo** `label` según la tabla de Global Constraints. Ningún `svgPaths` se reescribe, reordena ni reindenta: se mueve el objeto completo. Al terminar, `git diff` no debe mostrar ni un carácter distinto dentro de ningún `svgPaths`.

Estructura resultante (los comentarios marcan qué objetos van en cada sección y en qué orden):

```ts
/**
 * Menú lateral del rol Empleado, agrupado por momento de uso:
 * pedir algo (Mis trámites), atender lo que le piden (Pendientes),
 * consultar cómo va (Mi desarrollo). El Dashboard va suelto arriba.
 */

import type { AppShellNavItemId } from "./shellNavPolicy.ts";

export type EmpleadoFlatNavKey =
  | "dashboard"
  | "solicitudes"
  | "horas-extra-solicitud"
  | "horas-extra-aprobaciones"
  | "comedor"
  | "mis-encuestas"
  | "mis-encuestas-rh"
  | "mis-firmas"
  | "mis-aprobaciones-opl"
  | "mis-metas"
  | "mi-desempeno"
  | "mis-evaluaciones";

export type EmpleadoFlatNavItem = {
  id: AppShellNavItemId;
  key: EmpleadoFlatNavKey;
  href: string;
  label: string;
  svgPaths: string;
};

export type EmpleadoNavSection = {
  id: string;
  title: string;
  items: readonly EmpleadoFlatNavItem[];
};

export const EMPLEADO_DASHBOARD_ITEM: EmpleadoFlatNavItem = {
  // El objeto `dashboard` que hoy abre EMPLEADO_FLAT_NAV_ITEMS, movido tal cual.
  id: "dashboard",
  key: "dashboard",
  href: "#/",
  label: "Dashboard",
  svgPaths: /* el svgPaths actual del ítem dashboard, sin tocar */,
};

export const EMPLEADO_NAV_SECTIONS: readonly EmpleadoNavSection[] = [
  {
    id: "tramites",
    title: "Mis trámites",
    items: [
      // Los objetos: solicitudes, horas-extra-solicitud, comedor — en ese orden.
    ],
  },
  {
    id: "pendientes",
    title: "Pendientes",
    items: [
      // Los objetos: mis-firmas, mis-aprobaciones-opl, horas-extra-aprobaciones,
      // mis-encuestas, mis-encuestas-rh, mis-evaluaciones — en ese orden.
    ],
  },
  {
    id: "desarrollo",
    title: "Mi desarrollo",
    items: [
      // Los objetos: mis-metas, mi-desempeno — en ese orden.
    ],
  },
];

/**
 * Puente de compilación mientras `appShell` y `shellSidebar` siguen consumiéndolo.
 * Se elimina en el Task 3, cuando ya no le quede ningún consumidor.
 */
export const EMPLEADO_FLAT_NAV_ITEMS: readonly EmpleadoFlatNavItem[] = [
  EMPLEADO_DASHBOARD_ITEM,
  ...EMPLEADO_NAV_SECTIONS.flatMap((seccion) => seccion.items),
];

/** Secciones con sus ítems ya filtrados por rol/permiso; descarta las que quedan vacías. */
export function getVisibleEmpleadoNavSections(rol: string | null): EmpleadoNavSection[] {
  return EMPLEADO_NAV_SECTIONS.map((seccion) => ({
    ...seccion,
    items: seccion.items.filter((item) => isShellNavItemVisibleForRol(rol, item.id)),
  })).filter((seccion) => seccion.items.length > 0);
}
```

El import de la política va junto al de tipos, igual que en `rhNav.ts:5-6`:

```ts
import type { AppShellNavItemId } from "./shellNavPolicy.ts";
import { isShellNavItemVisibleForRol } from "./shellNavPolicy.ts";
```

Conservar los comentarios de condicionalidad que ya existen, movidos junto a su ítem:
- sobre `horas-extra-solicitud`: `// Visible solo con autorización de RH para registrar horas extra (shellNavPolicy).`
- sobre `horas-extra-aprobaciones`: `// Visible solo si RH designó al empleado como aprobador (shellNavPolicy).`

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `docker-compose exec frontend npm run test -- empleadoNav`
Expected: PASS, 11 tests.

- [ ] **Step 5: Correr la suite completa del frontend**

Run: `docker-compose exec frontend npm run test`
Expected: todo verde. Si algún test de `shellNavPolicy.*` falla, es señal de que se tocó una regla de visibilidad — revertir esa parte, no adaptar el test.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/navigation/empleadoNav.ts frontend/src/navigation/empleadoNav.test.ts
git commit -m "refactor(nav): agrupar el menú del empleado en secciones"
```

---

### Task 2: Renderizar las secciones en el sidebar

**Files:**
- Modify: `frontend/src/layouts/appShell.ts:398-404` (renombrar el helper), `:435-437` (su llamador), `:453-462` (rama empleado)

**Interfaces:**
- Consumes: `EMPLEADO_DASHBOARD_ITEM` y `getVisibleEmpleadoNavSections(rol)` de Task 1.
- Produces: `renderFlatNavSection(sectionId, title, items, activeNav, rol): string` — antes `renderSupervisorNavSection`, misma firma y mismo cuerpo.

- [ ] **Step 1: Renombrar el helper a un nombre neutro de rol**

En `appShell.ts:398`, renombrar `renderSupervisorNavSection` → `renderFlatNavSection`. La firma y el cuerpo no cambian: ya acepta `readonly { id, key, href, label, svgPaths }[]` y ya devuelve `""` cuando ningún ítem del grupo es visible.

Actualizar su único llamador, dentro de `renderSupervisorSidebarSections` (`appShell.ts:435-437`):

```ts
  const sectionLis = SUPERVISOR_NAV_SECTIONS.map((section) =>
    renderFlatNavSection(section.id, section.title, section.items, activeNav, rol),
  ).join("");
```

- [ ] **Step 2: Verificar que el renombre compila**

Run: `docker-compose exec frontend npm run build`
Expected: build OK, sin referencias a `renderSupervisorNavSection`.

- [ ] **Step 3: Cambiar el import del nav de empleado**

En `appShell.ts:27`, sustituir:

```ts
import { EMPLEADO_FLAT_NAV_ITEMS } from "../navigation/empleadoNav.ts";
```

por:

```ts
import { EMPLEADO_DASHBOARD_ITEM, getVisibleEmpleadoNavSections } from "../navigation/empleadoNav.ts";
```

- [ ] **Step 4: Renderizar secciones en la rama empleado**

Añadir esta función junto a `renderSupervisorSidebarSections` (después de `appShell.ts:439`):

```ts
function renderEmpleadoSidebarSections(
  activeNav: ShellNavKey | undefined,
  rol: string | null,
): string {
  const dashboardLi = navItemLi(activeNav, rol, {
    id: EMPLEADO_DASHBOARD_ITEM.id,
    key: EMPLEADO_DASHBOARD_ITEM.key,
    hrefFor: () => EMPLEADO_DASHBOARD_ITEM.href,
    label: EMPLEADO_DASHBOARD_ITEM.label,
    svgPaths: EMPLEADO_DASHBOARD_ITEM.svgPaths,
  });
  const sectionLis = getVisibleEmpleadoNavSections(rol)
    .map((section) => renderFlatNavSection(section.id, section.title, section.items, activeNav, rol))
    .join("");
  return `${dashboardLi ? `<li><ul role="list" class="-mx-2 space-y-0.5 md:max-lg:-mx-0">${dashboardLi}</ul></li>` : ""}${sectionLis}`;
}
```

En `sidebarBody` (`appShell.ts:453-462`), sustituir el `.map(...)` sobre `EMPLEADO_FLAT_NAV_ITEMS` por la llamada:

```ts
  const mainMenuLis = (!nonRhRhMode && isEmpleadoFlatNavRol(rol))
    ? renderEmpleadoSidebarSections(sidebarActiveNav, rol)
    : (!nonRhRhMode && supervisorSidebar)
```

- [ ] **Step 5: Quitar el encabezado "Menú principal" para empleado**

En `sidebarBody` (`appShell.ts:490-497`), la envoltura `mainMenuBlock` añade un `<div>Menú principal</div>` alrededor de `mainMenuLis`. Con secciones propias ese encabezado sobra y el sidebar mostraría dos niveles de título. Extender la condición que ya exime al supervisor:

```ts
        const empleadoSidebar = !nonRhRhMode && isEmpleadoFlatNavRol(rol);
        const mainMenuBlock = ((supervisorSidebar && !nonRhRhMode) || empleadoSidebar)
          ? mainMenuLis
          : `<li>
```

- [ ] **Step 6: Verificar el build**

Run: `docker-compose exec frontend npm run build`
Expected: build OK.

- [ ] **Step 7: Verificar en el navegador con un usuario empleado**

Levantar (`docker-compose up -d`), entrar a http://localhost:5173 con un usuario de rol `empleado` y confirmar contra el spec:
- Dashboard suelto arriba, sin encabezado "Menú principal".
- Tres encabezados: MIS TRÁMITES, PENDIENTES, MI DESARROLLO, en ese orden.
- Etiquetas nuevas: "Comedor", "Aprobaciones de OPL", "Encuestas de curso", "Encuestas de RH", "Evaluaciones 360".
- El ítem de la página abierta se marca activo (fondo `surface`, texto `accent`).
- Achicar la ventana al rango tablet (768–1023 px): los encabezados desaparecen y quedan solo los iconos, sin huecos ni títulos sueltos.
- Achicar a móvil (<768 px): el drawer abre con las tres secciones.
- Si el usuario de prueba no tiene permiso de horas extra, "Horas extra" y "Aprobar horas extra" no aparecen y las secciones se ven completas sin huecos.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/layouts/appShell.ts
git commit -m "feat(nav): renderizar el sidebar del empleado por secciones"
```

---

### Task 3: Borrar el código muerto

**Files:**
- Delete: `frontend/src/layouts/shellSidebar.ts` (331 líneas)
- Modify: `frontend/src/navigation/empleadoNav.ts` (quitar `EMPLEADO_FLAT_NAV_ITEMS`)

**Interfaces:**
- Consumes: nada. Produces: nada. Retira dos piezas que quedan sin consumidor tras el Task 2.

- [ ] **Step 1: Confirmar que nadie importa `shellSidebar.ts`**

Run:
```bash
cd frontend/src && grep -rn "shellSidebar\.ts" . | grep -v "shellSidebarActiveNav"
```
Expected: sin resultados. Si aparece algún import, **detenerse** y reportarlo en vez de borrar: el archivo dejó de ser código muerto desde que se escribió este plan.

- [ ] **Step 2: Borrar el archivo**

```bash
git rm frontend/src/layouts/shellSidebar.ts
```

- [ ] **Step 3: Confirmar que `EMPLEADO_FLAT_NAV_ITEMS` ya no tiene consumidores**

Run:
```bash
cd frontend/src && grep -rn "EMPLEADO_FLAT_NAV_ITEMS" .
```
Expected: solo la definición en `navigation/empleadoNav.ts`. Era el puente de compilación del Task 1 y sus dos consumidores (`appShell.ts:454`, `shellSidebar.ts:229`) desaparecieron en los Tasks 2 y 3.

- [ ] **Step 4: Quitar el puente**

Borrar de `navigation/empleadoNav.ts` el bloque completo:

```ts
/**
 * Puente de compilación mientras `appShell` y `shellSidebar` siguen consumiéndolo.
 * Se elimina en el Task 3, cuando ya no le quede ningún consumidor.
 */
export const EMPLEADO_FLAT_NAV_ITEMS: readonly EmpleadoFlatNavItem[] = [
  EMPLEADO_DASHBOARD_ITEM,
  ...EMPLEADO_NAV_SECTIONS.flatMap((seccion) => seccion.items),
];
```

Los tests del Task 1 no lo usan (calculan su propio `TODOS`), así que no hay que tocarlos.

- [ ] **Step 5: Verificar build y tests**

Run: `docker-compose exec frontend npm run build && docker-compose exec frontend npm run test`
Expected: ambos verdes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/navigation/empleadoNav.ts
git commit -m "chore(nav): eliminar shellSidebar.ts y el flatten sin consumidores"
```

---

### Task 4: Actualizar `design.md` §8.1

**Files:**
- Modify: `design.md:495-510` (sección "8.1 Sidebar Navigation")

**Interfaces:**
- Consumes: la estructura final de Task 1. Produces: nada de código.

- [ ] **Step 1: Corregir la lista de ítems por rol**

En el bloque **Role-based** (`design.md:504-507`), la línea de `empleado` dice "dashboard, solicitudes, comedor, notificaciones" y quedó desactualizada hace varias versiones (`notificaciones` ya no es un ítem de sidebar). Sustituir esa línea por:

```markdown
- `empleado`: menú agrupado en tres secciones estáticas — **Mis trámites** (solicitudes, horas extra*, comedor), **Pendientes** (mis firmas, aprobaciones de OPL, aprobar horas extra*, encuestas de curso, encuestas de RH, evaluaciones 360) y **Mi desarrollo** (mis metas, mi desempeño), con Dashboard suelto arriba. (*) sujeto a permiso de nómina.
```

- [ ] **Step 2: Documentar el patrón de sección estática**

Añadir al final de §8.1, antes de "### 8.2 Topbar":

```markdown
**Secciones del sidebar**: dos variantes según el volumen de ítems.

| Variante | Cuándo | Implementación |
|---|---|---|
| Estática | ≤ ~15 ítems (empleado, supervisor) | Encabezado `navSectionHeadingClass` + `<ul>`. Todo visible, sin taps extra. |
| Colapsable | > ~15 ítems (RH operativo) | `<details>` por sección, abierta la que contiene la ruta activa. |

El encabezado de sección lleva `md:max-lg:hidden`: en el rail de tablet el sidebar queda solo con iconos y los títulos estorbarían.
```

- [ ] **Step 3: Commit**

```bash
git add design.md
git commit -m "docs(design): documentar las secciones del sidebar del empleado"
```

---

## Verificación final

1. `docker-compose exec frontend npm run test` — verde, incluidos los 7 tests nuevos de `empleadoNav.test.ts`.
2. `docker-compose exec frontend npm run build` — sin errores de TypeScript.
3. En el navegador, con rol `empleado`: las tres secciones, las etiquetas nuevas, el activo marcado, y los breakpoints de tablet y móvil según el Step 7 del Task 2.
4. Con un usuario RH: cambiar a **Modo empleado** desde el menú de perfil y confirmar que ve exactamente el mismo sidebar agrupado.
5. Con un usuario supervisor: su sidebar no cambió (mismas secciones Laborales y Comedor de siempre) — es la regresión más probable del renombre del helper en Task 2.
