# Diseño — Modal «Nuevo registro» (Faltas y retardos)

**Fecha:** 2026-07-15  
**Estado:** Implementado (opción A + enfoque 1)  
**Ámbito:** Solo UI del modal de alta en `#/faltas-retardos`

## Problema

El formulario de nuevo registro es funcional pero visualmente plano frente al modal de **Nueva solicitud**: sin secciones escaneables, tipografía de labels distinta, controles de filtros reutilizados y footer embebido en el scroll.

## Objetivo

Alinear el chrome y la jerarquía visual del modal FR con Nueva solicitud (`rhNewRequestModalUi.ts`), manteniendo la lógica, validaciones, combobox de empleado, select de tipo y flujo de submit actuales.

## Fuera de alcance

- Chips/tarjetas de tipo (opción B)
- Cambios de API, schemas o reglas de negocio
- Filtros, KPIs, tabla o modal de detalle de la página
- Extraer tokens compartidos a un módulo común (enfoque 2)
- Split obligatorio a `*Ui.ts` (enfoque 3); opcional si el archivo crece

## Enfoque elegido

**Alineación visual in-place** en `frontend/src/components/faltasRetardos/nuevaFaltaRetardoModal.ts` (+ copy en `faltasRetardosCopy.ts` si hace falta subtítulo).

Referencia de tokens/patrones (copiar localmente, no refactor compartido):

| Token | Uso |
|-------|-----|
| `SEC_TITLE` | Títulos de sección uppercase tracking |
| `SEC_BOX` | Contenedor tonal de Empleado / Fechas |
| `LABEL` / `CONTROL` | Labels e inputs/select/textarea |
| Overlay / header NR | blur, padding, título + subtítulo, botón cerrar |

## Estructura del formulario

Orden fijo:

1. **Empleado** — `section` + `SEC_BOX`; título «Empleado»; ayuda corta; combobox ARIA y tarjeta «Cambiar» existentes.
2. **Tipo de registro** — título de sección; `<select>` (sin chips); `optgroup` opcional («Disciplina» = suspensión, «Con goce de sueldo» = matrimonio / incapacidad interna / defunción / paternidad); hint de duración debajo cuando aplique.
3. **Fechas** — `SEC_BOX`; título «Fecha del evento» o «Rango de fechas» según tipo; grid 1→2 cols; fechas fin readonly cuando el tipo las fija.
4. **Observaciones** — sección propia; required + maxlength 30 solo suspensión; contador existente.

Errores: callout superior `rounded-xl` (estilo NR) + mensajes por campo; `aria-invalid` en controles inválidos.

## Chrome del modal

- Overlay: `bg-slate-900/40`, `backdrop-blur-[3px]`, padding `p-4 sm:p-5`
- Panel: `max-w-lg`, `rounded-2xl`, borde suave, sombra NR, `max-h-[min(92vh,880px)]`
- Header: título «Nuevo registro» + subtítulo corto (copy nuevo en `FR_COPY`); cerrar `size-11` / `rounded-xl`
- Body: padding `px-5 py-6 sm:px-6`; formulario `space-y-8`
- Acciones: barra sticky al pie del panel (fuera del scroll del body) — Cancelar secundario + Guardar primary (`BTN_PRIMARY` / tokens existentes FR-solicitudes)
- Overlay de «Insertando…» se mantiene

## Criterios de éxito

- A simple vista, el modal se siente de la misma familia que Nueva solicitud
- Tipos ofrecidos sin cambio funcional: suspensión + 4 goce
- Combobox, validaciones y POST sin regresión
- Mobile usable (stack de fechas / secciones)

## Archivos previstos

- `frontend/src/components/faltasRetardos/nuevaFaltaRetardoModal.ts` (principal)
- `frontend/src/faltasRetardos/rh/faltasRetardosCopy.ts` (subtítulo / labels de sección si faltan)
- Opcional: `frontend/src/ui/uiTokens.ts` solo si se reutilizan `BTN_*` ya exportados

## Verificación

- Abrir Faltas y retardos → Nuevo registro
- Comparar overlay/header/secciones con Nueva solicitud
- Probar: suspensión (obs required), matrimonio (rango fijo), cambio de empleado, submit y overlay de carga
