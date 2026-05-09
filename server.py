"""
nexus-test-dashboard server — FastAPI, port 8003.

Endpoints:
  GET  /api/repos          — discover all repos with test files
  GET  /api/config         — get tags + pinned config
  POST /api/config         — update config
  POST /api/run            — start a test run, returns run_id
  WS   /ws/{run_id}        — stream output for a run

Static files: serves frontend/dist/ (build with: cd frontend && pnpm build)
Dev: frontend runs on Vite 5174, proxied to here.
"""
from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).parent))
from scanners.repo_scanner import discover_repos
from scanners.test_scanner import scan_repo_tests

# ─── Constants ────────────────────────────────────────────────────────────────

REPOS_ROOT = Path("/home/agrim/github/idyllic/repos")
CONFIG_PATH = Path(__file__).parent / "test-config.json"
STATIC_DIR = Path(__file__).parent / "static"

# ─── FastAPI app ──────────────────────────────────────────────────────────────

app = FastAPI(title="NEXUS_TEST_GRID", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Config ───────────────────────────────────────────────────────────────────

def _load_config() -> dict:
    try:
        return json.loads(CONFIG_PATH.read_text("utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {"tags": {}, "pinned": []}


def _save_config(cfg: dict) -> None:
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2), "utf-8")


# ─── In-memory run registry ───────────────────────────────────────────────────

_runs: dict[str, dict[str, Any]] = {}


# ─── Build run command ────────────────────────────────────────────────────────

def _build_cmd(repo_id: str, file_id: str | None, test_id: str | None, stack: str, repo_path: str) -> list[str]:
    if stack == "jest":
        cmd = ["pnpm", "exec", "jest", "--passWithNoTests", "--forceExit", "--colors"]
        if file_id:
            cmd += ["--testPathPattern", file_id]
        if test_id:
            cmd += ["--testNamePattern", test_id]
        return cmd
    if stack == "vitest":
        cmd = ["pnpm", "exec", "vitest", "run", "--reporter=verbose"]
        if file_id:
            cmd.append(file_id)
        return cmd
    if stack == "pytest":
        cmd = [sys.executable, "-m", "pytest", "-v", "--tb=short"]
        if test_id:
            cmd.append(test_id)
        elif file_id:
            cmd.append(file_id)
        return cmd
    if stack == "godot":
        gut_path = Path(repo_path) / "addons" / "gut"
        gdunit_path = Path(repo_path) / "addons" / "gdUnit4"
        if gut_path.exists():
            cmd = ["godot", "--headless", "-d", "-s", "addons/gut/gut_cmdln.gd", "-ginclude_subdirs", "-gexit"]
            if file_id:
                cmd += [f"-gscript={file_id}"]
            else:
                cmd += ["-gdir=tests/unit"]
            return cmd
        if gdunit_path.exists():
            return ["godot", "--headless", "--path", repo_path, "--gdunit4", "--ignoreHeadlessMode"]
        return []
    return []


# ─── API routes ───────────────────────────────────────────────────────────────

@app.get("/api/repos")
async def get_repos(refresh: bool = False) -> JSONResponse:
    repos = [r for r in discover_repos() if not r.get("skip_reason")]
    cfg = _load_config()
    tag_map: dict[str, list[str]] = cfg.get("tags", {})

    # Scan all repos in parallel (static file scan — no subprocess)
    tasks = [
        asyncio.to_thread(scan_repo_tests, r["path"], r["stack"])
        for r in repos
    ]
    files_list = await asyncio.gather(*tasks)

    result = []
    for r, files in zip(repos, files_list):
        total = sum(f.get("testCount", 0) for f in files) or len(files)
        result.append({
            **r,
            "testCount": total,
            "status": "pending",
            "files": files,
            "tags": tag_map.get(r["id"], []),
        })

    return JSONResponse(result)


@app.get("/api/config")
async def get_config() -> JSONResponse:
    return JSONResponse(_load_config())


@app.get("/api/system")
async def get_system() -> JSONResponse:
    meminfo: dict[str, int] = {}
    with open("/proc/meminfo") as f:
        for line in f:
            key, _, value, *_ = line.split()
            meminfo[key.rstrip(":")] = int(value)

    kb_total = meminfo["MemTotal"]
    kb_available = meminfo["MemAvailable"]
    kb_used = kb_total - kb_available

    gb_total = round(kb_total / 1024 / 1024, 1)
    gb_available = round(kb_available / 1024 / 1024, 1)
    gb_used = round(kb_used / 1024 / 1024, 1)
    percent = round(kb_used / kb_total * 100, 1)

    return JSONResponse({
        "ram_total_gb": gb_total,
        "ram_available_gb": gb_available,
        "ram_used_gb": gb_used,
        "ram_percent": percent,
    })


class ConfigUpdate(BaseModel):
    tags: dict[str, list[str]] | None = None
    pinned: list[str] | None = None


@app.post("/api/config")
async def update_config(body: ConfigUpdate) -> JSONResponse:
    cfg = _load_config()
    if body.tags is not None:
        cfg["tags"] = body.tags
    if body.pinned is not None:
        cfg["pinned"] = body.pinned
    _save_config(cfg)
    return JSONResponse({"ok": True})


class RunRequest(BaseModel):
    repo_id: str
    stack: str
    repo_path: str
    file_id: str | None = None
    test_id: str | None = None
    label: str = ""
    cmd: str | None = None  # raw cmd override (demo mode)


@app.post("/api/run")
async def start_run(body: RunRequest) -> JSONResponse:
    run_id = str(uuid.uuid4())
    cmd = _build_cmd(body.repo_id, body.file_id, body.test_id, body.stack, body.repo_path)
    if not cmd:
        return JSONResponse({"error": "could not build command"}, status_code=400)

    _runs[run_id] = {
        "cmd": cmd,
        "cwd": body.repo_path,
        "label": body.label,
        "status": "pending",
    }
    return JSONResponse({"run_id": run_id, "cmd": cmd})


@app.websocket("/ws/{run_id}")
async def ws_run(websocket: WebSocket, run_id: str) -> None:
    await websocket.accept()

    run = _runs.get(run_id)
    if not run:
        await websocket.send_json({"type": "error", "text": "run_id not found"})
        await websocket.close()
        return

    cmd = run["cmd"]
    cwd = run["cwd"]
    run["status"] = "running"

    import time
    t0 = time.monotonic()

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env={**os.environ, "FORCE_COLOR": "0", "NO_COLOR": "1"},
        )

        assert proc.stdout is not None

        async def stream_output() -> None:
            async for raw in proc.stdout:
                line = raw.decode("utf-8", errors="replace").rstrip()
                await websocket.send_json({"type": "line", "text": line})

        await asyncio.gather(stream_output(), proc.wait())
        duration = time.monotonic() - t0
        run["status"] = "done"
        run["exit_code"] = proc.returncode

        await websocket.send_json({
            "type": "done",
            "exit_code": proc.returncode,
            "duration": round(duration, 2),
        })

    except (WebSocketDisconnect, ConnectionResetError):
        pass
    except Exception as exc:
        try:
            await websocket.send_json({"type": "error", "text": str(exc)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


# ─── Static files (frontend build) ────────────────────────────────────────────

if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8003, reload=True)
