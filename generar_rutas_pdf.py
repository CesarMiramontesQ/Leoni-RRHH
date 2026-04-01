"""
Genera el documento PDF de rutas de la Plataforma RH Leoni Cable.
Ejecutar: python3 generar_rutas_pdf.py
"""

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# ── Paleta ────────────────────────────────────────────────────
LEONI_BLUE   = colors.HexColor("#003B7A")   # Azul corporativo Leoni
LEONI_YELLOW = colors.HexColor("#F5A800")   # Amarillo Leoni
DARK_BG      = colors.HexColor("#1A2433")
LIGHT_BLUE   = colors.HexColor("#E8F0FA")
GRAY_ROW     = colors.HexColor("#F4F6F9")
WHITE        = colors.white
TEXT_DARK    = colors.HexColor("#1C2B3A")

METHOD_COLORS = {
    "GET":    colors.HexColor("#0D6EFD"),
    "POST":   colors.HexColor("#198754"),
    "PUT":    colors.HexColor("#FD7E14"),
    "DELETE": colors.HexColor("#DC3545"),
    "PATCH":  colors.HexColor("#6F42C1"),
}

# ── Datos: (método, ruta, pantalla sugerida, rol mínimo, notas) ──
ROUTES = [
    # ── ROOT ──────────────────────────────────────────────────
    ("Root / Sistema", [
        ("GET",    "/",                                           "Estado del sistema (DevOps / Health check)",     "Público",    "Retorna versión y entorno. No exponer en producción."),
        ("GET",    "/health",                                     "Health check (load balancer / monitoreo)",       "Público",    "Usado por nginx / Docker healthcheck."),
        ("GET",    "/docs",                                       "Swagger UI interactivo",                         "Interno",    "Deshabilitar en producción o proteger con auth básica."),
        ("GET",    "/redoc",                                      "ReDoc — documentación de referencia",            "Interno",    "Alternativa a /docs. Solo desarrollo."),
    ]),

    # ── AUTENTICACIÓN ─────────────────────────────────────────
    ("Autenticación", [
        ("POST",   "/api/v1/auth/login",                          "Pantalla de Login",                              "Público",    "Recibe email + password. Retorna access_token y refresh_token."),
        ("POST",   "/api/v1/auth/logout",                         "Botón «Cerrar sesión» (header/navbar)",          "Autenticado","Agrega JTI al blacklist. Limpiar localStorage en el frontend."),
        ("POST",   "/api/v1/auth/refresh",                        "Interceptor HTTP (transparente al usuario)",     "Autenticado","Llamar automáticamente cuando el access_token expire (401)."),
        ("GET",    "/api/v1/auth/me",                             "Carga inicial del usuario (contexto de sesión)", "Autenticado","Llamar al abrir la app para poblar el store de usuario."),
        ("POST",   "/api/v1/auth/sync-it",                        "Panel admin → Botón «Sincronizar IT Mirror»",    "rh",         "Sincronización manual de empleados desde BD espejo."),
    ]),

    # ── USUARIOS ──────────────────────────────────────────────
    ("Usuarios (Gestión de Cuentas)", [
        ("GET",    "/api/v1/usuarios",                            "Panel RH → Lista de usuarios",                   "rh",         "Paginación cursor-based. Tabla con búsqueda/filtro en frontend."),
        ("POST",   "/api/v1/usuarios",                            "Panel RH → Formulario «Crear usuario»",          "rh",         "Crea empleado con password inicial y rol asignado."),
        ("GET",    "/api/v1/usuarios/{id}",                       "Panel RH → Detalle del usuario",                 "rh",         "Ficha completa del empleado."),
        ("PUT",    "/api/v1/usuarios/{id}",                       "Panel RH → Formulario «Editar usuario»",         "rh",         "Solo RH puede modificar datos."),
        ("DELETE", "/api/v1/usuarios/{id}",                       "Panel RH → Botón «Desactivar usuario»",          "rh",         "Soft delete. Cancela solicitudes PENDING activas."),
        ("GET",    "/api/v1/usuarios/{id}/vista360",              "Vista 360° del empleado (perfil extendido)",     "rh/gerente", "Solicitudes, incidencias, actas y saldo de vacaciones."),
        ("GET",    "/api/v1/usuarios/{id}/metricas",              "Panel RH → Tarjetas de métricas del empleado",   "rh",         "KPIs individuales: antigüedad, rotación, actas totales."),
    ]),

    # ── EMPLEADOS ─────────────────────────────────────────────
    ("Empleados (Directorio y Vista 360)", [
        ("GET",    "/api/v1/empleados",                           "Directorio de empleados (tabla/tarjetas)",       "rh/gerente", "Listado activo de toda la plantilla."),
        ("GET",    "/api/v1/empleados/{id}/vista360",             "Perfil extendido del empleado",                  "rh/gerente", "Historial completo: solicitudes, incidencias, actas."),
        ("GET",    "/api/v1/empleados/{id}/metricas",             "Dashboard individual del empleado",              "rh/gerente", "Solicitudes por estado, incidencias por tipo, antigüedad."),
    ]),

    # ── SOLICITUDES ───────────────────────────────────────────
    ("Solicitudes (Vacaciones / Permisos)", [
        ("GET",    "/api/v1/solicitudes",                         "Mi bandeja → Lista mis solicitudes",             "Autenticado","Empleado ve las suyas; supervisor ve equipo; rh ve todas."),
        ("POST",   "/api/v1/solicitudes",                         "Formulario «Nueva solicitud»",                   "Autenticado","Tipos: vacaciones, permiso_personal, home_office, etc."),
        ("GET",    "/api/v1/solicitudes/{id}",                    "Detalle de solicitud",                           "Autenticado","Card con historial de aprobaciones y estado actual."),
        ("GET",    "/api/v1/solicitudes/{id}/aprobaciones",       "Timeline de aprobaciones (dentro del detalle)",  "Autenticado","Muestra quién aprobó/rechazó en cada nivel jerárquico."),
        ("PUT",    "/api/v1/solicitudes/{id}/approve",            "Bandeja supervisor → Botón «Aprobar»",           "supervisor+","Aprobación en flujo jerárquico nivel 1."),
        ("PUT",    "/api/v1/solicitudes/{id}/reject",             "Bandeja supervisor → Botón «Rechazar»",          "supervisor+","Requiere comentario de rechazo en el body."),
        ("PUT",    "/api/v1/solicitudes/{id}/override",           "Bandeja director/RH → Botón «Override»",         "director/rh","Aprueba saltando niveles jerárquicos pendientes."),
        ("PUT",    "/api/v1/solicitudes/{id}/cancel",             "Detalle solicitud → Botón «Cancelar»",           "Autenticado","Solo el dueño puede cancelar mientras esté PENDING."),
    ]),

    # ── INCIDENCIAS ───────────────────────────────────────────
    ("Incidencias", [
        ("GET",    "/api/v1/incidencias",                         "Panel RH/Supervisor → Lista de incidencias",     "supervisor+","Filtros por tipo, estado y empleado."),
        ("POST",   "/api/v1/incidencias",                         "Formulario «Registrar incidencia»",              "supervisor+","El supervisor registra incidencias de su equipo."),
        ("GET",    "/api/v1/incidencias/{id}",                    "Detalle de incidencia",                          "supervisor+","Incluye evidencias adjuntas y estado actual."),
        ("PUT",    "/api/v1/incidencias/{id}/estado",             "Detalle incidencia → Cambiar estado",            "supervisor+","Transiciones: OPEN → IN_PROGRESS → RESOLVED/CLOSED."),
        ("POST",   "/api/v1/incidencias/{id}/evidencias",         "Detalle incidencia → Subir evidencia",           "supervisor+","Upload de archivo (imagen, PDF, video)."),
        ("GET",    "/api/v1/incidencias/{id}/evidencias/{eid}",   "Detalle incidencia → Descargar evidencia",       "supervisor+","Descarga directa del archivo adjunto."),
    ]),

    # ── ACTAS ADMINISTRATIVAS ─────────────────────────────────
    ("Actas Administrativas", [
        ("GET",    "/api/v1/actas",                               "Panel RH → Lista de actas administrativas",      "rh/gerente", "Tabla con estado y filtros por tipo y período."),
        ("POST",   "/api/v1/actas/generar/{incidencia_id}",       "Detalle incidencia → Botón «Generar acta»",      "rh/gerente", "Genera borrador con Ollama LLM. Fallback: plantilla manual."),
        ("GET",    "/api/v1/actas/{id}",                          "Vista del acta con editor y firmas",             "rh/gerente", "Preview del acta + botones de firma por rol."),
        ("PUT",    "/api/v1/actas/{id}/editar",                   "Editor de acta (DRAFT → edición)",               "rh",         "Solo editable en estado DRAFT. RichText o textarea."),
        ("PUT",    "/api/v1/actas/{id}/firmar",                   "Vista acta → Botón «Firmar»",                    "gerente/dir/rh","Cada rol firma una vez. Al completar 3 firmas → SIGNED."),
        ("GET",    "/api/v1/actas/{id}/pdf",                      "Vista acta → Botón «Descargar PDF»",             "rh/gerente", "Genera y descarga el PDF del acta firmada."),
    ]),

    # ── COMEDOR ───────────────────────────────────────────────
    ("Comedor (Gestión de Menú y Acceso)", [
        ("GET",    "/api/v1/comedor/comedores",                   "Selección de comedor (dropdown/card)",           "Autenticado","Lista comedores activos para el registro de selección."),
        ("GET",    "/api/v1/comedor/menu",                        "Vista semanal del menú del comedor",             "Autenticado","Mostrar menú por día (lunes–viernes) con foto si existe."),
        ("POST",   "/api/v1/comedor/menu",                        "Panel RH → Formulario «Publicar menú»",          "rh",         "RH carga el menú semanal para cada comedor."),
        ("POST",   "/api/v1/comedor/registro",                    "Vista menú → Botón «Seleccionar platillo»",      "Autenticado","Empleado elige normal o dieta para la semana."),
        ("POST",   "/api/v1/comedor/huella/validar",              "Lector de huella (acceso al comedor físico)",    "Sistema",    "FAIL OPEN. Solo IPs en whitelist. Sin JWT. Responde <500ms."),
        ("GET",    "/api/v1/comedor/estadisticas",                "Dashboard comedor → Estadísticas semanales",     "rh/gerente", "Total registros, distribución normal/dieta, accesos."),
        ("GET",    "/api/v1/comedor/proyecciones",                "Dashboard comedor → Proyecciones de consumo",    "rh/gerente", "Promedio últimas 4 semanas para planificación de compras."),
    ]),

    # ── REPORTES ──────────────────────────────────────────────
    ("Reportes y Exportación", [
        ("GET",    "/api/v1/reportes/dashboard/kpis",             "Dashboard principal → Tarjetas de KPIs",         "rh/gerente", "Empleados activos, solicitudes por estado, incidencias abiertas."),
        ("GET",    "/api/v1/reportes/{modulo}/pdf",               "Cualquier lista → Botón «Exportar PDF»",         "rh/gerente", "Genera reporte PDF del módulo (solicitudes, incidencias, etc)."),
        ("GET",    "/api/v1/reportes/{modulo}/excel",             "Cualquier lista → Botón «Exportar Excel»",       "rh/gerente", "Genera archivo .xlsx descargable del módulo indicado."),
    ]),

    # ── NOTIFICACIONES ────────────────────────────────────────
    ("Notificaciones", [
        ("GET",    "/api/v1/notificaciones",                      "Bandeja de notificaciones (panel lateral)",      "Autenticado","Lista todas las notificaciones del usuario autenticado."),
        ("GET",    "/api/v1/notificaciones/no-leidas/count",      "Badge contador en campana del header",           "Autenticado","Polling cada 30s para actualizar el badge de notificaciones."),
        ("PUT",    "/api/v1/notificaciones/{id}/leer",            "Notificación → Clic para marcar leída",          "Autenticado","Cambia leida=True. Actualizar badge en UI."),
        ("PUT",    "/api/v1/notificaciones/leer-todas",           "Bandeja → Botón «Marcar todas como leídas»",     "Autenticado","Marca todas las notificaciones del usuario como leídas."),
    ]),

    # ── AUDITORÍA ─────────────────────────────────────────────
    ("Auditoría (Solo RH)", [
        ("GET",    "/api/v1/auditoria/logs",                      "Panel RH → Log de auditoría con filtros",        "rh",         "Filtros: módulo, usuario, acción, rango de fechas."),
        ("GET",    "/api/v1/auditoria/logs/{id}",                 "Panel RH → Detalle de entrada de auditoría",     "rh",         "Ver datos_antes / datos_despues del cambio."),
    ]),
]


def build_pdf(output_path: str):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        title="Plataforma RH Leoni Cable — Mapa de Rutas API",
        author="Leoni Cable — Generado automáticamente",
    )

    styles = getSampleStyleSheet()

    style_title = ParagraphStyle(
        "TitleCustom",
        fontName="Helvetica-Bold",
        fontSize=20,
        textColor=WHITE,
        alignment=TA_CENTER,
        spaceAfter=4,
    )
    style_subtitle = ParagraphStyle(
        "SubtitleCustom",
        fontName="Helvetica",
        fontSize=10,
        textColor=colors.HexColor("#BED0E8"),
        alignment=TA_CENTER,
        spaceAfter=2,
    )
    style_section = ParagraphStyle(
        "SectionHeader",
        fontName="Helvetica-Bold",
        fontSize=11,
        textColor=WHITE,
        spaceBefore=12,
        spaceAfter=6,
        leftIndent=6,
    )
    style_note = ParagraphStyle(
        "Note",
        fontName="Helvetica-Oblique",
        fontSize=7.5,
        textColor=colors.HexColor("#5A6880"),
        leading=10,
    )
    style_path = ParagraphStyle(
        "Path",
        fontName="Courier",
        fontSize=8,
        textColor=TEXT_DARK,
        leading=11,
    )
    style_screen = ParagraphStyle(
        "Screen",
        fontName="Helvetica-Bold",
        fontSize=8,
        textColor=TEXT_DARK,
        leading=11,
    )
    style_small = ParagraphStyle(
        "Small",
        fontName="Helvetica",
        fontSize=7.5,
        textColor=colors.HexColor("#445566"),
        leading=10,
    )
    style_toc_head = ParagraphStyle(
        "TocHead",
        fontName="Helvetica-Bold",
        fontSize=10,
        textColor=LEONI_BLUE,
        spaceBefore=4,
        spaceAfter=2,
    )
    style_toc_item = ParagraphStyle(
        "TocItem",
        fontName="Helvetica",
        fontSize=9,
        textColor=TEXT_DARK,
        leading=14,
    )

    story = []

    # ── Portada ───────────────────────────────────────────────
    cover_data = [[
        Paragraph("PLATAFORMA RH LEONI CABLE", style_title),
    ]]
    cover_table = Table(cover_data, colWidths=[18 * cm])
    cover_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LEONI_BLUE),
        ("ROUNDEDCORNERS", [6]),
        ("TOPPADDING",    (0, 0), (-1, -1), 22),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (-1, -1), 12),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 12),
    ]))
    story.append(cover_table)

    subtitle_data = [[
        Paragraph("Mapa completo de rutas API · Guía de ubicación de pantallas frontend", style_subtitle),
    ]]
    subtitle_table = Table(subtitle_data, colWidths=[18 * cm])
    subtitle_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), DARK_BG),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING",   (0, 0), (-1, -1), 12),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 12),
    ]))
    story.append(subtitle_table)
    story.append(Spacer(1, 0.4 * cm))

    # ── Leyenda de colores de métodos ─────────────────────────
    legend_items = []
    for method, color in METHOD_COLORS.items():
        cell = Table([[Paragraph(f"  {method}  ", ParagraphStyle(
            f"m{method}", fontName="Helvetica-Bold", fontSize=8,
            textColor=WHITE, alignment=TA_CENTER
        ))]], colWidths=[1.6 * cm])
        cell.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), color),
            ("ROUNDEDCORNERS", [4]),
            ("TOPPADDING",    (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        legend_items.append(cell)

    legend_table = Table([legend_items], colWidths=[1.8 * cm] * 5)
    legend_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN",  (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(legend_table)
    story.append(Spacer(1, 0.3 * cm))

    # Nota rápida de roles
    story.append(Paragraph(
        "Roles: <b>Público</b> = sin auth · <b>Autenticado</b> = cualquier token válido · "
        "<b>supervisor+</b> = supervisor, gerente, director o rh · <b>rh</b> = solo Recursos Humanos",
        style_note
    ))
    story.append(Spacer(1, 0.5 * cm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=LEONI_YELLOW))
    story.append(Spacer(1, 0.4 * cm))

    # ── Índice ────────────────────────────────────────────────
    story.append(Paragraph("ÍNDICE DE MÓDULOS", style_toc_head))
    for i, (section_name, _) in enumerate(ROUTES, 1):
        story.append(Paragraph(f"  {i:02d}.  {section_name}", style_toc_item))

    story.append(Spacer(1, 0.6 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CBD5E0")))
    story.append(Spacer(1, 0.3 * cm))

    col_widths = [1.5 * cm, 5.2 * cm, 4.8 * cm, 2.2 * cm, 4.3 * cm]
    header_row = [
        Paragraph("<b>Método</b>", ParagraphStyle("H", fontName="Helvetica-Bold",
                  fontSize=8, textColor=WHITE, alignment=TA_CENTER)),
        Paragraph("<b>Ruta</b>", ParagraphStyle("H", fontName="Helvetica-Bold",
                  fontSize=8, textColor=WHITE)),
        Paragraph("<b>Pantalla / Uso en Frontend</b>", ParagraphStyle("H", fontName="Helvetica-Bold",
                  fontSize=8, textColor=WHITE)),
        Paragraph("<b>Rol mínimo</b>", ParagraphStyle("H", fontName="Helvetica-Bold",
                  fontSize=8, textColor=WHITE, alignment=TA_CENTER)),
        Paragraph("<b>Notas</b>", ParagraphStyle("H", fontName="Helvetica-Bold",
                  fontSize=8, textColor=WHITE)),
    ]

    for idx, (section_name, rows) in enumerate(ROUTES):
        # Encabezado de sección
        section_data = [[
            Paragraph(f"  {idx+1:02d}  {section_name.upper()}", style_section)
        ]]
        section_table = Table(section_data, colWidths=[18 * cm])
        section_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), LEONI_BLUE),
            ("TOPPADDING",    (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ]))
        story.append(section_table)

        # Encabezados de tabla
        table_data = [header_row]

        for i, (method, path, screen, role, notes) in enumerate(rows):
            method_color = METHOD_COLORS.get(method, LEONI_BLUE)

            method_cell = Table([[
                Paragraph(method, ParagraphStyle(
                    f"mc{method}", fontName="Helvetica-Bold",
                    fontSize=7.5, textColor=WHITE, alignment=TA_CENTER
                ))
            ]], colWidths=[1.3 * cm])
            method_cell.setStyle(TableStyle([
                ("BACKGROUND",    (0, 0), (-1, -1), method_color),
                ("ROUNDEDCORNERS", [3]),
                ("TOPPADDING",    (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING",   (0, 0), (-1, -1), 2),
                ("RIGHTPADDING",  (0, 0), (-1, -1), 2),
            ]))

            bg = GRAY_ROW if i % 2 == 0 else WHITE

            table_data.append([
                method_cell,
                Paragraph(path, style_path),
                Paragraph(screen, style_screen),
                Paragraph(role, ParagraphStyle("role", fontName="Helvetica",
                          fontSize=7.5, textColor=LEONI_BLUE, alignment=TA_CENTER, leading=10)),
                Paragraph(notes, style_note),
            ])

        t = Table(table_data, colWidths=col_widths, repeatRows=1)

        row_styles = [
            ("BACKGROUND",    (0, 0), (-1, 0),  DARK_BG),
            ("TEXTCOLOR",     (0, 0), (-1, 0),  WHITE),
            ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica-Bold"),
            ("FONTSIZE",      (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS",(0, 1), (-1, -1), [GRAY_ROW, WHITE]),
            ("GRID",          (0, 0), (-1, -1), 0.3, colors.HexColor("#D1DCE8")),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING",   (0, 0), (-1, -1), 5),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 5),
            ("ALIGN",         (0, 0), (0, -1),  "CENTER"),
            ("ALIGN",         (3, 0), (3, -1),  "CENTER"),
        ]
        t.setStyle(TableStyle(row_styles))
        story.append(t)
        story.append(Spacer(1, 0.3 * cm))

    # ── Dashboard map ─────────────────────────────────────────
    story.append(PageBreak())
    story.append(HRFlowable(width="100%", thickness=1.5, color=LEONI_YELLOW))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("MAPA DE PANTALLAS — NAVEGACIÓN SUGERIDA", ParagraphStyle(
        "MapTitle", fontName="Helvetica-Bold", fontSize=13, textColor=LEONI_BLUE,
        spaceAfter=8, alignment=TA_LEFT
    )))

    nav_map = [
        ("🔐  Login",              "/api/v1/auth/login",                        "Pantalla inicial. Pública."),
        ("📊  Dashboard principal", "/api/v1/reportes/dashboard/kpis",           "Página home post-login. KPIs en tarjetas."),
        ("📋  Mis solicitudes",     "/api/v1/solicitudes",                       "Bandeja personal. Filtros por tipo y estado."),
        ("➕  Nueva solicitud",     "POST /api/v1/solicitudes",                  "Modal/página de formulario."),
        ("✅  Bandeja de aprobación","PUT /api/v1/solicitudes/{id}/approve|reject","Vista supervisor/gerente/director."),
        ("⚡  Override (director)", "PUT /api/v1/solicitudes/{id}/override",      "Acción rápida desde detalle de solicitud."),
        ("👥  Directorio empleados","GET /api/v1/empleados",                     "Solo rh/gerente. Tabla con búsqueda."),
        ("🔍  Vista 360°",          "/api/v1/empleados/{id}/vista360",           "Perfil completo desde directorio."),
        ("⚠️   Incidencias",        "/api/v1/incidencias",                       "Lista. Filtro por tipo/estado."),
        ("📄  Generar acta",        "POST /api/v1/actas/generar/{incidencia_id}","Desde detalle incidencia. Ollama stub."),
        ("✍️   Firmar acta",        "PUT /api/v1/actas/{id}/firmar",             "Dentro del detalle del acta."),
        ("🍽️   Menú comedor",       "/api/v1/comedor/menu",                      "Vista semanal. Selección de platillo."),
        ("📡  Lector de huella",    "POST /api/v1/comedor/huella/validar",       "Solo dispositivo físico. Sin JWT."),
        ("📈  Estadísticas comedor","/api/v1/comedor/estadisticas",              "Dashboard de consumo semanal (RH)."),
        ("🔔  Notificaciones",      "/api/v1/notificaciones",                   "Panel lateral. Badge con no-leidas/count."),
        ("👤  Gestión usuarios",    "/api/v1/usuarios",                         "CRUD completo. Solo RH."),
        ("🗂️   Log de auditoría",   "/api/v1/auditoria/logs",                   "Solo RH. Filtros avanzados."),
        ("⚙️   Sync IT Mirror",     "POST /api/v1/auth/sync-it",                "Botón en panel admin RH."),
    ]

    nav_data = [
        [
            Paragraph("<b>Pantalla</b>", ParagraphStyle("nh", fontName="Helvetica-Bold",
                      fontSize=8.5, textColor=WHITE)),
            Paragraph("<b>Ruta(s) involucrada(s)</b>", ParagraphStyle("nh", fontName="Helvetica-Bold",
                      fontSize=8.5, textColor=WHITE)),
            Paragraph("<b>Descripción</b>", ParagraphStyle("nh", fontName="Helvetica-Bold",
                      fontSize=8.5, textColor=WHITE)),
        ]
    ]
    for i, (screen, route, desc) in enumerate(nav_map):
        nav_data.append([
            Paragraph(screen, ParagraphStyle("ns", fontName="Helvetica-Bold",
                      fontSize=8, textColor=LEONI_BLUE, leading=11)),
            Paragraph(f"<font name='Courier' size='7.5'>{route}</font>",
                      ParagraphStyle("nr", fontName="Courier", fontSize=7.5,
                      textColor=TEXT_DARK, leading=11)),
            Paragraph(desc, style_note),
        ])

    nav_table = Table(nav_data, colWidths=[4.2 * cm, 7.0 * cm, 6.8 * cm])
    nav_table.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0),  DARK_BG),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [LIGHT_BLUE, WHITE]),
        ("GRID",          (0, 0), (-1, -1), 0.3, colors.HexColor("#CBD5E0")),
        ("FONTSIZE",      (0, 0), (-1, -1), 8),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
    ]))
    story.append(nav_table)

    story.append(Spacer(1, 0.8 * cm))
    story.append(HRFlowable(width="100%", thickness=1, color=LEONI_YELLOW))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(
        "Generado automáticamente desde app.main · Plataforma RH Leoni Cable v1.0.0 · "
        "FastAPI 0.115 · PostgreSQL 15 · 57 endpoints registrados",
        ParagraphStyle("footer", fontName="Helvetica-Oblique", fontSize=7.5,
                       textColor=colors.HexColor("#8899AA"), alignment=TA_CENTER)
    ))

    doc.build(story)
    print(f"PDF generado: {output_path}")


if __name__ == "__main__":
    build_pdf("Leoni_RRHH_Mapa_Rutas_API.pdf")
