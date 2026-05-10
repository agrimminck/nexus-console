# nexus_console

Repo: `/home/agrim/github/idyllic/repos/nexus_console/`  
GitHub: `github.com/agrimminck/nexus-console`

Test runner dashboard — Tron UI. Corre, monitorea, gestiona tests de todos los repos idyllic + basilisk. Accesible por Tailscale.

---

## Stack

| Capa | Tech | Puerto |
|------|------|--------|
| Frontend | Vite + React + TS | build → `static/` |
| Backend | FastAPI + uvicorn | 8003 |
| Scanners | Python (static scan) | — |

---

## Levantar

```bash
cd /home/agrim/github/idyllic/repos/nexus_console
python3 server.py          # puerto 8003
# o
python3 -m uvicorn server:app --host 0.0.0.0 --port 8003
```

Frontend build (siempre después de editar .tsx/.ts/.css):
```bash
cd frontend && pnpm build  # output → ../static/
```

Auto-reload: polling `/api/version` cada 15s → recarga si mtime de `static/index.html` cambió.

---

## Endpoints

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/api/repos` | Discover todos los repos con tests |
| GET | `/api/version` | mtime de static/index.html (auto-reload) |
| GET | `/api/system` | RAM disponible + total + % |
| GET | `/api/config` | Tags + pinned config (test-config.json) |
| POST | `/api/config` | Actualizar config |
| POST | `/api/run` | Iniciar test run → `{run_id, cmd}` |
| POST | `/api/docker` | Compose up/down/ps → `{run_id, cmd}` |
| GET | `/api/docker/files` | Lista compose files disponibles |
| POST | `/api/open-godot` | Lanza `godot --editor --path idyllic-mmo1-game` |
| POST | `/api/reset-seed` | Corre `idyllic-infra/scripts/reset-and-seed-all-dbs.py` |
| WS | `/ws/{run_id}` | Stream output: `{type:"line",text}` / `{type:"done",exit_code}` |

---

## Scanner system

`scanners/repo_scanner.py` — descubre repos en `REPOS_ROOT`.  
`scanners/test_scanner.py` — escanea test files estáticamente (sin subprocess → rápido).

Stacks soportados:
- `jest` / `vitest`: busca `*.spec.ts` / `*.test.ts` excluyendo `node_modules/dist/`
- `pytest`: busca todos `.py` con `def test_*` o `class Test*::def test_*`
- `godot`: busca `tests/**/*.gd` con `func test_*`

Monorepo: si repo raíz es `unknown` stack → escanea `apps/*` subdirs.

Repos especiales: `smoke` = `idyllic-infra/tests/smoke/`, `e2e` = `idyllic-infra/tests/e2e/`.

---

## Frontend — estructura

```
frontend/src/
  App.tsx          # componente raíz + toda la lógica de estado
  App.css          # estilos Tron (vars, animaciones, layout)
  types.ts         # Repo, TestFile, IndividualTest, QueueItem, RunTarget, etc.
  CursorFX.tsx     # trail laser + hexágonos orbitando (canvas)
  MatrixRain.tsx   # lluvia de caracteres background
  sounds.ts        # sistema de sonidos — archivos mp3 + fallback Web Audio
  main.tsx         # entry point
```

---

## Features clave

**Categorías**: tarjetas agrupadas en E2E / INTEGRATION / UNIT. Colapsables. Header con N/Total pass + color (verde/amarillo/rojo). Botón RUN por categoría.

**Sidebar**: tabs QUEUE (efímera, sale al correr) / PINNED (permanente). Workers 1-8. FX toggles (ANIMS/MATRIX/CURSOR/SOUND). Toast mode (center/slide). OPTIONS collapsible.

**Tarjetas**: animaciones Tron idle/hover/running. `.tn-card-hover` = React-controlled (activo si `hovered || isRunning`). Pass count: `passedTests / testCount` — PASS solo si completo.

**Terminal**: 6 niveles (220px → 28vh → 38vh → 50vh → 65vh → 100vh).  
- Space: toggle min↔max  
- Shift+Space: sube nivel  
- Ctrl+Space: baja nivel

**ACTIONS bar**: UP DEV / DOWN DEV / PS / OPEN GODOT / RESET+SEED. Collapsible.

**Filtros**: eco dropdown (ALL/IDYLLIC/BASILISK), tags/stack chips (collapsible), search. RUN_ALL respeta filtros activos.

---

## Sonidos

Pool run (inicio test, random 1): locked-in, course-laid-in, make-it-so, easy-thrusters, hostiles-confirmed-and-locked, checklist-protocol-initiated, i-copy-that.  
Botón UI: starcraft-confirm.  
Boot (random): all-hands, commlink-online.  
Pass: research-complete.  
Fail (random): ghost-death, marine-death.  
Interlock: nunca superpone sonidos del run pool.  
Archivos en: `frontend/public/sounds/`.

---

## Tailscale

```bash
sudo tailscale funnel 8003
# acceso: https://agrim.tail2a8082.ts.net:8003
```

---

## Reglas importantes

- `start_new_session=True` en subprocess → subprocesos no heredan socket 8003.  
- `--testPathPatterns` (no `--testPathPattern`) en jest individual.  
- pytest test individual: `file_id::test_id` como nodeID.  
- Rebuild obligatorio después de editar frontend — servidor sirve `static/`, no fuente.
