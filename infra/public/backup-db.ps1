# Backs up the kinetra database to db\backups\ (ignored by git: it contains personal data).
#   powershell -ExecutionPolicy Bypass -File infra\public\backup-db.ps1
# Custom-format dump, made inside the container (no password needed there).
# Restore (after confirming!) with pg_restore; see docs/PRIVATE_DISTRIBUTION_GUIDE.md.
. "$PSScriptRoot\common.ps1"
$dir = Join-Path $Root 'db\backups'
New-Item -ItemType Directory -Force $dir | Out-Null
$name = 'kinetra_' + (Get-Date -Format 'yyyyMMdd_HHmmss') + '.dump'
docker exec kinetra-db-1 pg_dump -U kinetra -d kinetra -Fc -f "/tmp/$name"
if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed' }
docker cp "kinetra-db-1:/tmp/$name" (Join-Path $dir $name) | Out-Null
docker exec kinetra-db-1 rm "/tmp/$name"
$size = (Get-Item (Join-Path $dir $name)).Length
Write-Host "Backup: db\backups\$name ($([math]::Round($size / 1KB)) KB)"
