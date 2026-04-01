# Diseño: Modo Lectura de Usuarios + Edición Restringida RH

**Fecha:** 2026-04-01  
**Estado:** Aprobado  
**Alcance:** Backend (FastAPI) + Frontend (Vanilla TS + Vite)

---

## Objetivo

Eliminar completamente la funcionalidad de creación de usuarios desde el sistema. Los empleados solo se leen desde la base de datos existente (alimentada por integración IT Mirror / TRESS). RH únicamente puede editar dos campos de asignación: supervisor y rol del sistema.

---

## Contexto

Los empleados se sincronizan automáticamente desde el sistema legacy TRESS vía IT Mirror. Crear empleados manualmente desde la plataforma RH es innecesario y un riesgo de inconsistencia de datos. Solo tiene sentido permitir que RH ajuste asignaciones organizacionales (quién supervisa a quién, qué rol tiene en la plataforma).

---

## 1. Backend

### 1.1 Router `/api/v1/usuarios` — cambios

| Endpoint actual | Acción |
|---|---|
| `POST /api/v1/usuarios` | **Eliminar** |
| `GET /api/v1/usuarios/roles` | **Mantener** — lo usa el nuevo form de edición |
| `GET /api/v1/usuarios/{id}` | **Mantener** sin cambios (solo RH) |
| `PUT /api/v1/usuarios/{id}` | **Reemplazar** por `PATCH /{id}` con schema restringido |
| `DELETE /api/v1/usuarios/{id}` | **Mantener** sin cambios (desactivar, solo RH) |

### 1.2 Nuevo schema `UsuarioAsignacionUpdate`

Reemplaza a `UsuarioUpdate` en el router de edición. Acepta **únicamente** dos campos opcionales:

```python
class UsuarioAsignacionUpdate(BaseModel):
    supervisor_id: int | None = None
    rol_id: int | None = None
```

`UsuarioCreate` y `UsuarioUpdate` se eliminan del archivo `schemas/usuarios.py` (ya no tienen uso).

### 1.3 Nuevo método de servicio `asignar_supervisor_y_rol()`

Reemplaza a `actualizar_usuario()` en `UsuarioService`. Responsabilidades:

- Validar que el empleado exista → `NotFoundError`
- Validar que solo RH puede llamarlo → `ForbiddenError`
- Aplicar solo `supervisor_id` y `rol_id` del payload (ignorar cualquier otro campo — el schema lo garantiza a nivel de Pydantic)
- Registrar audit con `audit_background()` (acción: `USUARIO_ASIGNACION_UPDATED`)
- Retornar `UsuarioResponse`

`crear_usuario()` se elimina del servicio.

### 1.4 Router `/api/v1/empleados` — sin cambios

El router ya cumple los requisitos:
- RH: ve activos + inactivos, puede filtrar por `activo`
- Gerente / director / supervisor: solo ven activos vía `list_directorio_empleados_page()`
- No hay endpoints de escritura en este router

---

## 2. Frontend

### 2.1 Archivos a eliminar

| Archivo | Razón |
|---|---|
| `src/components/empleados/nuevoEmpleadoButton.ts` | Botón de creación eliminado |
| `src/components/empleados/nuevoEmpleadoModal.ts` | Modal de creación eliminado |

### 2.2 `src/api/usuariosAdmin.ts` — reescribir

**Eliminar:**
- Tipo `UsuarioCreatePayload`
- Tipo `UsuarioCreatedResponse`
- Función `createUsuario()`

**Mantener:**
- `fetchUsuariosRoles()` — lo usa el nuevo modal de edición

**Agregar:**

```ts
export type UsuarioAsignacionPayload = {
  supervisor_id?: number | null;
  rol_id?: number | null;
};

// Reutilizar UsuarioListItem de usuarios.ts como tipo de respuesta
export async function patchUsuarioAsignacion(
  id: number,
  body: UsuarioAsignacionPayload,
): Promise<UsuarioListItem> { ... }
// PATCH /api/v1/usuarios/{id}
```

### 2.3 Nuevo `src/components/empleados/editarAsignacionModal.ts`

Reemplaza funcionalmente a `nuevoEmpleadoModal.ts`. Diferencias clave:

- **Solo 2 campos editables:** dropdown de Supervisor + dropdown de Rol
- Al abrir, recibe el `empleadoId` y pre-carga los valores actuales del empleado
- Muestra un indicador visual (ej. badge o texto informativo) que deja claro que son los únicos campos modificables
- Llama a `patchUsuarioAsignacion(id, { supervisor_id, rol_id })`
- Al guardar con éxito: cierra el modal, muestra toast de éxito, recarga la tabla

API pública del componente:

```ts
export type EditarAsignacionModalHandle = {
  open: (empleado: UsuarioListItem) => Promise<void>;
  close: () => void;
  destroy: () => void;
};

export function mountEditarAsignacionModal(
  host: HTMLElement,
  options: EditarAsignacionModalOptions,
): EditarAsignacionModalHandle { ... }
```

### 2.4 `src/pages/empleados.ts` — modificaciones

**Eliminar:**
- Imports de `renderNuevoEmpleadoButton` y `mountNuevoEmpleadoModal`
- Renderizado del botón "Nuevo Empleado" en el header
- Div `#nuevo-empleado-modal-host`
- Handler del click en `#btn-nuevo-empleado`
- Montaje del modal de creación

**Agregar:**
- Import de `mountEditarAsignacionModal`
- Columna de acción en `rowHtml()`: ícono de lápiz con `data-edit-empleado-id="{id}"` — **solo renderizado cuando `isRh === true`**
- Montaje de `editarAsignacionModal` al iniciar la página (cuando `isRh`)
- Handler del click en `[data-edit-empleado-id]` → `modal.open(empleado)`

**Sin cambios:**
- Filtro de estatus activo/inactivo (ya solo visible para RH)
- Lógica de paginación, búsqueda y filtros
- Rutas y permisos de acceso a la página

---

## 3. Reglas de negocio

- **Solo RH** puede editar asignaciones. El backend rechaza con `403` si otro rol intenta el `PATCH`.
- Si el body del `PATCH` llega vacío (ambos campos `null`), el servicio retorna el empleado sin cambios (no es error).
- El supervisor asignado debe ser un empleado existente en la BD. Si no existe → `404`.
- No se pueden crear ni eliminar empleados desde esta plataforma. Solo lectura + asignación.
- Toda modificación de asignación queda registrada en el audit log con `USUARIO_ASIGNACION_UPDATED`.

---

## 4. Archivos afectados — resumen

### Backend

| Archivo | Cambio |
|---|---|
| `app/api/v1/usuarios/router.py` | Eliminar `POST /`, cambiar `PUT` → `PATCH` con nuevo schema |
| `app/schemas/usuarios.py` | Eliminar `UsuarioCreate`, `UsuarioUpdate`; agregar `UsuarioAsignacionUpdate` |
| `app/services/usuario_service.py` | Eliminar `crear_usuario()`; agregar `asignar_supervisor_y_rol()` |

### Frontend

| Archivo | Cambio |
|---|---|
| `src/api/usuariosAdmin.ts` | Eliminar creación; agregar `patchUsuarioAsignacion()` |
| `src/components/empleados/nuevoEmpleadoButton.ts` | **Eliminar** |
| `src/components/empleados/nuevoEmpleadoModal.ts` | **Eliminar** |
| `src/components/empleados/editarAsignacionModal.ts` | **Nuevo** |
| `src/pages/empleados.ts` | Quitar creación; agregar edición de asignación |

---

## 5. Lo que NO cambia

- No se crean nuevas tablas ni estructuras espejo
- La lógica de desactivación (`DELETE /api/v1/usuarios/{id}`) se mantiene
- El router `/api/v1/empleados` no recibe cambios
- Los permisos de visualización por rol ya están correctos en backend y frontend
