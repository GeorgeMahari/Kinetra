# Reports whether each piece of the public deployment is up. Read-only.
. "$PSScriptRoot\common.ps1"
$s = Get-PublicSettings
$hostname = $s['KINETRA_PUBLIC_HOSTNAME']

if ($s['KINETRA_DB_TARGET'] -eq 'supabase') {
    Write-Host "Database: Supabase ($($s['KINETRA_DB_HOST'])); its state shows in /health/ready below"
} else {
    $db = docker inspect -f '{{.State.Health.Status}}' kinetra-db-1 2>$null
    Write-Host ('Database: local PostgreSQL (container kinetra-db-1): ' + ($(if ($db) { $db } else { 'not running' })))
}
Write-Host ('API local  /health/ready: HTTP ' + (Test-Http 'http://127.0.0.1:8000/api/v1/health/ready'))
if ($hostname) {
    Write-Host ("API public https://$hostname/api/v1/health/ready: HTTP " + (Test-Http "https://$hostname/api/v1/health/ready"))
    # Anything outside /api/v1/ must not be served through the tunnel.
    Write-Host ("Outside the API (https://$hostname/docs): HTTP " + (Test-Http "https://$hostname/docs") + ' (expected 404)')
}
if ($s['KINETRA_TUNNEL_PROVIDER'] -eq 'tailscale') {
    $ErrorActionPreference = 'Continue'
    $funnel = (& (Get-Tailscale) funnel status 2>&1 | ForEach-Object { "$_" }) -join ' '
    $ErrorActionPreference = 'Stop'
    Write-Host ('Tailscale Funnel: ' + ($(if ($funnel -match 'Funnel on') { 'on' } else { 'off' })))
}
foreach ($name in 'api', 'tunnel') {
    $pidFile = Join-Path $RunDir "$name.pid"
    $alive = (Test-Path $pidFile) -and (Get-Process -Id ([int](Get-Content $pidFile)) -ErrorAction SilentlyContinue)
    Write-Host ("Process ${name}: " + ($(if ($alive) { 'running' } else { 'not running' })))
}
