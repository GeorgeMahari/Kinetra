# Reports whether each piece of the public deployment is up. Read-only.
. "$PSScriptRoot\common.ps1"
$s = Get-PublicSettings
$hostname = $s['KINETRA_PUBLIC_HOSTNAME']

$db = docker inspect -f '{{.State.Health.Status}}' kinetra-db-1 2>$null
Write-Host ('PostgreSQL (container kinetra-db-1): ' + ($(if ($db) { $db } else { 'not running' })))
Write-Host ('API local  /health/ready: HTTP ' + (Test-Http 'http://127.0.0.1:8000/api/v1/health/ready'))
if ($hostname) {
    Write-Host ("API public https://$hostname/api/v1/health/ready: HTTP " + (Test-Http "https://$hostname/api/v1/health/ready"))
    # Anything outside /api/v1/ must not be served through the tunnel.
    Write-Host ("Outside the API (https://$hostname/docs): HTTP " + (Test-Http "https://$hostname/docs") + ' (expected 404)')
}
foreach ($name in 'api', 'tunnel') {
    $pidFile = Join-Path $RunDir "$name.pid"
    $alive = (Test-Path $pidFile) -and (Get-Process -Id ([int](Get-Content $pidFile)) -ErrorAction SilentlyContinue)
    Write-Host ("Process ${name}: " + ($(if ($alive) { 'running' } else { 'not running' })))
}
