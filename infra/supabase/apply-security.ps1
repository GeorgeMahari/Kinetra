# Creates the kinetra_app login role and applies privileges and RLS (db/sql/supabase/*.sql) on the
# target database, as its admin user. Idempotent: safe to run again after new migrations.
#
#   powershell -ExecutionPolicy Bypass -File infra\supabase\apply-security.ps1 `
#       -TargetHost <host> -TargetUser postgres.<project-ref> [-SslMode require] [-SkipRole] [-SkipJobs]
#
# 03_jobs.sql needs pg_cron (available on Supabase); pass -SkipJobs for a plain PostgreSQL target.
#
# Secrets (user environment variables, never files):
#   SUPABASE_DB_PASSWORD     admin (postgres) password, typed by you in your own terminal
#   KINETRA_APP_DB_PASSWORD  password of kinetra_app; generated here on the first run if missing
# Only a SCRAM verifier of the kinetra_app password is sent to the server.

param(
    [Parameter(Mandatory)] [string]$TargetHost,
    [Parameter(Mandatory)] [string]$TargetUser,
    [int]$TargetPort = 5432,
    [string]$TargetDb = 'postgres',
    [string]$PasswordVariable = 'SUPABASE_DB_PASSWORD',
    [ValidateSet('disable', 'require', 'verify-full')] [string]$SslMode = 'require',
    [switch]$SkipRole,
    [switch]$SkipJobs
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path "$PSScriptRoot\..\..").Path
$Container = 'kinetra-db-1'   # used only for its psql client

function Get-Secret([string]$Name) {
    $v = [Environment]::GetEnvironmentVariable($Name, 'Process')
    if (-not $v) { $v = [Environment]::GetEnvironmentVariable($Name, 'User') }
    return $v
}

$admin = Get-Secret $PasswordVariable
if (-not $admin) { throw "Environment variable $PasswordVariable is not set." }
$env:PGPASSWORD = $admin
$target = "host=$TargetHost port=$TargetPort dbname=$TargetDb user=$TargetUser sslmode=$SslMode connect_timeout=10"

function Invoke-SqlFile([string]$Path, [string[]]$ExtraEnv = @()) {
    $envArgs = @('-e', 'PGPASSWORD') + ($ExtraEnv | ForEach-Object { '-e', $_ })
    Get-Content -Raw $Path | docker exec -i @envArgs $Container psql $target -X -v ON_ERROR_STOP=1 -f -
    if ($LASTEXITCODE -ne 0) { throw "Failed: $Path" }
}

if (-not $SkipRole) {
    $appPassword = Get-Secret 'KINETRA_APP_DB_PASSWORD'
    if (-not $appPassword) {
        $bytes = New-Object byte[] 32
        [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
        $appPassword = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', 'A').Replace('/', 'B')
        [Environment]::SetEnvironmentVariable('KINETRA_APP_DB_PASSWORD', $appPassword, 'User')
        Write-Host 'Created the KINETRA_APP_DB_PASSWORD user environment variable (not written to any file).'
    }
    $env:KINETRA_APP_DB_PASSWORD = $appPassword
    $env:KINETRA_APP_DB_VERIFIER = & "$Root\backend\.venv\Scripts\python.exe" "$PSScriptRoot\scram_verifier.py" KINETRA_APP_DB_PASSWORD
    if ($LASTEXITCODE -ne 0) { throw 'Could not compute the SCRAM verifier' }
    Invoke-SqlFile "$Root\db\sql\supabase\01_app_role.sql" @('KINETRA_APP_DB_VERIFIER')
    Remove-Item Env:KINETRA_APP_DB_VERIFIER, Env:KINETRA_APP_DB_PASSWORD
    Write-Host 'Role kinetra_app: ready'
}

Invoke-SqlFile "$Root\db\sql\supabase\02_security.sql"
Write-Host 'Privileges and RLS: applied'
if (-not $SkipJobs) {
    Invoke-SqlFile "$Root\db\sql\supabase\03_jobs.sql"
    Write-Host 'Scheduled jobs (pg_cron): applied'
}
Remove-Item Env:PGPASSWORD
