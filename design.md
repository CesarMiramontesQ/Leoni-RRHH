# Design System — Industrial Precision

Sistema de diseno para la plataforma HCM de LEONI Cable (Mexico).
Fuente de verdad unica para agentes Claude, Cursor y desarrolladores humanos.

> **Origen**: Google Stitch project `1746412759455982581` — "Automotive Manufacturing HCM Platform"
> **Design System**: Industrial Precision (Modern Corporate Minimalism)
> **Filosofia**: Herramienta de alto rendimiento — utilitaria, precisa, sin ornamentacion innecesaria. Estilo "Linear/Notion" adaptado para HCM automotriz.

---

## 1. Design Tokens

### 1.1 CSS Custom Properties

Bloque `:root` canonico. El `@theme` de Tailwind v4 en `frontend/src/style.css` debe exponer estos tokens.

```css
:root {
  /* ── Brand ──────────────────────────────────────────────── */
  --color-primary:              #0A1628;
  --color-on-primary:           #FFFFFF;
  --color-primary-container:    #101C2E;
  --color-secondary:            #1E3A5F;
  --color-on-secondary:         #FFFFFF;
  --color-secondary-container:  #B5D0FD;

  /* ── Accent (Electric Blue — solo acciones interactivas) ── */
  --color-accent:               #2563EB;
  --color-accent-hover:         #1D4ED8;
  --color-accent-light:         rgba(37, 99, 235, 0.10);
  --color-accent-glow:          rgba(37, 99, 235, 0.25);

  /* ── Semantic / Status ─────────────────────────────────── */
  --color-success:              #22C55E;
  --color-success-bg:           rgba(34, 197, 94, 0.10);
  --color-success-text:         #15803D;
  --color-success-border:       #BBF7D0;

  --color-warning:              #F59E0B;
  --color-warning-bg:           rgba(245, 158, 11, 0.10);
  --color-warning-text:         #92400E;
  --color-warning-border:       #FDE68A;

  --color-info:                 #3B82F6;
  --color-info-bg:              rgba(59, 130, 246, 0.10);
  --color-info-text:            #1E40AF;
  --color-info-border:          #BFDBFE;

  --color-danger:               #EF4444;
  --color-danger-bg:            rgba(239, 68, 68, 0.10);
  --color-danger-text:          #991B1B;
  --color-danger-border:        #FECACA;

  --color-error:                #BA1A1A;
  --color-on-error:             #FFFFFF;
  --color-error-container:      #FFDAD6;

  /* ── Surfaces ──────────────────────────────────────────── */
  --color-surface:              #FBF8FA;
  --color-on-surface:           #1B1B1D;
  --color-surface-dim:          #DCD9DB;
  --color-surface-container-lowest:  #FFFFFF;
  --color-surface-container-low:     #F5F3F5;
  --color-surface-container:         #F0EDEF;
  --color-surface-container-high:    #EAE7E9;
  --color-surface-container-highest: #E4E2E3;

  /* ── Text ──────────────────────────────────────────────── */
  --color-text-primary:         #0A1628;
  --color-text-secondary:       #64748B;
  --color-text-muted:           #94A3B8;
  --color-text-inverse:         #FFFFFF;
  --color-on-surface-variant:   #45474C;

  /* ── Borders ───────────────────────────────────────────── */
  --color-border:               #CBD5E1;
  --color-outline:              #75777D;
  --color-outline-variant:      #C5C6CD;

  /* ── Operational Aliases ───────────────────────────────── */
  --color-active-tint:          #F0F4F8;
  --color-grid-header-bg:       #F8FAFC;
  --color-grid-header-text:     #64748B;

  /* ── Inverse ───────────────────────────────────────────── */
  --color-inverse-surface:      #303032;
  --color-inverse-on-surface:   #F3F0F2;
  --color-inverse-primary:      #BBC7DF;

  /* ── Typography ────────────────────────────────────────── */
  --font-family-sans: "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;

  --font-size-h1:         2rem;       /* 32px */
  --line-height-h1:       1.2;
  --font-weight-h1:       700;
  --letter-spacing-h1:    -0.02em;

  --font-size-h2:         1.5rem;     /* 24px */
  --line-height-h2:       1.3;
  --font-weight-h2:       600;
  --letter-spacing-h2:    -0.01em;

  --font-size-h3:         1.25rem;    /* 20px */
  --line-height-h3:       1.4;
  --font-weight-h3:       600;
  --letter-spacing-h3:    -0.01em;

  --font-size-body-lg:    1rem;       /* 16px */
  --line-height-body-lg:  1.5;
  --font-weight-body-lg:  400;

  --font-size-body-md:    0.875rem;   /* 14px */
  --line-height-body-md:  1.5;
  --font-weight-body-md:  400;

  --font-size-body-sm:    0.8125rem;  /* 13px */
  --line-height-body-sm:  1.4;
  --font-weight-body-sm:  400;
  --letter-spacing-body-sm: 0.01em;

  --font-size-label-md:   0.75rem;    /* 12px */
  --line-height-label-md: 1;
  --font-weight-label-md: 600;
  --letter-spacing-label-md: 0.05em;

  --font-size-label-sm:   0.6875rem;  /* 11px */
  --line-height-label-sm: 1;
  --font-weight-label-sm: 500;
  --letter-spacing-label-sm: 0.02em;

  /* ── Spacing (4px base grid) ───────────────────────────── */
  --space-xs:     0.25rem;  /* 4px  */
  --space-sm:     0.5rem;   /* 8px  */
  --space-md:     1rem;     /* 16px */
  --space-lg:     1.5rem;   /* 24px */
  --space-xl:     2.5rem;   /* 40px */
  --space-gutter: 1rem;     /* 16px */
  --space-margin: 1.5rem;   /* 24px */

  /* ── Border Radius ─────────────────────────────────────── */
  --radius-sm:      0.125rem;  /* 2px  */
  --radius-default: 0.25rem;   /* 4px  */
  --radius-md:      0.375rem;  /* 6px  */
  --radius-lg:      0.5rem;    /* 8px  */
  --radius-xl:      0.75rem;   /* 12px */
  --radius-full:    9999px;

  /* ── Shadows ───────────────────────────────────────────── */
  --shadow-none: none;
  --shadow-sm:   0px 1px 3px rgba(10, 22, 40, 0.04);
  --shadow-md:   0px 4px 12px rgba(10, 22, 40, 0.08);
  --shadow-lg:   0px 8px 24px rgba(10, 22, 40, 0.12);
  --shadow-xl:   0px 16px 48px rgba(10, 22, 40, 0.16);

  /* ── Transitions ───────────────────────────────────────── */
  --transition-fast:   150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow:   300ms ease;
}
```

### 1.2 Tailwind v4 `@theme` Block

El archivo `frontend/src/style.css` debe exponer estos tokens para que las clases utilitarias funcionen (e.g., `bg-primary`, `text-accent`, `rounded-default`):

```css
@theme {
  --color-primary:           #0A1628;
  --color-primary-light:     #1E3A5F;
  --color-accent:            #2563EB;
  --color-accent-hover:      #1D4ED8;
  --color-surface:           #FBF8FA;
  --color-surface-container: #F0EDEF;
  --color-active-tint:       #F0F4F8;
  --color-text-primary:      #0A1628;
  --color-text-secondary:    #64748B;
  --color-text-muted:        #94A3B8;
  --color-border:            #CBD5E1;
  --color-success:           #22C55E;
  --color-warning:           #F59E0B;
  --color-info:              #3B82F6;
  --color-danger:            #EF4444;
  --color-error:             #BA1A1A;
  --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;
  --radius-sm:      0.125rem;
  --radius-default: 0.25rem;
  --radius-md:      0.375rem;
  --radius-lg:      0.5rem;
  --radius-xl:      0.75rem;
  --radius-full:    9999px;
}
```

> **Estado actual del `@theme`**: `style.css` ya expone los tokens *semánticos* de arriba
> (`text-secondary`, la escala `surface-container-*`, `active-tint`, `grid-header-*`,
> `outline`, `success`, `warning`, `danger`), pero **conserva los hex de marca Leoni**
> para `primary`, `surface`, `text-primary`, `text-muted` y `border`: el mapeo de
> migracion de abajo sigue pendiente (checklist §14). Un token que no esta en `@theme`
> **no genera CSS**: ni la utilidad (`text-text-secondary`) ni `var(--color-x)` sin
> fallback pintan nada. Antes de usar un token nuevo, verifica que este en el `@theme`.
> No existe `border-subtle`: para bordes de cards y tablas usa `border-border`.

**Mapeo de migracion** (tokens actuales → nuevos):

| Actual (`style.css`) | Nuevo | Nota |
|---|---|---|
| `--color-leoni-blue: #002147` | `--color-primary: #0A1628` | Cambio de hex |
| `--color-leoni-blue-light: #0D3D66` | `--color-primary-light: #1E3A5F` | Cambio de hex |
| `--color-leoni-green: #00C853` | Eliminar | No existe en Stitch |
| `--color-leoni-black: #000000` | Eliminar | Usar `--color-primary` |
| `--color-leoni-dark: #1A2433` | Eliminar | Usar `--color-primary` |
| `--color-surface: #F4F6F9` | `--color-surface: #FBF8FA` | Cambio de hex |
| `--color-text-primary: #002147` | `--color-text-primary: #0A1628` | Cambio de hex |
| `--color-text-muted: #5A6880` | `--color-text-muted: #94A3B8` | Cambio de hex |
| `--color-border: #D1DCE8` | `--color-border: #CBD5E1` | Cambio de hex |

---

## 2. Color System

### 2.1 Core Brand Palette

| Token | Hex | Rol | Uso |
|---|---|---|---|
| `primary` | `#0A1628` | Deep Space Navy | Side nav bg, encabezados de pagina, branding, texto primario |
| `primary-light` | `#1E3A5F` | Midnight Blue | Hover sobre primary, encabezados de seccion |
| `accent` | `#2563EB` | Electric Blue | **Solo acciones interactivas**: botones primarios, focus rings, progress bars, nav activo, links |
| `accent-hover` | `#1D4ED8` | Electric Blue Dark | Hover de elementos accent |

**Regla**: Electric Blue (`#2563EB`) es **exclusivo para affordances interactivas**. Nunca para decoracion o estructura.

### 2.2 Surface Palette

| Token | Hex | Uso |
|---|---|---|
| `surface` | `#FBF8FA` | Fondo de pagina, area de contenido principal |
| `surface-container-lowest` | `#FFFFFF` | Fondo de cards, inputs, modales |
| `surface-container-low` | `#F5F3F5` | Divisiones sutiles, filas alternantes |
| `surface-container` | `#F0EDEF` | Fondo de sidebar, paneles secundarios |
| `surface-container-high` | `#EAE7E9` | Fondos de inputs deshabilitados, skeletons |
| `active-tint` | `#F0F4F8` | Estado activo/pressed, hover de filas en tabla |
| `grid-header-bg` | `#F8FAFC` | Fondo de encabezados de data grid |

### 2.3 Text Palette

| Token | Hex | Uso |
|---|---|---|
| `text-primary` | `#0A1628` | Headings, body text, contenido principal |
| `text-secondary` | `#64748B` | Texto de soporte, descripciones, headers de columna |
| `text-muted` | `#94A3B8` | Placeholders, texto deshabilitado, timestamps, meta |
| `text-inverse` | `#FFFFFF` | Texto sobre fondos oscuros |
| `on-surface-variant` | `#45474C` | Body text de enfasis medio |

### 2.4 Semantic Status Colors

Cada color semantico tiene 4 tokens: base, background (10% opacity), text, border.

| Estado | Base | Background | Text | Border | Casos de uso |
|---|---|---|---|---|---|
| **Success** | `#22C55E` | `rgba(34,197,94,0.10)` | `#15803D` | `#BBF7D0` | Aprobado, Firmado, Confirmado, Activo |
| **Warning** | `#F59E0B` | `rgba(245,158,11,0.10)` | `#92400E` | `#FDE68A` | Pendiente, En revision, Requiere atencion |
| **Info** | `#3B82F6` | `rgba(59,130,246,0.10)` | `#1E40AF` | `#BFDBFE` | Abierto, En curso, Cambios solicitados |
| **Danger** | `#EF4444` | `rgba(239,68,68,0.10)` | `#991B1B` | `#FECACA` | Rechazado, Cancelado, Error, Critico |
| **Neutral** | `#94A3B8` | `rgba(148,163,184,0.10)` | `#475569` | `#E2E8F0` | Cancelado, Cerrado, Inactivo |

---

## 3. Typography

**Font**: Inter exclusivamente. Fallbacks: `ui-sans-serif, system-ui, -apple-system, sans-serif`.

| Nivel | Tamano | Line Height | Weight | Letter Spacing | Uso |
|---|---|---|---|---|---|
| **H1** | 32px / 2rem | 1.2 | 700 Bold | -0.02em | Titulos de pagina |
| **H2** | 24px / 1.5rem | 1.3 | 600 SemiBold | -0.01em | Encabezados de seccion, valores KPI, titulos de modal |
| **H3** | 20px / 1.25rem | 1.4 | 600 SemiBold | -0.01em | Titulos de card, subsecciones |
| **Body LG** | 16px / 1rem | 1.5 | 400 Regular | 0 | Texto de cuerpo principal, valores de form |
| **Body MD** | 14px / 0.875rem | 1.5 | 400 Regular | 0 | **Texto por defecto** — celdas de tabla, opciones, UI general |
| **Body SM** | 13px / 0.8125rem | 1.4 | 400 Regular | 0.01em | Texto secundario, helper text, timestamps |
| **Label MD** | 12px / 0.75rem | 1 | 600 SemiBold | 0.05em | Labels de form, headers de columna (**siempre UPPERCASE**) |
| **Label SM** | 11px / 0.6875rem | 1 | 500 Medium | 0.02em | Micro labels, footnotes |

**Reglas**:
- **Body MD (14px) es el default** — todo texto general a menos que haya razon especifica.
- **Label MD siempre en UPPERCASE** — para headers de data grid, labels de form, labels de filtro.
- Nunca bajar de 11px (Label SM) — tablets en piso de planta deben ser legibles.

---

## 4. Spacing

**Unidad base**: 4px (`0.25rem`). Todos los valores son multiplos de 4px. No usar valores arbitrarios.

| Token | Valor | Pixeles | Uso |
|---|---|---|---|
| `xs` | `0.25rem` | 4px | Gap icon-to-text inline, padding interno de chips |
| `sm` | `0.5rem` | 8px | Gap entre elementos relacionados, padding de componentes compactos |
| `md` | `1rem` | 16px | Padding estandar (card body, form group), gutter de grid |
| `lg` | `1.5rem` | 24px | Spacing de seccion, margenes de pagina, padding de modal |
| `xl` | `2.5rem` | 40px | Breaks mayores, separacion vertical a nivel pagina |
| `gutter` | `1rem` | 16px | Gutter de columnas en grid de 12 |
| `margin` | `1.5rem` | 24px | Margen exterior de pagina |

### Layout Grid

- **Columnas**: 12-column fluid grid
- **Gutters**: 16px
- **Margins**: 24px
- **Max width**: ninguno (fluid, llena el espacio disponible tras sidebar)

### Modos de Densidad

| Modo | Padding Vertical | Caso de uso |
|---|---|---|
| **Standard** | `md` (16px) | Settings, forms, vistas de detalle |
| **High Density** | `sm` (8px) — 50% reduccion | Listas de empleados, tablas, data grids, logs de comedor |

---

## 5. Elevation & Depth

El sistema usa **tonal layering** como mecanismo primario. Shadows solo para elementos flotantes.

### Las 4 Estrategias

**1. Tonal Layering (preferido)**: Profundidad via colores de superficie.
```
Layer 0 (page bg):     --color-surface               #FBF8FA
Layer 1 (sidebar):     --color-primary                #0A1628  (dark nav)
Layer 2 (card):        --color-surface-container-lowest  #FFFFFF
Layer 3 (nested):      --color-surface-container-low  #F5F3F5
```

**2. Low-Contrast Outlines**: Todos los containers, cards, inputs usan `border: 1px solid var(--color-border)` (`#CBD5E1`).

**3. Elevation Shadows**: **Solo para elementos flotantes** (dropdowns, modales, tooltips).

| Nivel | Token | CSS | Uso |
|---|---|---|---|
| 0 | `shadow-none` | `none` | Default — cards, containers, elementos estaticos |
| 1 | `shadow-sm` | `0px 1px 3px rgba(10,22,40,0.04)` | Sticky headers, botones hover |
| 2 | `shadow-md` | `0px 4px 12px rgba(10,22,40,0.08)` | Dropdowns, date pickers, autocomplete |
| 3 | `shadow-lg` | `0px 8px 24px rgba(10,22,40,0.12)` | Modales, dialogs, side sheets |
| 4 | `shadow-xl` | `0px 16px 48px rgba(10,22,40,0.16)` | Overlays full-screen, alertas criticas |

**4. Inset Effect**: Estados activos usan `background: var(--color-active-tint)` (`#F0F4F8`), nunca shadow.

### Decision Tree

```
Elemento flotante? (dropdown, modal, tooltip)
  → SI: shadow-md (menus) o shadow-lg (modales)
  → NO: Es container/card/input?
    → SI: 1px border + tonal bg. SIN shadow.
    → NO: Es estado activo/pressed?
      → SI: background active-tint
      → NO: Solo tonal layering
```

---

## 6. Border Radius

| Token | Valor | Pixeles | Uso |
|---|---|---|---|
| `radius-sm` | `0.125rem` | 2px | Nav active indicator, inline code |
| `radius-default` | `0.25rem` | 4px | **Default** — buttons, inputs, cards, dropdowns, chips |
| `radius-md` | `0.375rem` | 6px | Dropdown menus, date pickers, toasts |
| `radius-lg` | `0.5rem` | 8px | Modales, dialogs, KPI cards |
| `radius-xl` | `0.75rem` | 12px | Paneles a nivel pagina |
| `radius-full` | `9999px` | Pill | Status badges, avatares, toggles |

### Mapping Componente → Radius

| Componente | Radius | Nota |
|---|---|---|
| Todos los botones | `default` (4px) | |
| Text input, select | `default` (4px) | |
| Dropdown menu panel | `md` (6px) | |
| Card / Container | `lg` (8px) | |
| Modal / Dialog | `lg` (8px) | |
| Status chip / Badge | `full` (pill) | Siempre pill con `rounded-full` |
| Avatar | `full` (circle) | |
| Tooltip | `default` (4px) | |
| Toast | `md` (6px) | |
| Checkbox | `sm` (2px) | |

**Regla**: En caso de duda, usar `default` (4px). El sistema mantiene radii ajustados y uniformes.

---

## 7. Page Layout Templates

### 7.1 App Shell Structure

```
+------------------------------------------------------------------+
| [Sidebar 288px]  |  [Topbar h-16 sticky]                        |
| fixed left       |  Page Title    [Notifications] [User Menu]    |
| border-r         |------------------------------------------------|
| bg-white         |                                                |
|                  |  <main class="py-10">                         |
| Logo (h-16)      |    <div class="px-4 sm:px-6 lg:px-8">        |
| Nav Primary       |      {Page Content}                           |
| Nav Modules       |    </div>                                     |
| Nav Footer        |  </main>                                      |
+------------------------------------------------------------------+
```

```html
<!-- Desktop sidebar: fixed left, w-72 (288px) -->
<div class="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
  <div class="flex grow flex-col gap-y-5 overflow-y-auto border-r border-border bg-white px-6 pb-4">
    <!-- Logo + nav -->
  </div>
</div>

<!-- Main area: lienzo autenticado = degradado azul (`.rh-dashboard-page`).
     No usar `bg-surface` ni `bg-[#f6f8fb]` en el contenedor de página;
     esos tokens quedan para surfaces locales (cards, hover, stickies). -->
<div class="min-h-full rh-dashboard-page lg:pl-72">
  <div class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-border bg-white px-4 shadow-xs sm:gap-x-6 sm:px-6 lg:px-8">
    <!-- Topbar -->
  </div>
  <main class="{mainClass}">
    <div class="px-4 sm:px-6 lg:px-8">{content}</div>
  </main>
</div>
```

`mainClass` default: `py-10`. Para listas admin densas: `py-5 sm:py-6`.

**Fondo de contenido autenticado:** siempre `.rh-dashboard-page` (radial + linear azul definido en `style.css`). El token `RH_LISTADO_PAGE_OUTER` es alias de `RH_LISTADO_PAGE_OUTER_GRADIENT` (layout sin pintar fondo). Login y pantallas sin app shell no usan este lienzo.

### 7.2 Layout A — Dashboard

KPI Cards + Lower Section. Usado por: Dashboard (todas las vistas por rol).

```
[Intro text / date]
[KPI Card] [KPI Card] [KPI Card]    ← grid-cols-1 md:grid-cols-2 xl:grid-cols-3
[KPI Card] [KPI Card] [KPI Card]
[Calendar]         | [Activity List]  ← grid-cols-1 lg:grid-cols-2
```

### 7.3 Layout B — Admin List

Stats + Filters + Data Grid. Usado por: Solicitudes, Incidencias, Actas, Empleados.

```
[Header: subtitle + action buttons]
[Stat Card] [Stat Card] [Stat Card] [Stat Card]  ← grid-cols-1 sm:2 xl:4
[Filter Bar: selects + search + clear]
[Data Table with sticky header]
[Pagination: range | page size | page buttons]
```

### 7.4 Layout C — Detail / Profile

Header + Tabs + Content. Usado por: Vista 360, Acta detalle, PDI/Career detail.

```
[Profile Header Card: Avatar + Name + Meta + Actions]
[Tab Bar: Resumen | Incidencias | Historial | ...]
[Tab Panel Content: Card Grid or Detail Sections]
```

### 7.5 Layout D — Configuration / Form

Step indicator + Sections. Usado por: Competency Matrix, Position Profiles, PDI.

```
[Page Header with title + description]
[Step indicator or Tab switcher]
[Form Section 1: grouped fields]
[Form Section 2: matrix/grid editor]
[Footer: Cancel | Save Draft | Submit]
```

### 7.6 Layout E — Auth

Sin shell. Login page con split layout.

```
[Left: form panel, centered, max-w-sm] | [Right: hero image, hidden mobile]
```

---

## 8. Component Catalog

Todos los componentes generan HTML strings via funciones TypeScript. Los tokens de clase se centralizan en `frontend/src/ui/uiTokens.ts`.

### 8.1 Sidebar Navigation

**States:**

| Estado | Link Classes | Icon Classes |
|---|---|---|
| Inactive | `group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold text-text-primary hover:bg-surface hover:text-accent` | `size-6 shrink-0 text-text-muted group-hover:text-accent` |
| Active | `group flex gap-x-3 rounded-md bg-surface p-2 text-sm/6 font-semibold text-accent` | `size-6 shrink-0 text-accent` |

**Role-based**: Items filtrados por `isShellNavItemVisibleForRol(rol, itemId)`.
- `empleado`: menú agrupado en tres secciones estáticas — **Mis trámites** (solicitudes, horas extra*), **Pendientes** (mis firmas, aprobaciones de OPL, aprobar horas extra*, encuestas de curso, encuestas de RH, evaluaciones 360) y **Mi desarrollo** (mis metas, mi desempeño), con Dashboard y Comedor sueltos arriba (acceso directo, sin sección). (*) sujeto a permiso de nómina.
- `supervisor` (y `gerente`): cinco secciones — **Mi equipo** y **Talento del equipo** estáticas, **Mis trámites**, **Pendientes** y **Mi desarrollo** plegables, con Dashboard y Comedor sueltos arriba (acceso directo, sin sección). No ve actas ni reportes.
- `rh`: acceso completo + organigrama

**Responsive**: `lg+` = fixed left column. `<lg` = `<dialog>` slide-in overlay.

**Secciones del sidebar**: dos variantes, y un mismo menú puede mezclarlas.

| Variante | Cuándo | Implementación |
|---|---|---|
| Estática | Lo que el rol usa a diario | Encabezado `navSectionHeadingClass` + `<ul>`. Todo visible, sin taps extra. |
| Plegable | Lo secundario para ese rol | `<details>` por sección, abierta la que contiene la ruta activa. |

El criterio es **la frecuencia de uso, no el número de ítems**: el supervisor tiene sus dos secciones de equipo estáticas y las tres personales plegables, aunque sumen 19 ítems.

**Una sección plegable que queda con un solo ítem visible pierde el acordeón**: dos niveles y un clic extra no aportan jerarquía para un único enlace, y los ítems se filtran por permiso, así que a muchos usuarios les queda uno solo. Cómo se sustituye depende del menú, porque su gramática es distinta:

| Menú | Sustitución | Por qué |
|---|---|---|
| Supervisor / empleado | Sección **estática** (encabezado + ítem), vía `renderFlatNavSection` | Todos los grupos llevan encabezado; sin él el enlace flota suelto entre ellos |
| RH estructurado | Enlace de primer nivel con el nombre y el icono del **ítem** | Su sidebar es una lista plana de hubs, sin encabezados de sección |

Las secciones plegables del supervisor se envuelven en el mismo `<ul class="-mx-2 mt-2 …">` que usan las estáticas (`wrapSupervisorCollapsible`). Sin esa envoltura se cuelgan del `<ul>` del shell, pierden el `-mx-2` y **todo el bloque queda 8px a la derecha** del resto del menú. En RH no hace falta: `sectionLis` ya vive dentro de un `<ul>` con `-mx-2`.

El encabezado plegable **no lleva fondo al abrirse**: competiría con el ítem activo, que es el único que debe verse seleccionado. El estado abierto lo comunica el chevron. Los subítems se leen como subordinados por tamaño y color (`lg:min-h-9`, `text-text-secondary`, icono `size-4`), no por indentación sola, y no llevan la barra `before:` del activo de primer nivel: quedaría pegada a la guía vertical y se leerían como dos líneas paralelas. La guía usa `border-border`, no un azul, para no competir con el estado activo.

Toda sección plegable **necesita icono**. El encabezado estático lleva `md:max-lg:hidden`, así que en el rail de tablet desaparece; una sección plegable sin icono se quedaría sin ningún control visible y sus ítems serían inalcanzables. De dónde sale ese icono depende de quién arma la sección: RH (`rhNav.ts`) usa el icono propio del hub (`LABORALES_SIDEBAR_ITEM.svgPaths`, `COMEDOR_SIDEBAR_ITEM.svgPaths`, etc.), mientras que el supervisor reusa el icono de su primer ítem.

### 8.2 Topbar

- Sticky, `h-16`, `z-40`
- Hamburger mobile (`lg:hidden`)
- Page title (truncated)
- Notifications dropdown
- User profile dropdown (avatar initials + name)

### 8.3 Buttons

Cuatro variantes definidas en `uiTokens.ts`:

| Variante | Fondo | Borde | Texto | Uso |
|---|---|---|---|---|
| **Primary** | `accent` (#2563EB) | none | white | Accion principal: Nueva solicitud, Confirmar |
| **Secondary** | white | `border` (#CBD5E1) | `text-primary` | Exportar, Cancelar |
| **Ghost** | white | `border` (#CBD5E1) | `text-secondary` | Limpiar filtros, acciones terciarias |
| **Danger** | `#EF4444` | none | white | Rechazar, Eliminar |

**Tamanos** (Stitch): Small (28px height), Medium (36px), Large (44px).
**Radius**: `default` (4px) para todos.
**Focus**: `focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2`.
**Disabled**: `disabled:cursor-not-allowed disabled:opacity-60`.

### 8.4 Data Grid / Table

```html
<section class="rounded-xl border border-border bg-white shadow-sm ring-1 ring-slate-900/5">
  <table class="min-w-[920px] w-full text-left">
    <thead class="border-b border-primary-light shadow-sm">
      <tr class="text-white">
        <th class="sticky top-0 z-20 bg-primary px-3 py-2 text-left text-xs font-semibold uppercase">
          {Header}
        </th>
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-100/90">
      <tr class="cursor-pointer hover:bg-active-tint" tabindex="0" role="button">
        <td class="px-3 py-2.5 align-middle">{Cell}</td>
      </tr>
    </tbody>
  </table>
</section>
```

**Header**: `bg-primary` con texto blanco, sticky top, `text-xs font-semibold uppercase`.
**Rows**: 40px height (standard density), clickable con `cursor-pointer hover:bg-active-tint`.
**Data attributes**: `data-rh-{module}-id="{id}"` para event delegation.

### 8.5 Status Chip / Badge

Patron unificado: pill con dot indicator. Definidos como funciones en `uiTokens.ts`.

```html
<span class="inline-flex items-center gap-1.5 rounded-full border border-{color}-200 bg-{color}-50 px-2 py-0.5 text-xs font-semibold text-{color}-900">
  <span class="size-1.5 shrink-0 rounded-full bg-{color}-{shade}" aria-hidden="true"></span>
  {Label}
</span>
```

| Funcion | Color | Caso de uso |
|---|---|---|
| `badgePending` | amber | Pendiente, necesita atencion |
| `badgeApproved` | emerald | Aprobado, Firmado, Confirmado |
| `badgeRejected` | red | Rechazado, Critico |
| `badgeCancelled` | slate | Cancelado, Cerrado |
| `badgeChangesRequested` | sky | Cambios solicitados, En revision |
| `badgeOpen` | blue | Abierto, En curso |
| `badgeInProgress` | amber (500 dot) | En investigacion |
| `badgeOverridden` | emerald | Override administrativo |

**Priority badges** (variante uppercase bold): CRITICA (solid red bg/white text), ALTA (red-50), MEDIA (orange-50), BAJA (slate-100).

**Categorical badges** (distinto de los de estado). Cuando el badge no marca un *estado*
sino una *categoria* --el tipo de incidencia en la pagina Incidencias, con sus 10
valores-- los 5 colores semanticos no alcanzan y ademas significan otra cosa. Para esos
casos se usa una paleta **categorica**, no semantica:

- Los hues salen de una paleta validada por separacion perceptual: banda de luminosidad,
  piso de croma, separacion para daltonismo (protan/deutan/tritan) y contraste sobre la
  superficie. No se eligen a ojo.
- Los derivados pastel de cada pill (texto, fondo, borde) se calculan desde el hue base
  mezclando con blanco/negro en proporciones fijas, para que los 10 se vean como una
  familia y no como 10 decisiones sueltas.
- El texto de cada pill queda en **AA (>= 4.5:1) sobre su propio fondo**; se verifica,
  no se asume.
- El pill **siempre** muestra la etiqueta escrita. El color refuerza la lectura pero
  nunca es el unico identificador --requisito de accesibilidad y lo que permite usar 10
  categorias, porque a partir de ~8 hues no todos los pares son distinguibles entre si--.

Implementacion de referencia: `rh-inc-type-pill--t-<tipo>` en `style.css`, mapeadas en
`frontend/src/faltasRetardos/rh/constants.ts`.

### 8.6 KPI Card

**Variante A — Dashboard (grande, con icon + progress + pills):**

```html
<article class="flex h-full flex-col rounded-2xl border border-border bg-white p-5 shadow-sm">
  <div class="flex items-start justify-between gap-3">
    <h2 class="text-sm font-medium text-text-muted">{title}</h2>
    <div class="rounded-xl p-2 {accent-bg-class}">
      <svg class="size-6"><!-- icon --></svg>
    </div>
  </div>
  <p class="mt-2"><span class="{primaryClass}">{value}</span></p>
  <!-- progress bar, pills, action link opcionales -->
</article>
```

**Icon accent mapping**: `bg-blue-500/10 text-blue-600`, `bg-orange-500/10 text-orange-600`, etc.

**Variante B — Summary stat (compacta, para listas admin):**

```html
<article class="rounded-xl border border-border border-t-4 border-t-{color} bg-white p-3 shadow-sm sm:p-4">
  <div class="flex items-center justify-between gap-2">
    <h2 class="text-xs font-medium text-text-muted sm:text-sm">{title}</h2>
    <p class="text-2xl font-bold tabular-nums tracking-tight text-text-primary sm:text-3xl">{value}</p>
  </div>
</article>
```

**Variante C — Stat-filter card (stat que además filtra el listado):**

Tarjeta-botón que unifica una métrica con su filtro: el conteo informa y el click
aplica el filtro correspondiente. Sustituye el par redundante "stat cards + chips
de filtro" cuando ambos representan los mismos segmentos. Usado en: Permisos RH.

```html
<section class="grid grid-cols-2 gap-3 sm:grid-cols-4" role="group" aria-label="Filtrar por {dimensión}">
  <button type="button" data-filter="{value}" aria-pressed="{isActive}"
    class="group flex flex-col gap-2 rounded-[14px] border p-4 text-left transition
           {isActive
             ? 'border-leoni-blue bg-[rgba(219,234,254,0.45)] shadow-[0_6px_18px_rgba(30,64,175,0.12)]'
             : 'border-[rgba(148,163,184,0.24)] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:border-leoni-blue/40 hover:bg-slate-50/70'}
           focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue/40 focus-visible:ring-offset-2">
    <span class="flex items-center gap-2">
      <span class="size-2 shrink-0 rounded-full {dot-color}" aria-hidden="true"></span>
      <span class="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</span>
    </span>
    <span class="text-2xl font-bold tabular-nums text-text-primary">{count}</span>
  </button>
</section>
```

- **Estado activo**: borde + tinte `leoni-blue`, obligatorio `aria-pressed`. El segmento
  "Total" representa el filtro vacío (sin filtro).
- **Dot de color**: refuerza el significado del segmento reutilizando los tonos de los
  status badges (emerald/amber/slate; `bg-leoni-blue` para "Total").

### 8.7 Form Field

**Text input:**

```html
<div>
  <label for="{id}" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">{Label}</label>
  <input id="{id}" type="text"
    class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
    placeholder="{placeholder}" />
</div>
```

**Select**: Grid-based con chevron SVG overlay (`SELECT_CHEVRON` en `uiTokens.ts`).
**Focus token (`FIELD_FOCUS`)**: Ring + outline hacia accent color.
**Checkbox**: `appearance-none rounded-sm border border-border checked:border-accent checked:bg-accent`.

**Tokens de formulario vs. tokens de filtro de listado** — mismo propósito visual, contextos distintos, no intercambiables:

| | Formulario (modal / detalle) | Filtro de listado |
|---|---|---|
| Label | `FORM_LABEL` — uppercase, `tracking-wide`, `text-text-muted` | `RH_LISTADO_LABEL` — sin uppercase, `text-[#667085]` |
| Select | `FORM_SELECT` — `rounded-lg`, `border-slate-200`, usa `FIELD_FOCUS` | `RH_LISTADO_SELECT` — `rounded-[10px]`, `border-[#e5e7eb]`, sin focus propio (usa `RH_LISTADO_FOCUS_RING`) |

Ambos pares viven en `uiTokens.ts`. `FORM_SELECT` se usa dentro de un wrapper `relative` junto a `SELECT_CHEVRON`, igual que el patrón existente en `encuestasRh.ts` / `encuestasRhResultados.ts`.

**Combobox server-side (catálogos grandes):** Para pickers que buscan en API (p. ej. tareas del catálogo en «Editar tareas»):

- Input: `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls` → listbox.
- Listbox: `role="listbox"`, opciones `role="option"`; `shadow-md`, `max-h-52`.
- No mostrar sugerencias hasta ≥1 carácter; debounce ~300 ms; `AbortController` en requests sucesivos.
- Teclado: ↑↓ navegar, Enter seleccionar, Escape cerrar dropdown (no el modal).
- Filtros adicionales (tipo/categoría) acotan la consulta; no disparan lista sin texto.
- Referencia: `editarTareasModal.ts`, `solicitudesNuevaIncidenciaModalUi.ts`.

### 8.8 Modal / Dialog

```html
<div id="{id}-overlay"
     class="fixed inset-0 z-[60] hidden items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[3px]">
  <div class="flex max-h-[min(92vh,900px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-lg"
       role="dialog" aria-modal="true">
    <header class="shrink-0 border-b border-slate-100 px-5 pb-4 pt-5 sm:px-8">
      <!-- Title + close button -->
    </header>
    <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8">
      <!-- Body -->
    </div>
    <footer class="shrink-0 border-t border-slate-100 px-5 py-4 sm:px-8">
      <!-- Actions: BTN_SECONDARY + BTN_PRIMARY -->
    </footer>
  </div>
</div>
```

Open/close: toggle entre `hidden` y `flex`. Cerrar con Escape, click overlay, o boton close.

### 8.9 Tabs

```html
<div role="tablist" class="flex flex-wrap gap-x-8 gap-y-1 border-b border-slate-200/70">
  <!-- Active -->
  <button role="tab" aria-selected="true"
    class="-mb-px border-b-2 border-accent px-1 py-3 text-sm font-semibold text-accent">
    {Label}
  </button>
  <!-- Inactive -->
  <button role="tab" aria-selected="false"
    class="-mb-px border-b-2 border-transparent px-1 py-3 text-sm font-semibold text-slate-500 hover:text-text-primary">
    {Label}
  </button>
</div>
```

**Helpers en `uiTokens.ts`**: `tabButton(active: boolean)` devuelve las clases de un tab individual (evita triplicar el string en cada página). `renderTabNav(tabs, activeId, opts?)` arma la barra completa (`role="tablist"` + botones `role="tab"` con `data-tab="{id}"` para event delegation); no incluye el panel asociado.

### 8.10 Filter Bar

```html
<section class="rounded-xl border border-border bg-white p-3 shadow-sm ring-1 ring-slate-900/5 sm:p-4">
  <div class="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-2 sm:gap-x-3 xl:flex-nowrap">
    <div class="min-w-0 w-full flex-1 basis-full sm:basis-[calc(50%-0.375rem)] lg:min-w-[9rem] lg:basis-0">
      <!-- Select or input -->
    </div>
    <!-- Clear filters button -->
  </div>
</section>
```

**Responsive**: Full-width stacked (mobile) → 2-col (sm) → single scrollable row (xl).

### 8.11 Pagination

- Left: "Mostrando X - Y de Z" + selector de tamano de pagina
- Right: botones de pagina con ellipsis
- Active page: `bg-primary text-white rounded-lg`
- Inactive: `text-slate-600 hover:bg-slate-100 hover:text-accent`
- Pagina generada por `paginationRange()` en `uiUtils.ts`

### 8.12 Progress Bar

```html
<div class="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar"
     aria-valuenow="{%}" aria-valuemin="0" aria-valuemax="100">
  <div class="h-full rounded-full bg-accent transition-all" style="width:{%}%"></div>
</div>
```

### 8.13 Avatar

| Contexto | Tamano | Shape |
|---|---|---|
| Topbar | `size-8` | Circle, `bg-primary-light text-white` |
| Table row | `size-9` | Circle, `bg-primary-light text-white` |
| Profile header | `size-24 sm:size-28` | `rounded-2xl`, `bg-primary-light text-white` |

Iniciales calculadas del nombre. Si hay foto: `<img class="rounded-full object-cover ring-1 ring-slate-200" />`.

### 8.14 Timeline (Approval Flow)

Vertical line con circulos por paso: completed (emerald), current (accent outline), future (border-only).

### 8.15 Empty State

```html
<!-- En tabla -->
<td colspan="{n}" class="px-3 py-10 text-center text-sm text-slate-500">
  No se encontraron registros.
</td>

<!-- En seccion (dashed border) -->
<div class="rounded-xl border border-dashed border-border/90 bg-slate-50/40 py-8 text-center">
  <p class="text-sm font-semibold text-text-primary">{Title}</p>
  <p class="mt-1.5 text-xs text-text-muted">{Explanation}</p>
</div>
```

**Error con reintento**: `errorState({ message, actionLabel?, actionAttrs? })` en `uiTokens.ts` — surface (`RH_LISTADO_SURFACE`) con `role="alert"`, mensaje en rojo y, si se pasa `actionLabel`, un botón `BTN_SECONDARY` con los `actionAttrs` crudos (p. ej. `data-action="retry"`). Reemplaza los bloques de error repetidos que hoy no ofrecen reintento.

### 8.16 Loading State

**Spinner inline:**
```html
<svg class="size-5 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
</svg>
```

**Skeleton**: `animate-pulse` con `bg-slate-200` (headers) y `bg-slate-100` (body). Helper `skeletonBlock(opts?: { className?; label? })` en `uiTokens.ts`: surface con `animate-pulse`, `aria-busy="true"` y `<span class="sr-only">` con el label (default "Cargando…"); usa `RH_LISTADO_SURFACE` salvo que `className` la sustituya.

### 8.17 Alert / Banner

| Tipo | Border | Background | Text |
|---|---|---|---|
| Error | `border-red-200` | `bg-red-50` | `text-red-800` |
| Warning | `border-amber-200` | `bg-amber-50` | `text-amber-900` |
| Info | `border-blue-200` | `bg-blue-50` | `text-blue-800` |
| Success | `border-emerald-200` | `bg-emerald-50` | `text-emerald-800` |

Helpers en `uiTokens.ts` (misma estructura/rounded/padding, mensaje interpolado con `escapeHtml`): `alertSuccess(message, role = "status")`, `alertError(message, role = "alert")`, `alertInfo(message, role = "status")`, `alertWarning(message, role = "alert")`.

### 8.18 Fila editable con guardado individual

Tabla donde cada fila es un mini-formulario con su propio boton Guardar (sin modal). Usado
en: Ajustes Comedor (horario de comida por turno).

```html
<!-- Fila con cambios sin guardar -->
<tr class="hover:bg-active-tint bg-amber-50/40" data-{modulo}-row="{id}">
  <td class="px-3 py-2.5 align-middle">
    <div class="flex flex-col gap-0.5">
      <span class="font-mono text-xs font-semibold text-text-primary">{codigo}</span>
      <span class="text-sm text-text-secondary">{descripcion}</span>
      <span data-{modulo}-sin-guardar
        class="text-[11px] font-semibold uppercase tracking-wide text-amber-600">Sin guardar</span>
    </div>
  </td>
  <!-- inputs de la fila -->
  <td class="px-3 py-2.5 text-right">
    <button type="button" data-{modulo}-guardar="{id}"
      class="{BTN_SECONDARY} !px-3 !py-1.5 disabled:cursor-not-allowed disabled:opacity-60">Guardar</button>
  </td>
</tr>
```

**Reglas que hacen que no pierda trabajo** (las tres son obligatorias):

1. **Borradores en el estado.** Lo capturado y no guardado vive en el estado
   (`borradores: Record<id, {...}>`), no solo en el DOM. Sin esto, filtrar o buscar
   repinta desde los datos del servidor y descarta en silencio lo que el usuario escribio.
2. **Guardar no repinta la tabla.** Se toca solo la fila afectada (boton a `disabled` +
   "Guardando…", inputs actualizados con la respuesta del servidor). Un repintado
   global perderia las ediciones pendientes de las **otras** filas.
3. **La marca «Sin guardar» se aplica en vivo**, en el handler de `input`, no esperando al
   siguiente render: sirve justo mientras se captura. Se retira sola si el valor vuelve a
   coincidir con lo guardado.

**Derivados en vivo**: si una celda muestra un calculo de los campos de la fila (duracion,
total), se recalcula en el mismo handler de `input` reemplazando solo esa celda.

**Cuando NO usarlo**: si la edicion tiene mas de ~3 campos o requiere validacion cruzada
compleja, usar modal (§8.8). Esta variante es para ajustes cortos y repetitivos donde
abrir un modal por fila seria mas lento que editar en linea.

---

## 9. Interaction Patterns

### 9.1 Navigation

- **Hash-based SPA routing**: `window.location.hash` → `shellRouter.ts` → `mount{Page}()`.
- **Deep linking**: `#/empleados/42`, `#/actas/15`.
- **Page title sync**: `document.title = "{page} — Plataforma RH"`.

### 9.2 CRUD Operations

1. **List**: Tabla con filas clickable → abre modal segun `estado`
2. **Detail**: Modal con datos read-only + acciones (aprobar/rechazar)
3. **Create**: Boton primary → modal con form → submit → toast → reload
4. **Update**: Modal con form pre-llenado → submit → toast → reload

### 9.3 Filtering & Search

- Event delegation via `data-rh-{module}-filter="{name}"`
- Text search: 200ms debounce
- Estado mutable: `state` object → reset page 1 → `paint()`
- "Limpiar filtros": solo visible cuando hay filtros activos

### 9.4 Multi-Step Workflows

Para PDI, enrollment de capacitacion, configuracion de competencias:

1. Step indicator (circulos numerados + lineas)
2. "Siguiente"/"Anterior" con validacion por paso
3. Persistencia de draft parcial
4. Paso final: summary + "Confirmar"
5. Exito: toast + navegacion a lista

### 9.5 Feedback

- **Toast**: `fixed top-20 right-6 z-[70]`, auto-dismiss 4-5s
- **Inline validation**: `<p class="mt-1 text-xs text-red-600">{msg}</p>` debajo del input
- **Button loading**: disabled + texto "Guardando..."
- **Error 401**: redirect automatico a login

### 9.6 Role-Based Views

Roles: `empleado`, `supervisor`, `gerente`, `rh`, `director`.

- Sidebar: items removidos del DOM (no hidden)
- Route guards: hash no autorizado → redirect a `#/`
- Dashboard: variante por rol (RH ops, lider team, empleado personal)
- Acciones: botones condicionalmente renderizados segun `pageUi`

---

## 10. Responsive Rules

### Breakpoints

| Token | Min Width |
|---|---|
| base | 0px |
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |
| `2xl` | 1536px |

### Adaptaciones por Componente

| Componente | Mobile (<640) | Tablet (640-1023) | Desktop (>=1024) |
|---|---|---|---|
| Sidebar | `<dialog>` overlay | `<dialog>` overlay | Fixed left w-72 |
| User menu | Solo avatar | Solo avatar | Avatar + name + chevron |
| KPI cards | 1 col | 2 col | 3 col |
| Stat cards | 1 col | 2 col | 4 col |
| Filter fields | Stacked vertical | 2-col wrap | Single row scroll |
| Table | Scroll horizontal | Scroll horizontal | Fits, sticky header |
| Pagination | Stacked | Row wrap | Single row |
| Modal | Near full-screen | Centered wide | Centered max-w-xl |
| Login | Full-width form | Full-width form | Split form + hero |

---

## 11. Icons & Illustrations

### Icon Library

**Heroicons** (outline style, 24x24 viewBox). Todos inlined como SVG, no font ni sprite.

```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" class="{size}">
  <path stroke-linecap="round" stroke-linejoin="round" d="{path}" />
</svg>
```

### Tamanos

| Contexto | Clase | Pixeles |
|---|---|---|
| Nav sidebar, topbar | `size-6` | 24px |
| KPI card accent | `size-6` | 24px |
| Button inline icon | `size-5` | 20px |
| Meta, labels | `size-4` | 16px |
| Pagination arrows | `size-4` | 16px |

### Colores

Icons heredan via `currentColor`. Color controlado por clases de texto del padre.

### Cuando usar Icons vs Text

| Escenario | Approach |
|---|---|
| Navigation items | Icon + text label (siempre pareados) |
| Acciones primarias | Label de texto requerido; icon opcional |
| Status indicators | Badge con dot + texto (nunca solo icon) |
| Headers de columna | Solo texto |
| Topbar actions | Icon con `sr-only` text para accessibility |
| Empty states | Solo texto (sin ilustraciones decorativas) |

### Illustrations

Sin ilustraciones decorativas. Empty states usan solo texto. Login usa foto hero (`/login-hero.png`).

---

## 12. Level Up — Extended Design Tokens

> Extensiones del design system para el modulo Level Up (desarrollo, capacitacion, matrices de capacidades/habilidades, OPLs, evidencias, encuestas). Estos tokens se agregan al sistema existente sin reemplazarlo.

### 12.1 Heatmap / Capability Level Scale

Escala de 5 niveles para matrices de capacidades. Usada en celdas de heatmap y barras de progreso por colaborador.

```css
:root {
  /* ── Capability Levels (navy scale) ──────────────────── */
  --level-0:          #F0EDEF;  /* N/A — sin dato */
  --level-0-text:     #94A3B8;
  --level-1:          #E2E8F0;  /* 1 — Inicial */
  --level-1-text:     #475569;
  --level-2:          #CBD5E1;  /* 2 — Basico */
  --level-2-text:     #334155;
  --level-3:          #93C5FD;  /* 3 — Competente */
  --level-3-text:     #FFFFFF;
  --level-4:          #2563EB;  /* 4 — Avanzado */
  --level-4-text:     #FFFFFF;
  --level-5:          #0A1628;  /* 5 — Experto */
  --level-5-text:     #FFFFFF;

  /* ── Gap indicator ───────────────────────────────────── */
  --level-gap:        #EF4444;  /* Borde de brecha */
  --level-gap-bg:     rgba(239, 68, 68, 0.08);
}
```

**Tailwind utilities** (agregar a `style.css` como `@layer utilities`):

```css
@layer utilities {
  .heat-0 { background: var(--level-0); color: var(--level-0-text); }
  .heat-1 { background: var(--level-1); color: var(--level-1-text); }
  .heat-2 { background: var(--level-2); color: var(--level-2-text); }
  .heat-3 { background: var(--level-3); color: var(--level-3-text); }
  .heat-4 { background: var(--level-4); color: var(--level-4-text); }
  .heat-5 { background: var(--level-5); color: var(--level-5-text); }
  .heat-gap { box-shadow: inset 0 0 0 2px var(--level-gap); }
}
```

### 12.2 Skill Level Scale (4 niveles)

Para matrices de habilidades. Representada como barras discretas (no heatmap continuo).

| Nivel | Valor | Label | Color de barra |
|---|---|---|---|
| 1 | 25% | Basico | `--color-border` (#CBD5E1) |
| 2 | 50% | Intermedio | `--color-text-secondary` (#64748B) |
| 3 | 75% | Avanzado | `--color-accent` (#2563EB) |
| 4 | 100% | Experto | `--color-primary` (#0A1628) |

Barra con brecha: usar `--color-accent` en vez de `--color-primary` cuando `nivel_actual < nivel_requerido`.

### 12.3 Escala ordinal continua (ejes)

Para **ejes cuyo orden significa algo** — el eje de global grades del mapa WTW, donde a la
derecha pesa más. Es la misma familia navy de §12.1, en versión continua para ejes de
longitud variable.

`frontend/src/ui/escalaOrdinal.ts`:

| Uso | Función | Recorrido |
|---|---|---|
| Fondo de columna | `tinteOrdinalFondo(i, total)` | 5% → 27% de `--color-primary` sobre blanco |
| Chip del encabezado | `tinteOrdinalChip(i, total)` | 14% → 100%, con el texto invertido pasado el 55% |

```ts
style="background: ${tinteOrdinalFondo(i, total)};"
```

Reglas:
- **Rampa, no paleta.** Colores sueltos por columna dirían que son alternativas equivalentes;
  en un eje ordinal son grados de lo mismo. Es la razón por la que el mapa WTW no reproduce
  el morado/naranja/azul de la lámina original: ahí el color distingue *categorías*, aquí
  tiene que ordenar.
- **No se escriben valores**: se interpola con `color-mix` entre tokens existentes, así que
  la rampa sigue a la marca si cambia.
- **El tinte va en el fondo de la columna, no en el contenido.** Así el color codifica el eje
  y lo que se apoya encima queda como figura, con contraste constante. Por eso el fondo se
  queda por debajo del 30% de tinta.
- **El texto sobre la rampa se invierte** pasado `UMBRAL_TEXTO_INVERTIDO`; hay un test que lo
  comprueba en toda la rampa, porque el contraste no puede depender de dónde caiga la columna.

### 12.4 Monospace Font Token

Para IDs, codigos, valores numericos tabulares en matrices y tablas de Level Up:

```css
:root {
  --font-family-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, monospace;
}
```

**Tailwind**: `font-mono` ya mapea a este valor. Usar clase `.tabular-nums` para alineacion numerica.

**Uso**: IDs de OPL (`OPL-2041`), codigos de capacidad (`CR-01`), scores (`4.6`), porcentajes en matriz, versiones (`v4`).

### 12.4 Status Tones — Level Up Specific

Extensiones al sistema de badges existente para estados de Level Up:

| Estado | Mapeo a badge existente | Ejemplo |
|---|---|---|
| Completada | `badgeApproved` (emerald) | Capacitacion completada |
| En curso | `badgePending` (amber) | Capacitacion activa |
| Pendiente | `badgeOpen` (blue) | Pendiente de programar |
| Vencida | `badgeRejected` (red) | Capacitacion vencida |
| Sugerido | `badgeChangesRequested` (sky) | Sugerencia del motor |
| Vigente | `badgeApproved` (emerald) | OPL vigente |
| Reentrenamiento | `badgePending` (amber) | OPL requiere reentrenamiento |
| Borrador | `badgeOpen` (blue) | OPL en revision |
| En revision | `badgePending` (amber) | Evidencia en bandeja |
| Esperando firma | `badgeOpen` (blue) | Evidencia esperando siguiente firma |
| Devuelta | `badgeRejected` (red) | Evidencia rechazada |

---

## 13. Level Up — Layout Templates

### 13.1 Layout F — Operational Dashboard (Level Up)

KPIs con sparklines + grid de 2 columnas + fila inferior. Usado por: Dashboard Level Up (#1).

```
[Page Header: eyebrow + title + description + actions]
[KPI] [KPI] [KPI] [KPI]                    ← grid-cols-1 sm:2 xl:4, con sparkline
[Brechas por area (barras)]  | [Proximas capacitaciones (timeline)]  ← grid 1.35fr 1fr
[Evidencias pendientes (tabla)] | [Sugerencias (cards)]              ← grid 1.35fr 1fr
```

**KPI card con sparkline:**

```html
<article class="rounded-xl border border-border bg-white p-4 shadow-sm flex flex-col gap-2.5">
  <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
  <div class="flex items-end justify-between gap-3">
    <p class="text-3xl font-bold tabular-nums tracking-tight text-text-primary">
      {value}<sup class="ml-0.5 text-sm font-normal text-text-muted">{suffix}</sup>
    </p>
    <div class="flex items-end gap-0.5 h-7">
      <!-- Sparkline bars -->
    </div>
  </div>
  <div class="flex items-center justify-between text-xs text-text-muted">
    <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold
      {delta > 0 ? 'bg-success-bg text-success-text' : 'bg-danger-bg text-danger-text'}">
      {delta}
    </span>
    <span>{subtitle}</span>
  </div>
</article>
```

### 13.2 Layout G — Matrix / Heatmap

Grid scrollable con header sticky y filas de colaboradores. Usado por: Matriz de capacidades (#2), Matriz de habilidades (#4).

```
[Page Header: eyebrow + title + sub + actions]
[Legend bar: niveles + marcadores + evaluador]
[Card container scrollable]
  [Grid: col-fija(persona) + col-fija(req) + cols-scroll(capacidades) + col-fija(score)]
[Footer summary: brechas detectadas, colaboradores afectados, capacidad critica]
```

**Heatmap cell:**

```html
<div class="grid place-items-center h-8 rounded text-xs font-bold font-mono
  heat-{nivel} {isGap ? 'heat-gap' : ''}"
  title="{capacidad} — Nivel {nivel}">
  {nivel}
</div>
```

**Legend row:**

```html
<div class="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface-container-low px-3 py-2.5 text-xs">
  <span class="font-semibold text-text-secondary">Nivel de dominio</span>
  <!-- Level swatches -->
  <span class="flex items-center gap-1.5">
    <span class="inline-block w-5 h-3.5 rounded heat-{n}"></span>
    <span class="text-text-muted">{n} · {label}</span>
  </span>
  <!-- Gap marker -->
  <span class="flex items-center gap-1.5">
    <span class="inline-block w-5 h-3.5 rounded border-2 border-danger"></span>
    <span class="text-text-muted">Brecha vs. perfil</span>
  </span>
</div>
```

### 13.3 Layout H — Master-Detail (Queue)

Panel izquierdo con lista seleccionable + panel derecho con detalle. Usado por: OPLs (#9), Evidencias (#10).

```
[Page Header + alert banner (si aplica)]
[Left panel 420px: tabs + scrollable list]  |  [Right panel flex-1: detail content]
```

**Queue item (selected state):**

```html
<div class="px-3.5 py-3 border-b border-border border-l-3
  {selected ? 'bg-active-tint border-l-accent' : 'border-l-transparent'}">
  <!-- Row 1: ID + type badge + priority -->
  <!-- Row 2: title -->
  <!-- Row 3: avatar + name + meta -->
</div>
```

### 13.4 Layout I — Catalog Cards Grid

Grid de tarjetas enriquecidas con KPIs integrados. Usado por: Perfiles de puesto lista (#5), Catalogo de cursos (#8).

```
[Page Header + actions]
[Summary KPIs: 4 cards compactas]           ← grid-cols-1 sm:2 xl:4
[Card container]
  [Toggle: Tarjetas | Tabla | Comparar]
  [Grid de cards: repeat(auto-fill, minmax(280px, 1fr))]
```

**Profile/Course card:**

```html
<article class="rounded-xl border border-border bg-white p-4 flex flex-col gap-3">
  <div class="flex items-center justify-between">
    <span class="font-mono text-xs text-text-muted">{code}</span>
    <span class="badge...">{cumplimiento}%</span>
  </div>
  <div>
    <h3 class="text-sm font-semibold text-text-primary">{nombre}</h3>
    <p class="text-xs text-text-muted mt-0.5">{area}</p>
  </div>
  <div class="grid grid-cols-2 gap-2 text-xs">
    <!-- Metrics: personas, cursos, OPLs, evidencias -->
  </div>
  <div class="mt-auto pt-3 border-t border-border flex items-center justify-between">
    <!-- Owner avatar + "Abrir" link -->
  </div>
</article>
```

### 13.5 Layout J — Suggestion Cards (Horizontal)

Cards horizontales con justificacion dual y acciones. Usado por: Motor de sugerencias (#11).

```
[Page Header + actions]
[KPI strip: 4 cards]
[Scrollable list of suggestion cards]
```

**Suggestion card:**

```html
<article class="rounded-xl border border-border bg-white p-4
  grid grid-cols-[1.4fr_1fr_220px] gap-6 items-stretch
  {featured ? 'border-l-3 border-l-accent' : ''}">
  <!-- Col 1: badges + title + reason + tags + metrics -->
  <!-- Col 2: justification panel (brecha % bar + sector % bar + benchmark text) -->
  <!-- Col 3: priority stars + actions (Aprobar / Posponer / Descartar) -->
</article>
```

### 13.6 Layout K — Survey Results

Tabla de scores con barras de progreso + panel lateral de distribucion. Usado por: Encuestas post curso (#12).

```
[Page Header]
[KPI strip: 5 cards]                        ← grid-cols-2 sm:3 xl:5
[Left 1.55fr: Score table]  |  [Right 1fr: Distribucion + Comentarios]
```

---

### 13.3 Layout — Mapa de estructura

Franjas apiladas sobre un **eje ordinal compartido**: cada categoría es una fila y cada
elemento ocupa el ancho del tramo del eje que abarca. Usado por: Estructura WTW
(`#/puestos/wtw`), donde la fila es un career path y el elemento un career level sobre el
eje de global grades.

```
[Page Header]
[Nota del eje: qué significa la escala]
[Card por categoría]
  [Badge de la categoría + conteo]
  [Scroll horizontal]
    [Fila de encabezado: una columna por punto del eje, sticky]
    [Carril: elementos posicionados con grid-column: inicio / span n]
  [Bandeja ámbar: elementos sin posición en el eje]
```

Reglas:
- **El valor de la vista es la alineación entre franjas.** Todas comparten el mismo
  `grid-template-columns`, así que dos elementos de categorías distintas en la misma columna
  significan lo mismo. Si cada franja calculara sus columnas, la lectura se perdería.
- **El eje se recorta a lo ocupado.** Un punto que ninguna categoría usa solo agrega
  columnas vacías y empuja las franjas a un lado. Se recorta a la **cobertura** (la unión de
  los tramos), no a los puntos con dato: un elemento que abarque del 10 al 12 necesita la
  columna del 11 aunque nadie la haya declarado.
- **La posición se calcula contra el índice del punto en el eje, no contra su valor.** Al
  recortar, el eje queda con huecos en la numeración; buscar por valor colocaría mal las
  celdas.
- **Un solo contenedor de scroll para todas las franjas.** Con un scroll por franja, desplazar
  una desalinea las demás y se pierde lo único que la vista existe para enseñar. La etiqueta
  de cada categoría va en una columna `sticky left-0` para no perderse al desplazar.
- **El eje se colorea con la escala ordinal de §12.3.** Dos elementos con el mismo tinte están
  en la misma columna, así que el color acaba probando la alineación en lugar de solo
  decorar.
- **Los elementos que se solapan bajan a otro carril** (`talento/wtwCarriles.ts`,
  empaquetado greedy). Dibujarlos en la misma fila los haría pisarse y el gráfico diría algo
  falso. Un catálogo sano sale en un solo carril.
- **Lo que no se puede posicionar se muestra, no se oculta**: bandeja ámbar bajo el gráfico,
  con el mismo lenguaje que usa Ajustes («Sin equivalencia») y enlace a donde se corrige.
  Omitirlo haría creer que el catálogo está completo.
- **No se reproducen paletas de origen.** La lámina de WTW usa morado/naranja/azul por
  categoría; aquí las franjas usan capas tonales y la identidad la da el badge de la
  categoría — §2 prohíbe inventar colores y reserva el accent para lo interactivo.

## 14. Level Up — Component Patterns

### 14.1 Sparkline (mini bar chart)

Representacion compacta de tendencia dentro de KPI cards.

```html
<div class="flex items-end gap-0.5 h-7" aria-hidden="true">
  {values.map(v => `
    <span class="flex-1 rounded-sm bg-accent/30"
      style="height: ${(v / max) * 100}%"></span>
  `)}
</div>
```

- Height fijo: `h-7` (28px)
- Color: `bg-accent/30` (30% opacity del accent)
- Gap: `gap-0.5` (2px)
- Radius: `rounded-sm` (2px)

### 14.1.1 Paleta categórica Chart.js

Gráficas con **varias series o categorías** usan la paleta centralizada en `frontend/src/charts/chartTokens.ts` (`chartCategoricalPalette`, `chartColorSlots`, `chartColorAt`). Regla: **una familia de color por slot** — no rotar dos azules, dos verdes ni tonos vecinos del mismo matiz en la misma gráfica.

| Slot | Token / fallback | Uso típico |
|---|---|---|
| `accent` | `--color-accent` (#2563EB) | Serie principal, retardo, home office |
| `green` | `--color-leoni-green` (#00C853) | Positivo, justificado, calidad |
| `amber` | `--color-warning` (#F59E0B) | Pendiente, suspensión |
| `red` | `--color-danger` (#EF4444) | Negativo, falta injustificada |
| `violet` | #9333EA | Categorías extra, matrimonio |
| `teal` | #0891B2 | Vacaciones, incapacidad |
| `orange` | #EA580C | Seguridad, paternidad, daño equipo |
| `navy` | `--color-leoni-blue` (#002147) | Indisciplina (único oscuro) |
| `slate` | `--color-text-secondary` (#64748B) | Otros, defunción, neutral |

Mapas por dominio (solicitudes, incidencias, faltas-retardos) deben referenciar `chartColorSlots()` en lugar de tokens vecinos (`--color-info`, `--color-success`, `--color-leoni-blue-light`). Gráficas de **una sola serie** pueden seguir usando `--color-accent`.

### 14.1.2 Micro-visualizacion de distribucion (barra apilada en un tile)

Barra apilada al 100 % dentro de un stat tile, para una escala **ordinal con
semantica de estado** (p. ej. bandas de desempeno bajo/medio/alto). Implementada en
`distribucionBandasHtml` (`frontend/src/pages/dashboardTalento.ts`).

| Regla | Por que |
|---|---|
| Segmentos con `flex:<n> 1 0%`, no `width:%` | los 2 px de separacion se descuentan del reparto; con `width` la suma desborda |
| `gap-[2px]` entre segmentos | sin separador, dos bandas contiguas se leen como una sola mancha |
| `h-1.5 rounded-full overflow-hidden` en el contenedor | extremos redondeados sin redondear cada segmento |
| Conteo por banda en texto debajo, en `text-text-secondary` + punto de color | la identidad **nunca** depende solo del color; el texto va en tokens de texto, no en el color de la serie |
| Total 0 → no se pinta nada | una barra vacia no significa lo mismo que "sin datos" |

**Color**: verde = `--color-success-text` (#15803D), **no** `--color-success`. Adyacente
al ambar, la pareja del semaforo (#22C55E / #F59E0B) cae a ΔE 5.7 en protanopia —
indistinguible. Con #15803D las tres bandas pasan la validacion CVD. Regla general:
los colores de **estado** valen para marcas de datos solo si los pares adyacentes
superan la separacion CVD; si no, hay que bajar un paso el tono, no confiar en el label.

### 14.1.3 Matriz 9-Box (rejilla ordinal en dos ejes)

La matriz de desempeno x potencial NO es una rejilla de nueve categorias sueltas: es una
escala **ordinal en dos ejes** y el lector busca la esquina buena y la mala. Implementada en
`frontend/src/cicloDesempeno/nueveBox.ts`.

| Regla | Por que |
|---|---|
| Color **divergente** por la SUMA de los dos ejes (bajo=0, medio=1, alto=2) | rojo en la esquina de riesgo, neutro en la antidiagonal, verde en la de talento clave; una paleta categorica de 9 colores no diria nada |
| Tintes de estado (`*-bg` + `*-border`), nunca el color pleno | dentro de la celda va texto (nombres); el fondo tiene que admitirlo |
| **Nombre del segmento en cada celda** ("Estrella", "Riesgo", "Enigma"…) | la matriz se lee igual en escala de grises o con daltonismo: el color no es la unica senal |
| Anillo solo en la celda estrella | es la que se busca primero; si todo destaca, nada destaca |
| Celda vacia al 60 % de opacidad | lo que se lee primero debe ser donde SI hay gente |
| Maximo 4 nombres + "+N mas" | una celda con 30 personas estira la fila y la matriz deja de leerse de un vistazo |
| Leyenda del degradado (Riesgo → Talento clave) | el color codifica una suma, no una categoria: sin leyenda hay que adivinarlo |

### 14.2 Progress Bar con Marker (nivel requerido)

Barra de progreso con indicador vertical del nivel requerido.

```html
<div class="relative h-2.5 rounded-full bg-slate-100">
  <!-- Current level -->
  <div class="absolute inset-y-0 left-0 rounded-full
    {hasGap ? 'bg-accent' : 'bg-primary'}"
    style="width: {(current / max) * 100}%"></div>
  <!-- Required marker -->
  <div class="absolute top-[-3px] bottom-[-3px] w-0.5 bg-text-primary"
    style="left: {(required / max) * 100}%"></div>
</div>
```

### 14.3 Plan de Desarrollo Timeline (vertical)

Timeline vertical con pasos numerados y estados.

```html
<div class="grid grid-cols-[24px_1fr] gap-3 py-3 border-b border-border">
  <!-- Step indicator -->
  <div class="flex flex-col items-center gap-1">
    <div class="size-5.5 rounded-full grid place-items-center text-xs font-bold
      {completed ? 'bg-success text-white' : 'bg-surface-container border border-border text-text-secondary'}">
      {completed ? '✓' : stepNumber}
    </div>
    {!isLast && '<div class="flex-1 w-0.5 bg-border"></div>'}
  </div>
  <!-- Content -->
  <div>
    <p class="font-mono text-[10px] uppercase text-text-muted">{fase}</p>
    <p class="font-semibold text-sm mt-0.5">{curso}</p>
    <div class="flex items-center gap-2 mt-1.5">
      <span class="badge...">{estado}</span>
      <span class="text-xs text-text-muted">{fecha}</span>
      {score && '<span class="badge font-mono">★ {score}</span>'}
    </div>
  </div>
</div>
```

### 14.4 Version Timeline (OPLs)

Timeline horizontal compacto para historial de versiones.

```html
<div class="grid grid-cols-[32px_1fr] gap-3 pb-3">
  <div class="flex flex-col items-center">
    <span class="font-mono text-xs font-bold rounded-md px-1.5 py-0.5 grid place-items-center
      {isCurrent ? 'bg-warning-bg text-warning-text' : 'bg-surface-container text-text-secondary'}">
      {version}
    </span>
    {!isLast && '<div class="flex-1 w-0.5 bg-border mt-1"></div>'}
  </div>
  <div>
    <div class="flex justify-between">
      <span class="text-xs text-text-muted">{fecha} · {autor}</span>
      {isCurrent && '<span class="badge...">Actual</span>'}
    </div>
    <p class="text-sm mt-0.5">{descripcion}</p>
  </div>
</div>
```

### 14.5 Validation Checklist

Lista de verificacion para bandeja de evidencias.

```html
<div class="flex items-center gap-2.5 rounded-md border border-border bg-surface-container-low px-2.5 py-2">
  <div class="size-4.5 rounded grid place-items-center
    {checked ? 'bg-success border border-success-text' : 'bg-white border border-border'}">
    {checked && '<svg class="size-3 text-white"><!-- checkmark --></svg>'}
  </div>
  <span class="text-sm font-medium">{label}</span>
  {!checked && '<span class="badge ml-auto...">Pendiente</span>'}
</div>
```

### 14.6 Signature / Firma Card

Card de firma requerida en evidencias.

```html
<div class="flex items-center gap-2.5 rounded-lg border border-border p-2.5">
  <!-- Avatar -->
  <div class="flex-1 min-w-0">
    <p class="text-sm font-semibold truncate">{nombre}</p>
    <p class="text-xs text-text-muted">{rol}</p>
  </div>
  <span class="badge {state === 'pending' ? 'amber' : 'blue'}">
    {state === 'pending' ? 'Tu turno' : 'En espera'}
  </span>
</div>
```

### 14.7 Cumplimiento Bar (area)

Barra horizontal con porcentaje y semaforo para vista de cumplimiento por area.

```html
<div class="grid grid-cols-[180px_1fr_60px_70px] items-center gap-3">
  <div>
    <p class="text-sm font-semibold">{area}</p>
    <p class="text-xs text-text-muted">{personas} personas</p>
  </div>
  <div class="relative h-5 rounded-md overflow-hidden bg-slate-100">
    <div class="absolute inset-y-0 left-0 bg-primary rounded-md" style="width: {cumpl}%"></div>
    <div class="absolute inset-y-0 rounded-md bg-accent/40" style="left: {cumpl}%; width: {100-cumpl}%"></div>
    <span class="absolute right-2 inset-y-0 flex items-center text-xs font-mono font-semibold text-white">
      {cumpl}%
    </span>
  </div>
  <span class="font-mono text-sm text-right">{brechas}</span>
  <span class="badge {cumpl >= 90 ? 'emerald' : cumpl >= 80 ? 'amber' : 'red'}">
    {cumpl >= 90 ? 'Verde' : cumpl >= 80 ? 'Ambar' : 'Rojo'}
  </span>
</div>
```

### 14.8 Calendar Date Block

Bloque de fecha para proximas capacitaciones.

```html
<div class="text-center rounded-lg border border-border bg-surface-container-low px-2 py-1.5">
  <p class="text-xl font-bold leading-none">{dia}</p>
  <p class="text-[9px] font-semibold tracking-wider text-text-muted uppercase mt-0.5">{mes}</p>
</div>
```

### 14.9 Stacked Avatars

Grupo de avatares superpuestos para personal impactado.

```html
<div class="flex items-center">
  {people.slice(0, 8).map((p, i) => `
    <span class="size-6 rounded-full grid place-items-center text-[10px] font-semibold
      ring-2 ring-white ${i > 0 ? '-ml-2.5' : ''}"
      style="background: {bg}; color: {fg}">
      {initials}
    </span>
  `)}
  {remaining > 0 && `
    <span class="size-6 rounded-full grid place-items-center text-[10px] font-semibold
      bg-surface-container border-2 border-white -ml-2.5 text-text-secondary">
      +{remaining}
    </span>
  `}
</div>
```

### 14.10 Barra de distribución con marcador de objetivo

Compara la distribución **actual** de una banda contra su **objetivo** (p. ej. calibración de desempeño, pestaña Resultados y 9-Box). Variante de la 14.2 con relleno semántico por banda: reutiliza los tonos del dot de las badges (`bandaBadge` / `uiTokens`) — `alto` → `emerald` (positivo), `medio` → `amber` (neutro), `bajo` → `red` (negativo). Track `slate-100`, relleno = pct actual (clamp 0–100), marcador de objetivo `slate-500/70`. No introducir hex ni fuentes nuevas.

```html
<div class="relative h-2 w-full rounded-full bg-slate-100">
  <!-- Actual (banda: alto=bg-emerald-500, medio=bg-amber-400, bajo=bg-red-400) -->
  <div class="absolute inset-y-0 left-0 rounded-full {bandaBarClass}"
    style="width: {clamp(pctActual, 0, 100)}%"></div>
  <!-- Objetivo -->
  <div class="absolute inset-y-[-3px] w-px bg-slate-500/70"
    style="left: {clamp(objetivo, 0, 100)}%" title="Objetivo {objetivo}%"></div>
</div>
```

---

## 15. Level Up — Navigation Structure

El sidebar RH agrupa **por dominio**, no por fase del proyecto ni por tabla. Cada sección
responde una pregunta distinta, y ese es el criterio para decidir dónde entra una pantalla
nueva.

### Sidebar RH operativo (`navigation/rhNav.ts`)

```
Dashboard · Organigrama                              (sueltos, fuera de sección)

PUESTOS            ¿cómo está definido el puesto?
  Perfiles de puesto           → #/puestos
  Competencias                 → #/competencias
  Tareas                       → #/tareas-catalogo
  Ajustes perfil de puesto     → #/puestos/ajustes

TALENTO            ¿cómo está la gente frente a esa definición?
  Dashboard de Talento         → #/talento/dashboard
  Matriz de multihabilidades   → #/capacidades
  Cobertura y polivalencia     → #/operaciones
  Encuestas                    → #/talento/encuestas

DESEMPEÑO          ¿qué pondera el ciclo?
DESARROLLO         ¿cómo se capacita?
PERSONAL EXTERNO · NÓMINAS · LABORALES · COMEDOR
```

**Puestos va antes que Talento**: primero se define el puesto, después se mide a la gente
frente a esa definición. Estuvieron fundidos en una sola sección de ocho ítems (PR #137) y
no se distinguía la configuración del análisis.

Reglas al tocar el menú:
- Los ítems de Puestos salen de `LEVEL_UP_PUESTOS` (`levelUpNav.ts`), de donde también sale
  la categoría del hub `#/level-up`: si el menú y el hub agruparan distinto, cada uno
  contaría una historia diferente del mismo producto. Hay un test que lo ata.
- El `group=` de `app/core/rh_module_registry.py` (pantalla de Permisos RH) se mantiene
  alineado **a mano** con estas secciones, y el grupo nuevo debe agregarse además a
  `RH_MODULE_GROUP_ORDER` — lo que no esté ahí no se muestra.
- Un permiso puede abrir pantallas de **dos** secciones: `competencias` habilita
  Competencias (Puestos) y Matriz de multihabilidades (Talento). Separar el menú no separa
  el permiso.

### Rutas nuevas

| Ruta | Pagina | Layout |
|---|---|---|
| `#/level-up` | Dashboard Level Up | F (Operational Dashboard) |
| `#/puestos/:id` | Perfil de puesto detalle | C (Detail/Profile) |
| `#/capacidades` | Matriz de capacidades | G (Matrix/Heatmap) |
| `#/habilidades` | Matriz de habilidades | G (Matrix/Heatmap) |
| `#/cursos` | Catalogo de cursos | I (Catalog Cards) |
| `#/opls` | Manejo de OPLs | H (Master-Detail) |
| `#/evidencias` | Bandeja de evidencias | H (Master-Detail) |
| `#/sugerencias` | Motor de sugerencias | J (Suggestion Cards) |
| `#/encuestas` | Encuestas post curso | K (Survey Results) |

---

## 15.5 Ajustes de Nómina — Component Patterns

Página `#/nominas/ajustes` estructurada como **centro de control de autorizaciones** (no como mantenimiento de catálogos). Estructura: header ejecutivo → KPI cards → Flow Status Card → tabla de autorizados → grid de aprobadores (2 col).

### 15.5.1 Flow Status Card (Estado del flujo)

Tarjeta que resume la salud de la configuración de un proceso de aprobación en cadena.

- Header: título + descripción a la izquierda; badge de estado general a la derecha.
- Badge de estado: pill `text-sm font-bold` con dot — verde `OPERATIVO` cuando toda la cadena está configurada, ámbar `CONFIGURACIÓN INCOMPLETA` cuando falta algún eslabón, azul `Verificando…` durante la carga.
- Banda de flujo: `<ol>` horizontal en desktop (`sm:flex-row`), apilada en móvil. Cada paso es un chip `rounded-lg border` con icono + título + descripción corta. Tono por estado: emerald (configurado), amber (falta configuración), blue (paso informativo/terminal). Flechas SVG entre pasos (`rotate-90` en móvil).
- Checklist inferior: grid `sm:grid-cols-3` con check emerald (✓ configurado) o triángulo amber (falta), separado con `border-t`.

### 15.5.2 Executive Approver Card (Ficha ejecutiva)

Cuando un rol de aprobación tiene un único responsable (p. ej. Director), se muestra como ficha en lugar de tabla:

- Avatar `size-14 text-lg` con iniciales (`bg-leoni-blue text-white rounded-full`).
- Nombre (`text-base font-semibold`), no. empleado · área/puesto, correo en `text-xs text-muted`.
- Badge de estado (Activo/Inactivo) debajo de los metadatos.
- Acciones (Desactivar/Eliminar) en footer separado con `border-t`.
- Si hay más de un registro (histórico de inactivos), degrada a tabla estándar.

### 15.5.3 Empty State con CTA

Extensión del empty state de sección (8.15): dashed border + icono circular `bg-blue-50 text-blue-600` + título + descripción + botón secundario `+ {acción}` que abre el modal correspondiente.

### 15.5.4 Selector de empleados en modal

Filas de resultados como `<label>` clickeable: checkbox/radio + avatar `size-9` con iniciales + nombre + detalle (no. empleado · correo · área/puesto). Selección con tinte `bg-blue-50/60 border-leoni-blue/50`. Chips removibles de seleccionados debajo.

### 15.5.5 Jerarquía de color de la página

- **Azul**: configuración e información (pasos del flujo, iconos de empty state).
- **Verde**: estados activos y configuración completa.
- **Ámbar**: pendiente o configuración incompleta.
- **Rojo**: solo acciones destructivas (Eliminar, Revocar).

---

## 15.6 Catálogos de Ajustes — Sección reutilizable

Los catálogos de `#/puestos/ajustes` (career paths, funciones, disciplinas, career levels,
categorías de tarea, grupos y tipos de competencia) son **la misma pantalla**: card con
header + tabla + modal de alta/edición + confirmación de borrado. Ese comportamiento vive en
`frontend/src/components/puestos/ajustes/catalogoSection.ts` (`mountCatalogoSection`), y los
estilos en `ajustesSectionUi.ts`.

**No dupliques la sección entera para un catálogo nuevo.** Declara su configuración:

```ts
mountCatalogoSection<MiEntidad>(sectionEl, signal, {
  key: "mi-entidad",        // prefijo de data-attributes e ids del DOM
  title, titleId, description, iconHtml,
  singular: "mi entidad",   // usado en botones y títulos de modal
  emptyMessage,
  columnas: [{ header: "Nombre", valor: (i) => i.nombre, clase: "font-medium" }],
  campos: [{ tipo: "texto", name: "nombre", label: "Nombre", minLength: 2 }],
  valoresNuevo, valoresEdicion, etiqueta,
  cargar, crear, actualizar, eliminar,
  validar,                  // mensaje de error o null
  bloqueo,                  // mensaje si falta un requisito previo (ver abajo)
});
```

### 15.6.1 Reglas de la sección de catálogo

- **Campos**: `tipo: "texto" | "numero" | "select" | "multiselect"`. Dos campos consecutivos con
  `ancho: "medio"` se emparejan en `sm:grid-cols-2`; el resto ocupa el ancho completo.
  El chevron de los `select` sale de `SELECT_CHEVRON`, nunca se dibuja a mano.
- **Dependencias entre catálogos**: cuando un catálogo no puede existir sin otro
  (una disciplina necesita una función; un career level necesita un career path), se usa
  `bloqueo()`. Devuelve un mensaje y la sección muestra un empty state explicativo **y oculta
  el botón de alta**, en vez de dejar al usuario abrir un formulario que va a fallar.
- **Sincronía entre cards**: si dar de alta en una card cambia el select de otra, se emite un
  evento en `document` (`AJUSTES_CLASIFICACION_CHANGED`) y la card dependiente se recarga.
  Mismo patrón que `AJUSTES_GRUPOS_COMPETENCIA_CHANGED` y `AJUSTES_EQUIVALENCIAS_CHANGED`.

  **Toda card que lea un catálogo ajeno tiene que escuchar su evento** — el select y las
  columnas que muestran ese dato quedan obsoletos si no. Han faltado dos veces: equivalencias
  → tabla de career levels, y career paths → formulario de career level. La regla es
  mecánica: si `cargar()` llama a un `api/` que no es el de la card, hay un
  `document.addEventListener` que le corresponde.

  Al reaccionar **no se reutiliza `load()`** si la card además *emite* ese mismo evento:
  respondería a su propio cambio con el estado «Cargando…» y la tabla parpadearía en cada
  alta. Se recarga en silencio, sin tocar `loading`.
- **Conflictos del backend**: los 409 ("está en uso", "duplicado") se muestran tal cual dentro
  del modal con `ajustesModalError`; no se traducen ni se resumen.
- Los listeners se registran con `{ signal }` y el modal se pinta dentro de la sección.

### 15.6.2 Altura de las tablas de catálogo

Una pantalla que apila varias cards de catálogo **no puede dejar que cada tabla
crezca con sus datos**: con seis catálogos, llegar al último exige recorrer media
página y la jerarquía se pierde.

`ajustesTableWrap` marca el contenedor con `.ajustes-table-scroll`, y en
`#puestos-ajustes-root` eso aplica el patrón ya usado en `.puestos-table-scroll` y
`.tc-catalogo-scroll`: **alto máximo con scroll propio y `thead` fijo**.

- El tope (`min(38vh, 340px)`) es más bajo que el de esas pantallas a propósito:
  allí la tabla es el contenido principal; aquí conviven varias.
- **Solo actúa cuando el contenido lo excede**: un catálogo de dos filas se ve igual
  que antes, sin caja vacía ni scroll fantasma.
- En móvil (`< 640px`) se desactiva: la card ya ocupa el ancho completo y el scroll
  interno competiría con el de la página.
- El badge de conteo del header pasa a ser necesario, no decorativo: es lo que dice
  cuántas filas hay cuando solo se ven seis.
- La regla está acotada por id. Otras pantallas que reusan `ajustesTableWrap`
  (Ajustes de cursos) conservan solo el `overflow-x-auto` de la clase Tailwind.

**Buscador dentro de la card**: a partir de 8 filas aparece un `input[type=search]`
sobre la tabla que filtra en cliente lo ya cargado, para que el scroll no sea la
única forma de llegar a una fila. Por debajo de ese umbral la tabla se recorre de un
vistazo y el campo solo robaría espacio. Al escribir se repinta **solo el cuerpo**:
un repintado completo recrearía el input y el foco saltaría al primer carácter.

### 15.6.3 Tabs de la página de ajustes

`#/puestos/ajustes` agrupa los catálogos por dominio, no por tabla: **Clasificación**
(career paths · funciones · disciplinas · career levels), **Competencias**, **Tareas**,
**Cualificaciones**. La primera tab es la que define la identidad del puesto.

Las tabs de esta página usan píldoras (`tabButtonClass` local), no el subrayado de §8.9 —
es una excepción documentada. Una página nueva debe usar `renderTabNav` de `uiTokens.ts`.

**Agrupación dentro de un tab.** Cuando un tab reúne muchos catálogos, se ordenan en
columnas que reflejan la estructura del dominio, no el orden en que se programaron. En
Clasificación son las dos cadenas del modelo, cada una encabezada por una etiqueta
ligera (`renderColumnaTitulo`: sin superficie ni borde, para no competir con las cards
que ordena):

| Qué es el puesto | Cuánto pesa el puesto |
|---|---|
| Función → Disciplina | Career Path → Career Level → Global Grade → Equivalencia |

Cada columna se lee de arriba abajo en el mismo orden en que se captura.

### 15.6.4 La unidad de la card es la entidad, no la fila del backend

La card de **Equivalencias** guarda un renglón por par career level ↔ global grade, pero se
presenta **agrupada por career level**: una fila por nivel, con su tramo en una columna
(`GG17, GG18`). RH piensa «M4 equivale a GG17 y GG18», no «dos equivalencias que comparten
nivel».

Consecuencias, que valen para cualquier card en la misma situación:
- El `id` del item es el de la **entidad agrupadora** (el career level), no el del renglón.
  Editar y eliminar actúan sobre todo el grupo.
- El formulario usa `tipo: "multiselect"` (lista de checkboxes) y guardar **sincroniza**:
  crea los que faltan y borra los que sobran. No se edita renglón por renglón.
- El item conserva el id de cada renglón (`filas`), que es lo único que permite borrarlo.
- Si otra card muestra el dato agrupado, hay que **avisarle**
  (`AJUSTES_EQUIVALENCIAS_CHANGED`): la tabla de career levels muestra el tramo y se quedaba
  diciendo «Sin equivalencia» hasta recargar la página.

### 15.6.5 Campo con prefijo fijo

Cuando parte del valor de un campo **la dicta otro dato del formulario**, esa parte no se
teclea: se pinta adosada dentro del mismo borde, en un `<span>` que vive fuera del
`<input>` (no se envía ni se puede editar). El usuario solo captura la parte variable, con
lo que un valor inválido deja de ser posible de escribir.

`ajustesInputConPrefijo` (`components/puestos/ajustes/ajustesSectionUi.ts`):

```
Career path  [ Professional (P) ▾ ]

Código *
┌─────┬──────────────────────┐
│  P  │ 13                   │
└─────┴──────────────────────┘
El prefijo lo da el career path; captura solo el número.
```

Reglas:
- El borde y el foco viven en el **contenedor** (`focus-within:border-accent` +
  `focus-within:ring-accent/20`), no en el input, para que se lea como un solo campo.
- El prefijo usa `bg-slate-50` + `text-text-secondary`: presente pero claramente inerte.
  Lleva `aria-hidden` — el texto de ayuda bajo el campo es lo que lo explica.
- El `<label>` apunta al input, no al contenedor.
- Al cambiar el dato que dicta el prefijo, el campo se **repinta** y, en un alta, se
  propone el siguiente valor libre.
- La validación del prefijo es del backend; el cliente la replica solo para evitar el
  viaje. Ambas reglas se escriben una vez y se comparten
  (`app/utils/career_level_codigo.py` ↔ `talento/clasificacionPuestoUi.ts`).

Único uso hoy: el código de un **career level**, que es el de su career path más un número
(P1, P10, M3).

---

## 15.7 Clasificación de puesto — Presentación

La clasificación WTW de un puesto (**Career Path · Función · Disciplina · Career Level ·
Global Grade**) se lee igual en listado, detalle y formulario. Todo lo visual sale de
`frontend/src/talento/clasificacionPuestoUi.ts`; **no** se re-implementa por pantalla.

| Elemento | Helper | Se lee como |
|---|---|---|
| Rango de niveles | `formatGlobalLevelRango` | `P10 → P12` (o `P10` si es uno solo) |
| Rango expandido | `globalLevelChips` | `P10` → `P11` → `P12`, para el formulario |
| Career Path | `careerPathBadge` | pill neutra con dot accent |
| Global Grade | `globalGradeBadge` | pill accent tabular con tooltip |
| Estado | `estadoPerfilBadge` | verde activo · azul en revisión · gris inactivo |
| Clasificación incompleta | `clasificacionPendienteBadge` | pill ámbar con texto |

> **Vocabulario.** El nivel se llama **Career Level** (P10, M3), no "Global Level":
> compartir prefijo con el **Global Grade** los hacía confundibles, y "Career" lo ata
> al Career Path del que cuelga. En código el modelo y la tabla conservan el nombre
> legacy en español (`GradoPuesto`, `levelup_grados_puesto`, `grado_id`) — es una
> limpieza aparte, no debe aparecer en texto visible.
>
> **Quién ordena.** El Career Level **no tiene orden propio**: lo posiciona el Global
> Grade al que equivale. Por eso un P10 y un M1 pueden pesar lo mismo — es el GG el
> ordenador del sistema Towers, y los career paths son alternativas, no escalas.
> Consecuencias en la UI:
> - Un nivel **sin equivalencia configurada no tiene posición**: la tabla de Ajustes lo
>   marca en ámbar como *Sin equivalencia*, y el formulario de perfil lo rechaza con un
>   mensaje que apunta a Ajustes. No se puede usar en un rango.
> - Todo orden de niveles pasa por `compararCareerLevels`: los que no tienen posición
>   van al final y se desempata por código, para que el listado no baile.
> - El rango sigue exigiéndose contiguo, pero **sobre el orden del GG y deduplicado**:
>   dos niveles que equivalen al mismo grado no rompen la contigüidad.

### 15.7.1 Reglas

- **El código manda sobre el nombre.** Un career level se muestra por su `codigo`
  (`P10`); el `nombre` va en el `title`. Los códigos llevan `tabular-nums` para que las
  columnas no bailen.
- **Nunca anteponer el career path al código de un nivel.** El código ya empieza con el del
  path (`M1`, `P10`), así que `M · M1 — Team Leader` repite la misma letra. El career path
  se muestra aparte solo cuando es un dato por derecho propio: su **columna** en la tabla de
  career levels, o el **badge** del perfil.
- **El Global Grade siempre lleva tooltip** (`GLOBAL_GRADE_TOOLTIP`): explica que es la
  clasificación organizacional definida por RH. **Ningún texto de la UI puede sugerir que
  el Global Grade determina sueldo, banda salarial o compensación** — este sistema no
  administra esos conceptos. Hay un test que lo verifica.
- **Un rango solo existe dentro de un career path.** `careerLevelsEntre` devuelve vacío si
  los extremos son de paths distintos, y el select de "hasta" se acota al path elegido.
- **Un career level abarca un TRAMO de global grades**, no uno solo: M4 puede ser GG17 y
  GG18, y por eso dos empleados en M4 pueden estar clasificados distinto. Se muestra con
  `formatGlobalGrades` (`GG17`, `GG17 – GG18`, o «Sin equivalencia»). La contigüidad de un
  rango se mide sobre la **unión** de grades cubiertos, no sobre una posición por nivel.
- **El Global Grade del perfil está acotado a los de su career level inicial.** Con uno se
  autocompleta; con varios el select queda sin preseleccionar y el aviso pide elegir; sin
  equivalencias el campo queda libre con el aviso ámbar que enlaza a Ajustes. Guardar uno
  fuera de ese conjunto devuelve 422 — si no, la equivalencia sería una sugerencia y nada
  impediría un M4 clasificado GG25.
- **Los badges llevan texto, nunca solo color** (§8.9). El de "Clasificación pendiente" es
  ámbar informativo, no un error: el perfil se puede seguir editando.
- **Cascadas**: Función → Disciplina en filtros y formulario; al cambiar la función se
  invalida la disciplina. Career Path → Career Level en el formulario.
- **Autocompletado del Global Grade**: al elegir el career level inicial se consulta la
  equivalencia configurada. Si existe, se rellena y se avisa con un texto discreto
  ("Autocompletado desde la equivalencia…"); si no, se muestra un aviso ámbar que enlaza a
  Ajustes y el campo queda libre. El valor **nunca** se calcula.

### 15.7.2 Formulario de perfil

Cuatro pasos numerados (`renderModalSection`), en este orden:

1. **Identidad del puesto** — código y nombre.
2. **Clasificación del puesto** — Career Path · Función · Disciplina.
3. **Career level y global grade** — rango desde/hasta con preview de chips, y el GG.
4. **Organización y estado** — Área y Estado.

---

## 15.8 Responsabilidades del puesto — Atributos

Cada responsabilidad puede llevar **categoría, prioridad, frecuencia y % de dedicación**.
La presentación vive en `frontend/src/talento/tareaAtributosUi.ts`.

| Atributo | Helper | Tono |
|---|---|---|
| Categoría | `categoriaTareaBadge` | accent (viene de catálogo) |
| Prioridad | `prioridadBadge` | rojo alta · ámbar media · gris baja |
| Frecuencia | `frecuenciaBadge` | neutro |
| % dedicación | `dedicacionBadge` | neutro, `tabular-nums` |

### 15.8.1 Reglas

- **Solo se pinta lo capturado.** Los cuatro son opcionales; una tarea sin atributos se
  ve exactamente como antes. Nada de badges "Sin definir" ocupando espacio.
- **Prioridad y frecuencia son valores fijos**, no catálogo editable: cargan lógica de
  lectura y el backend los valida contra un conjunto cerrado. Las etiquetas salen de
  `PRIORIDADES` y `FRECUENCIAS`; no se escriben a mano en cada vista.
- **La categoría sí es catálogo** (`levelup_categorias_tarea`), administrable en
  Ajustes → Tareas. El texto libre anterior sigue de solo lectura como fallback mientras
  queden filas sin migrar.
- **El aviso de dedicación es informativo, nunca bloqueante.** `dedicacionResumen`
  distingue tres estados: verde en 100%, ámbar si falta (dice cuánto) y rojo si se pasa.
  Menciona cuántas tareas no tienen porcentaje, para que el total no se lea como completo
  cuando no lo es. **No debe usar lenguaje de error**: repartir el 100% es una guía de
  análisis del puesto, no una regla de validación. Hay un test que lo verifica.
- El resumen **solo aparece si alguien empezó a repartir**: sin ningún porcentaje
  capturado, un "faltan 100%" sería ruido.
- En el modal, el resumen corresponde **al alcance seleccionado**: si RH está trabajando
  en un career level, muestra el total de ese nivel (que incluye las generales, porque ese
  nivel también las ejecuta).

### 15.8.2 Evidencia de competencia

La evidencia es un texto opcional por competencia **y alcance** (general o un global
level): acredita qué respalda el nivel requerido en ese puesto.

- En la **matriz del detalle** se lee en el `title` de la celda y se marca con un punto
  accent de 6px. Es un dato de apoyo: no debe competir visualmente con el nivel.
- En el **modal de competencias** se edita con un botón de nota en el chip, que abre un
  textarea debajo. Un editor a la vez.
- Al guardar, la evidencia **solo viaja si cambió**. Un sync que no la manda conserva la
  ya capturada: el sync existe para ajustar niveles en bloque y no debe tirar el trabajo
  de captura por omitir un campo opcional.

---

## 16. Stitch Screens Reference

### Original — HCM Platform (project `1746412759455982581`)

Las 15 pantallas originales del sistema RRHH:

#### Dashboard & Overview
1. Dashboard Profesional — Gestion de Talento (Refinado)
2. Panel de Gestion de Talento — Vista de Supervisor (Optimizado)
3. Panel de Gestion de Talento — Optimizado con IA

#### Talent & Career
4. Vista de Supervisor — Gestion de Talento
5. Mi Desarrollo (PDI) — LEONI LCS
6. Detalle de Desarrollo y Plan de Carrera — Vista del Gerente
7. Gestion de PDI — Vista del Gerente

#### Training & Learning
8. Capacitaciones — Gestion de Aprendizaje (Interfaz Unificada)
9. Catalogo de Capacitacion — Optimizado y Refinado (3 variantes)
10. Catalogo de Capacitacion — Recomendaciones IA

#### Competencies & Evaluation
11. Matriz de Competencias — Configuracion por Area
12. Matriz de Competencias — Configuracion Optimizada
13. Evaluacion y Feedback — Gestion de Talento

#### Positions & Opportunities
14. Oportunidades de Crecimiento — Vacantes Internas
15. Definicion de Perfiles de Puesto — Configuracion con IA

Stitch project ID: `1746412759455982581`

### Level Up — Modulo de Desarrollo (Stitch export local)

12 pantallas diseñadas en `/Downloads/Level Up/`:

#### Dashboard
16. Dashboard Level Up — Resumen operativo (screens-1.jsx: `ScreenDashboard`)

#### Matrices y Personas
17. Matriz de Capacidades — Heatmap por colaborador (screens-1.jsx: `ScreenCapabilityMatrix`)
18. Detalle de Colaborador — Capacidades + Plan de desarrollo (screens-1.jsx: `ScreenColaboradorDetail`)
19. Matriz de Habilidades — Tecnicas, blandas, operativas (screens-1.jsx: `ScreenSkillsMatrix`)

#### Perfiles y Formacion
20. Perfiles de Puesto — Lista de tarjetas (screens-2.jsx: `ScreenProfilesList`)
21. Perfil de Puesto — Detalle completo (screens-2.jsx: `ScreenProfileDetail`)
22. Capacitaciones — Tabla de asignaciones (screens-2.jsx: `ScreenTrainings`)
23. Catalogo de Cursos — Cards por categoria (screens-2.jsx: `ScreenCourses`)
24. Manejo de OPLs — Master-detail con versiones (screens-2.jsx: `ScreenOPLs`)

#### Cumplimiento
25. Bandeja de Evidencias — Validacion y firma (screens-3.jsx: `ScreenEvidences`)
26. Motor de Sugerencias — Justificacion dual (screens-3.jsx: `ScreenSuggestions`)
27. Encuestas Post Curso — Scores y comentarios (screens-3.jsx: `ScreenSurveys`)

---

## 13. Migration Checklist

Archivos a actualizar para alinear el frontend actual con este design system:

### Prioridad 1 — Tokens (1-2h)
- [ ] `frontend/src/style.css` — Reemplazar `@theme` block con nuevos tokens
- [ ] `frontend/src/ui/uiTokens.ts` — Actualizar constantes BTN_*, badges con nuevos colores

### Prioridad 2 — Typography & Spacing (2-3h)
- [ ] Agregar clases `.text-h1` a `.text-label-sm` como `@layer utilities` en `style.css`
- [ ] Auditar y normalizar tamanos de fuente hardcoded en componentes

### Prioridad 3 — Border Radius (2-3h)
- [ ] Reemplazar `rounded-lg` (8px) → `rounded` (4px) en botones e inputs
- [ ] Reemplazar `rounded-2xl` (16px) → `rounded-lg` (8px) en cards
- [ ] Mantener `rounded-full` en badges y avatares

### Prioridad 4 — Colors (8-12h)
- [ ] Reemplazar `bg-leoni-blue` → `bg-primary` globalmente
- [ ] Reemplazar `text-leoni-blue` → `text-accent` para acciones interactivas
- [ ] Reemplazar `hover:bg-leoni-blue-light` → `hover:bg-primary-light`
- [ ] Migrar colores hardcoded de Tailwind (slate, red, emerald, amber, sky) a tokens semanticos donde aplique

### Prioridad 5 — Shadow System (1h)
- [ ] Reemplazar `shadow-sm` generico por tokens de shadow definidos
- [ ] Remover shadows de cards/containers estaticos (solo tonal layering + border)
