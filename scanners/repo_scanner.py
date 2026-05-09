"""Detects repos and their test stacks — mirrors logic from run-all-tests.py."""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPOS_ROOT = Path("/home/agrim/github/idyllic/repos")
EXCLUDED = {"idyllic-deploy", "idyllic-infra", "nexus-test-dashboard"}
INFRA_ROOT = REPOS_ROOT / "idyllic-infra"
SMOKE_DIR = INFRA_ROOT / "tests" / "smoke"
E2E_DIR = INFRA_ROOT / "tests" / "e2e"


def detect_stack(repo_path: Path) -> tuple[str, str]:
    """Returns (stack, skip_reason). skip_reason non-empty → skip."""
    project_godot = repo_path / "project.godot"
    pkg_json = repo_path / "package.json"

    if project_godot.exists():
        has_gut = (repo_path / "addons" / "gut").exists()
        has_gdunit = (repo_path / "addons" / "gdUnit4").exists()
        if has_gut or has_gdunit:
            return "godot", ""
        return "godot", "no GUT/gdUnit4 installed"

    if pkg_json.exists():
        try:
            pkg = json.loads(pkg_json.read_text("utf-8"))
        except (json.JSONDecodeError, OSError):
            return "unknown", "package.json parse error"
        all_deps = {**pkg.get("devDependencies", {}), **pkg.get("dependencies", {})}
        if "vitest" in all_deps:
            return "vitest", ""
        if "jest" in all_deps or "@nestjs/testing" in all_deps:
            if "test" not in pkg.get("scripts", {}):
                return "unknown", "no test script"
            return "jest", ""
        return "unknown", "no jest/vitest"

    if (repo_path / "pytest.ini").exists():
        return "pytest", ""
    if (repo_path / "pyproject.toml").exists():
        content = (repo_path / "pyproject.toml").read_text("utf-8")
        if "[tool.pytest.ini_options]" in content or "[pytest]" in content:
            return "pytest", ""
    tests_dir = repo_path / "tests"
    if tests_dir.exists() and (list(tests_dir.glob("test_*.py")) or list(tests_dir.glob("*_test.py"))):
        return "pytest", ""

    return "unknown", "no runner detected"


def discover_repos() -> list[dict]:
    """Scan all repos and return metadata list."""
    repos = []

    for p in sorted(REPOS_ROOT.iterdir()):
        if not p.is_dir():
            continue
        if p.name in EXCLUDED:
            continue
        if not (p.name.startswith("idyllic-") or p.name.startswith("basilisk-")):
            continue

        stack, skip_reason = detect_stack(p)
        if stack != "unknown":
            repos.append({
                "id": p.name,
                "name": p.name,
                "path": str(p),
                "stack": stack,
                "skip_reason": skip_reason,
            })
        else:
            # Monorepo: scan apps/* subdirs
            apps_dir = p / "apps"
            if apps_dir.is_dir():
                for sub in sorted(apps_dir.iterdir()):
                    if not sub.is_dir():
                        continue
                    sub_stack, sub_skip = detect_stack(sub)
                    if sub_stack == "unknown":
                        continue
                    sub_id = f"{p.name}/{sub.name}"
                    repos.append({
                        "id": sub_id,
                        "name": sub_id,
                        "path": str(sub),
                        "stack": sub_stack,
                        "skip_reason": sub_skip,
                    })

    # Add special infra entries for smoke + e2e
    if SMOKE_DIR.exists():
        repos.append({
            "id": "smoke",
            "name": "smoke-tests (idyllic-infra)",
            "path": str(SMOKE_DIR),
            "stack": "pytest",
            "skip_reason": "",
        })
    if E2E_DIR.exists():
        repos.append({
            "id": "e2e",
            "name": "e2e-flows (idyllic-infra)",
            "path": str(E2E_DIR),
            "stack": "pytest",
            "skip_reason": "",
        })

    return repos
