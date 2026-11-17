# After a deploy: checks that the rate limits see the real client address, i.e. that a caller cannot
# dodge them by sending a made-up X-Forwarded-For. Sends 11 failed sign-ins for one made-up email,
# each with a different forged X-Forwarded-For. Safe: the email does not exist, nothing is created.
#
#   powershell -ExecutionPolicy Bypass -File infra\supabase\probe-client-ip.ps1
#
# Expected with a correct KINETRA_CLIENT_IP_HEADER: 401 x10, then 429 (the limit is 10 per 5 minutes).
# If the 11th is still 401, the forged header was believed: redeploy with another -ClientIpHeader
# (for example "x-forwarded-for:last", "x-real-ip" or "cf-connecting-ip") and run this again.
# Never deploy with an empty header: every caller would then share the platform proxy's address,
# and one person's failed attempts would lock everyone out.

param([string]$Base = 'https://vrdwcgzcgukzmyzyuedm.supabase.co/functions/v1/api')

$email = "probe-$([guid]::NewGuid().ToString('N').Substring(0, 10))@example.com"
$body = @{ email = $email; password = 'not the password' } | ConvertTo-Json
$codes = foreach ($i in 1..11) {
    $forged = "203.0.113.$i"
    try {
        $r = Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$Base/api/v1/auth/login" -Body $body `
            -ContentType 'application/json' -Headers @{ 'X-Forwarded-For' = $forged; 'X-Real-IP' = $forged }
        $r.StatusCode
    } catch {
        [int]$_.Exception.Response.StatusCode
    }
}
"Statuses: $($codes -join ' ')"
if ($codes[-1] -eq 429) { 'OK: forged headers do not reset the limit.' } else { 'NOT SAFE: the limit followed the forged header.' }
