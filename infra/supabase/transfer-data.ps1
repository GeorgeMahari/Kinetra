# Copies the Kinetra data from the local PostgreSQL (Docker, kinetra-db-1) into a target database
# whose schema was already created by Alembic (`alembic upgrade head`). Read-only on the source.
#
#   powershell -ExecutionPolicy Bypass -File infra\supabase\transfer-data.ps1 `
#       -TargetHost <host> -TargetUser <user> [-TargetPort 5432] [-TargetDb postgres] `
#       [-PasswordVariable SUPABASE_DB_PASSWORD] [-SslMode require] [-VerifyOnly]
#
# Safety:
# - Refuses unless the target is at the same Alembic revision as the source.
# - Refuses unless every data table on the target is empty (nothing is ever overwritten).
# - One transaction with ON_ERROR_STOP and all constraints active: everything or nothing.
# - `sports` is seeded by the migrations, so it is compared, not copied.
# - Verifies row counts and an md5 checksum of every table on both sides.
# - The password is read from a user environment variable and passed to the container through
#   the environment, never on a command line, in a file or in the output.

param(
    [Parameter(Mandatory)] [string]$TargetHost,
    [Parameter(Mandatory)] [string]$TargetUser,
    [int]$TargetPort = 5432,
    [string]$TargetDb = 'postgres',
    [string]$PasswordVariable = 'SUPABASE_DB_PASSWORD',
    [ValidateSet('disable', 'require', 'verify-full')] [string]$SslMode = 'require',
    [switch]$VerifyOnly
)

$ErrorActionPreference = 'Stop'
$Source = 'kinetra-db-1'
$Seeded = @('sports')
$Skip = @('alembic_version')

$password = [Environment]::GetEnvironmentVariable($PasswordVariable, 'Process')
if (-not $password) { $password = [Environment]::GetEnvironmentVariable($PasswordVariable, 'User') }
if (-not $password) { throw "Environment variable $PasswordVariable is not set." }
$env:PGPASSWORD = $password
$env:PGTZ = 'UTC'
$target = "host=$TargetHost port=$TargetPort dbname=$TargetDb user=$TargetUser sslmode=$SslMode connect_timeout=10"

function Invoke-Source([string]$Sql) {
    $out = docker exec -e PGTZ $Source psql -U kinetra -d kinetra -X -At -v ON_ERROR_STOP=1 -c $Sql
    if ($LASTEXITCODE -ne 0) { throw "Source query failed: $Sql" }
    return $out
}
function Invoke-Target([string]$Sql) {
    $out = docker exec -e PGPASSWORD -e PGTZ $Source psql $target -X -At -v ON_ERROR_STOP=1 -c $Sql
    if ($LASTEXITCODE -ne 0) { throw "Target query failed: $Sql" }
    return $out
}

$tables = Invoke-Source "select tablename from pg_tables where schemaname='public' order by 1"
$dataTables = $tables | Where-Object { $_ -notin $Skip }

# 1. Preconditions
$srcRev = Invoke-Source 'select version_num from alembic_version'
$dstRev = Invoke-Target 'select version_num from alembic_version'
if ($srcRev -ne $dstRev) { throw "Alembic revision differs: source $srcRev, target $dstRev. Run alembic upgrade head on the target first." }
Write-Host "Alembic revision: $srcRev on both"

$dstTables = Invoke-Target "select tablename from pg_tables where schemaname='public' order by 1"
$missing = $tables | Where-Object { $_ -notin $dstTables }
if ($missing) { throw "Tables missing on the target: $($missing -join ', ')" }

if (-not $VerifyOnly) {
    foreach ($t in $dataTables | Where-Object { $_ -notin $Seeded }) {
        $n = [int](Invoke-Target "select count(*) from public.""$t""")
        if ($n -ne 0) { throw "Target table $t already has $n rows. Nothing was copied (no overwrite)." }
    }
    Write-Host 'Target data tables are empty: OK'

    # 2. Copy: data-only dump piped into one transaction on the target, inside the source container
    #    (no file with personal data is written on the host).
    $exclude = ($Seeded + $Skip | ForEach-Object { "--exclude-table-data=public.$_" }) -join ' '
    $cmd = "pg_dump -U kinetra -d kinetra --data-only --no-owner --no-privileges $exclude | " +
           "psql '$target' -X -q -1 -v ON_ERROR_STOP=1 -o /dev/null"
    docker exec -e PGPASSWORD -e PGTZ $Source sh -c $cmd
    if ($LASTEXITCODE -ne 0) { throw 'Copy failed. The transaction was rolled back; the target is unchanged.' }
    Write-Host 'Copy: committed in one transaction'
}

# 3. Verification: row counts and checksums of every table, both sides, in UTC.
$failed = 0
foreach ($t in $tables) {
    $q = "select count(*) || ':' || md5(coalesce(string_agg(x::text, '|' order by x::text), '')) from public.""$t"" x"
    $a = Invoke-Source $q
    $b = Invoke-Target $q
    $status = if ($a -eq $b) { 'OK' } else { $failed++; 'DIFFERENT' }
    Write-Host ('{0,-26} {1,-40} {2}' -f $t, $a, $status)
}
Remove-Item Env:PGPASSWORD
if ($failed) { throw "$failed table(s) differ." }
Write-Host 'All tables identical (row counts and checksums).'
