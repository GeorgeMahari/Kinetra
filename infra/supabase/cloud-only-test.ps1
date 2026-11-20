# Proves that the public Kinetra API works on Supabase alone, with the local Docker database stopped,
# and that what it saves is still there after the API restarts.
#   powershell -ExecutionPolicy Bypass -File infra\supabase\cloud-only-test.ps1
#
# 1. Stops the local PostgreSQL container (docker stop: the data volume is kept) if it is running.
# 2. Restarts the public API (infra\public\start-public.ps1) and checks from its log that it
#    connected to the Supabase pooler, not to this computer.
# 3. smoke_test.py through the public URL: register, login, refresh, profile, onboarding, results,
#    isolation between accounts, a direct read of the rows on Supabase, and cleanup.
# 4. restart_test.py save, API restart, restart_test.py verify: the same account and result read
#    back after the restart, then the account is deleted.
# 5. Starts the local container again if it was running before.
# Throwaway accounts only (smoke-<random>@example.com); nothing else is read or changed.

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\..\public\common.ps1"
$s = Get-PublicSettings
if ($s['KINETRA_DB_TARGET'] -ne 'supabase') { throw 'KINETRA_DB_TARGET in infra\public\.env.public is not supabase' }
$base = "https://$($s['KINETRA_PUBLIC_HOSTNAME'])"
$python = Join-Path $Backend '.venv\Scripts\python.exe'
$failures = 0

function Invoke-Step([string]$Name, [scriptblock]$Body) {
    Write-Host "`n== $Name"
    & $Body
    if ($LASTEXITCODE -ne 0) { $script:failures++; Write-Host "FAIL  $Name" }
}

function Restart-PublicApi {
    & "$PSScriptRoot\..\public\stop-public.ps1" | Out-Null
    & "$PSScriptRoot\..\public\start-public.ps1"
    $line = Select-String -Path (Join-Path $RunDir 'api.err.log') -Pattern 'Database reachable: (.+)$' | Select-Object -Last 1
    $target = if ($line) { $line.Matches[0].Groups[1].Value } else { '' }
    Write-Host "API connected to: $target"
    if ($target -notmatch '@[^ ]+\.supabase\.com:') { throw "The API did not connect to Supabase ($target)" }
}

$wasRunning = (docker inspect -f '{{.State.Running}}' kinetra-db-1 2>$null) -eq 'true'
$state = Join-Path ([IO.Path]::GetTempPath()) ("kinetra-restart-" + [guid]::NewGuid() + '.json')
try {
    if ($wasRunning) {
        docker stop kinetra-db-1 | Out-Null
        Write-Host 'Local PostgreSQL container: stopped for this test (data volume kept)'
    }
    Restart-PublicApi
    # The smoke test's direct database check uses the API's own settings (kinetra_app on Supabase).
    Set-DatabaseEnvironment $s | Out-Null
    Push-Location $Backend
    try {
        Invoke-Step 'End-to-end through the public URL' { & $python ..\infra\supabase\smoke_test.py $base }
        Invoke-Step 'Save before the restart' { & $python ..\infra\supabase\restart_test.py save $base $state }
        Restart-PublicApi
        Invoke-Step 'Read back after the restart' { & $python ..\infra\supabase\restart_test.py verify $base $state }
    } finally {
        Pop-Location
    }
} finally {
    if (Test-Path $state) { Remove-Item $state }
    if ($wasRunning) {
        docker start kinetra-db-1 | Out-Null
        Write-Host 'Local PostgreSQL container: started again'
    }
}
if ($failures) { throw "$failures step(s) failed" }
Write-Host "`nAll steps passed: the public API runs on Supabase without the local database."
