# Plan de Pruebas — Fase 1: Modulo de Talento (Puestos Perfil + Competencias)

**Fecha**: 2026-05-04  
**Version**: 1.0  
**Autor**: Alberto Flores  

---

## 1. Estructura de Archivos de Test

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

---

## 2. Adiciones a `tests/conftest.py`

```python
# ---------------------------------------------------------------------------
# Factories — Modulo Talento (Fase 1)
# ---------------------------------------------------------------------------

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
    """Factory para crear un CompetenciaRequisito (nivel requerido por puesto)."""
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


async def make_evaluacion_competencia(
    db: AsyncSession,
    *,
    empleado_id: int,
    competencia_id: int,
    nivel_actual: int = 2,
    evaluador_id: int | None = None,
):
    """Factory para crear una EvaluacionCompetencia (nivel actual del empleado)."""
    from app.models.talento import EvaluacionCompetencia
    
    evaluacion = EvaluacionCompetencia(
        empleado_id=empleado_id,
        competencia_id=competencia_id,
        nivel_actual=nivel_actual,
        evaluador_id=evaluador_id,
    )
    db.add(evaluacion)
    await db.flush()
    await db.refresh(evaluacion)
    return evaluacion
```

---

## 3. Test File: `tests/test_puestos_perfil.py`

### 3.1 Happy Path — CRUD

| # | Test Function | Verifica | Setup | Status | Response |
|---|---|---|---|---|---|
| 1 | `test_crear_perfil_exitoso` | RH crea perfil correctamente | `make_empleado(rol="rh")` | 201 | `codigo` con formato PRF-2026-001, `version=1` |
| 2 | `test_listar_perfiles_paginado` | Paginacion devuelve estructura correcta | 15 perfiles en DB | 200 | `items`, `total`, `page`, `pages` |
| 3 | `test_obtener_perfil_por_id` | Detalle devuelve todos los campos | 1 perfil creado | 200 | Todos los campos del schema |
| 4 | `test_actualizar_perfil_exitoso` | Update modifica campos y version incrementa | perfil existente | 200 | `version=2`, campos actualizados |
| 5 | `test_eliminar_perfil_exitoso` | Delete retorna 204 y ya no se encuentra | perfil existente | 204 | GET posterior retorna 404 |
| 6 | `test_crear_perfil_genera_codigo_secuencial` | Segundo perfil tiene codigo PRF-2026-002 | 1 perfil previo | 201 | `codigo="PRF-2026-002"` |

### 3.2 Autorizacion

| # | Test Function | Verifica | Status |
|---|---|---|---|
| 7 | `test_crear_perfil_sin_rol_rh_403` | Empleado no puede crear | 403 |
| 8 | `test_crear_perfil_supervisor_403` | Supervisor no puede crear | 403 |
| 9 | `test_actualizar_perfil_sin_rol_rh_403` | Empleado no puede actualizar | 403 |
| 10 | `test_eliminar_perfil_sin_rol_rh_403` | Empleado no puede eliminar | 403 |
| 11 | `test_listar_perfiles_empleado_200` | Cualquier autenticado puede leer | 200 |
| 12 | `test_obtener_perfil_empleado_200` | Cualquier autenticado puede leer detalle | 200 |
| 13 | `test_crear_perfil_sin_token_401` | Sin autenticacion | 401 |

### 3.3 Validacion

| # | Test Function | Verifica | Status |
|---|---|---|---|
| 14 | `test_crear_perfil_sin_titulo_422` | Titulo obligatorio | 422 |
| 15 | `test_crear_perfil_titulo_vacio_422` | Titulo no puede ser string vacio | 422 |
| 16 | `test_crear_perfil_area_inexistente_422` | area_id debe existir en catalogo | 422 |

### 3.4 Filtrado y Busqueda

| # | Test Function | Verifica | Setup | Status |
|---|---|---|---|---|
| 17 | `test_listar_perfiles_filtro_area` | `?area_id=X` filtra correctamente | 3 perfiles, 2 con area_id=1 | 200, total=2 |
| 18 | `test_listar_perfiles_busqueda_titulo` | `?busqueda=ingeniero` filtra por titulo | 3 perfiles distintos | 200, resultados match |
| 19 | `test_listar_perfiles_paginacion_page2` | `?page=2&size=5` devuelve pagina 2 | 12 perfiles | 200, items<=5, page=2 |
| 20 | `test_listar_perfiles_vacio` | Sin datos devuelve lista vacia | ninguno | 200, items=[], total=0 |

### 3.5 Reglas de Negocio

| # | Test Function | Verifica | Status |
|---|---|---|---|
| 21 | `test_version_incrementa_en_cada_update` | 3 updates → version=4 | 200 |
| 22 | `test_eliminar_perfil_cascade_competencia_requisito` | Al borrar perfil se eliminan sus CompetenciaRequisito | 204 |
| 23 | `test_codigo_formato_correcto` | PRF-{year}-{seq 3 digits} | 201 |
| 24 | `test_perfil_inactivo_no_aparece_en_listado_default` | Filtro activo=true por defecto | 200 |

### 3.6 Endpoint IA

| # | Test Function | Verifica | Status |
|---|---|---|---|
| 25 | `test_generar_ia_exitoso` | Mock Ollama retorna sugerencias | 200 |
| 26 | `test_generar_ia_ollama_no_disponible_degradacion_graceful` | Sin Ollama retorna respuesta con mensaje de error controlado | 200 o 503 con body descriptivo |
| 27 | `test_generar_ia_sin_rol_rh_403` | Solo RH puede invocar | 403 |

---

## 4. Test File: `tests/test_competencias.py`

### 4.1 Happy Path — CRUD

| # | Test Function | Verifica | Setup | Status |
|---|---|---|---|---|
| 1 | `test_crear_competencia_exitoso` | RH crea competencia | RH empleado | 201 |
| 2 | `test_listar_competencias` | Lista todas las competencias | 5 competencias | 200 |
| 3 | `test_obtener_competencia_por_id` | Detalle correcto | 1 competencia | 200 |
| 4 | `test_actualizar_competencia_exitoso` | Modifica nombre y descripcion | 1 competencia | 200 |
| 5 | `test_eliminar_competencia_exitoso` | Borra y ya no aparece | 1 competencia | 204 |

### 4.2 Autorizacion

| # | Test Function | Verifica | Status |
|---|---|---|---|
| 6 | `test_crear_competencia_empleado_403` | Solo RH puede crear | 403 |
| 7 | `test_actualizar_competencia_supervisor_403` | Solo RH puede actualizar | 403 |
| 8 | `test_eliminar_competencia_empleado_403` | Solo RH puede eliminar | 403 |
| 9 | `test_listar_competencias_empleado_200` | Cualquier autenticado lee | 200 |
| 10 | `test_crear_competencia_sin_token_401` | Sin auth | 401 |

### 4.3 Validacion

| # | Test Function | Verifica | Status |
|---|---|---|---|
| 11 | `test_crear_competencia_sin_nombre_422` | nombre obligatorio | 422 |
| 12 | `test_crear_competencia_categoria_invalida_422` | categoria debe ser enum valido | 422 |
| 13 | `test_crear_competencia_nombre_duplicado_409` | Nombre unico | 409 |

### 4.4 Filtrado

| # | Test Function | Verifica | Status |
|---|---|---|---|
| 14 | `test_listar_competencias_filtro_categoria` | `?categoria=tecnica` | 200 |
| 15 | `test_listar_competencias_busqueda` | `?busqueda=lider` | 200 |

---

## 5. Test File: `tests/test_competencias_matriz.py`

### 5.1 Matriz View

| # | Test Function | Verifica | Setup | Status |
|---|---|---|---|---|
| 1 | `test_obtener_matriz_por_area` | Retorna grid puestos x competencias | Area con 2 puestos, 3 competencias | 200 |
| 2 | `test_matriz_incluye_niveles_requeridos` | Cada celda tiene nivel_requerido | CompetenciaRequisito existentes | 200 |
| 3 | `test_matriz_area_sin_puestos_retorna_vacia` | Area sin perfiles | Area vacia | 200, rows=[] |
| 4 | `test_matriz_sin_area_id_422` | area_id obligatorio | - | 422 |

### 5.2 Bulk Update

| # | Test Function | Verifica | Setup | Status |
|---|---|---|---|---|
| 5 | `test_bulk_update_matriz_exitoso` | Actualiza multiples niveles de golpe | Matriz existente | 200 |
| 6 | `test_bulk_update_crea_requisitos_nuevos` | Si no existia requisito, lo crea | Perfil sin requisitos | 200 |
| 7 | `test_bulk_update_nivel_fuera_rango_422` | nivel > 4 o < 0 rechazado | - | 422 |
| 8 | `test_bulk_update_sin_rol_rh_403` | Solo RH | empleado auth | 403 |
| 9 | `test_bulk_update_nivel_cero_elimina_requisito` | nivel=0 borra el registro | requisito existente nivel=3 | 200 |

### 5.3 Resumen de Area (Compliance)

| # | Test Function | Verifica | Setup | Status |
|---|---|---|---|---|
| 10 | `test_resumen_area_compliance_100_porciento` | Todos cumplen | 3 emps, todos nivel >= requerido | 200, compliance=100 |
| 11 | `test_resumen_area_compliance_parcial` | Algunos no cumplen | 2 de 3 cumplen | 200, compliance~66.7 |
| 12 | `test_resumen_area_sin_empleados` | Area sin empleados | area vacia | 200, compliance=null/0 |
| 13 | `test_resumen_area_sin_area_id_422` | Parametro obligatorio | - | 422 |

### 5.4 Brechas (Gaps)

| # | Test Function | Verifica | Setup | Status |
|---|---|---|---|---|
| 14 | `test_brechas_detecta_gap_correctamente` | Nivel actual < requerido = brecha | emp con nivel 1, req=3 | 200, gap=2 |
| 15 | `test_brechas_sin_gap_no_aparece` | Si nivel >= requerido, no aparece | emp nivel 4, req=3 | 200, items no incluye emp |
| 16 | `test_brechas_multiples_competencias` | Un empleado con 2 brechas | setup multiple | 200, 2 gaps |
| 17 | `test_brechas_area_sin_evaluaciones` | Sin evaluaciones todo es brecha | requisitos sin evaluaciones | 200 |
| 18 | `test_brechas_empleado_200` | Cualquier auth puede ver | empleado auth | 200 |

---

## 6. Test File: `tests/test_fase1_integracion.py`

### 6.1 Flujos End-to-End

| # | Test Function | Verifica |
|---|---|---|
| 1 | `test_flujo_crear_perfil_asignar_competencias_ver_matriz` | Crear perfil → crear competencias → asignar via matriz → consultar |
| 2 | `test_flujo_eliminar_perfil_limpia_matriz` | Eliminar perfil → ya no aparece en matriz |
| 3 | `test_flujo_evaluar_empleado_ver_brecha` | Crear requisito nivel 3 → evaluar empleado nivel 1 → brecha=2 |
| 4 | `test_flujo_compliance_despues_de_capacitacion` | Evaluar → mejorar nivel → compliance sube |
| 5 | `test_flujo_ia_genera_y_acepta_competencias` | Generar IA → crear las competencias sugeridas → asociar a perfil |

---

## 7. Codigo de Ejemplo — Tests Criticos (pytest)

```python
# tests/test_puestos_perfil.py
"""
Tests del dominio Puestos Perfil — Modulo Talento Fase 1.

Cubre:
  - CRUD completo (crear, listar, detalle, actualizar, eliminar)
  - Autorizacion por rol (solo RH muta, cualquier auth lee)
  - Validacion de payload
  - Reglas de negocio: codigo secuencial, version increment, cascade delete
  - Generacion IA con degradacion graceful
"""

import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado, make_puesto_perfil, make_area


# Payload valido reutilizable
PERFIL_PAYLOAD = {
    "titulo": "Ingeniero de Procesos",
    "objetivo": "Optimizar procesos de manufactura",
    "requisitos_educacion": "Ingenieria Industrial o afin",
    "requisitos_experiencia": "3 anios en manufactura automotriz",
    "funciones_principales": [
        "Disenar diagramas de flujo",
        "Implementar mejoras Kaizen",
        "Documentar procedimientos",
    ],
}


# ---------------------------------------------------------------------------
# TC-PP-001: Crear perfil como RH → 201 con codigo y version
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_crear_perfil_exitoso(client: AsyncClient, db):
    area = await make_area(db, descripcion="Manufactura")
    rh = await make_empleado(db, rol="rh", email="pp001@leoni.test")
    headers = await auth_headers(client, rh)

    payload = {**PERFIL_PAYLOAD, "area_id": area.area_id}
    response = await client.post(
        "/api/v1/puestos-perfil/",
        json=payload,
        headers=headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["titulo"] == "Ingeniero de Procesos"
    assert body["version"] == 1
    assert body["codigo"].startswith("PRF-2026-")
    assert len(body["codigo"].split("-")[2]) == 3  # 3 digitos secuenciales
    assert body["area_id"] == area.area_id
    assert body["activo"] is True


# ---------------------------------------------------------------------------
# TC-PP-007: Crear perfil sin rol RH → 403
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_crear_perfil_sin_rol_rh_403(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="pp007@leoni.test")
    headers = await auth_headers(client, empleado)

    response = await client.post(
        "/api/v1/puestos-perfil/",
        json=PERFIL_PAYLOAD,
        headers=headers,
    )

    assert response.status_code == 403


# ---------------------------------------------------------------------------
# TC-PP-004: Actualizar perfil incrementa version
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_actualizar_perfil_incrementa_version(client: AsyncClient, db):
    area = await make_area(db, descripcion="Calidad")
    rh = await make_empleado(db, rol="rh", email="pp004@leoni.test")
    perfil = await make_puesto_perfil(db, titulo="Auditor Calidad", area_id=area.area_id)
    headers = await auth_headers(client, rh)

    # Primera actualizacion
    response1 = await client.put(
        f"/api/v1/puestos-perfil/{perfil.id}",
        json={"titulo": "Auditor Senior Calidad", "objetivo": "Auditorias avanzadas"},
        headers=headers,
    )
    assert response1.status_code == 200
    assert response1.json()["version"] == 2
    assert response1.json()["titulo"] == "Auditor Senior Calidad"

    # Segunda actualizacion
    response2 = await client.put(
        f"/api/v1/puestos-perfil/{perfil.id}",
        json={"objetivo": "Auditorias de proceso y producto"},
        headers=headers,
    )
    assert response2.status_code == 200
    assert response2.json()["version"] == 3


# ---------------------------------------------------------------------------
# TC-PP-022: Eliminar perfil con cascade a CompetenciaRequisito
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_eliminar_perfil_cascade_competencia_requisito(client: AsyncClient, db):
    from sqlalchemy import select
    from app.models.talento import CompetenciaRequisito

    area = await make_area(db, descripcion="Ingenieria")
    rh = await make_empleado(db, rol="rh", email="pp022@leoni.test")
    perfil = await make_puesto_perfil(db, titulo="Ingeniero Test", area_id=area.area_id)
    competencia = await make_competencia(db, nombre="Soldadura")
    await make_competencia_requisito(
        db,
        competencia_id=competencia.id,
        puesto_perfil_id=perfil.id,
        nivel_requerido=3,
    )
    headers = await auth_headers(client, rh)

    # Verificar que existe el requisito
    result_antes = await db.execute(
        select(CompetenciaRequisito).where(
            CompetenciaRequisito.puesto_perfil_id == perfil.id
        )
    )
    assert len(list(result_antes.scalars().all())) == 1

    # Eliminar perfil
    response = await client.delete(
        f"/api/v1/puestos-perfil/{perfil.id}",
        headers=headers,
    )
    assert response.status_code == 204

    # Verificar cascade
    result_despues = await db.execute(
        select(CompetenciaRequisito).where(
            CompetenciaRequisito.puesto_perfil_id == perfil.id
        )
    )
    assert len(list(result_despues.scalars().all())) == 0


# ---------------------------------------------------------------------------
# TC-PP-025: Generacion IA — exitoso con Ollama mockeado
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_generar_ia_exitoso(client: AsyncClient, db):
    area = await make_area(db, descripcion="Produccion")
    rh = await make_empleado(db, rol="rh", email="pp025@leoni.test")
    perfil = await make_puesto_perfil(db, titulo="Operador CNC", area_id=area.area_id)
    headers = await auth_headers(client, rh)

    respuesta_ia_mock = {
        "competencias_sugeridas": [
            {"nombre": "Programacion CNC", "categoria": "tecnica", "nivel_sugerido": 3},
            {"nombre": "Lectura de planos", "categoria": "tecnica", "nivel_sugerido": 4},
        ],
        "funciones_sugeridas": ["Operar tornos CNC", "Mantener calibracion"],
    }

    with patch(
        "app.integrations.ollama.generar_perfil_ia",
        new_callable=AsyncMock,
        return_value=respuesta_ia_mock,
    ):
        response = await client.post(
            f"/api/v1/puestos-perfil/{perfil.id}/generar-ia",
            headers=headers,
        )

    assert response.status_code == 200
    body = response.json()
    assert "competencias_sugeridas" in body
    assert len(body["competencias_sugeridas"]) == 2
    assert body["competencias_sugeridas"][0]["nombre"] == "Programacion CNC"


# ---------------------------------------------------------------------------
# TC-PP-026: Generacion IA — Ollama no disponible → degradacion graceful
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_generar_ia_ollama_no_disponible(client: AsyncClient, db):
    area = await make_area(db, descripcion="Logistica")
    rh = await make_empleado(db, rol="rh", email="pp026@leoni.test")
    perfil = await make_puesto_perfil(db, titulo="Coordinador Logistica", area_id=area.area_id)
    headers = await auth_headers(client, rh)

    with patch(
        "app.integrations.ollama.generar_perfil_ia",
        new_callable=AsyncMock,
        side_effect=ConnectionError("Ollama no disponible"),
    ):
        response = await client.post(
            f"/api/v1/puestos-perfil/{perfil.id}/generar-ia",
            headers=headers,
        )

    # Degradacion graceful: no debe ser 500
    assert response.status_code in (200, 503)
    body = response.json()
    if response.status_code == 503:
        assert "disponible" in body.get("detail", "").lower()
    else:
        # Si retorna 200, debe indicar que no pudo generar
        assert body.get("error") or body.get("message")
```

---

## 8. Codigo de Ejemplo — Tests de Matriz (pytest)

```python
# tests/test_competencias_matriz.py
"""
Tests de la Matriz de Competencias — brechas y compliance.
"""

import pytest
from httpx import AsyncClient

from tests.conftest import (
    auth_headers,
    make_area,
    make_competencia,
    make_competencia_requisito,
    make_empleado,
    make_evaluacion_competencia,
    make_puesto_perfil,
)


# ---------------------------------------------------------------------------
# TC-MAT-001: Obtener matriz por area
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_obtener_matriz_por_area(client: AsyncClient, db):
    area = await make_area(db, descripcion="Produccion Matriz")
    perfil_a = await make_puesto_perfil(db, titulo="Operador A", area_id=area.area_id)
    perfil_b = await make_puesto_perfil(db, titulo="Operador B", area_id=area.area_id)
    comp_1 = await make_competencia(db, nombre="Seguridad Industrial")
    comp_2 = await make_competencia(db, nombre="5S")

    await make_competencia_requisito(db, competencia_id=comp_1.id, puesto_perfil_id=perfil_a.id, nivel_requerido=3)
    await make_competencia_requisito(db, competencia_id=comp_2.id, puesto_perfil_id=perfil_a.id, nivel_requerido=2)
    await make_competencia_requisito(db, competencia_id=comp_1.id, puesto_perfil_id=perfil_b.id, nivel_requerido=4)

    rh = await make_empleado(db, rol="rh", email="mat001@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.get(
        f"/api/v1/competencias/matriz?area_id={area.area_id}",
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert "puestos" in body
    assert "competencias" in body
    assert "celdas" in body
    assert len(body["puestos"]) == 2
    assert len(body["competencias"]) >= 2


# ---------------------------------------------------------------------------
# TC-MAT-005: Bulk update matriz
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_bulk_update_matriz_exitoso(client: AsyncClient, db):
    area = await make_area(db, descripcion="Calidad Matriz")
    perfil = await make_puesto_perfil(db, titulo="Inspector", area_id=area.area_id)
    comp = await make_competencia(db, nombre="Metrologia")
    
    rh = await make_empleado(db, rol="rh", email="mat005@leoni.test")
    headers = await auth_headers(client, rh)

    payload = {
        "actualizaciones": [
            {
                "puesto_perfil_id": perfil.id,
                "competencia_id": comp.id,
                "nivel_requerido": 4,
            }
        ]
    }

    response = await client.put(
        "/api/v1/competencias/matriz",
        json=payload,
        headers=headers,
    )

    assert response.status_code == 200

    # Verificar que se creo el requisito
    verify = await client.get(
        f"/api/v1/competencias/matriz?area_id={area.area_id}",
        headers=headers,
    )
    body = verify.json()
    celdas = body.get("celdas", [])
    match = [c for c in celdas if c["competencia_id"] == comp.id and c["puesto_perfil_id"] == perfil.id]
    assert len(match) == 1
    assert match[0]["nivel_requerido"] == 4


# ---------------------------------------------------------------------------
# TC-MAT-007: Bulk update nivel fuera de rango → 422
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_bulk_update_nivel_fuera_rango_422(client: AsyncClient, db):
    area = await make_area(db, descripcion="Test Rango")
    perfil = await make_puesto_perfil(db, titulo="Tester", area_id=area.area_id)
    comp = await make_competencia(db, nombre="Testing")
    
    rh = await make_empleado(db, rol="rh", email="mat007@leoni.test")
    headers = await auth_headers(client, rh)

    payload = {
        "actualizaciones": [
            {
                "puesto_perfil_id": perfil.id,
                "competencia_id": comp.id,
                "nivel_requerido": 5,  # fuera de rango 0-4
            }
        ]
    }

    response = await client.put(
        "/api/v1/competencias/matriz",
        json=payload,
        headers=headers,
    )

    assert response.status_code == 422


# ---------------------------------------------------------------------------
# TC-MAT-014: Brechas — detecta gap correctamente
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_brechas_detecta_gap_correctamente(client: AsyncClient, db):
    area = await make_area(db, descripcion="Produccion Brechas")
    perfil = await make_puesto_perfil(db, titulo="Tecnico", area_id=area.area_id)
    comp = await make_competencia(db, nombre="Hidraulica")

    # Requisito: nivel 3
    await make_competencia_requisito(
        db, competencia_id=comp.id, puesto_perfil_id=perfil.id, nivel_requerido=3
    )

    # Empleado con nivel 1 (brecha de 2)
    empleado = await make_empleado(
        db, rol="empleado", email="mat014@leoni.test"
    )
    # Asignar puesto_id al empleado (simulando que tiene ese perfil)
    await make_evaluacion_competencia(
        db, empleado_id=empleado.id, competencia_id=comp.id, nivel_actual=1
    )

    rh = await make_empleado(db, rol="rh", email="mat014rh@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.get(
        f"/api/v1/competencias/brechas?area_id={area.area_id}",
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    gaps = body.get("brechas", body.get("items", []))
    # Debe existir al menos un gap para nuestro empleado
    emp_gaps = [g for g in gaps if g.get("empleado_id") == empleado.id]
    assert len(emp_gaps) >= 1
    gap = emp_gaps[0]
    assert gap["nivel_requerido"] == 3
    assert gap["nivel_actual"] == 1
    assert gap["brecha"] == 2


# ---------------------------------------------------------------------------
# TC-MAT-010: Resumen area — compliance 100%
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_resumen_area_compliance_100(client: AsyncClient, db):
    area = await make_area(db, descripcion="Area Compliance")
    perfil = await make_puesto_perfil(db, titulo="Tecnico Comp", area_id=area.area_id)
    comp = await make_competencia(db, nombre="Electronica")

    await make_competencia_requisito(
        db, competencia_id=comp.id, puesto_perfil_id=perfil.id, nivel_requerido=2
    )

    # 2 empleados que cumplen (nivel >= requerido)
    emp1 = await make_empleado(db, rol="empleado", email="mat010a@leoni.test")
    emp2 = await make_empleado(db, rol="empleado", email="mat010b@leoni.test")
    await make_evaluacion_competencia(db, empleado_id=emp1.id, competencia_id=comp.id, nivel_actual=3)
    await make_evaluacion_competencia(db, empleado_id=emp2.id, competencia_id=comp.id, nivel_actual=2)

    rh = await make_empleado(db, rol="rh", email="mat010rh@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.get(
        f"/api/v1/competencias/resumen-area?area_id={area.area_id}",
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["compliance"] == 100.0
```

---

## 9. Frontend Test Specs (vitest)

### 9.1 `frontend/src/__tests__/api/puestos.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock session
vi.mock("../../auth/session.ts", () => ({
  getAccessToken: () => "test-token-123",
  getRefreshToken: () => null,
  updateAccessToken: vi.fn(),
}));

import {
  listarPerfiles,
  crearPerfil,
  obtenerPerfil,
  actualizarPerfil,
  eliminarPerfil,
  generarPerfilIA,
} from "../../api/puestos.ts";

describe("API Puestos Perfil", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("listarPerfiles", () => {
    it("hace GET a /api/v1/puestos-perfil/ con params de paginacion", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [], total: 0, page: 1, pages: 0 }),
      });

      const result = await listarPerfiles({ page: 1, size: 10 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/puestos-perfil/"),
        expect.objectContaining({ method: "GET" })
      );
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("incluye filtro area_id en query params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [], total: 0, page: 1, pages: 0 }),
      });

      await listarPerfiles({ page: 1, size: 10, area_id: 5 });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("area_id=5");
    });

    it("incluye busqueda en query params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [], total: 0, page: 1, pages: 0 }),
      });

      await listarPerfiles({ page: 1, size: 10, busqueda: "ingeniero" });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("busqueda=ingeniero");
    });
  });

  describe("crearPerfil", () => {
    it("hace POST con body JSON y Authorization header", async () => {
      const perfil = { titulo: "Nuevo Puesto", objetivo: "Test" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 1, ...perfil, codigo: "PRF-2026-001", version: 1 }),
      });

      const result = await crearPerfil(perfil);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/puestos-perfil/",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(perfil),
        })
      );
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.get("Authorization")).toBe("Bearer test-token-123");
      expect(result.codigo).toBe("PRF-2026-001");
    });
  });

  describe("eliminarPerfil", () => {
    it("hace DELETE y retorna void en 204", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

      await eliminarPerfil(42);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/puestos-perfil/42",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("generarPerfilIA", () => {
    it("hace POST al endpoint de IA", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          competencias_sugeridas: [{ nombre: "Lean Manufacturing", nivel_sugerido: 3 }],
        }),
      });

      const result = await generarPerfilIA(7);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/puestos-perfil/7/generar-ia",
        expect.objectContaining({ method: "POST" })
      );
      expect(result.competencias_sugeridas).toHaveLength(1);
    });

    it("maneja 503 de Ollama sin explotar", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ detail: "Servicio IA no disponible" }),
      });

      await expect(generarPerfilIA(7)).rejects.toThrow(/no disponible/i);
    });
  });
});
```

### 9.2 `frontend/src/__tests__/api/competencias.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("../../auth/session.ts", () => ({
  getAccessToken: () => "test-token-123",
  getRefreshToken: () => null,
  updateAccessToken: vi.fn(),
}));

import {
  listarCompetencias,
  crearCompetencia,
  obtenerMatriz,
  actualizarMatrizBulk,
  obtenerBrechas,
  obtenerResumenArea,
} from "../../api/competencias.ts";

describe("API Competencias", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("listarCompetencias", () => {
    it("hace GET a /api/v1/competencias/", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ([
          { id: 1, nombre: "Liderazgo", categoria: "blanda" },
        ]),
      });

      const result = await listarCompetencias();
      expect(result).toHaveLength(1);
      expect(result[0].nombre).toBe("Liderazgo");
    });

    it("filtra por categoria", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ([]),
      });

      await listarCompetencias({ categoria: "tecnica" });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("categoria=tecnica");
    });
  });

  describe("obtenerMatriz", () => {
    it("hace GET con area_id obligatorio", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          puestos: [],
          competencias: [],
          celdas: [],
        }),
      });

      const result = await obtenerMatriz(3);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("area_id=3"),
        expect.any(Object)
      );
      expect(result.puestos).toEqual([]);
    });
  });

  describe("actualizarMatrizBulk", () => {
    it("hace PUT con array de actualizaciones", async () => {
      const actualizaciones = [
        { puesto_perfil_id: 1, competencia_id: 2, nivel_requerido: 3 },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ updated: 1 }),
      });

      await actualizarMatrizBulk(actualizaciones);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.actualizaciones).toHaveLength(1);
      expect(body.actualizaciones[0].nivel_requerido).toBe(3);
    });
  });

  describe("obtenerBrechas", () => {
    it("hace GET con area_id y parsea brechas", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          brechas: [
            { empleado_id: 1, competencia_id: 2, nivel_requerido: 4, nivel_actual: 1, brecha: 3 },
          ],
        }),
      });

      const result = await obtenerBrechas(5);
      expect(result.brechas).toHaveLength(1);
      expect(result.brechas[0].brecha).toBe(3);
    });
  });

  describe("obtenerResumenArea", () => {
    it("parsea compliance como numero", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ compliance: 75.5, total_empleados: 10, cumplen: 7 }),
      });

      const result = await obtenerResumenArea(2);
      expect(result.compliance).toBe(75.5);
      expect(result.total_empleados).toBe(10);
    });
  });
});
```

---

## 10. Checklist de QA Manual (Browser)

### 10.1 Navegacion y Acceso

| # | Paso | Esperado |
|---|---|---|
| 1 | Login como RH → Menu lateral | Aparece opcion "Talento" o "Puestos Perfil" |
| 2 | Login como empleado → Menu lateral | Puede ver secciones de lectura, no ve boton "Crear" |
| 3 | Click en "Puestos Perfil" | Se carga la tabla paginada sin errores de consola |
| 4 | Click en "Competencias" | Se carga la lista de competencias |
| 5 | Navegar a "Matriz de Competencias" | Se muestra el grid con encabezados puestos y competencias |

### 10.2 CRUD Puestos Perfil

| # | Paso | Esperado |
|---|---|---|
| 6 | Click "Nuevo Perfil" → llenar form → Guardar | Toast exito, perfil aparece en tabla con codigo generado |
| 7 | Click en un perfil → editar titulo → Guardar | Version incrementa, titulo actualizado |
| 8 | Click "Eliminar" en perfil → Confirmar | Perfil desaparece de la tabla |
| 9 | Intentar crear perfil sin titulo → Submit | Muestra error de validacion en el campo |
| 10 | Buscar por texto en la barra de busqueda | Tabla se filtra en tiempo real o al presionar Enter |
| 11 | Filtrar por area con dropdown | Solo se muestran perfiles de esa area |
| 12 | Navegar entre paginas | Paginacion funcional, total correcto |

### 10.3 CRUD Competencias

| # | Paso | Esperado |
|---|---|---|
| 13 | Crear competencia con nombre y categoria | Aparece en la lista |
| 14 | Intentar crear competencia con nombre duplicado | Toast de error claro (409) |
| 15 | Editar descripcion de competencia | Cambio se refleja al recargar |
| 16 | Eliminar competencia | Desaparece de la lista |

### 10.4 Matriz de Competencias

| # | Paso | Esperado |
|---|---|---|
| 17 | Seleccionar area → ver matriz | Grid carga con puestos en filas, competencias en columnas |
| 18 | Click en celda vacia → ingresar nivel 3 → guardar | Celda muestra "3" con color indicador |
| 19 | Editar celda existente (cambiar 2 a 4) | Se actualiza inmediatamente o tras guardar |
| 20 | Ingresar nivel 5 → intentar guardar | Validacion: "Nivel debe ser 0-4" |
| 21 | Guardar multiples celdas a la vez (bulk) | Todas se actualizan, toast exito |
| 22 | Seleccionar area sin perfiles | Mensaje "No hay perfiles para esta area" |

### 10.5 Generacion IA

| # | Paso | Esperado |
|---|---|---|
| 23 | En detalle de perfil → click "Generar con IA" | Spinner de carga visible |
| 24 | IA genera sugerencias | Se muestran competencias sugeridas con boton "Aceptar" |
| 25 | Aceptar sugerencia de competencia | Se agrega al perfil como requisito |
| 26 | Ollama apagado → click "Generar con IA" | Mensaje amigable: "Servicio de IA no disponible" (no error 500) |

### 10.6 Brechas y Compliance

| # | Paso | Esperado |
|---|---|---|
| 27 | Navegar a "Resumen de Area" → seleccionar area | Se muestra porcentaje de compliance con indicador visual |
| 28 | Navegar a "Brechas" → seleccionar area | Tabla de brechas con empleado, competencia, gap |
| 29 | Area con 0 empleados | Muestra "Sin datos" o compliance=N/A |
| 30 | Area con 100% compliance | Indicador verde, texto positivo |

### 10.7 Responsividad y UX

| # | Paso | Esperado |
|---|---|---|
| 31 | Abrir en tablet (768px) | Tabla y matriz se adaptan, no overflow horizontal |
| 32 | Matriz en tablet | Scroll horizontal controlado con sombras o indicador |
| 33 | Forms en mobile | Campos ocupan 100% width, legibles |
| 34 | Loading states | Skeletons o spinners visibles durante carga |
| 35 | Error de red (offline) | Toast o banner de error, no pantalla blanca |

### 10.8 Seguridad en UI

| # | Paso | Esperado |
|---|---|---|
| 36 | Login como empleado → ir a /puestos-perfil | Se ve la lista pero NO boton crear/editar/eliminar |
| 37 | Login como empleado → URL directa a /puestos-perfil/nuevo | Redirect o mensaje "sin permisos" |
| 38 | Token expirado → intentar accion | Redirect a login o refresh automatico |

---

## 11. Criterios de Aceptacion (Definition of Done)

### Backend
- [ ] Todos los tests de `test_puestos_perfil.py` pasan (27 tests)
- [ ] Todos los tests de `test_competencias.py` pasan (15 tests)
- [ ] Todos los tests de `test_competencias_matriz.py` pasan (18 tests)
- [ ] Todos los tests de `test_fase1_integracion.py` pasan (5 tests)
- [ ] Coverage de las nuevas lineas >= 90%
- [ ] `docker-compose run --rm test pytest tests/test_puestos_perfil.py tests/test_competencias.py tests/test_competencias_matriz.py tests/test_fase1_integracion.py -v` — 0 failures
- [ ] No hay imports circulares ni warnings de deprecacion
- [ ] OpenAPI spec (`openapi.yaml`) actualizada con todos los endpoints nuevos

### Frontend
- [ ] `frontend/src/__tests__/api/puestos.test.ts` pasa (6+ tests)
- [ ] `frontend/src/__tests__/api/competencias.test.ts` pasa (6+ tests)
- [ ] `docker-compose exec frontend npm run test` — 0 failures
- [ ] Types en `frontend/src/dashboard/talento/types.ts` sincronizados con backend schemas

### QA Manual
- [ ] Todos los 38 pasos del checklist verificados y aprobados
- [ ] No hay errores de consola (JS errors) en ningun flujo
- [ ] Tiempo de respuesta < 2s para todas las operaciones

### Reglas de Negocio Verificadas
- [ ] Solo rol RH puede crear/editar/eliminar perfiles y competencias
- [ ] Cualquier autenticado puede leer
- [ ] Nivel validado 0-4 en todas las entradas
- [ ] Codigo PRF-{year}-{seq} generado correctamente
- [ ] Version incrementa en cada update
- [ ] Cascade delete funciona (perfil → requisitos)
- [ ] Compliance = empleados cumpliendo / total * 100
- [ ] IA degrada gracefully si Ollama no esta

---

## 12. Resumen de Cobertura por Categoria

| Categoria | Backend Tests | Frontend Tests | QA Manual |
|---|---|---|---|
| Happy Path CRUD | 11 | 4 | 8 |
| Autorizacion | 10 | 1 | 3 |
| Validacion | 6 | 1 | 2 |
| Paginacion/Filtrado | 6 | 3 | 3 |
| Reglas de Negocio | 4 | 0 | 2 |
| Matriz Bulk | 5 | 2 | 5 |
| Compliance/Brechas | 9 | 2 | 4 |
| IA Generacion | 3 | 2 | 4 |
| Edge Cases | 5 | 1 | 3 |
| Integracion E2E | 5 | 0 | 4 |
| **TOTAL** | **65** | **16** | **38** |
