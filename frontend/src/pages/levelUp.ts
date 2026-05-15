import { mountAppShell } from "../layouts/appShell.ts";

function levelUpStub(title: string, subtitle: string): string {
  return `
    <div class="rounded-lg border border-border bg-white px-6 py-10 shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Level Up</p>
      <h1 class="mt-1 text-lg font-semibold text-text-primary">${title}</h1>
      <p class="mt-2 text-sm text-text-muted">${subtitle}</p>
    </div>`;
}

export function mountLevelUpDashboard(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Level Up",
    activeNav: "level-up",
    mainHtml: levelUpStub("Resumen operativo", "Vista consolidada de capacitación, brechas y cumplimiento."),
  });
}

export function mountCapacidades(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Matriz de Capacidades",
    activeNav: "capacidades",
    mainHtml: levelUpStub("Matriz de capacidades", "Heatmap de nivel actual vs. requerido por colaborador."),
  });
}

export function mountHabilidades(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Matriz de Habilidades",
    activeNav: "habilidades",
    mainHtml: levelUpStub("Matriz de habilidades", "Habilidades técnicas, blandas y operativas por colaborador."),
  });
}

export function mountCursos(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Manejo de Cursos",
    activeNav: "cursos",
    mainHtml: levelUpStub("Catálogo de cursos", "Programación, instructores y reglas de elegibilidad."),
  });
}

export function mountOPLs(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Manejo de OPLs",
    activeNav: "opls",
    mainHtml: levelUpStub("Manejo de OPLs", "One Point Lessons con control de versiones y reentrenamiento."),
  });
}

export function mountEvidencias(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Motor de Evidencias",
    activeNav: "evidencias",
    mainHtml: levelUpStub("Bandeja de validación", "Evidencias que respaldan la acreditación de cursos y OPLs."),
  });
}

export function mountSugerencias(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Motor de Sugerencias",
    activeNav: "sugerencias",
    mainHtml: levelUpStub("Cursos sugeridos", "Recomendaciones por brecha interna y estándares del sector."),
  });
}

export function mountEncuestas(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Encuestas Post Curso",
    activeNav: "encuestas",
    mainHtml: levelUpStub("Resultados post curso", "Score consolidado por curso, instructor y proveedor."),
  });
}
