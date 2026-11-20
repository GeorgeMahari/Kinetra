# Deploys the Edge Function "api" to Supabase and sets its secrets from your user environment
# variables. Nothing secret is written to a file or committed.
#
#   powershell -ExecutionPolicy Bypass -File infra\supabase\deploy-function.ps1            # secrets + deploy
#   powershell -ExecutionPolicy Bypass -File infra\supabase\deploy-function.ps1 -SkipSecrets
#
# Needs (user environment variables, set once in your own terminal):
#   SUPABASE_ACCESS_TOKEN    a scoped personal access token for this project
#                            (supabase.com > Account > Access Tokens; permissions: Edge Functions write,
#                            Secrets write, on project vrdwcgzcgukzmyzyuedm only)
#   RESEND_API_KEY           optional. Resend > API Keys, "Sending access", with a sender domain
#                            verified in Resend. Without it, email is disabled (see below).
#   KINETRA_JWT_SECRET       the same secret as the Python API, so existing sign-ins stay valid
#   KINETRA_APP_DB_PASSWORD  the kinetra_app database password (created by apply-security.ps1)
# Node.js (npx) runs a pinned Supabase CLI; Docker is not needed for a deploy.

param(
    [string]$ProjectRef = 'vrdwcgzcgukzmyzyuedm',
    [string]$EmailFrom = '',   # default: KINETRA_EMAIL_FROM from infra\public\.env.public (not committed)
    [string]$ConsentPageUrl = 'https://georgemahari.github.io/Kinetra/consent/',
    [string]$CorsOrigins = '["https://georgemahari.github.io"]',
    [string]$ClientIpHeader = 'x-forwarded-for',   # verify with probe-client-ip.ps1 after each deploy
    [switch]$SkipSecrets
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path "$PSScriptRoot\..\..").Path
$Cli = 'supabase@3.1.0'

function Get-Secret([string]$Name) {
    $v = [Environment]::GetEnvironmentVariable($Name, 'Process')
    if (-not $v) { $v = [Environment]::GetEnvironmentVariable($Name, 'User') }
    if (-not $v) { throw "User environment variable $Name is not set." }
    return $v
}

# Email is optional. Without RESEND_API_KEY the function runs with KINETRA_EMAIL_BACKEND=disabled:
# the app works, and verification codes, password reset and parental consent answer 503
# email_unavailable. Setting the key later and deploying again turns email on.
$resendKey = [Environment]::GetEnvironmentVariable('RESEND_API_KEY', 'Process')
if (-not $resendKey) { $resendKey = [Environment]::GetEnvironmentVariable('RESEND_API_KEY', 'User') }
if ($resendKey) {
    if (-not $EmailFrom) {
        . "$Root\infra\public\common.ps1"
        $EmailFrom = (Get-PublicSettings)['KINETRA_EMAIL_FROM']
        if (-not $EmailFrom) { throw 'Pass -EmailFrom or set KINETRA_EMAIL_FROM in infra\public\.env.public' }
    }
    # Resend sends only from a domain verified in its dashboard, and nobody can verify a free mailbox
    # domain. Without this check the deploy would succeed and every email would be refused (403).
    $fromDomain = ([regex]::Match($EmailFrom, '@([^>\s]+)')).Groups[1].Value.ToLower()
    if (-not $fromDomain) { throw "The sender '$EmailFrom' has no domain." }
    if ($fromDomain -in 'gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'proton.me', 'protonmail.com') {
        throw "Resend cannot send from $fromDomain. Pass -EmailFrom 'Kinetra <no-reply@your-domain>' with a domain verified in Resend."
    }
    $emailSecrets = [ordered]@{ KINETRA_EMAIL_BACKEND = 'resend'; RESEND_API_KEY = $resendKey; KINETRA_EMAIL_FROM = $EmailFrom }
} else {
    Write-Host 'RESEND_API_KEY is not set: deploying with email disabled.'
    $emailSecrets = [ordered]@{ KINETRA_EMAIL_BACKEND = 'disabled' }
}
$env:SUPABASE_ACCESS_TOKEN = Get-Secret 'SUPABASE_ACCESS_TOKEN'
Push-Location $Root
try {
    if (-not $SkipSecrets) {
        $secrets = [ordered]@{
            KINETRA_ENVIRONMENT                   = 'production'
            KINETRA_JWT_SECRET                    = Get-Secret 'KINETRA_JWT_SECRET'
            KINETRA_DB_HOST                       = 'aws-0-eu-west-1.pooler.supabase.com'
            KINETRA_DB_PORT                       = '6543'   # transaction pooler: short-lived invocations
            KINETRA_DB_NAME                       = 'postgres'
            KINETRA_DB_USER                       = "kinetra_app.$ProjectRef"
            KINETRA_DB_PASSWORD                   = Get-Secret 'KINETRA_APP_DB_PASSWORD'
            KINETRA_DB_SSLMODE                    = 'require'
            KINETRA_PUBLIC_BASE_URL              = "https://$ProjectRef.supabase.co/functions/v1/api"
            KINETRA_CONSENT_PAGE_URL              = $ConsentPageUrl
            KINETRA_CORS_ORIGINS                  = $CorsOrigins
            KINETRA_CLIENT_IP_HEADER              = $ClientIpHeader
        }
        foreach ($k in $emailSecrets.Keys) { $secrets[$k] = $emailSecrets[$k] }
        # One call; values go to the CLI as arguments (never to a file) and Supabase stores them encrypted.
        $pairs = foreach ($k in $secrets.Keys) { if ($secrets[$k] -ne '') { "$k=$($secrets[$k])" } }
        npx --yes $Cli secrets set --remote=$ProjectRef --yes @pairs | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Setting the function secrets failed.' }
        Write-Host "Secrets set: $($secrets.Keys -join ', ')"
    }
    npx --yes $Cli functions deploy api --remote=$ProjectRef --no-verify-jwt --use-api --yes
    if ($LASTEXITCODE -ne 0) { throw 'Deploy failed.' }
    $url = "https://$ProjectRef.supabase.co/functions/v1/api/api/v1/health/ready"
    Write-Host "Deployed. Readiness: $url"
    (Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 60).Content
} finally {
    Pop-Location
    Remove-Item Env:SUPABASE_ACCESS_TOKEN -ErrorAction SilentlyContinue
}
