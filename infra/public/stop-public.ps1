# Stops the tunnel first (the API disappears from the internet), then the API.
# PostgreSQL keeps running (it is local-only and also serves development); stop it with
#   docker compose stop db
. "$PSScriptRoot\common.ps1"
if (Stop-FromPidFile 'tunnel') { Write-Host 'Cloudflare Tunnel: stopped' } else { Write-Host 'Cloudflare Tunnel: was not running' }
if (Stop-FromPidFile 'api') { Write-Host 'API: stopped' } else { Write-Host 'API: was not running' }
