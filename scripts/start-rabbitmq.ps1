param([switch]$PauseConsumer)

$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectPath '.env'
if (-not (Test-Path -LiteralPath $envPath)) {
    throw 'Primero configura .env usando .env.example para tu instalacion local de Nexo.'
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker no esta disponible.' }
docker info --format '{{.ServerVersion}}' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Abre Docker Desktop y espera a que el motor este listo.' }

$settings = [IO.File]::ReadAllText($envPath)
function Set-LocalSetting([string]$name, [string]$value) {
    $pattern = '(?m)^' + [regex]::Escape($name) + '=.*$'
    $line = "$name=$value"
    if ([regex]::IsMatch($script:settings, $pattern)) {
        $script:settings = [regex]::Replace($script:settings, $pattern, $line)
    } else {
        $script:settings = $script:settings.TrimEnd() + "`n$line`n"
    }
}
if ($settings -notmatch '(?m)^RABBITMQ_PASSWORD=(?!\s*$|replace-with)[^\r\n]+') {
    $randomBytes = New-Object byte[] 32
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($randomBytes) } finally { $generator.Dispose() }
    Set-LocalSetting 'RABBITMQ_PASSWORD' ([Convert]::ToBase64String($randomBytes))
}
Set-LocalSetting 'NEXO_EVENTS_ENABLED' 'true'
Set-LocalSetting 'NEXO_EVENTS_CONSUMER_ENABLED' $(if ($PauseConsumer) { 'false' } else { 'true' })
if ($settings -notmatch '(?m)^RABBITMQ_USER=') { Set-LocalSetting 'RABBITMQ_USER' 'nexo' }
[IO.File]::WriteAllText($envPath, $settings, (New-Object Text.UTF8Encoding($false)))

Push-Location $projectPath
try {
    docker compose --profile events up -d --wait rabbitmq
    if ($LASTEXITCODE -ne 0) { throw 'RabbitMQ no alcanzo un estado saludable. Revisa docker compose logs rabbitmq.' }
    docker compose exec -T rabbitmq rabbitmq-diagnostics -q ping
    if ($LASTEXITCODE -ne 0) { throw 'RabbitMQ no respondio al diagnostico.' }
} finally { Pop-Location }
Write-Output 'RabbitMQ listo. Credenciales guardadas en .env (no se muestran).'
Write-Output 'Reinicia el backend para cargar NEXO_EVENTS_ENABLED y NEXO_EVENTS_CONSUMER_ENABLED.'
Write-Output 'Panel: http://localhost:15672 (o RABBITMQ_MANAGEMENT_PORT si lo personalizaste).'
