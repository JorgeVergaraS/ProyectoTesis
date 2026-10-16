#!/bin/sh
set -eu
target=/usr/local/lib/docker/cli-plugins
mkdir -p "$target"
temporary=$(mktemp -d)
trap 'rm -f "$temporary/docker-compose" "$temporary/docker-compose.sha256" "$temporary/buildx-v0.29.1.linux-amd64" "$temporary/checksums.txt"; rmdir "$temporary"' EXIT
cd "$temporary"
curl -fsSL https://github.com/docker/compose/releases/download/v2.40.3/docker-compose-linux-x86_64 -o docker-compose
curl -fsSL https://github.com/docker/compose/releases/download/v2.40.3/docker-compose-linux-x86_64.sha256 -o docker-compose.sha256
# The upstream checksum names the original binary, while the installed plugin uses a shorter name.
expected=$(cut -d ' ' -f 1 docker-compose.sha256)
printf '%s  docker-compose\n' "$expected" | sha256sum -c -
curl -fsSL https://github.com/docker/buildx/releases/download/v0.29.1/buildx-v0.29.1.linux-amd64 -o buildx-v0.29.1.linux-amd64
curl -fsSL https://github.com/docker/buildx/releases/download/v0.29.1/checksums.txt -o checksums.txt
grep ' [*]buildx-v0.29.1.linux-amd64$' checksums.txt | sha256sum -c -
install -m 755 docker-compose "$target/docker-compose"
install -m 755 buildx-v0.29.1.linux-amd64 "$target/docker-buildx"
docker compose version
docker buildx version
