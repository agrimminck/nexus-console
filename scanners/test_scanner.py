"""Discovers individual test files and test names per repo."""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


def scan_pytest_files(repo_path: Path) -> list[dict]:
    """Use pytest --collect-only to get test IDs."""
    try:
        result = subprocess.run(
            [sys.executable, "-m", "pytest", "--collect-only", "-q", "--no-header", "--tb=no"],
            cwd=repo_path,
            capture_output=True,
            text=True,
            timeout=30,
        )
        lines = (result.stdout + result.stderr).splitlines()
        files: dict[str, dict] = {}
        for line in lines:
            if "::" in line and not line.startswith("=") and not line.startswith("ERROR"):
                parts = line.strip().split("::")
                file_path = parts[0].strip()
                test_name = "::".join(parts[1:]).strip() if len(parts) > 1 else ""
                if file_path not in files:
                    files[file_path] = {"path": file_path, "tests": [], "status": "pending"}
                if test_name:
                    files[file_path]["tests"].append({
                        "id": f"{file_path}::{test_name}",
                        "name": test_name,
                        "status": "pending",
                    })
        return [
            {**v, "id": v["path"], "testCount": len(v["tests"])}
            for v in files.values()
        ]
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return _scan_pytest_files_static(repo_path)


def _scan_pytest_files_static(repo_path: Path) -> list[dict]:
    """Fallback: grep test_*.py files."""
    result = []
    for f in sorted(repo_path.rglob("test_*.py")):
        rel = str(f.relative_to(repo_path))
        tests = []
        try:
            for m in re.finditer(r"^def (test_\w+)", f.read_text("utf-8"), re.MULTILINE):
                name = m.group(1)
                tests.append({"id": f"{rel}::{name}", "name": name, "status": "pending"})
        except OSError:
            pass
        result.append({"id": rel, "path": rel, "testCount": len(tests), "tests": tests, "status": "pending"})
    return result


def scan_jest_files(repo_path: Path) -> list[dict]:
    """Scan *.spec.ts / *.test.ts files and extract describe/it blocks."""
    result = []
    # Walk manually to skip node_modules and .godot
    SKIP_DIRS = {"node_modules", ".godot", "dist", ".git", "build", "coverage"}
    files: list[Path] = []
    seen: set[str] = set()

    def _walk(d: Path) -> None:
        try:
            for entry in d.iterdir():
                if entry.is_dir():
                    if entry.name not in SKIP_DIRS:
                        _walk(entry)
                elif entry.suffix in (".ts", ".js") and (
                    entry.stem.endswith(".spec") or entry.stem.endswith(".test")
                ):
                    key = str(entry)
                    if key not in seen:
                        seen.add(key)
                        files.append(entry)
        except PermissionError:
            pass

    _walk(repo_path)

    for f in sorted(files):
        rel = str(f.relative_to(repo_path))
        tests = []
        try:
            text = f.read_text("utf-8")
            # Extract it/test descriptions
            for m in re.finditer(r"(?:it|test)\s*\(\s*['\"`]([^'\"` \n]{1,120})", text):
                name = m.group(1).strip()
                tests.append({"id": f"{rel}::{name}", "name": name, "status": "pending"})
        except OSError:
            pass
        result.append({"id": rel, "path": rel, "testCount": len(tests) or 1, "tests": tests, "status": "pending"})
    return result


def scan_godot_files(repo_path: Path) -> list[dict]:
    """Grep test_*.gd for func test_* methods."""
    result = []
    for f in sorted(repo_path.rglob("test_*.gd")):
        if ".godot" in str(f):
            continue
        rel = str(f.relative_to(repo_path))
        tests = []
        try:
            for m in re.finditer(r"^func (test_\w+)", f.read_text("utf-8"), re.MULTILINE):
                name = m.group(1)
                tests.append({"id": f"{rel}::{name}", "name": name, "status": "pending"})
        except OSError:
            pass
        result.append({"id": rel, "path": rel, "testCount": len(tests), "tests": tests, "status": "pending"})
    return result


def scan_repo_tests(repo_path: Path, stack: str) -> list[dict]:
    """Dispatch static scanner by stack (no subprocess — fast discovery)."""
    p = Path(repo_path)
    if stack == "pytest":
        return _scan_pytest_files_static(p)
    if stack in ("jest", "vitest"):
        return scan_jest_files(p)
    if stack == "godot":
        return scan_godot_files(p)
    return []
