# ADR 0001 — Persistencia de resultados de tests (Neon DB) + comportamiento RESCAN

**Status:** Accepted  
**Date:** 2026-05-10

---

## Contexto

nexus-console corre tests y muestra resultados. Sin persistencia, cada refresh/rescan resetea todos los estados a `pending`. Se necesita que los resultados sobrevivan reloads de página y rescans.

## Decisión

Persistencia en Neon Postgres (schema `nexus_console`, tabla `test_results`). Restore en dos momentos: initial page load y RESCAN.

### Flujo save (post-run)

```
runTarget() completa → collectea resultados por test → POST /api/test-results
  id: `${repo_id}::${test.id}`  (PK única por test por repo)
  repo_id: repo.id              (nombre del repo, ej: "idyllic-auth")
  test_id: test.id              (path relativo + nombre: "tests/file.py::test_fn")
  status: "pass" | "fail"
  duration_ms: null             (no se persiste por-test aún)
```

### Flujo load (initial + RESCAN)

Ambos hacen `Promise.all([/api/repos, /api/test-results])`:
1. Construye `testMap: Map<repo_id, Map<test_id, {status, duration_ms}>>`
2. Para cada test del scan: busca in-memory primero (RESCAN), luego DB, fallback `pending`

### IDs en pinned/queue items

Los items de pinned/queue para tests usan `t.name` como ID (no el full `test.id`). El validIds del purge de RESCAN debe incluir AMBOS:
- `test.id` → `"tests/file.py::test_fn"` (para lookups DB + merge)
- `test.name` → `"test_fn"` (para pinned/queue items de tipo "test")

## Consecuencias

- Tests pasados sobreviven reload de página y RESCAN
- RESCAN purga pinned/queue items de tests borrados del filesystem
- Colisión de nombres: dos tests con mismo `t.name` en repos distintos tienen el mismo ID en pinned/queue (limitación conocida, no breaking en uso típico)
- `duration_ms` no se persiste por test individual (solo repo-level, via terminal output)

## Alternativas descartadas

- localStorage: no persiste entre dispositivos, límite de tamaño
- Archivo JSON local: conflictos concurrentes en multi-session
