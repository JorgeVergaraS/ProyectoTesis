#!/bin/sh
set -eu
python3 - <<'PY'
import json, os
fields = {'apiUrl': 'PUBLIC_API_URL', 'clientId': 'AZURE_FRONTEND_CLIENT_ID',
          'tenantId': 'AZURE_TENANT_ID', 'apiClientId': 'AZURE_API_CLIENT_ID',
          'redirectUri': 'FRONTEND_ORIGIN'}
config = {key: os.environ[value] for key, value in fields.items() if os.environ.get(value)}
with open('/srv/nexo/runtime-config.js', 'w') as output:
    output.write('window.NEXO_CONFIG = ' + json.dumps(config) + ';\n')
PY
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
