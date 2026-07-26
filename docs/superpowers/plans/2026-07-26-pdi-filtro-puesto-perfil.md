# PDI filtro puesto_perfil — Implementation Plan

> **For agentic workers:** ejecutar task-by-task. Steps con checkbox.

**Goal:** Filtrar Gestión PDI por perfil de puesto Talento (`puesto_perfil_id`).

**Architecture:** Query param en endpoints PDI; join vía `PerfilFunciones` activo; select en filtros globales UI.

**Tech Stack:** FastAPI, SQLAlchemy async, frontend vanilla TS.

## Global Constraints

- Solo tablas `levelup_*` / lectura empleados; sin DDL Bono.
- Prefijo `puesto_perfil_id` (no `puesto_id` Bono).

---

### Task 1: Backend filtro + opciones

- [ ] `pdi_repository.list_consolidated` + agregados con `puesto_perfil_id`
- [ ] `pdi_service` propaga param; rellena `puesto_nombre`
- [ ] Router query params + endpoint opciones perfiles
- [ ] `openapi.yaml`

### Task 2: Frontend

- [ ] API client + `gestionPdi` select Puesto + propagación

### Task 3: Verificar

- [ ] Tests existentes / smoke; commit + PR
