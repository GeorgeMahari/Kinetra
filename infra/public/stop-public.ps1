# Stops the tunnel first (the API disappears from the internet), then the API.
# PostgreSQL keeps running (it is local-only and also serves development); stop it with
#   docker compose stop db
. "$PSScriptRoot\common.ps1"
$s = Get-PublicSettings
if ($s['KINETRA_TUNNEL_PROVIDER'] -eq 'tailscale') {
    $ErrorActionPreference = 'Continue'
    & (Get-Tailscale) funnel --https=443 off 2>&1 | Out-Null
    $ErrorActionPreference = 'Stop'
    Write-Host 'Tailscale Funnel: off'
}
if (Stop-FromPidFile 'tunnel') { Write-Host 'Cloudflare Tunnel: stopped' }
if (Stop-FromPidFile 'api') { Write-Host 'API: stopped' } else { Write-Host 'API: was not running' }
