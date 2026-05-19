# Level Up — Endpoints API (Fase B1)

## Resumen

Crear todos los endpoints CRUD y de consulta para las 14 entidades de Level Up modeladas en Fase B0. Esto conecta el frontend (Track A demo) con datos reales vía la API REST versionada.

## Motivación

Los modelos, migraciones y schemas Pydantic ya existen (Fase B0). El frontend tiene 12 pantallas demo con datos hardcodeados. Los endpoints API son el puente necesario para que cada pantalla consuma datos reales de PostgreSQL.

## Alcance

### Dominio: Capacidades y Habilidades

| Entidad | Endpoints | Notas |
|---------|-----------|-------|
| Capacidad | GET list, GET by id, POST, PATCH, DELETE (soft) | Filtro por categoría, paginación |
| CapacidadPuestoPerfil | GET by puesto, POST, DELETE | Vincular capacidades a puestos con nivel requerido |
| Habilidad | GET list, GET by id, POST, PATCH, DELETE (soft) | Filtro por tipo |
| EvaluacionCapacidad | GET by empleado, GET by capacidad, POST | Incluir brecha (nivel_requerido - nivel_actual) |
| EvaluacionHabilidad | GET by empleado, GET by habilidad, POST | Última evaluación vigente |

### Dominio: Catálogo de Cursos y OPLs

| Entidad | Endpoints | Notas |
|---------|-----------|-------|
| Curso | GET list, GET by id, POST, PATCH, DELETE (soft) | Filtro por categoría, modalidad |
| OPL | GET list, GET by id, POST, PATCH | Incluir versiones en GET by id |
| OPLVersion | GET by opl, POST | Auto-incrementar version_num |

### Dominio: Evidencias y Firmas

| Entidad | Endpoints | Notas |
|---------|-----------|-------|
| EvidenciaCapacitacion | GET list (filtro estado), GET by id, POST, PATCH (validar/devolver) | Solo RH puede validar |
| EvidenciaFirma | GET by evidencia, POST, PATCH (firmar/rechazar) | Solo el firmante asignado puede firmar |

### Dominio: Encuestas Post-Curso

| Entidad | Endpoints | Notas |
|---------|-----------|-------|
| EncuestaPostCurso | GET by capacitación, GET by empleado, POST | Una por empleado+capacitación (unique) |

### Dominio: Sugerencias de Capacitación

| Entidad | Endpoints | Notas |
|---------|-----------|-------|
| SugerenciaCapacitacion | GET list, GET by id, POST, PATCH | Filtro por estado y prioridad |

### Dominio: Planes de Desarrollo

| Entidad | Endpoints | Notas |
|---------|-----------|-------|
| PlanDesarrollo | GET by empleado, GET by id, POST, PATCH | Incluir etapas en GET by id |
| PlanEtapa | GET by plan, POST, PATCH, DELETE | Reordenar con campo `orden` |

## Estructura de archivos

```
app/api/v1/level_up/
├── __init__.py
├── router_capacidades.py
├── router_habilidades.py
├── router_cursos.py
├── router_opls.py
├── router_evidencias.py
├── router_encuestas.py
├── router_sugerencias.py
├── router_planes.py
└── dependencies.py          # permisos compartidos

app/services/
├── level_up_capacidades.py
├── level_up_habilidades.py
├── level_up_cursos.py
├── level_up_opls.py
├── level_up_evidencias.py
├── level_up_encuestas.py
├── level_up_sugerencias.py
└── level_up_planes.py

app/repositories/
├── level_up_capacidades.py
├── level_up_habilidades.py
├── level_up_cursos.py
├── level_up_opls.py
├── level_up_evidencias.py
├── level_up_encuestas.py
├── level_up_sugerencias.py
└── level_up_planes.py
```

## Patrones transversales

- **Paginación**: Todos los GET list aceptan `skip` y `limit` (default 0, 50)
- **Soft delete**: `activo = False` para Capacidad, Habilidad, Curso; no borrado físico
- **Permisos**: RH puede crear/editar todo; supervisores solo evalúan su equipo; empleados solo lectura de su propio perfil
- **Respuestas**: Usar los schemas de `app/schemas/level_up.py` existentes para request/response
- **Router prefix**: `/api/v1/level-up/...`
- **Tags OpenAPI**: Agrupar por dominio (Capacidades, Habilidades, Cursos, OPLs, Evidencias, Encuestas, Sugerencias, Planes)

## Orden de implementación

```
1. Capacidades + CapacidadPuestoPerfil (base de todo Level Up)
2. Habilidades (similar patrón CRUD)
3. EvaluacionCapacidad + EvaluacionHabilidad (dependen de 1 y 2)
4. Cursos (catálogo independiente)
5. OPLs + OPLVersion (auto-incremento)
6. Evidencias + Firmas (workflow de validación)
7. Encuestas (depende de capacitación existente)
8. Sugerencias (independiente)
9. Planes + Etapas (depende de todo lo anterior para recurso_id)
```

## Dependencias

- Modelos en `app/models/level_up.py` (completos desde B0)
- Schemas en `app/schemas/level_up.py` (completos desde B0)
- Database engine + async session (existente en `app/core/database.py`)
- Auth/permisos (existente en `app/core/security.py`)
- Modelo `Empleado` y `Capacitacion` existentes

## Fuera de alcance

- Cambios en frontend (eso será Fase B2: conectar pantallas a API)
- Algoritmo de sugerencias automáticas (Fase B3)
- Disparos automáticos (nueva OPL version → reentrenamiento)
- Upload de archivos (evidencias, OPL archivos)
- Reportes y dashboards con datos reales
