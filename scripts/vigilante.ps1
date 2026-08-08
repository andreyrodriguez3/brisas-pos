<#
.SYNOPSIS
  Vigilante del servicio Brisas POS (Windows).

.DESCRIPTION
  Consulta /api/health/ping cada N segundos. Si el servidor no responde varias
  veces seguidas, reinicia el servicio y lo deja anotado en el log.

  Existe porque NSSM y PM2 reinician el proceso cuando MUERE, pero no cuando
  queda vivo y colgado — que es el caso que deja la caja mirando una pantalla
  que no responde en plena hora de almuerzo.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\vigilante.ps1

  Programalo en el Programador de tareas con "Al iniciar el equipo" y
  "Repetir cada 5 minutos indefinidamente".

.NOTES
  No reinicia más de $MaxReinicios veces por hora: si el problema es de
  configuración, reiniciar en bucle solo llena el disco de logs y esconde la
  causa real.
#>

[CmdletBinding()]
param(
  [string]$Url = 'http://127.0.0.1:3000/api/health/ping',
  [string]$Servicio = 'BrisasPOS',
  [int]$Intentos = 3,
  [int]$SegundosEntreIntentos = 5,
  [int]$MaxReinicios = 3,
  [string]$Log
)

$ErrorActionPreference = 'Stop'

# Resuelto acá, no en el default del param: $PSScriptRoot no siempre existe ahí.
$RaizScript = Split-Path -Parent $MyInvocation.MyCommand.Definition
if (-not $Log) { $Log = Join-Path (Split-Path -Parent $RaizScript) 'logs\vigilante.log' }

$carpetaLog = Split-Path $Log -Parent
if (-not (Test-Path $carpetaLog)) {
  New-Item -ItemType Directory -Force -Path $carpetaLog | Out-Null
}

function Anotar($mensaje) {
  $linea = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $mensaje"
  Write-Host $linea
  Add-Content -Path $Log -Value $linea
}

function Responde {
  try {
    $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
    return $r.StatusCode -eq 200
  } catch {
    return $false
  }
}

# ── ¿Está vivo? ─────────────────────────────────────────────────────────────

$vivo = $false
for ($i = 1; $i -le $Intentos; $i++) {
  if (Responde) { $vivo = $true; break }
  if ($i -lt $Intentos) {
    Anotar "Sin respuesta (intento $i de $Intentos). Reintento en $SegundosEntreIntentos s."
    Start-Sleep -Seconds $SegundosEntreIntentos
  }
}

if ($vivo) { exit 0 }

# ── No responde: reiniciar, con freno ───────────────────────────────────────

$haceUnaHora = (Get-Date).AddHours(-1)
$reciente = 0
if (Test-Path $Log) {
  $reciente = @(
    Get-Content $Log -Tail 200 |
      Where-Object { $_ -match 'REINICIANDO' } |
      Where-Object {
        if ($_ -match '^\[(.+?)\]') {
          try { [datetime]::ParseExact($Matches[1], 'yyyy-MM-dd HH:mm:ss', $null) -gt $haceUnaHora }
          catch { $false }
        } else { $false }
      }
  ).Count
}

if ($reciente -ge $MaxReinicios) {
  Anotar "NO RESPONDE y ya se reinició $reciente vez/veces en la última hora. Me detengo: revisá logs\brisas-error.log, esto no se arregla reiniciando."
  exit 2
}

Anotar "NO RESPONDE tras $Intentos intentos. REINICIANDO el servicio $Servicio."

try {
  $svc = Get-Service -Name $Servicio -ErrorAction SilentlyContinue
  if ($svc) {
    Restart-Service -Name $Servicio -Force
  } else {
    # Instalado con PM2 en vez de NSSM.
    & pm2 restart brisas-pos | Out-Null
  }
} catch {
  Anotar "ERROR al reiniciar: $($_.Exception.Message)"
  exit 3
}

Start-Sleep -Seconds 15
if (Responde) {
  Anotar "Reiniciado y respondiendo."
  exit 0
}

Anotar "Reiniciado pero SIGUE SIN RESPONDER. Hace falta mirarlo a mano."
exit 4
