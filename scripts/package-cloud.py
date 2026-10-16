#!/usr/bin/env python3
"""Package source needed to rebuild Nexo; excludes credentials, local state and dependencies."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
target = root / ".tmp" / "nexo-source.zip"
target.parent.mkdir(exist_ok=True)
excluded = {"node_modules", "target", "dist", ".angular", ".git", ".tmp", ".tools", "coverage", "__pycache__"}
roots = ["backend", "event-support", "event-worker", "rabbit-admin", "frontend", "infra", "scripts", ".mvn"]
with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
    for directory in roots:
        for path in (root / directory).rglob("*"):
            relative = path.relative_to(root)
            if not path.is_file() or any(part in excluded for part in relative.parts): continue
            if path.name.startswith(".env") or path.suffix in {".pem", ".key", ".pfx"}: continue
            if not path.resolve().is_relative_to(root): raise ValueError("File outside repository")
            archive.write(path, relative.as_posix())
    for name in ["pom.xml", "mvnw", "mvnw.cmd", "compose.platform.yml", ".dockerignore"]:
        archive.write(root / name, name)
print(str(target), target.stat().st_size, "bytes")
