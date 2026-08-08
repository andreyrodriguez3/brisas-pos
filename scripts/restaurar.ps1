<#
.SYNOPSIS
  Restaura un respaldo de Brisas POS (Windows).

.DESCRIPTION
  Detiene el servicio, guarda la base actual por si acaso, copia el respaldo
  elegido y vuelve a arrancar. Verifica que el archivo restaurado sea una base
  SQLite válida ANTES de pisar la que está en uso.

  Un respaldo que nunca se restauró no es un respaldo: probá esto durante la
  instalación, con el restaurante cerrado, no el día que haga falta.

.EXAMPLE
  # Ver qué respaldos hay
  powershell -ExecutionPolicy Bypass -File scripts\restaurar.ps1 -Listar

  # Restaurar el más reciente
  powershell -ExecutionPolicy Bypass -File scripts\restaurar.ps1 -MasReciente

  # Restaurar uno puntual
  powershell -ExecutionPolicy Bypass -File scripts\restaurar.ps1 -Respaldo C:\BrisasPOS\respaldos\brisas_2026-08-07_1430.sqlite
#>

[CmdletBinding(DefaultParameterSetName = 'Listar')]
param(
  [Parameter(ParameterSetName = 'Listar')]
  [switch]$Listar,

  [Parameter(ParameterSetName = 'Reciente')]
  [switch]$MasReciente,

  [Parameter(ParameterSetName = 'Puntual', Mandatory = $true)]
  [string]$Respaldo,

  [string]$BaseDatos,
  [string]$CarpetaRespaldos,
  [string]$Servicio = 'BrisasPOS',
  [string]$Url = 'http://127.0.0.1:3000/api/health'
)

$ErrorActionPreference = 'Stop'

# Las rutas se resuelven acá y no en los defaults del bloque param: según cómo
# se invoque el script, $PSScriptRoot todavía no existe cuando esos se evalúan.
$RaizScript = Split-Path -Parent $MyInvocation.MyCommand.Definition
$Raiz = Split-Path -Parent $RaizScript

if (-not $BaseDatos) { $BaseDatos = Join-Path $Raiz 'packages\backend\data\brisas.sqlite' }
if (-not $CarpetaRespaldos) { $CarpetaRespaldos = Join-Path $Raiz 'respaldos' }

function Escribir($mensaje) {
  Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $mensaje"
}

# ── Listar ──────────────────────────────────────────────────────────────────

$disponibles = @()
if (Test-Path $CarpetaRespaldos) {
  $disponibles = Get-ChildItem -Path $CarpetaRespaldos -Filter 'brisas_*.sqlite' |
    Sort-Object LastWriteTime -Descending
}

if ($Listar -or $PSCmdlet.ParameterSetName -eq 'Listar') {
  if ($disponibles.Count -eq 0) {
    Escribir "No hay respaldos en $CarpetaRespaldos"
    exit 1
  }
  Escribir "Respaldos disponibles (el más nuevo primero):"
  $disponibles | ForEach-Object {
    "  {0,-34} {1,8:N2} MB   {2}" -f $_.Name, ($_.Length / 1MB), $_.LastWriteTime
  }
  exit 0
}

if ($MasReciente) {
  if ($disponibles.Count -eq 0) { throw "No hay respaldos en $CarpetaRespaldos" }
  $Respaldo = $disponibles[0].FullName
}

if (-not (Test-Path $Respaldo)) { throw "No existe el respaldo: $Respaldo" }

# ── Verificar ANTES de tocar nada ───────────────────────────────────────────
# Restaurar un archivo corrupto encima de la base buena convierte un problema
# en un desastre.

Escribir "Verificando $Respaldo…"

$cabecera = [System.IO.File]::ReadAllBytes($Respaldo)[0..15]
$texto = [System.Text.Encoding]::ASCII.GetString($cabecera)
if ($texto -notlike 'SQLite format 3*') {
  throw "Ese archivo no es una base SQLite. No se restaura nada."
}

# Sin `?.`: Windows 11 trae PowerShell 5.1 y ese operador es de la 7.
$comandoSqlite = Get-Command sqlite3.exe -ErrorAction SilentlyContinue
$sqlite3 = if ($comandoSqlite) { $comandoSqlite.Source } else { $null }
if ($sqlite3) {
  $chequeo = & $sqlite3 $Respaldo 'PRAGMA integrity_check;'
  if ($chequeo -ne 'ok') { throw "integrity_check falló: $chequeo" }
  $cuentas = & $sqlite3 $Respaldo 'SELECT COUNT(*) FROM cuenta;'
  $productos = & $sqlite3 $Respaldo 'SELECT COUNT(*) FROM producto;'
  Escribir "  integridad ok · $productos producto(s) · $cuentas cuenta(s)"
} else {
  Escribir "  cabecera ok (instalá sqlite3.exe para verificar la integridad completa)"
}

# ── Restaurar ───────────────────────────────────────────────────────────────

$svc = Get-Service -Name $Servicio -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq 'Running') {
  Escribir "Deteniendo $Servicio…"
  Stop-Service -Name $Servicio -Force
  Start-Sleep -Seconds 3
} else {
  Escribir "El servicio $Servicio no está corriendo (o no está instalado)."
}

if (Test-Path $BaseDatos) {
  $aparte = "$BaseDatos.antes-de-restaurar_$(Get-Date -Format 'yyyy-MM-dd_HHmm')"
  Move-Item $BaseDatos $aparte -Force
  Escribir "La base anterior quedó guardada en $aparte"
}
# Los -wal/-shm que hay ahora pertenecen a la base ANTERIOR: dejarlos encima de
# la restaurada la corrompería.
foreach ($sufijo in '-wal', '-shm') {
  if (Test-Path "$BaseDatos$sufijo") { Remove-Item "$BaseDatos$sufijo" -Force }
}

Copy-Item $Respaldo $BaseDatos -Force

# ⚠️ Y ahora los del RESPALDO, si los tiene.
#
# Cuando el respaldo se hizo por copia de archivos (sin sqlite3.exe), el .sqlite
# solo contiene lo que estaba en el último checkpoint: todo lo escrito después
# vive en el -wal. Restaurar el .sqlite solo, sin su -wal, pierde en silencio
# las últimas ventas — que en plena hora de almuerzo pueden ser todas.
$conWal = $false
foreach ($sufijo in '-wal', '-shm') {
  if (Test-Path "$Respaldo$sufijo") {
    Copy-Item "$Respaldo$sufijo" "$BaseDatos$sufijo" -Force
    $conWal = $true
  }
}

if ($conWal) {
  Escribir "Restaurado (con su -wal: el respaldo se hizo por copia de archivos)."
} else {
  Escribir "Restaurado."
}

if ($svc) {
  Start-Service -Name $Servicio
  Escribir "Servicio arrancado. Verificando…"
  Start-Sleep -Seconds 8
  try {
    $salud = Invoke-RestMethod -Uri $Url -TimeoutSec 10
    if ($salud.ok) {
      Escribir "LISTO: el sistema responde y la base está ok."
    } else {
      Escribir "AVISO: responde pero la base reporta '$($salud.base_datos)'."
    }
  } catch {
    Escribir "ERROR: el servicio no responde en $Url. Revisá logs\brisas-error.log"
    exit 1
  }
} else {
  Escribir "Arrancá el sistema y abrí $Url para confirmar."
}
