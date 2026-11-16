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
