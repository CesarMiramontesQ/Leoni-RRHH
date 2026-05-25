# Spec: Modelo de datos — Perfil de Funciones

> Fecha: 2026-05-24
> Fuente: 11 PDFs en `/perfil de funciones/` (Form-Nr 1178 KM, Leoni corporativo)
> Estado: Propuesta para validación

---

## Hallazgos del análisis de PDFs

### Estructura del formulario (idéntica en los 11 documentos)

| # | Sección | Descripción |
|---|---------|-------------|
| 1 | Encabezado | División, denominación de la función, centro Leoni |
| 2 | Titular del puesto | Datos del empleado asignado |
| 3 | Área funcional / Autoridad | Cadena de mando, sustituciones, obligaciones legales |
| 4 | Descripción de tareas | Funciones principales + complementos |
| 5 | Cualificaciones requeridas | Estudios, formación, experiencia (deseada vs actual) |
| 6 | Competencias demostradas | Informática, idiomas, profesional, social, personal, métodos (deseada vs actual) |
| 7 | Firmas | Superior + empleado con fecha y firma digital |

### Insight clave: Dos capas de datos

El formulario separa **"Situación deseada"** (requisitos del puesto) de **"Situación actual"** (estado del empleado). Esto implica:

- **Perfil de puesto (template)** → define qué se necesita
- **Asignación individual** → registra qué tiene el empleado + gap analysis

Dos personas con el mismo puesto comparten "deseada" pero difieren en "actual".

---

## Modelo de datos propuesto

### Entidades existentes que se extienden

#### `puestos_perfil` (ya existe — se extiende)

Nuevos campos:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `division` | enum('holding','wsd','wcs') | División corporativa |
| `centro_leoni` | varchar(200) | Centro/planta |
| `form_version` | varchar(20) | Versión del formulario (ej. "V 2.6") |
| `reporta_a` | varchar(200) | Puesto jerárquico superior |
| `ordenes_funcional_de` | varchar(200) | Mando funcional (si difiere del jerárquico) |
| `responsable_de` | text | Descripción de responsabilidades de supervisión |
| `sustituye_a` | varchar(200) | Puesto que sustituye (nullable) |
| `sustituido_por` | varchar(200) | Quién lo sustituye (nullable) |
| `obligaciones_empresariales` | boolean | ¿Tiene obligaciones empresariales? |
| `obligacion_confidencialidad` | boolean | ¿Obligación especial de confidencialidad? |
| `poderes_legales` | text | Poderes legales / correspondencia (nullable) |
| `complemento_poderes` | text | Complemento sobre competencias y poderes (nullable) |

---

### Nuevas entidades

#### `perfil_funciones` (1:1 con asignación empleado ↔ puesto)

Registra la **evaluación individual** de un empleado contra un perfil de puesto.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | serial PK | |
| `puesto_perfil_id` | FK → puestos_perfil | Template del puesto |
| `empleado_id` | FK → empleados | Titular del puesto (su `no_empleado` = número de personal del PDF) |
| `departamento` | varchar(200) | Departamento asignado (snapshot histórico) |
| `fecha_firma_superior` | date | Fecha firma del jefe |
| `fecha_firma_empleado` | date | Fecha firma del empleado |
| `firma_superior_id` | varchar(50) | ID digital del firmante (ej. "groc1001") |
| `firma_empleado_id` | varchar(50) | ID digital del empleado |
| `activo` | boolean | ¿Es la asignación vigente? |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

---

#### `perfil_tareas` (1:N desde `puestos_perfil`)

Funciones principales del puesto (la "Situación deseada" de tareas).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | serial PK | |
| `puesto_perfil_id` | FK → puestos_perfil | |
| `orden` | smallint | Orden de la tarea |
| `descripcion` | text | Texto de la tarea/función |
| `es_complemento` | boolean | true = complemento individual, false = tarea principal |

---

#### `perfil_cualificaciones` (1:N desde `puestos_perfil`)

Requisitos académicos/experiencia del puesto.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | serial PK | |
| `puesto_perfil_id` | FK → puestos_perfil | |
| `tipo` | enum | Ver tipos abajo |
| `situacion_deseada` | text | Lo que requiere el puesto |
| `comentarios` | text | Notas adicionales (nullable) |

**Tipos de cualificación:**
- `estudios_finalizados`
- `formacion_profesional`
- `ampliacion_formacion`
- `estudios_universitarios`
- `experiencia_profesional`
- `experiencia_direccion`
- `complementos`

---

#### `perfil_competencias_requeridas` (1:N desde `puestos_perfil`)

Competencias que el puesto **requiere** (situación deseada).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | serial PK | |
| `puesto_perfil_id` | FK → puestos_perfil | |
| `categoria` | enum | Ver categorías abajo |
| `descripcion` | text | Texto de la competencia requerida |
| `orden` | smallint | Orden dentro de la categoría |

**Categorías:**
- `informatica` — Conocimientos de informática (SAP, MS Office, etc.)
- `idiomas` — Lenguas requeridas
- `profesional` — Competencia profesional (conocimientos técnicos)
- `social` — Competencia social (trabajo en equipo, comunicación)
- `personal` — Competencias personales (actitudes, valores)
- `metodos` — Competencias en métodos (análisis, planificación)
- `complementos` — Complementos individuales

---

#### `perfil_funciones_cualificacion` (evaluación individual — situación actual)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | serial PK | |
| `perfil_funciones_id` | FK → perfil_funciones | La asignación individual |
| `cualificacion_id` | FK → perfil_cualificaciones | El requisito del puesto |
| `situacion_actual` | text | Lo que el empleado tiene |
| `comentarios` | text | Observaciones (nullable) |

---

#### `perfil_funciones_competencia` (evaluación individual — situación actual)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | serial PK | |
| `perfil_funciones_id` | FK → perfil_funciones | La asignación individual |
| `competencia_requerida_id` | FK → perfil_competencias_requeridas | La competencia del puesto |
| `situacion_actual` | text | Lo que el empleado demuestra |
| `comentarios` | text | Observaciones (nullable) |

---

## Diagrama de relaciones

```
puestos_perfil (template)
├── perfil_tareas[]                         (funciones del puesto)
├── perfil_cualificaciones[]                (requisitos académicos/experiencia)
├── perfil_competencias_requeridas[]        (competencias deseadas por categoría)
└── perfil_funciones[] (asignación individual por empleado)
    ├── perfil_funciones_cualificacion[]    (situación actual vs cualificaciones)
    └── perfil_funciones_competencia[]      (situación actual vs competencias)
```

---

## Relación con modelos existentes

| Existente | Relación con nuevo modelo |
|-----------|---------------------------|
| `puestos_perfil` | Se extiende con campos de autoridad/jerarquía |
| `competencias` + `competencia_requisitos` | Coexiste — `competencia_requisitos` maneja niveles 0-4, `perfil_competencias_requeridas` maneja texto libre del formulario |
| `habilidades` | Independiente — las habilidades son evaluaciones 1-5 del Level Up, no del formulario PDF |
| `evaluaciones_competencia` | Complementa — el formulario PDF es evaluación textual, `evaluaciones_competencia` es numérica |
| `empleados` | FK en `perfil_funciones.empleado_id` |

---

## Campos del formulario que NO se modelan como tabla

Estos campos se derivan de relaciones existentes y no necesitan duplicarse:

- **Apellidos/Nombre del titular** → viene de `empleados`
- **Departamento** → viene de `empleados.area_id` (aunque se guarda como snapshot en `perfil_funciones.departamento` por histórico)
- **División** → se agrega a `puestos_perfil.division`

---

## Datos requeridos para llenar un perfil completo

### Para crear el TEMPLATE del puesto (una vez):
1. Denominación de la función (nombre del puesto)
2. División, Centro Leoni
3. Cadena de mando (reporta a, ordenes funcional de, responsable de, sustituciones)
4. Obligaciones empresariales y confidencialidad (booleanos)
5. Lista de tareas principales (ordenadas)
6. Cualificaciones deseadas (por tipo)
7. Competencias deseadas (por categoría)

### Para crear la ASIGNACIÓN individual (por empleado):
1. Seleccionar puesto perfil + empleado
2. Número de personal
3. Situación actual por cada cualificación
4. Situación actual por cada competencia
5. Firmas (superior + empleado con fecha e ID digital)

---

## Migración sugerida

1. Agregar columnas a `puestos_perfil` (division, centro, reporta_a, etc.)
2. Crear tabla `perfil_tareas`
3. Crear tabla `perfil_cualificaciones`
4. Crear tabla `perfil_competencias_requeridas`
5. Crear tabla `perfil_funciones` (asignación individual)
6. Crear tabla `perfil_funciones_cualificacion`
7. Crear tabla `perfil_funciones_competencia`

---

## Decisiones tomadas

1. **Migrar JSONB a tablas normalizadas** — Los campos `competencias_tecnicas`, `habilidades_blandas`, `maquinas_herramientas` se eliminan de `puestos_perfil` y sus datos se mueven a `perfil_competencias_requeridas`. Estrategia en dos pasos: primero crear tablas nuevas y poblarlas, después eliminar los JSONB cuando la UI ya lea de las tablas.
2. **`numero_personal` no se duplica** — Ya existe como `empleados.no_empleado` (String(50), unique). La relación FK en `perfil_funciones.empleado_id` es suficiente.
3. **Firmas sin integración externa** — Se almacenan como texto simple (quién + cuándo), sin validación contra Active Directory ni Okta.
4. **Sin versionado de template** — El perfil de puesto se sobreescribe directamente. No se guarda historial de versiones.
5. **"Ver empleados" usa asignaciones (`perfil_funciones`)** — No se usa el área de TRESS como fallback. La relación empleado ↔ puesto es exclusivamente vía `perfil_funciones` porque: (a) los PDFs son asignaciones individuales por empleado, (b) el conteo "N personas" de la tarjeta es de asignados al perfil, (c) el gap analysis requiere la asignación explícita.
