# Starts the public Kinetra API: PostgreSQL (Docker), FastAPI in production mode, Cloudflare Tunnel.
#   powershell -ExecutionPolicy Bypass -File infra\public\start-public.ps1
# Stop with infra\public\stop-public.ps1, check with infra\public\status-public.ps1.
#
# FastAPI listens on 127.0.0.1:8000 only; PostgreSQL on 127.0.0.1:5433 only. The internet reaches
# the API solely through the outbound tunnel. The script refuses to start when a secret is missing
# or when the database has migrations that have not been applied (those need your confirmation).

. "$PSScriptRoot\common.ps1"
$s = Get-PublicSettings
$hostname = $s['KINETRA_PUBLIC_HOSTNAME']
$tunnel = if ($s['KINETRA_TUNNEL_NAME']) { $s['KINETRA_TUNNEL_NAME'] } else { 'kinetra-api' }
if (-not $hostname) { throw 'Set KINETRA_PUBLIC_HOSTNAME in infra\public\.env.public' }
$configPath = Get-TunnelConfigPath $tunnel
if (-not (Test-Path $configPath)) { throw "No tunnel config at $configPath. Run infra\public\setup-tunnel.ps1 first." }

foreach ($name in 'KINETRA_JWT_SECRET', 'KINETRA_SMTP_PASSWORD') {
    $v = Get-UserSecret $name
    if (-not $v) { throw "User environment variable $name is not set." }
    Set-Item -Path "Env:$name" -Value $v
}
foreach ($name in 'KINETRA_SMTP_HOST', 'KINETRA_SMTP_USER', 'KINETRA_EMAIL_FROM') {
    if (-not $s[$name]) { throw "Set $name in infra\public\.env.public" }
}

# 1. Database: Supabase (KINETRA_DB_TARGET=supabase) or the local Docker PostgreSQL.
$dbTarget = Set-DatabaseEnvironment $s
if ($dbTarget -eq 'supabase') {
    Write-Host "Database: Supabase, $($env:KINETRA_DB_HOST) as $($env:KINETRA_DB_USER) (sslmode=$($env:KINETRA_DB_SSLMODE))"
} else {
    Push-Location $Root
    docker compose up -d db | Out-Null
    Pop-Location
    $deadline = (Get-Date).AddSeconds(60)
    do {
        $health = docker inspect -f '{{.State.Health.Status}}' kinetra-db-1 2>$null
        if ($health -eq 'healthy') { break }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    if ($health -ne 'healthy') { throw 'PostgreSQL did not become healthy within 60 s' }
    Write-Host 'Database: local PostgreSQL, healthy (127.0.0.1:5433, not published to the internet)'
}

# 2. Production settings for this process tree only (nothing is written to disk).
$env:KINETRA_ENVIRONMENT = 'production'
$env:KINETRA_CLIENT_IP_HEADER = 'CF-Connecting-IP'
$env:KINETRA_PUBLIC_BASE_URL = "https://$hostname"
$env:KINETRA_EMAIL_BACKEND = 'smtp'
$env:KINETRA_SMTP_HOST = $s['KINETRA_SMTP_HOST']
$env:KINETRA_SMTP_PORT = if ($s['KINETRA_SMTP_PORT']) { $s['KINETRA_SMTP_PORT'] } else { '587' }
$env:KINETRA_SMTP_USER = $s['KINETRA_SMTP_USER']
$env:KINETRA_EMAIL_FROM = $s['KINETRA_EMAIL_FROM']

# 3. Migrations must already be applied; this script never changes the schema.
$migrated = Test-DatabaseMigrated
if (-not $migrated.Ok) {
    throw "Database is not at the latest migration (current: '$($migrated.Current)', head: '$($migrated.Head)'). Apply it after review (docs/SUPABASE_MIGRATION.md)."
}

# 4. FastAPI (one process: the login rate limiter is in-process)
if ((Test-Http 'http://127.0.0.1:8000/api/v1/health/live') -ne 0) {
    throw 'Something already listens on 127.0.0.1:8000 (a development server?). Stop it first.'
}
$api = Start-Process -FilePath (Join-Path $Backend '.venv\Scripts\uvicorn.exe') `
    -ArgumentList 'app.main:app', '--host', '127.0.0.1', '--port', '8000', '--no-server-header' `
    -WorkingDirectory $Backend -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $RunDir 'api.log') -RedirectStandardError (Join-Path $RunDir 'api.err.log')
Set-Content (Join-Path $RunDir 'api.pid') $api.Id
$deadline = (Get-Date).AddSeconds(30)
do { Start-Sleep -Seconds 1; $code = Test-Http 'http://127.0.0.1:8000/api/v1/health/ready' } while ($code -ne 200 -and (Get-Date) -lt $deadline -and -not $api.HasExited)
if ($code -ne 200) { throw "API did not become ready (see $RunDir\api.err.log)" }
Write-Host 'API: ready on 127.0.0.1:8000 (production mode)'

# 5. Cloudflare Tunnel
$cf = Get-Cloudflared
$tun = Start-Process -FilePath $cf -ArgumentList 'tunnel', '--config', $configPath, 'run', $tunnel `
    -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $RunDir 'tunnel.log') -RedirectStandardError (Join-Path $RunDir 'tunnel.err.log')
Set-Content (Join-Path $RunDir 'tunnel.pid') $tun.Id
$deadline = (Get-Date).AddSeconds(45)
do { Start-Sleep -Seconds 2; $code = Test-Http "https://$hostname/api/v1/health/ready" } while ($code -ne 200 -and (Get-Date) -lt $deadline -and -not $tun.HasExited)
if ($code -ne 200) { throw "Public endpoint not reachable yet (HTTP $code). See $RunDir\tunnel.err.log" }
Write-Host "Public API: https://$hostname/api/v1 is online"
