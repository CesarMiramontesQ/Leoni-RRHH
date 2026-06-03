"""GET /api/v1/empleados/{id}/foto — fotografía desde directorio RH/Images."""

from pathlib import Path

import pytest

from app.core.config import settings
from app.services.empleado_foto_service import EmpleadoFotoService
from tests.conftest import auth_headers, make_empleado


@pytest.fixture
def fotos_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setattr(settings, "RH_EMPLEADO_FOTOS_DIR", str(tmp_path))
    return tmp_path


async def test_resolve_foto_por_no_empleado(fotos_dir: Path, db):
    (fotos_dir / "10042.jpg").write_bytes(b"\xff\xd8\xff fake jpeg")
    svc = EmpleadoFotoService(db)
    path = svc.resolve_foto_path("10042.0", foto_hint=None)
    assert path is not None
    assert path.name == "10042.jpg"


async def test_resolve_foto_por_hint_en_bd(fotos_dir: Path, db):
    (fotos_dir / "custom.png").write_bytes(b"\x89PNG\r\n\x1a\n")
    svc = EmpleadoFotoService(db)
    path = svc.resolve_foto_path("999", foto_hint="custom.png")
    assert path is not None
    assert path.name == "custom.png"


async def test_get_foto_endpoint_ok(client, db, fotos_dir: Path):
    rh = await make_empleado(db, rol="rh", email="rh_foto@leoni.test")
    emp = await make_empleado(db, rol="empleado", no_empleado="55001", email="emp_foto@leoni.test")
    (fotos_dir / "55001.jpg").write_bytes(
        b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb"
    )
    headers = await auth_headers(client, rh)

    r = await client.get(f"/api/v1/empleados/{emp.id}/foto", headers=headers)

    assert r.status_code == 200, r.text
    assert r.headers["content-type"].startswith("image/")
    assert len(r.content) > 0


async def test_get_foto_endpoint_404_sin_archivo(client, db, fotos_dir: Path):
    rh = await make_empleado(db, rol="rh", email="rh_foto404@leoni.test")
    emp = await make_empleado(db, rol="empleado", no_empleado="55002", email="emp_foto404@leoni.test")
    headers = await auth_headers(client, rh)

    r = await client.get(f"/api/v1/empleados/{emp.id}/foto", headers=headers)

    assert r.status_code == 404
