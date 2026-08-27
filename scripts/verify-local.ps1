param(
    [string]$ApiUrl = 'http://localhost:8080',
    [string]$FrontendUrl = 'http://localhost:4200'
)

$ErrorActionPreference = 'Stop'

function Assert-Health {
    param([string]$Url, [switch]$CheckService)
    $result = Invoke-RestMethod -Uri $Url -TimeoutSec 20
    if ($result.status -ne 'UP') { throw "Health check failed: $Url" }
    if ($CheckService -and $result.service -ne 'nexo-backend') {
        throw "Unexpected service at $Url"
    }
    Write-Output "PASS $Url"
}

Assert-Health -Url "$ApiUrl/api/public/health" -CheckService
Assert-Health -Url "$ApiUrl/actuator/health/readiness"
Assert-Health -Url "$FrontendUrl/api/public/health" -CheckService

$frontend = Invoke-WebRequest -UseBasicParsing -Uri $FrontendUrl -TimeoutSec 20
if ($frontend.StatusCode -ne 200 -or $frontend.Content -notmatch '<app-root>') {
    throw 'Angular did not return its application shell'
}
Write-Output "PASS $FrontendUrl (application shell; visual checks are separate)"

$docs = Invoke-RestMethod -Uri "$ApiUrl/v3/api-docs" -TimeoutSec 20
if (-not $docs.paths.'/api/public/health'.get) { throw 'Public health is not documented' }
Write-Output 'PASS OpenAPI public health documentation'

$cors = Invoke-WebRequest -UseBasicParsing -Uri "$ApiUrl/api/public/health" `
    -Method Options -Headers @{
        Origin = 'http://localhost:4200'
        'Access-Control-Request-Method' = 'GET'
    } -TimeoutSec 20
if ($cors.Headers['Access-Control-Allow-Origin'] -ne 'http://localhost:4200') {
    throw 'Angular origin not allowed by CORS'
}
Write-Output 'PASS explicit Angular CORS origin'
