# Plan de Pruebas — Fase 1: Modulo de Talento (Puestos Perfil + Competencias)

**Fecha**: 2026-05-04  
**Version**: 2.0 (post-implementacion)  
**Autor**: Alberto Flores  
**Estado**: FASE 1 COMPLETADA Y VALIDADA

---

## 0. Resumen Ejecutivo

La Fase 1 del modulo de Talento fue implementada y validada end-to-end con pruebas Playwright. A continuacion se documenta el estado final de la implementacion, las pruebas realizadas, correcciones aplicadas durante la validacion, y el trabajo pendiente para Fase 2.

### Resultado de Validacion E2E (Playwright)

| Flujo | Estado |
|---|---|
| Login | PASS |
| Perfiles de Puesto — listar | PASS |
| Perfiles de Puesto — crear (con area) | PASS |
| Perfiles de Puesto — editar | PASS |
| Perfiles de Puesto — eliminar | PASS |
| Competencias Catalogo — listar | PASS |
| Competencias Catalogo — crear | PASS |
| Competencias Catalogo — editar | PASS |
| Competencias Catalogo — eliminar | PASS |
| Competencias Matriz — cargar filter-options, seleccionar area | PASS |
| Competencias Matriz — mostrar estado vacio | PASS |
| Competencias Brechas — cargar sin errores | PASS |
| Competencias Brechas — mostrar estado vacio | PASS |

---

## 1. Archivos Implementados

### Backend

| Archivo | Descripcion | Estado |
|---|---|---|
| `app/models/talento.py` | Modelos ORM: PuestoPerfil, Competencia, CompetenciaRequisito | DONE |
| `alembic/versions/t3u4v5w6x7y8_fase1_puestos_competencias.py` | Merge migration creando 3 tablas | DONE |
| `app/schemas/talento.py` | Schemas Pydantic: CRUD + Matriz + Resumen + Brechas + FilterOptions + IA | DONE |
| `app/services/puesto_perfil_service.py` | CRUD completo con auto-generacion de codigo (PRF-YYYY-NNN) | DONE |
| `app/services/competencia_service.py` | CRUD + matriz + bulk update + resumen-area + brechas + filter-options | DONE |
| `app/api/v1/puestos_perfil/router.py` | Endpoints CRUD + /generar-ia | DONE |
| `app/api/v1/competencias/router.py` | 10 endpoints incluyendo /filter-options | DONE |

### Frontend

| Archivo | Descripcion | Estado |
|---|---|---|
| `frontend/src/pages/puestos.ts` | Pagina CRUD completa: tabla, filtros, modal crear/editar, eliminar | DONE |
| `frontend/src/pages/competencias.ts` | Pagina con 3 tabs: Catalogo, Matriz, Brechas | DONE |
| `frontend/src/api/puestos.ts` | Modulo API con mapping de respuesta backend→frontend | DONE |
| `frontend/src/api/competencias.ts` | Modulo API con mapping de respuesta backend→frontend | DONE |
| Navegacion sidebar | Links bajo seccion "Talento" | DONE |

---

## 2. Endpoints Implementados

### Puestos Perfil (`/api/v1/puestos-perfil/`)

| Metodo | Path | Descripcion | Estado |
|---|---|---|---|
| GET | `/` | Listar perfiles (paginado, filtro area_id opcional, busqueda) | DONE |
| POST | `/` | Crear perfil (solo RH) | DONE |
| GET | `/{id}` | Obtener detalle de perfil | DONE |
| PUT | `/{id}` | Actualizar perfil (solo RH) | DONE |
| DELETE | `/{id}` | Eliminar perfil (solo RH) | DONE |
| POST | `/{id}/generar-ia` | Generar competencias con IA (solo RH) | DONE (endpoint existe, Ollama no conectado) |

### Competencias (`/api/v1/competencias/`)

| Metodo | Path | Descripcion | Estado |
|---|---|---|---|
| GET | `/` | Listar competencias | DONE |
| POST | `/` | Crear competencia (solo RH) | DONE |
| GET | `/{id}` | Obtener competencia | DONE |
| PUT | `/{id}` | Actualizar competencia (solo RH) | DONE |
| DELETE | `/{id}` | Eliminar competencia (solo RH) | DONE |
| GET | `/filter-options` | Obtener opciones de filtro (areas disponibles) | DONE |
| GET | `/matriz` | Obtener matriz competencias x puestos por area (area_id opcional) | DONE |
| PUT | `/matriz` | Bulk update de niveles en la matriz (solo RH) | DONE |
| GET | `/resumen-area` | Resumen de compliance por area (area_id opcional) | DONE |
| GET | `/brechas` | Brechas/gaps por area (area_id opcional) | DONE |

**Nota importante**: `area_id` fue cambiado a parametro opcional en todos los endpoints que lo usan. Cuando no se proporciona, los endpoints retornan datos vacios en lugar de 422. Esto fue necesario para que el frontend pueda cargar las paginas sin error antes de que el usuario seleccione un area.

---

## 3. Funcionalidades del Frontend Validadas

### Perfiles de Puesto (`/puestos-perfil`)

- [x] Tabla con listado paginado
- [x] Filtro por area (SELECT poblado desde `/filter-options`)
- [x] Filtro por nivel
- [x] Busqueda por texto
- [x] Modal de creacion con campo area como SELECT (no texto libre)
- [x] Campo `codigo` auto-generado (readonly en el form)
- [x] Modal de edicion pre-poblado
- [x] Dialogo de confirmacion en eliminar
- [x] Manejo de estado vacio

### Competencias (`/competencias`)

- [x] Tab "Catalogo": tabla CRUD (crear, editar, eliminar)
- [x] Tab "Matriz": filtro por area + grid de niveles por puesto
- [x] Tab "Brechas": filtro por area + tabla de gaps
- [x] Estados vacios en Matriz y Brechas cuando no hay datos

---

## 4. Correcciones Aplicadas Durante Validacion

Estas correcciones fueron necesarias para que los flujos E2E pasaran:

| # | Problema | Correccion |
|---|---|---|
| 1 | URL frontend era `/puestos/perfiles` | Corregido a `/puestos-perfil` (match con backend) |
| 2 | Frontend esperaba campos `nombre_puesto`/`grupo`/`activa` | Agregada capa de mapping en API modules (backend usa `nombre`/`categoria`/`activo`) |
| 3 | Endpoint `/competencias/matriz?area_id=X` retornaba 422 sin area_id | `area_id` hecho opcional; retorna datos vacios si no se proporciona |
| 4 | Endpoint `/filter-options` no existia | Agregado a `app/api/v1/competencias/router.py` |
| 5 | Campo "Area" en modal de puestos era input de texto | Cambiado a SELECT poblado desde `/filter-options` |
| 6 | Cache de Vite no reflejaba cambios en modulos | Se requirio limpieza manual de cache (`node_modules/.vite/`) |

---

## 5. Pruebas E2E Realizadas (Playwright)

### 5.1 Flujo de Login

```
- Navegar a /login
- Ingresar credenciales validas
- Verificar redirect a dashboard
```
**Resultado**: PASS

### 5.2 Perfiles de Puesto — CRUD Completo

```
- Navegar a /puestos-perfil
- Verificar tabla vacia o con datos existentes
- Abrir modal "Nuevo Perfil"
- Llenar titulo, objetivo, seleccionar area del dropdown
- Guardar → verificar que aparece en tabla con codigo PRF-YYYY-NNN
- Click en perfil → editar titulo → guardar → verificar cambio
- Click eliminar → confirmar → verificar que desaparece
```
**Resultado**: PASS (todos los pasos)

### 5.3 Competencias Catalogo — CRUD

```
- Navegar a /competencias (tab Catalogo)
- Crear competencia con nombre y categoria
- Verificar que aparece en la lista
- Editar nombre/descripcion → verificar cambio
- Eliminar → confirmar → verificar que desaparece
```
**Resultado**: PASS

### 5.4 Competencias Matriz

```
- Navegar a /competencias (tab Matriz)
- Verificar que carga /filter-options sin error
- Seleccionar un area del dropdown
- Verificar que muestra grid vacio (sin requisitos asignados aun)
```
**Resultado**: PASS (muestra estado vacio correctamente)

### 5.5 Competencias Brechas

```
- Navegar a /competencias (tab Brechas)
- Verificar que carga sin errores HTTP
- Verificar que muestra estado vacio (sin evaluaciones individuales)
```
**Resultado**: PASS (muestra estado vacio correctamente)

---

## 6. Tests Unitarios Propuestos (No ejecutados aun)

Los siguientes tests fueron disenados en la Version 1.0 de este plan pero NO se han ejecutado como suite automatizada. Se mantienen como referencia para implementacion futura de la suite de tests.

### Estructura propuesta

```
tests/
├── conftest.py                     # (agregar factories nuevas)
├── test_puestos_perfil.py          # CRUD + autorizacion + reglas de negocio
├── test_competencias.py            # CRUD competencias
├── test_competencias_matriz.py     # Matriz, brechas, resumen
└── test_fase1_integracion.py       # Flujos end-to-end cruzados

frontend/src/__tests__/
├── api/
│   ├── puestos.test.ts             # API module unit tests
│   └── competencias.test.ts        # API module unit tests
```

### Resumen de cobertura propuesta

| Categoria | Backend Tests | Frontend Tests |
|---|---|---|
| Happy Path CRUD | 11 | 4 |
| Autorizacion | 10 | 1 |
| Validacion | 6 | 1 |
| Paginacion/Filtrado | 6 | 3 |
| Reglas de Negocio | 4 | 0 |
| Matriz Bulk | 5 | 2 |
| Compliance/Brechas | 9 | 2 |
| IA Generacion | 3 | 2 |
| Edge Cases | 5 | 1 |
| Integracion E2E | 5 | 0 |
| **TOTAL** | **65** | **16** |

---

## 7. Criterios de Aceptacion — Estado Actual

### Backend

- [x] Modelos creados (PuestoPerfil, Competencia, CompetenciaRequisito)
- [x] Migracion funcional (3 tablas creadas)
- [x] Schemas Pydantic completos (CRUD + vistas especializadas)
- [x] Service layer con logica de negocio (codigo secuencial, version, etc.)
- [x] Routers registrados y funcionales (validado via E2E)
- [x] area_id opcional en endpoints (evita 422 en carga inicial)
- [x] /filter-options endpoint funcional
- [x] Codigo PRF-{year}-{seq} generado correctamente
- [ ] Suite de tests unitarios (pytest) — NO ejecutada, pendiente
- [ ] Coverage >= 90% — pendiente
- [ ] OpenAPI spec (`openapi.yaml`) actualizada — pendiente

### Frontend

- [x] Pagina de Puestos Perfil con CRUD completo
- [x] Pagina de Competencias con 3 tabs funcionales
- [x] API modules con mapping de respuesta
- [x] Navegacion en sidebar
- [x] Select de area poblado desde backend
- [x] Campo codigo readonly auto-generado
- [ ] Suite de tests unitarios (vitest) — NO ejecutada, pendiente
- [ ] Types en archivo separado `types.ts` — inline actualmente

### Validacion E2E

- [x] Login flow funcional
- [x] CRUD Perfiles de Puesto — todas las operaciones validadas
- [x] CRUD Competencias Catalogo — todas las operaciones validadas
- [x] Matriz de Competencias — carga y muestra estado vacio
- [x] Brechas — carga y muestra estado vacio
- [x] Sin errores 4xx/5xx inesperados en consola
- [x] Flujo completo sin pantallas blancas ni crashes

### Reglas de Negocio Verificadas

- [x] Codigo PRF-{year}-{seq} generado correctamente (validado en E2E)
- [x] area_id funcional como filtro (select en frontend, parametro en backend)
- [x] CRUD completo funcional para perfiles y competencias
- [x] Tabs de Matriz y Brechas renderizan correctamente
- [ ] Solo rol RH puede crear/editar/eliminar (validado por endpoint, no por UI hide/show de botones)
- [ ] Version incrementa en cada update — implementado, no validado en E2E
- [ ] Cascade delete (perfil → requisitos) — implementado, no validado en E2E
- [ ] Compliance calculo correcto — sin datos para validar
- [ ] IA degrada gracefully si Ollama no esta — endpoint existe, Ollama no conectado

---

## 8. Trabajo Pendiente para Fase 2

### Funcionalidad nueva requerida

| # | Feature | Descripcion |
|---|---|---|
| 1 | Evaluaciones individuales | Modelo EvaluacionCompetencia + CRUD para registrar nivel actual de cada empleado |
| 2 | Link empleado ↔ puesto_perfil | Campo `puesto_perfil_id` en modelo Empleado para asociar perfil de puesto |
| 3 | Implementacion real de IA | Conectar endpoint /generar-ia con Ollama local para generacion de competencias |
| 4 | Compliance con datos reales | Validar calculo de compliance cuando haya evaluaciones registradas |
| 5 | Brechas con datos reales | Validar que la tabla de brechas muestre gaps cuando haya evaluaciones vs requisitos |
| 6 | Bulk edit en Matriz | Validar flujo de edicion de niveles directamente en el grid |
| 7 | Permisos UI granulares | Ocultar botones crear/editar/eliminar para roles no-RH en frontend |

### Deuda tecnica

| # | Item | Descripcion |
|---|---|---|
| 1 | Suite pytest | Implementar los 65 tests unitarios backend propuestos en este plan |
| 2 | Suite vitest | Implementar los 16 tests unitarios frontend propuestos |
| 3 | OpenAPI spec | Actualizar `openapi.yaml` con los endpoints nuevos |
| 4 | Types separados | Extraer types de competencias/puestos a archivo `types.ts` dedicado |
| 5 | QA manual completo | Ejecutar los 38 pasos del checklist de QA manual original |

---

## 9. Referencia: Factories para Tests (a implementar)

```python
# tests/conftest.py — Factories para Modulo Talento

async def make_area(db: AsyncSession, *, descripcion: str = "Area Prueba", estatus_id: int = 1):
    """Factory para crear un Area de catalogo."""
    from app.models.catalogos import Area
    import uuid
    uid = str(uuid.uuid4())[:6]
    area = Area(
        area_id=abs(hash(uid)) % 100000,
        descripcion=descripcion or f"Area-{uid}",
        estatus_id=estatus_id,
    )
    db.add(area)
    await db.flush()
    await db.refresh(area)
    return area


async def make_puesto_perfil(
    db: AsyncSession,
    *,
    titulo: str = "Ingeniero de Procesos",
    area_id: int | None = None,
    objetivo: str = "Optimizar procesos de manufactura",
    requisitos_educacion: str = "Ingenieria Industrial o afin",
    requisitos_experiencia: str = "3 anios en manufactura",
    funciones_principales: list[str] | None = None,
    activo: bool = True,
):
    """Factory para crear un PuestoPerfil directamente en DB."""
    from app.models.talento import PuestoPerfil
    
    perfil = PuestoPerfil(
        titulo=titulo,
        area_id=area_id,
        objetivo=objetivo,
        requisitos_educacion=requisitos_educacion,
        requisitos_experiencia=requisitos_experiencia,
        funciones_principales=funciones_principales or ["Funcion A", "Funcion B"],
        activo=activo,
    )
    db.add(perfil)
    await db.flush()
    await db.refresh(perfil)
    return perfil


async def make_competencia(
    db: AsyncSession,
    *,
    nombre: str = "Liderazgo",
    categoria: str = "blanda",
    descripcion: str = "Capacidad de guiar equipos",
):
    """Factory para crear una Competencia."""
    from app.models.talento import Competencia
    
    competencia = Competencia(
        nombre=nombre,
        categoria=categoria,
        descripcion=descripcion,
    )
    db.add(competencia)
    await db.flush()
    await db.refresh(competencia)
    return competencia


async def make_competencia_requisito(
    db: AsyncSession,
    *,
    competencia_id: int,
    puesto_perfil_id: int,
    nivel_requerido: int = 3,
):
    """Factory para crear un CompetenciaRequisito."""
    from app.models.talento import CompetenciaRequisito
    
    requisito = CompetenciaRequisito(
        competencia_id=competencia_id,
        puesto_perfil_id=puesto_perfil_id,
        nivel_requerido=nivel_requerido,
    )
    db.add(requisito)
    await db.flush()
    await db.refresh(requisito)
    return requisito
```

---

## 10. Notas de Implementacion

### Response Mapping (Frontend)

El backend usa nombres de campos diferentes a lo que el frontend espera internamente. Los API modules (`frontend/src/api/puestos.ts` y `frontend/src/api/competencias.ts`) contienen una capa de mapping:

| Backend | Frontend |
|---|---|
| `nombre` (competencia) | `nombre` (sin cambio, pero mapeado explicitamente) |
| `categoria` | `grupo` (en algunos contextos) |
| `activo` | `activa` (en algunos contextos) |
| `titulo` (puesto) | `nombre_puesto` (en tabla display) |

### URL Routing

| Recurso | URL Frontend | URL Backend |
|---|---|---|
| Perfiles de Puesto | `/puestos-perfil` | `/api/v1/puestos-perfil/` |
| Competencias | `/competencias` | `/api/v1/competencias/` |

### Parametros Opcionales

Los siguientes parametros fueron hechos opcionales para evitar 422 en carga inicial:
- `area_id` en GET `/competencias/matriz`
- `area_id` en GET `/competencias/brechas`
- `area_id` en GET `/competencias/resumen-area`

Cuando no se proporciona area_id, los endpoints retornan estructuras vacias validas (listas vacias, compliance null, etc.).
