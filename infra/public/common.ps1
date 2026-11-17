# Shared helpers for the public-deployment scripts. Dot-source it: . "$PSScriptRoot\common.ps1"
# Reads non-secret settings from infra/public/.env.public and secrets from user environment
# variables only. Nothing here writes a secret to disk.

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path "$PSScriptRoot\..\..").Path
$Backend = Join-Path $Root 'backend'
$RunDir = Join-Path $Root 'infra\public\run'      # PID files and logs (ignored by git)
New-Item -ItemType Directory -Force $RunDir | Out-Null

function Get-PublicSettings {
    $file = Join-Path $PSScriptRoot '.env.public'
    if (-not (Test-Path $file)) {
        throw "Missing $file. Copy infra\public\public.env.example to infra\public\.env.public and fill it in."
    }
    $settings = @{}
    foreach ($line in Get-Content $file) {
        $t = $line.Trim()
        if (-not $t -or $t.StartsWith('#')) { continue }
        $i = $t.IndexOf('=')
        if ($i -lt 1) { continue }
        $settings[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim()
    }
    return $settings
}

function Get-UserSecret([string]$Name) {
    $value = [Environment]::GetEnvironmentVariable($Name, 'Process')
    if (-not $value) { $value = [Environment]::GetEnvironmentVariable($Name, 'User') }
    return $value
}

function Set-DatabaseEnvironment([hashtable]$Settings) {
    # Points this process (and the API it starts) at the database chosen in .env.public.
    # KINETRA_DB_TARGET=supabase: the Session Pooler as kinetra_app over TLS; password from the
    # KINETRA_APP_DB_PASSWORD user variable. Anything else: the local Docker database.
    # Returns 'supabase' or 'local'.
    if ($Settings['KINETRA_DB_TARGET'] -eq 'supabase') {
        foreach ($name in 'KINETRA_DB_HOST', 'KINETRA_DB_USER') {
            if (-not $Settings[$name]) { throw "Set $name in infra\public\.env.public" }
        }
        $pw = Get-UserSecret 'KINETRA_APP_DB_PASSWORD'
        if (-not $pw) { throw 'User environment variable KINETRA_APP_DB_PASSWORD is not set.' }
        $env:KINETRA_DB_PASSWORD = $pw
        $env:KINETRA_DB_HOST = $Settings['KINETRA_DB_HOST']
        $env:KINETRA_DB_PORT = if ($Settings['KINETRA_DB_PORT']) { $Settings['KINETRA_DB_PORT'] } else { '5432' }
        $env:KINETRA_DB_USER = $Settings['KINETRA_DB_USER']
        $env:KINETRA_DB_NAME = if ($Settings['KINETRA_DB_NAME']) { $Settings['KINETRA_DB_NAME'] } else { 'postgres' }
        $env:KINETRA_DB_SSLMODE = if ($Settings['KINETRA_DB_SSLMODE']) { $Settings['KINETRA_DB_SSLMODE'] } else { 'require' }
        if ($Settings['KINETRA_DB_SSLROOTCERT']) { $env:KINETRA_DB_SSLROOTCERT = $Settings['KINETRA_DB_SSLROOTCERT'] }
        $env:KINETRA_DB_CONNECT_TIMEOUT_SECONDS = '15'
        return 'supabase'
    }
    $pw = Get-UserSecret 'POSTGRES_PASSWORD'
    if (-not $pw) { throw 'User environment variable POSTGRES_PASSWORD is not set.' }
    $env:POSTGRES_PASSWORD = $pw
    return 'local'
}

function Test-DatabaseMigrated {
    # True when the configured database is at the latest Alembic revision (read-only check).
    # Alembic logs INFO lines to stderr; Windows PowerShell would turn them into terminating errors.
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    Push-Location $Backend
    try {
        $current = (& .\.venv\Scripts\alembic.exe current 2>$null) -join ' '
        $heads = (& .\.venv\Scripts\alembic.exe heads 2>$null) -join ' '
    } finally {
        Pop-Location
        $ErrorActionPreference = $previous
    }
    $headId = ($heads -split '\s+')[0]
    return [pscustomobject]@{ Ok = [bool]($headId -and $current -match [regex]::Escape($headId)); Current = $current; Head = $heads }
}

function Get-Cloudflared {
    $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    foreach ($p in @("$env:ProgramFiles\cloudflared\cloudflared.exe", "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe",
                     "$env:LOCALAPPDATA\Microsoft\WinGet\Links\cloudflared.exe")) {
        if (Test-Path $p) { return $p }
    }
    throw 'cloudflared is not installed: winget install --id Cloudflare.cloudflared -e'
}

function Get-TunnelConfigPath([string]$TunnelName) {
    return Join-Path $env:USERPROFILE ".cloudflared\$TunnelName.yml"
}

function Test-Http([string]$Url) {
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 10
        return $r.StatusCode
    } catch {
        if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
        return 0
    }
}

function Stop-FromPidFile([string]$Name) {
    $pidFile = Join-Path $RunDir "$Name.pid"
    if (-not (Test-Path $pidFile)) { return $false }
    $procId = [int](Get-Content $pidFile)
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($proc) { Stop-Process -Id $procId -Force -Confirm:$false }
    Remove-Item $pidFile -Force -Confirm:$false
    return [bool]$proc
}
