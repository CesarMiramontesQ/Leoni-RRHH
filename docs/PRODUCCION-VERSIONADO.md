# Flujo de versionado — Producción Leoni RRHH

## Modelo de ramas (v1.2+)

```
fix/.../ajustes-post-v1.2  ──PR/merge──►  main
                                              │
                                              │ merge / pull (solo consumo)
                                              ▼
                              release/cm/produccion-v1.0  ──deploy──►  servidor
                                                                        tag v1.x
```

| Branch | Rol |
|--------|-----|
| `fix/<iniciales>/ajustes-post-v1.x` | Trabajo temporal: ajustes UAT/producción |
| `main` | Integración oficial del código (dev + fixes validados) |
| `release/cm/produccion-v1.0` | **Solo consume** desde `main`. No envía cambios a `main` |

### Reglas de migraciones

- Los ajustes post-v1.x **no deben modificar** revisiones Alembic ya aplicadas en producción.
- **No crear migraciones nuevas** salvo aprobación explícita.
- `release/cm/produccion-v1.0` mantiene su historial de migraciones idempotente; al traer `main`, revisar que no entren migraciones conflictivas.
- Antes de merge a release: `python3 scripts/check_alembic_heads.py` debe pasar (un solo head).

---

## Estado v1.1 (desplegado)

- **Tag:** `v1.1` → commit `5c0d897` (lxmx1apps01)
- **Head Alembic en prod:** `n3o4p5q6r7s8`
- **Deploy:** `docker-compose.prod.yml` + `./scripts/prod-migrate.sh`
- **Branch de trabajo activo:** `fix/cm/ajustes-post-v1.2`

### Incluido en v1.1 (respecto a v1.0)

| Área | Cambio |
|------|--------|
| Auth | «Recordarme» en login + refresh token al bootstrap |
| App shell | Validación acceso dashboard empleado personal |
| Empleados | Import desde `bono.empleados` (`import_empleados_bono`) |
| Empleados | `lider_id` por `empleado_id` (migración `p1q2r3s4t5u6`) |
| Empleados | Normalización `no_empleado`, booleanos S/N, email en `empleados.email` |
| Empleados | Mapeo `bono.password` → `password_hash` |
| Empleados | Endpoint fotografía del empleado |
| Usuarios | Campos `comedor_id` y `centrocosto_id` en asignación |
| Comedor | Menús semanales, planificador, asignación comedor/turnos |
| Comedor | Sincronizar rol en refresh y validación de permisos (PR #56) |
| Talento | Competencias, perfiles, puestos, matriz de requisitos |
| Migraciones | Merge Alembic `n3o4p5q6r7s8` (menu_semanal + prod email/nivel) |
| Frontend | Fix build TypeScript post-merge main |

---

## Estado v1.0 (histórico)

- **Tag:** `v1.0` → commit `4dc2116`
- **Head Alembic:** `e9f0a1b2c3d4`

---

## 1. Trabajar ajustes (post UAT v1.2)

```bash
git fetch origin
git checkout main
git pull origin main
git checkout fix/cm/ajustes-post-v1.2
git pull origin fix/cm/ajustes-post-v1.2
```

**Preferir cambios de aplicación** sin tocar `alembic/versions/` salvo aprobación.

---

## 2. Validar localmente

```bash
python3 scripts/check_alembic_heads.py
docker compose run --rm test pytest tests/test_auth.py -q
docker compose exec frontend npm run build
```

---

## 3. Integrar a `main`

```bash
git push origin fix/cm/ajustes-post-v1.2
gh pr create --base main --head fix/cm/ajustes-post-v1.2 \
  --title "fix(scope): ajustes post UAT v1.2" \
  --body "## Summary
- ...

## Migraciones
Sin cambios en Alembic (o describir si aplica).

## Test plan
- [ ] ..."
```

Tras merge del PR → `main` tiene los ajustes.

---

## 4. Actualizar producción desde `main`

**En tu PC** (merge a branch de prod, nunca al revés):

```bash
git checkout release/cm/produccion-v1.0
git pull origin release/cm/produccion-v1.0
git merge origin/main
python3 scripts/check_alembic_heads.py
# Resolver conflictos favoreciendo migraciones/Docker de prod si aparecen
git push origin release/cm/produccion-v1.0
```

**En el servidor:**

```bash
cd /levelup/Leoni-RRHH
git pull origin release/cm/produccion-v1.0
python3 scripts/check_alembic_heads.py
./scripts/prod-migrate.sh
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

**Import empleados bono (manual):**

```bash
docker exec leoni_rh_backend_prod python -m app.scripts.import_empleados_bono
docker exec leoni_rh_backend_prod python -m app.scripts.import_empleados_bono --execute
```

---

## 5. Tag v1.2 (cuando prod esté estable)

```bash
git checkout release/cm/produccion-v1.0
git pull origin release/cm/produccion-v1.0
git tag -a v1.2 -m "Producción v1.2 — ajustes post UAT v1.1"
git push origin v1.2
git checkout main && git pull origin main
git checkout -b fix/cm/ajustes-post-v1.3
git push -u origin fix/cm/ajustes-post-v1.3
```

---

## Lo que NO hacer

- Merge `release/cm/produccion-v1.0` → `main`
- Commits directos en `release/cm/produccion-v1.0` sin pasar por `main`
- Modificar migraciones ya aplicadas en producción
- Autogenerate Alembic contra BD de dev para prod
- Push directo a `main`
- Merge a release sin validar `check_alembic_heads.py`
