# Puestos Tarjetas — Conectar a API Real

## Resumen

Reemplazar los datos fake (`FAKE_LEVEL_UP_METRICS`) de la vista de tarjetas en `frontend/src/pages/puestos.ts` con datos reales obtenidos desde la API. Incluye agregar un endpoint backend que devuelva métricas agregadas por perfil de puesto (personas vinculadas, cumplimiento %, brechas activas).

## Motivación

La vista de tarjetas de Perfiles de Puesto actualmente muestra 8 perfiles hardcodeados con métricas inventadas. El backend ya tiene la infraestructura completa (perfiles, asignaciones, evaluaciones, gap analysis), pero no existe un endpoint que devuelva las métricas consolidadas que las tarjetas necesitan. Los links de las tarjetas apuntan a `#/puestos/101` en vez de usar IDs reales.

## Alcance

### Backend — Endpoint de métricas por perfil

Extender o crear endpoint que devuelva, para cada perfil activo:

| Métrica | Fuente |
|---------|--------|
| `personas` | COUNT de `perfil_funciones` activos para ese `puesto_perfil_id` |
| `cumplimiento_pct` | Promedio de evaluaciones completadas vs requeridas (gap analysis) |
| `brechas` | COUNT de cualificaciones/competencias sin evaluar o con gap |
| `cursos` | COUNT de cursos asociados via `capacitaciones` del perfil |
| `evidencias` | COUNT de evidencias requeridas (mínimo por perfil) |

Opciones:
- A) Agregar campo `include=metrics` al `GET /api/v1/puestos-perfil` existente
- B) Nuevo endpoint `GET /api/v1/puestos-perfil/resumen-tarjetas`

### Frontend — Wire-up tarjetas

1. Eliminar constante `FAKE_LEVEL_UP_METRICS` y funciones helper que solo sirven al fake
2. Fetch datos reales al montar la vista de tarjetas
3. Mapear respuesta de API a las tarjetas existentes (mantener diseño actual)
4. Los links deben usar el `id` real del perfil: `#/puestos/${perfil.id}` y `#/puestos/${perfil.id}/empleados`
5. KPIs strip: calcular desde los datos reales obtenidos (totales)
6. Loading state mientras carga
7. Empty state si no hay perfiles

### Fuera de alcance

- Cambiar el diseño visual de las tarjetas
- Agregar filtros a la vista de tarjetas (solo se muestra todo)
- Implementar métricas de OPLs (se omiten de la tarjeta por ahora)
- Implementar cursos asociados reales (requiere Fase B3) — si no hay datos, mostrar 0

## Dependencias

- `GET /api/v1/puestos-perfil` — ya existe (listado básico)
- `GET /api/v1/perfiles/:id/asignaciones` — ya existe (personas por perfil)
- Tablas `perfil_funciones`, `perfil_funciones_cualificacion`, `perfil_funciones_competencia` — ya existen

## Criterios de aceptación

- [ ] Vista de tarjetas muestra perfiles reales de la base de datos
- [ ] Cada tarjeta muestra: código, nombre, área, personas vinculadas, cumplimiento %, brechas
- [ ] Links de "Ver puesto" y "Ver empleados" usan el ID real
- [ ] KPIs strip se calculan desde datos reales
- [ ] Si no hay perfiles, se muestra un empty state
- [ ] Si hay error de red, se muestra mensaje de error
- [ ] La vista tabla existente sigue funcionando sin cambios
