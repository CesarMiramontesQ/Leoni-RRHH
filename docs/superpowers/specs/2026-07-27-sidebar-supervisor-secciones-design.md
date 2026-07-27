# Sidebar del supervisor — agrupación en secciones

**Fecha:** 2026-07-27
**Estado:** aprobado
**Alcance:** `frontend/src/navigation/supervisorNav.ts` + rama supervisor de `layouts/appShell.ts` + §8.1 de `design.md`. Solo orden, agrupación, etiquetas y presentación; ninguna regla de visibilidad cambia.

## Problema

El supervisor ve **17 ítems bajo un único encabezado "Laborales"**, más una sección "Comedor" de un solo ítem, el Dashboard arriba y "Empleados" anclado al pie. Es el mismo desorden que se corrigió para el empleado (PR #143), agravado por el volumen.

Esos 17 mezclan tres cosas que no se parecen:
- **Gestión del equipo:** Métricas, Incidencias, Faltas y retardos, Solicitudes, Viajes laborales.
- **Ciclo de talento del equipo:** Dashboard de Talento, Metas, Ciclo de Desempeño, Historial Objetivo.
- **Sus propias páginas personales:** Mis firmas, Mis aprobaciones, las dos encuestas, Mis metas, Mi desempeño — las mismas seis que el empleado ya tiene agrupadas, pero aquí con los nombres viejos.

Ese último punto es el follow-up que el PR #143 dejó abierto: dos roles llaman distinto a la misma pantalla.

## Decisión

Cinco secciones, con **dos tratamientos visuales**: lo del equipo estático (trabajo diario, sin coste de clic), lo personal plegable (secundario para este rol).

Se descartaron:
- **Las cinco estáticas:** 19 ítems más 5 encabezados obligan a scroll en laptop.
- **Las cinco plegables, como RH:** el supervisor pagaría un clic para llegar a Incidencias o Faltas y retardos, que consulta a diario.

## Estructura

| Sección | Tipo | Ítems, en orden |
|---|---|---|
| *(fuera de sección)* | — | Dashboard |
| **Mi equipo** | estática | Empleados · Métricas · Incidencias · Faltas y retardos · Solicitudes · Viajes laborales |
| **Talento del equipo** | estática | Dashboard de Talento · Metas · Ciclo de Desempeño · Historial Objetivo |
| **Mis trámites** | plegable | Horas extra ᶜ · Comedor |
| **Pendientes** | plegable | Mis firmas · Aprobaciones de OPL · Aprobar horas extra ᶜ · Encuestas de curso · Encuestas de RH |
| **Mi desarrollo** | plegable | Mis metas · Mi desempeño |

ᶜ = condicional: `horas-extra-solicitud` depende de `canRegisterOvertime()` y `horas-extra-aprobaciones` de `canApproveOvertime()` (`shellNavPolicy.ts:328-329`). Ninguna de las dos condiciones cambia.

El supervisor **no** tiene `mis-evaluaciones` (no está en `SUPERVISOR_VISIBLE_NAV_IDS`), así que "Pendientes" tiene cinco ítems y no seis como en el menú del empleado.

**Empleados sube del pie a "Mi equipo".** Hoy vive anclado con `mt-auto pt-6` en `footerGestionHtml` (`appShell.ts:378-395`), separado del resto de la gestión del equipo sin razón funcional. `footerGestionHtml` seguirá devolviendo el pie para los demás roles que lo usan; solo deja de hacerlo cuando `isSupervisorStructuredNavRol(rol)`.

## Etiquetas

Las seis personales adoptan los nombres del menú del empleado:

| Antes | Ahora |
|---|---|
| Mis aprobaciones | **Aprobaciones de OPL** |
| Mis encuestas | **Encuestas de curso** |
| Mis encuestas RH | **Encuestas de RH** |
| Mis firmas, Mis metas, Mi desempeño | *(sin cambio, ya coincidían)* |

Las etiquetas de equipo no cambian. "Gestión de comedor" pasa a **Comedor**, igual que en el menú del empleado.

## Por qué las plegables llevan icono

En el rail de tablet (768–1023 px) el sidebar se reduce a iconos y los encabezados de sección se ocultan (`navSectionHeadingClass` trae `md:max-lg:hidden`). Una sección plegable cuyo título fuera un encabezado de texto **desaparecería en ese ancho y sus ítems quedarían inalcanzables** si está cerrada.

Por eso las tres plegables usan la misma fila que ya usa RH — icono + etiqueta + chevron (`rhSectionSummaryClass`) — donde el icono sobrevive en el rail y sigue siendo clicable. El icono de cada sección es el de su primer ítem, como ya hace `rhNav.ts` (reloj para Mis trámites, pluma para Pendientes, metas para Mi desarrollo).

Que convivan dos tratamientos visuales es correcto y deliberado: los encabezados estáticos **rotulan** grupos ya visibles; las filas plegables son **controles** que se pulsan.

## Comportamiento

- Las plegables se abren solas cuando la ruta activa está dentro, igual que las de RH.
- Sección sin ítems visibles no se renderiza.
- **Ninguna regla de visibilidad cambia.** `shellNavPolicy.ts` y `SUPERVISOR_VISIBLE_NAV_IDS` quedan intactos.
- El menú lo comparten `supervisor`, `gerente` y los usuarios RH en Modo líder / Modo gerente / Modo gestor de equipo (`isSupervisorStructuredNavRol`, `shellNavPolicy.ts:240-244`). Todos heredan la misma estructura; lo que difiere entre ellos ya lo resuelve la política de visibilidad. No se bifurca el menú por rol.

## Implementación

- `navigation/supervisorNav.ts`: `SupervisorNavSection` gana `tipo: "estatica" | "plegable"` e `iconSvgPaths` (obligatorio solo en las plegables), más `getVisibleSupervisorNavSections(rol: string | null): SupervisorNavSection[]`, que filtra por `isShellNavItemVisibleForRol` y descarta las vacías — mismo patrón que `getVisibleEmpleadoNavSections` (`empleadoNav.ts`).
- `layouts/appShell.ts`: `renderSupervisorSidebarSections` elige renderizador según `tipo`. `renderRhCollapsibleSection` (`appShell.ts:233-258`) se generaliza para no depender de los tipos `Rh*` — pasa a recibir los mismos parámetros sueltos que `renderFlatNavSection` más el icono, y `renderRhStructuredSidebarSections` se adapta a la nueva firma.
- `footerGestionHtml` deja de emitir el pie de Empleados para los roles con sidebar de supervisor.
- `design.md` §8.1: la tabla actual dice "≤ ~15 ítems → estática, > ~15 → colapsable". Ese criterio resultó equivocado y hay que reemplazarlo por el real: **estática para lo que se usa a diario, plegable para lo secundario**, y un mismo menú puede mezclar ambas. Documentar también por qué las plegables necesitan icono (el rail de tablet).

## Tests

Nuevo `navigation/supervisorNav.test.ts`, con los mocks de `empleadoNav.test.ts`:
- Orden de las cinco secciones, su `tipo`, y el orden de ítems dentro de cada una.
- Cada ítem cae en la sección que le toca; ninguno se repite entre secciones.
- Toda sección `plegable` trae `iconSvgPaths` no vacío; ninguna `estatica` lo necesita.
- El conjunto de `id` ofrecidos es idéntico al de antes del cambio, más `empleados` (que sube del pie). Garantiza que reagrupar no agregó ni quitó accesos.
- Con ambos permisos de horas extra en falso, "Mis trámites" conserva Comedor y "Pendientes" sus cuatro ítems restantes; ninguna sección queda vacía.
- Un rol cuya política excluya un id presente en el menú demuestra que el filtro está conectado (el equivalente al caso `supervisor` que se usó en `empleadoNav.test.ts`).

## Fuera de alcance

- El sidebar de RH operativo y el del empleado.
- Contadores de pendientes en el menú.
- Cambios en permisos, rutas o páginas.
- `misEncuestasRh.ts:302` conserva `ariaLabel: "Mis encuestas"` (preexistente, una línea); se corrige si se toca ese archivo.
