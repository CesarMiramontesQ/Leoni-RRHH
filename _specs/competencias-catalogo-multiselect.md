# Competencias Demostradas como Catálogo Multi-Select

## Resumen

Convertir la sección "Competencias demostradas" del Perfil de Funciones de texto libre a un sistema de multi-select basado en catálogos por categoría. Cada categoría (Informática, Lenguas, Profesional, Social, Personal, Métodos) tiene un conjunto finito de opciones identificadas en los 190 PDFs de perfiles de Leoni. Se captura "Situación deseada" a nivel puesto y "Situación actual" a nivel empleado asignado, ambas como selección múltiple del mismo catálogo.

## Motivación

- El análisis de 179 perfiles muestra que las competencias demostradas tienen **valores repetidos y predecibles** — no son texto libre real, sino selecciones de un catálogo implícito.
- Actualmente el sistema modela competencias con `CompetenciaRequisito` (nivel 0-4), pero los PDFs originales no usan niveles numéricos sino listas de habilidades seleccionadas.
- Tener catálogos permite: búsqueda, filtrado, reportes de cobertura, y comparación automática (¿el empleado tiene las competencias que pide el puesto?).
- Cada campo actual es un string concatenado de múltiples valores (e.g. "Kanban Conocimientos de materiales Conocimientos de productos") — esto debe descomponerse en opciones individuales seleccionables.

## Alcance

### 1. Catálogos de competencias por categoría

Cada categoría tiene un catálogo cerrado (administrable por RH). Los valores iniciales se derivan del análisis de los 190 PDFs:

#### Informática (`informatica`)
| Clave | Label |
|-------|-------|
| ms_office | MS Office |
| sap | SAP |
| oee | OEE |
| mes | MES |
| lisa | LISA |
| minitab | Minitab |
| ms_project | MS Project |
| software_estadistico | Software estadístico |
| software_visualizacion | Software para visualización del proceso |

#### Lenguas (`idiomas`)
| Clave | Label |
|-------|-------|
| idioma_local | Idioma local (Español) |
| ingles | Inglés |
| aleman | Alemán |

#### Competencia profesional (`profesional`)
| Clave | Label |
|-------|-------|
| procesos_produccion | Conocimientos de procesos de producción |
| kanban | Kanban |
| materiales | Conocimientos de materiales |
| productos | Conocimientos de productos |
| fifo | Flujo de materiales / FIFO |
| inventario | Inventario |
| auditor | Auditor |
| liderazgo | Liderazgo / dirección |
| manejo_personal | Manejo de personal |
| gestion_calidad | Gestión de calidad |
| requisitos_cliente | Requisitos específicos del cliente |
| conocimiento_departamento | Extensos conocimientos del departamento |
| maquinaria | Conocimientos de la maquinaria de la empresa |
| activos_fijos | Control de Activos Fijos |

#### Competencia social (`social`)
| Clave | Label |
|-------|-------|
| trabajo_equipo | Capacidad de cooperar y trabajar en equipo |
| comunicacion | Habilidades de comunicación |
| gestion_conflictos | Capacidad de gestionar conflictos |
| cortesia | Cortesía y amabilidad |
| tolerancia | Tolerancia |

#### Competencias personales (`personal`)
| Clave | Label |
|-------|-------|
| concentracion | Facultad de concentración |
| disposicion_aprender | Disposición a trabajar y a aprender |
| responsabilidad | Responsabilidad y autonomía |
| orientacion_calidad | Orientación al cliente y a la calidad |
| critica_autocritica | Capacidad de crítica y autocrítica |
| creatividad | Creatividad y flexibilidad |
| fiabilidad | Fiabilidad |

#### Competencias en métodos (`metodos`)
| Clave | Label |
|-------|-------|
| solucion_problemas | Capacidad de solucionar problemas |
| mejora_calidad | Concepto de mejora de calidad |
| formador | Competencia como formador |
| gestion_organizacion | Capacidad de gestionar y de organizar |
| liderazgo_metodos | Competencias en liderazgo |
| planificacion_tiempo | Gestión y planificación del tiempo |
| negociacion | Competencia en negociación |
| capacidad_analitica | Capacidad analítica |
| feedback | Capacidad de dar feedback |
| instrumento_calidad | Instrumento de calidad |

### 2. Modelo de datos

Se utiliza el modelo `Competencia` + `CompetenciaRequisito` existente, con ajustes:

- **Tabla `competencias`**: ya existe. Se poblarán registros con `categoria` = `"tecnica"` y `subcategoria` correspondiente (`"informatica"`, `"idiomas"`, `"profesional"`, `"social"`, `"personal"`, `"metodos"`).
- **Tabla `competencia_requisitos`**: ya existe. Vincula competencia con puesto. El `nivel_requerido` se usa como: `0` = no requerida, `1` = requerida (seleccionada). No se usan niveles graduales para esta sección.
- **Tabla `perfil_funciones_competencia`**: ya existe. Vincula competencia con empleado asignado. `situacion_actual` se simplifica: si la competencia está registrada, el empleado la tiene.

#### Alternativa más limpia (si se prefiere):

Agregar campo booleano `seleccionada` o simplemente usar la presencia/ausencia del registro en `competencia_requisitos` como indicador de que está seleccionada para ese puesto.

### 3. API: endpoints existentes + seed

| Acción | Endpoint existente | Cambio |
|--------|-------------------|--------|
| Listar competencias por categoría | `GET /api/v1/competencias?subcategoria=informatica` | Ya funciona, solo poblar datos |
| Asignar competencia a puesto | `POST /api/v1/puestos-perfil/{id}/competencias` | Ya existe |
| Quitar competencia de puesto | `DELETE /api/v1/puestos-perfil/{id}/competencias/{req_id}` | Ya existe |
| Evaluar competencia empleado | Ya existe vía `perfil_funciones_competencia` | Adaptar UI |

Se necesita un **seed** que cree los registros en `competencias` con las claves de los catálogos definidos arriba.

### 4. Frontend: multi-select por categoría

En la página de Detalle del Puesto, sección "Competencias demostradas":

- Mostrar **6 bloques** (uno por categoría), cada uno con:
  - Título de la categoría (e.g. "Conocimientos de Informática")
  - Chips/badges de las competencias seleccionadas para este puesto (situación deseada)
  - Botón "+ Agregar" que abre un dropdown/popover con las opciones del catálogo de esa categoría
  - Click en chip existente → quitar (con confirmación)

En la vista del empleado asignado (evaluación individual):

- Mostrar las mismas 6 categorías con:
  - Columna "Requerido" (lo que pide el puesto — read only)
  - Columna "Actual" (multi-select de las que tiene el empleado)
  - Badge de compliance: verde si tiene todas las requeridas, amarillo si tiene algunas, rojo si falta alguna

### 5. Compliance automático para competencias

Para cada categoría:
```
competencias_requeridas = set de competencias seleccionadas para el puesto
competencias_actuales = set de competencias registradas para el empleado
cumple = competencias_requeridas ⊆ competencias_actuales
parcial = len(competencias_requeridas ∩ competencias_actuales) > 0
```

Se computa en runtime, no se persiste.

### 6. Administración del catálogo

- RH puede agregar nuevas opciones a cada catálogo (crear nuevo registro en `competencias` con la subcategoría correspondiente).
- No se permite eliminar una competencia que ya está asignada a algún puesto o empleado (soft-delete o validación).
- Esto se hace desde una sección admin separada (puede ser la que ya existe para competencias).

### Fuera de alcance

- Migración automática del texto libre existente en `perfil_funciones_competencia.situacion_actual` a las nuevas selecciones (se puede hacer como script de one-time)
- Niveles graduales (0-4) para competencias demostradas — el PDF original no los usa, solo usa presencia/ausencia
- UI de administración avanzada del catálogo (reordenar, merge de duplicados)
- Importación masiva desde los PDFs extraídos
- Competencia "Complementos individuales" (texto largo) — se mantiene como texto libre en campo aparte

## Dependencias

- Modelo `Competencia` en `app/models/talento.py` — poblar con nuevos registros por categoría
- Modelo `CompetenciaRequisito` en `app/models/talento.py` — usar para vincular al puesto
- Modelo `PerfilFuncionesCompetencia` en `app/models/talento.py` — usar para vincular al empleado
- Seed script para poblar catálogos iniciales
- Frontend `perfilPuestoDetalle.ts` — nueva sección de competencias con multi-select
- Frontend `api/puestos.ts` — ya tiene endpoints de competencias

## Criterios de aceptación

- [ ] Catálogos de competencias poblados en BD (seed) con las 6 categorías y sus opciones
- [ ] En Detalle del Puesto: sección "Competencias demostradas" muestra 6 categorías con chips seleccionables
- [ ] RH puede agregar/quitar competencias requeridas por puesto (multi-select por categoría)
- [ ] En vista del empleado asignado: se muestran competencias requeridas vs actuales
- [ ] RH puede seleccionar qué competencias tiene el empleado (multi-select del mismo catálogo)
- [ ] Badge de compliance computado automáticamente (verde/amarillo/rojo)
- [ ] RH puede agregar nuevas opciones al catálogo de cualquier categoría
- [ ] No se puede eliminar una competencia en uso
- [ ] Backwards compatible con datos existentes en `competencia_requisitos`
- [ ] Las competencias se muestran agrupadas por categoría, no como lista plana
