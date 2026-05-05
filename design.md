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

<!-- Main area -->
<div class="min-h-full bg-surface lg:pl-72">
  <div class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-border bg-white px-4 shadow-xs sm:gap-x-6 sm:px-6 lg:px-8">
    <!-- Topbar -->
  </div>
  <main class="{mainClass}">
    <div class="px-4 sm:px-6 lg:px-8">{content}</div>
  </main>
</div>
```

`mainClass` default: `py-10`. Para listas admin densas: `py-5 sm:py-6`.

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
- `empleado`: dashboard, solicitudes, comedor, notificaciones
- `supervisor`: todo excepto actas, reportes
- `rh`: acceso completo + organigrama

**Responsive**: `lg+` = fixed left column. `<lg` = `<dialog>` slide-in overlay.

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

### 8.16 Loading State

**Spinner inline:**
```html
<svg class="size-5 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
</svg>
```

**Skeleton**: `animate-pulse` con `bg-slate-200` (headers) y `bg-slate-100` (body).

### 8.17 Alert / Banner

| Tipo | Border | Background | Text |
|---|---|---|---|
| Error | `border-red-200` | `bg-red-50` | `text-red-800` |
| Warning | `border-amber-200` | `bg-amber-50` | `text-amber-900` |
| Info | `border-blue-200` | `bg-blue-50` | `text-blue-800` |
| Success | `border-emerald-200` | `bg-emerald-50` | `text-emerald-800` |

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

## 12. Stitch Screens Reference

Las 19 pantallas visibles del proyecto Stitch que definen el target UI:

### Dashboard & Overview
1. Dashboard Profesional — Gestion de Talento (Refinado)
2. Panel de Gestion de Talento — Vista de Supervisor (Optimizado)
3. Panel de Gestion de Talento — Optimizado con IA

### Talent & Career
4. Vista de Supervisor — Gestion de Talento
5. Mi Desarrollo (PDI) — LEONI LCS
6. Detalle de Desarrollo y Plan de Carrera — Vista del Gerente
7. Gestion de PDI — Vista del Gerente

### Training & Learning
8. Capacitaciones — Gestion de Aprendizaje (Interfaz Unificada)
9. Catalogo de Capacitacion — Optimizado y Refinado (3 variantes)
10. Catalogo de Capacitacion — Recomendaciones IA

### Competencies & Evaluation
11. Matriz de Competencias — Configuracion por Area
12. Matriz de Competencias — Configuracion Optimizada
13. Evaluacion y Feedback — Gestion de Talento

### Positions & Opportunities
14. Oportunidades de Crecimiento — Vacantes Internas
15. Definicion de Perfiles de Puesto — Configuracion con IA

Stitch project ID: `1746412759455982581`

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
