# Matriz de Multihabilidades — Funcionalidad Real

## Resumen

Reemplazar la página hardcodeada de Matriz de Multihabilidades (`#/capacidades`) con funcionalidad real conectada al backend. La página permite filtrar por puesto (PuestoPerfil) y opcionalmente por nombre de empleado. Al seleccionar un puesto, la tabla se llena con:
- **Columnas**: todas las Competencias Demostradas requeridas para ese puesto (tabla `competencia_requisitos`).
- **Filas**: todos los empleados asignados a ese puesto (tabla `perfil_funciones`).
- **Celdas**: nivel de evaluación del empleado en cada competencia (tabla `evaluaciones_competencia`), comparado contra el nivel requerido del puesto.

## Motivación

- La página actual (`mountCapacidades` en `levelUp.ts`) usa datos hardcodeados (`CAP_EMPLOYEES`, `CAP_CAPABILITIES`, `CAP_MATRIX`) que no reflejan el estado real.
- Ya existen modelos, servicios y endpoints en el backend para competencias, requisitos por puesto, evaluaciones por empleado, y asignaciones (perfil_funciones). Solo falta un endpoint especializado que devuelva la estructura tipo "heatmap" y conectar el frontend.
- Esta vista es esencial para que RH identifique brechas reales de capacitación por puesto.

## Alcance

### 1. Nuevo endpoint backend: Matriz de Multihabilidades por Puesto

**`GET /api/v1/competencias/multihabilidades`**

Query params:
- `puesto_perfil_id` (int, requerido) — el puesto a evaluar.
- `nombre_empleado` (str, opcional) — filtro parcial por nombre del empleado.

Response:
```
{
  "puesto_perfil_id": 5,
  "puesto_nombre": "Operador de Crimpado",
  "competencias": [
    { "id": 12, "nombre": "MS Office", "subcategoria": "informatica", "nivel_requerido": 2 },
    { "id": 15, "nombre": "Kanban", "subcategoria": "profesional", "nivel_requerido": 3 },
    ...
  ],
  "empleados": [
    {
      "empleado_id": 42,
      "nombre_completo": "María Ortega Reyes",
      "no_empleado": "E-1042",
      "evaluaciones": [
        { "competencia_id": 12, "nivel_actual": 2 },
        { "competencia_id": 15, "nivel_actual": 1 },
        ...
      ]
    },
    ...
  ]
}
```

Lógica:
1. Obtener competencias requeridas del puesto (`competencia_requisitos` WHERE `puesto_perfil_id` = X AND `nivel_requerido > 0`).
2. Obtener empleados asignados al puesto via `perfil_funciones` WHERE `puesto_perfil_id` = X AND `activo = true`.
3. Si `nombre_empleado` se proporciona, filtrar la lista de empleados por ILIKE.
4. Para cada empleado, obtener sus evaluaciones de las competencias relevantes (`evaluaciones_competencia` WHERE `empleado_id` IN [...] AND `competencia_id` IN [...]`).
5. Retornar la estructura.

### 2. Endpoint de opciones de filtro: Puestos disponibles

**`GET /api/v1/competencias/multihabilidades/puestos`**

Retorna la lista de puestos que tienen al menos 1 competencia requisito configurada (para no mostrar puestos vacíos en el dropdown).

Response:
```
{
  "puestos": [
    { "id": 5, "codigo": "PP-005", "nombre": "Operador de Crimpado", "area_nombre": "Cableado" },
    ...
  ]
}
```

### 3. Frontend: Reemplazar datos hardcodeados

En `frontend/src/pages/levelUp.ts`, reemplazar `mountCapacidades`:

- Eliminar las constantes hardcodeadas: `CAP_EMPLOYEES`, `CAP_CAPABILITIES`, `CAP_REQ`, `CAP_MATRIX`.
- Agregar un **dropdown/select de Puesto** que carga opciones del endpoint de puestos.
- Agregar un **campo de búsqueda por nombre** de empleado (debounce 300ms).
- Al seleccionar un puesto, hacer fetch al endpoint de multihabilidades y renderizar la tabla heatmap con datos reales.
- Mantener el diseño visual existente (KPIs, leyenda, heatmap coloreado, score %) pero con datos dinámicos.
- Estado vacío: mostrar mensaje "Selecciona un puesto para ver la matriz" cuando no hay puesto seleccionado.

### 4. Frontend API module

Agregar en `frontend/src/api/` (o extender el módulo existente de competencias):
- `getMultihabilidadesPuestos()` → fetch endpoint de puestos.
- `getMultihabilidadesMatriz(puestoPerfilId, nombreEmpleado?)` → fetch endpoint de matriz.

### Fuera de alcance

- Edición inline de evaluaciones desde esta vista (eso ya se hace en la vista individual del empleado).
- Exportación a Excel/PDF de la matriz.
- Filtros adicionales (por área, por categoría de competencia) — se pueden agregar después.
- Habilidades del modelo `level_up` (la matriz usa `Competencia` + `CompetenciaRequisito` + `EvaluacionCompetencia` de `talento.py`, no `Capacidad`/`EvaluacionCapacidad` de `level_up.py`).

## Dependencias

- Modelo `CompetenciaRequisito` en `app/models/talento.py` — vincula competencia con puesto, tiene `nivel_requerido`.
- Modelo `EvaluacionCompetencia` en `app/models/talento.py` — tiene `nivel_actual` por empleado+competencia.
- Modelo `PerfilFunciones` en `app/models/talento.py` — vincula empleado con puesto (asignación activa).
- Modelo `PuestoPerfil` en `app/models/talento.py` — el puesto con perfil definido.
- Endpoint existente `GET /api/v1/competencias/matriz` — orientado a área (filas=competencias, cols=puestos). El nuevo endpoint es orientado a puesto (filas=empleados, cols=competencias).
- Frontend `levelUp.ts` función `mountCapacidades` y helpers (`renderCapHeatmap`, `renderCapKpis`, etc.).

## Criterios de aceptación

- [ ] Endpoint `GET /api/v1/competencias/multihabilidades` retorna la estructura correcta dado un `puesto_perfil_id`.
- [ ] Endpoint `GET /api/v1/competencias/multihabilidades/puestos` retorna puestos que tienen competencias requisito configuradas.
- [ ] Frontend: dropdown de Puesto carga opciones reales del backend.
- [ ] Frontend: al seleccionar puesto, la tabla se llena con empleados reales y sus niveles de evaluación.
- [ ] Frontend: campo de búsqueda por nombre filtra empleados mostrados.
- [ ] Frontend: celdas se colorean comparando `nivel_actual` vs `nivel_requerido` (misma lógica de colores actual).
- [ ] Frontend: KPIs se computan dinámicamente (total competencias, empleados evaluados, promedio, brechas).
- [ ] Frontend: estado vacío muestra mensaje claro cuando no hay puesto seleccionado.
- [ ] Frontend: carga con spinner/skeleton mientras se hace fetch.
- [ ] No se rompe la navegación ni otros módulos de Level Up (cursos, OPLs).
