$adb = "C:\Users\NESTOR\AppData\Local\Android\Sdk\platform-tools\adb.exe"

if (-not (Test-Path $adb)) {
    throw "adb.exe not found at: $adb"
}

& $adb reverse tcp:3000 tcp:3000
if ($LASTEXITCODE -ne 0) {
    throw "adb reverse failed. Check that the device is connected and authorized."
}

Write-Host "USB tunnel active: device port 3000 forwards to this PC's port 3000."
