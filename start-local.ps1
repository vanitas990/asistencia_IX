$ErrorActionPreference = 'Stop'

$projectRoot = $PSScriptRoot
$adb = 'C:\Users\NESTOR\AppData\Local\Android\Sdk\platform-tools\adb.exe'
$logDirectory = Join-Path $env:TEMP 'ASIX-local-dev'
$runStamp = Get-Date -Format 'yyyyMMdd-HHmmss'

if (-not (Test-Path -LiteralPath $adb)) {
  throw "No se encontró adb.exe en: $adb"
}

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$serverStdout = Join-Path $logDirectory "server-$runStamp.log"
$serverStderr = Join-Path $logDirectory "server-$runStamp.err.log"
$expoStdout = Join-Path $logDirectory "expo-$runStamp.log"
$expoStderr = Join-Path $logDirectory "expo-$runStamp.err.log"

Write-Host 'Cerrando procesos Node.js anteriores...'
& taskkill.exe /F /IM node.exe /T *> $null
Start-Sleep -Seconds 1

$deviceLine = @(& $adb devices | Where-Object { $_ -match '^\S+\s+device$' } | Select-Object -First 1)
if ($deviceLine.Count -eq 0) {
  throw 'No hay un Android autorizado por USB. Desbloquea el celular y acepta la solicitud de depuración USB.'
}
$deviceSerial = ($deviceLine[0] -split '\s+')[0]

Write-Host "Configurando túneles USB para $deviceSerial..."
& $adb -s $deviceSerial reverse tcp:8081 tcp:8081
if ($LASTEXITCODE -ne 0) {
  throw 'No se pudo configurar adb reverse para el puerto 8081.'
}
& $adb -s $deviceSerial reverse tcp:3000 tcp:3000
if ($LASTEXITCODE -ne 0) {
  throw 'No se pudo configurar adb reverse para el puerto 3000.'
}

$commandProcessor = if ($env:ComSpec) { $env:ComSpec } else { Join-Path $env:SystemRoot 'System32\cmd.exe' }

Write-Host 'Iniciando backend en segundo plano...'
$serverProcess = Start-Process `
  -FilePath $commandProcessor `
  -ArgumentList @('/d', '/s', '/c', 'npm run start:server') `
  -WorkingDirectory $projectRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $serverStdout `
  -RedirectStandardError $serverStderr `
  -PassThru

Write-Host 'Iniciando Expo en localhost:8081...'
$env:EXPO_PUBLIC_USE_ADB_REVERSE = 'true'
$expoProcess = Start-Process `
  -FilePath $commandProcessor `
  -ArgumentList @('/d', '/s', '/c', 'npx.cmd expo start --dev-client --port 8081 --clear --localhost') `
  -WorkingDirectory $projectRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $expoStdout `
  -RedirectStandardError $expoStderr `
  -PassThru

$expoOpenEndpoint = 'http://127.0.0.1:8081/_expo/open'
$androidLaunch = $null
$webLaunch = $null

for ($attempt = 0; $attempt -lt 60; $attempt++) {
  try {
    $androidLaunch = Invoke-RestMethod -Uri "$expoOpenEndpoint`?platform=android&runtime=custom" -TimeoutSec 2
    $webLaunch = Invoke-RestMethod -Uri "$expoOpenEndpoint`?platform=web" -TimeoutSec 2
    if ($androidLaunch.url -and $webLaunch.url) {
      break
    }
  } catch {
    $androidLaunch = $null
    $webLaunch = $null
  }

  if ($expoProcess.HasExited) {
    $details = (Get-Content -LiteralPath $expoStderr -Tail 25 -ErrorAction SilentlyContinue) -join [Environment]::NewLine
    throw "Expo se detuvo al iniciar. Revisa $expoStderr`n$details"
  }
  Start-Sleep -Seconds 1
}

if (-not $androidLaunch -or -not $webLaunch) {
  throw "Expo no respondió en el puerto 8081. Revisa los registros en $logDirectory"
}
if ($androidLaunch.runtime -ne 'custom') {
  throw 'Expo no devolvió un enlace de Development Build para Android.'
}

$installedApp = & $adb -s $deviceSerial shell pm path $androidLaunch.appId 2>$null
if ($LASTEXITCODE -eq 0 -and $installedApp) {
  $deepLink = $androidLaunch.url.Replace("'", "''")
  $launchCommand = "am start -a android.intent.action.VIEW -d '$deepLink'"
  & $adb -s $deviceSerial shell $launchCommand
  if ($LASTEXITCODE -ne 0) {
    throw 'No se pudo abrir ASISTENCIA IX. Comprueba que el APK instalado sea un Development Build de este proyecto.'
  }
  Write-Host 'ASISTENCIA IX se abrió en el celular.'
} else {
  Write-Warning 'No se encontró el APK de ASISTENCIA IX en el celular. Instala una vez el Development Build y vuelve a ejecutar este script.'
}

Start-Process -FilePath $webLaunch.url
Write-Host 'Web abierta en el navegador.'
Write-Host "API local: http://localhost:3000"
Write-Host "Registros de esta sesión: $logDirectory"
