#!/usr/bin/env bash
set -euo pipefail

BASE_BRANCH="${1:-main}"
PR_TITLE="${2:-}"
HEAD_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: gh no esta instalado."
  echo "Instalalo con: brew install gh"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "No hay sesion activa en GitHub CLI."
  echo "Ejecuta una vez: gh auth login --web"
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Hay cambios sin commitear. Haz commit o stash antes de crear PR."
  exit 1
fi

if [[ -z "${PR_TITLE}" ]]; then
  PR_TITLE="feat: cambios en ${HEAD_BRANCH}"
fi

if [[ "${HEAD_BRANCH}" == "${BASE_BRANCH}" ]]; then
  echo "La rama actual coincide con base (${BASE_BRANCH}). Cambia a tu rama feature."
  exit 1
fi

if ! git ls-remote --exit-code --heads origin "${HEAD_BRANCH}" >/dev/null 2>&1; then
  echo "La rama no existe en remoto. Haciendo push inicial..."
  git push -u origin "${HEAD_BRANCH}"
fi

if gh pr view --head "${HEAD_BRANCH}" --json url >/dev/null 2>&1; then
  echo "Ya existe un PR para ${HEAD_BRANCH}:"
  gh pr view --head "${HEAD_BRANCH}" --json url --jq .url
  exit 0
fi

PR_BODY="$(cat <<EOF
## Summary
- describe el objetivo del cambio.
- menciona modulos/backend/frontend impactados.
- agrega notas importantes de negocio o compatibilidad.

## Test plan
- [ ] pytest
- [ ] cd frontend && npm run test
EOF
)"

gh pr create \
  --base "${BASE_BRANCH}" \
  --head "${HEAD_BRANCH}" \
  --title "${PR_TITLE}" \
  --body "${PR_BODY}"

echo "PR creado correctamente."
gh pr view --head "${HEAD_BRANCH}" --json url --jq .url
