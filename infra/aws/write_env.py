import json
import os
from pathlib import Path
import sys

config = json.loads(Path(sys.argv[1]).read_text())
if any("\n" in str(value) or "\r" in str(value) for value in config.values()):
    raise ValueError("Unexpected newline in environment setting")
target = Path(sys.argv[2])
fd = os.open(target, os.O_CREAT | os.O_WRONLY | os.O_TRUNC, 0o600)
with os.fdopen(fd, "w") as output:
    for key, value in config.items():
        if not key.replace("_", "").isalnum(): raise ValueError("Invalid environment key")
        output.write(f"{key}={value}\n")
