#!/usr/bin/env bash
set -euo pipefail

if ! command -v git >/dev/null 2>&1; then
  echo "Git não está instalado ou não está disponível no PATH." >&2
  exit 1
fi

if [ -e .git ] && ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Existe um caminho .git que não é um repositório Git válido; nada foi alterado." >&2
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git init
fi

if git rev-parse --verify HEAD >/dev/null 2>&1; then
  echo "O repositório já possui histórico; o script foi interrompido sem alterar branch ou arquivos." >&2
  exit 1
fi

git branch -M main
git add -A

if git diff --cached --quiet; then
  echo "Não há arquivos para commitar."
  exit 0
fi

git commit -m "feat: setup inicial SGO UNILINK com automacao de ferias e integracao Supabase"
