# Sidebar del empleado — agrupación en secciones

**Fecha:** 2026-07-27
**Estado:** aprobado
**Alcance:** `frontend/src/navigation/empleadoNav.ts` + rama empleado de `layouts/appShell.ts`. Solo orden, agrupación y etiquetas; ninguna regla de visibilidad cambia.

## Problema

El rol empleado ve una lista plana de 12 ítems sin secciones (`EMPLEADO_FLAT_NAV_ITEMS`), mientras RH y supervisor sí tienen sidebar agrupado. El orden actual mezcla trámites, bandejas de pendientes y consulta de desempeño, y separa páginas hermanas: "Mis encuestas" y "Mis encuestas RH" quedan partidas por "Mis Evaluaciones".

Además hay etiquetas que engañan:
- "Mis Evaluaciones" se lee como "ver mi evaluación", pero la página sirve para **responder** las 360 donde el usuario es evaluador.
- "Mis aprobaciones" no dice que son OPLs, y cae junto a "Aprobar horas extra".
- "Gestión de Comedor" suena a pantalla de administración cuando el empleado solo reserva.
- "Mis encuestas" (post-curso) y "Mis encuestas RH" (clima) no se distinguen por el nombre.

## Decisión

Agrupar **por momento de uso**: pedir algo, atender lo que le piden, consultar cómo va. Es el único corte que un operador de planta entiende sin explicación, y junta las seis bandejas dispersas en un solo bloque.

Se descartaron:
- **Por dominio (espejo del sidebar RH):** produce secciones de un solo ítem y obliga al empleado a saber qué área administra cada cosa.
- **Bandeja de pendientes con contadores:** requiere endpoints de conteo nuevos y deja el resto del menú igual de plano.

## Estructura

| Sección | Ítem | `id` | Ruta | Etiqueta anterior |
|---|---|---|---|---|
| *(fuera de sección)* | Dashboard | `dashboard` | `#/` | — |
| **Mis trámites** | Solicitudes | `solicitudes` | `#/solicitudes` | — |
| | Horas extra ᶜ | `horas-extra-solicitud` | `#/horas-extra/solicitud` | — |
| | Comedor | `comedor` | `#/comedor` | Gestión de Comedor |
| **Pendientes** | Mis firmas | `mis-firmas` | `#/mis-firmas` | — |
| | Aprobaciones de OPL | `mis-aprobaciones-opl` | `#/mis-aprobaciones-opl` | Mis aprobaciones |
| | Aprobar horas extra ᶜ | `horas-extra-aprobaciones` | `#/nominas/horas-extra/aprobaciones` | — |
| | Encuestas de curso | `mis-encuestas` | `#/mis-encuestas` | Mis encuestas |
| | Encuestas de RH | `mis-encuestas-rh` | `#/talento/mis-encuestas` | Mis encuestas RH |
| | Evaluaciones 360 | `mis-evaluaciones` | `#/mis-evaluaciones` | Mis Evaluaciones |
| **Mi desarrollo** | Mis metas | `mis-metas` | `#/talento/mis-metas` | — |
| | Mi desempeño | `mi-desempeno` | `#/talento/mi-desempeno` | — |

ᶜ = condicional. `horas-extra-solicitud` depende de `canRegisterOvertime()` y `horas-extra-aprobaciones` de `canApproveOvertime()` (`shellNavPolicy.ts:328-329`). Ninguna de las dos condiciones cambia.

"Evaluaciones 360" va en **Pendientes**, no en Mi desarrollo: es trabajo que otro le pidió al usuario.

## Comportamiento

- **Secciones estáticas**, no colapsables. Con 11–13 ítems caben sin plegar y en móvil no se pierde un tap por sección. Las colapsables (`<details>`) se justifican en RH, que supera los 40 ítems.
- Sección sin ítems visibles no se renderiza.
- **Ninguna regla de visibilidad cambia.** `isShellNavItemVisibleForRol` y `EMPLEADO_VISIBLE_NAV_IDS` quedan intactos.
- El rail de tablet (`md:max-lg`, iconos con label oculto) sigue igual: `navSectionHeadingClass` (`appShell.ts:166`) ya trae `md:max-lg:hidden`.
- El menú lo comparten el rol `empleado` y un usuario RH en Modo empleado (`isEmpleadoFlatNavRol`); ambos ven la misma estructura.

## Implementación

- `navigation/empleadoNav.ts`: `EMPLEADO_NAV_SECTIONS` (`{ id, title, items }`) pasa a ser la fuente de verdad, más `getVisibleEmpleadoNavSections(rol)` que filtra por `isShellNavItemVisibleForRol` y descarta secciones vacías — espejo de `rhNav.ts::getVisibleRhNavSections`. Ese filtrado en la capa de datos es lo que hace testeables los casos condicionales de horas extra: `appShell` no es importable desde un test con `environment: "node"`.
- `EMPLEADO_FLAT_NAV_ITEMS` **se elimina**. Sus dos únicos consumidores son `appShell.ts:454` y `shellSidebar.ts:229`, y ambos desaparecen en este cambio; conservarlo contradiría el borrado de código muerto. Sobrevive como puente de compilación intermedio y se retira al final.
- `layouts/appShell.ts::sidebarBody`: la rama `isEmpleadoFlatNavRol` renderiza secciones reusando `renderSupervisorNavSection` (`appShell.ts:398-425`), que ya acepta la forma genérica `{ id, key, href, label, svgPaths }` y ya devuelve `""` cuando ningún ítem es visible. Solo hay que renombrarlo a algo neutro de rol (`renderFlatNavSection`); no se crea componente ni token de diseño nuevo.
- Borrar `layouts/shellSidebar.ts`: 331 líneas que **ningún módulo importa** (verificado por grep sobre todo `frontend/src`). Duplican el render del sidebar y consumen `EMPLEADO_FLAT_NAV_ITEMS`, así que son la trampa evidente para quien retome este trabajo.
- Actualizar `design.md` §8.1, cuya lista de ítems de empleado (dashboard, solicitudes, comedor, notificaciones) quedó desactualizada hace varias versiones.

## Tests

Nuevo `navigation/empleadoNav.test.ts`, con los mocks de `rhNav.test.ts`:
- Orden de secciones y de ítems dentro de cada una.
- Cada ítem cae en la sección que le toca; ninguno se repite entre secciones.
- El dashboard queda fuera de toda sección.
- Con `canRegisterOvertime()` falso, "Horas extra" no aparece y "Mis trámites" conserva el resto.
- Con ambos permisos de horas extra falsos, ninguna sección queda vacía.
- El conjunto de `id` ofrecidos es idéntico al de antes del cambio (garantiza que agrupar no agregó ni quitó accesos).

## Fuera de alcance

- Sidebar de supervisor, que tiene el problema inverso: una sección "Laborales" con 15 ítems que mezcla lo personal con lo del equipo.
- Contadores de pendientes en el menú.
- Cambios en permisos, rutas o páginas.
