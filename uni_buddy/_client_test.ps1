$ErrorActionPreference = "Stop"
$out = "d:\UniBuddy\uni_buddy\_client_result.txt"
Remove-Item $out -ErrorAction SilentlyContinue

try {
    $s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $null = Invoke-RestMethod -Uri http://127.0.0.1:5000/api/login -Method Post -ContentType 'application/json' -Body '{"username":"student1","password":"parola123"}' -WebSession $s

    $body = @{
        message  = "Ce formula e in notes.txt? Raspunde scurt."
        language = "ro"
        index    = @(@{ name = "notes.txt"; folder = "Physics"; source = "library"; size = 120 })
        files    = @(@{ name = "notes.txt"; source = "library"; text = "Legea lui Ohm: U = R * I." })
    } | ConvertTo-Json -Depth 5

    try {
        $r = Invoke-RestMethod -Uri http://127.0.0.1:5000/api/ai/chat -Method Post -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -WebSession $s -TimeoutSec 90
        "OK: " + ($r | ConvertTo-Json -Compress) | Out-File $out -Encoding utf8
    } catch {
        "HTTP ERROR: " + $_.Exception.Message + " | " + $_.ErrorDetails.Message | Out-File $out -Encoding utf8
    }
} catch {
    "SCRIPT ERROR: " + $_.Exception.Message | Out-File $out -Encoding utf8
}
