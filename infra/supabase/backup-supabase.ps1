# Backs up the Kinetra schema (public) on Supabase to db\backups\ (ignored by git: personal data).
#   powershell -ExecutionPolicy Bypass -File infra\supabase\backup-supabase.ps1
# Read-only on Supabase. Uses a PostgreSQL 17 client (postgres:17-alpine) so the dump restores on 17.
# Connection settings come from infra\public\.env.public; the admin password from the
# SUPABASE_DB_PASSWORD user environment variable (never written to a file or a command line).
# Restore: docs/SUPABASE_MIGRATION.md, section 6.

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\..\public\common.ps1"
$s = Get-PublicSettings
$dbHost = $s['KINETRA_DB_HOST']
$appUser = $s['KINETRA_DB_USER']
if (-not $dbHost -or -not $appUser -or $appUser -notmatch '\.(.+)$') {
    throw 'Set KINETRA_DB_HOST and KINETRA_DB_USER (kinetra_app.<project-ref>) in infra\public\.env.public'
}
$adminUser = 'postgres.' + $Matches[1]
$password = Get-UserSecret 'SUPABASE_DB_PASSWORD'
if (-not $password) { throw 'User environment variable SUPABASE_DB_PASSWORD is not set.' }

$dir = Join-Path $Root 'db\backups'
New-Item -ItemType Directory -Force $dir | Out-Null
$name = 'supabase_' + (Get-Date -Format 'yyyyMMdd_HHmmss') + '.dump'
$conn = "host=$dbHost port=5432 dbname=postgres user=$adminUser sslmode=require connect_timeout=15"

$env:PGPASSWORD = $password
try {
    docker run --rm -e PGPASSWORD -v "${dir}:/backups" postgres:17-alpine `
        pg_dump $conn --schema=public --format=custom --no-owner --no-privileges --file="/backups/$name"
    if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed' }
} finally {
    Remove-Item Env:PGPASSWORD
}
$size = (Get-Item (Join-Path $dir $name)).Length
Write-Host "Backup: db\backups\$name ($([math]::Round($size / 1KB)) KB)"
