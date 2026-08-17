<#
.SYNOPSIS
  Respaldo de la base de datos de Brisas POS (Windows).

.DESCRIPTION
  Copia el archivo SQLite con marca de tiempo a una carpeta local y, si está
  conectada, a una llave USB. Retiene 30 días.

  Usa el comando .backup de SQLite si hay sqlite3.exe disponible: es la forma
  correcta de copiar una base en WAL mientras el sistema está trabajando. Si no
  lo encuentra, copia los tres archivos (.sqlite, -wal, -shm) juntos, que sigue
  siendo consistente porque WAL no reescribe el archivo principal.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\backup.ps1

.NOTES
  Este archivo tiene que quedar guardado en UTF-8 CON BOM: Windows PowerShell
  5.1 lee los .ps1 sin BOM como ANSI y los acentos salen rotos en pantalla.

  RESTAURACIÓN: usá scripts\restaurar.ps1, que además verifica el respaldo
  antes de pisar la base en uso. Probala durante la instalación, con el
  restaurante cerrado — un respaldo que nunca se restauró no es un respaldo.

  ⚠️ La base incluye nombres y teléfonos de clientes de pedidos para llevar,
  sin cifrar. La llave USB de $UnidadUsb queda conectada todo el tiempo: si se
  pierde o la roban, esos datos se van con ella. Activá BitLocker To Go sobre
  esa unidad (ver scripts\instalacion-windows.md, sección 5) — este script no
  cifra nada por su cuenta.
#>

[CmdletBinding()]
param(
  [string]$BaseDatos,
  [string]$DestinoLocal,
  # Letra de la llave USB que queda conectada permanentemente.
  [string]$UnidadUsb = 'E:',
  [int]$DiasRetencion = 30
)

$ErrorActionPreference = 'Stop'

# Las rutas se resuelven ACÁ y no en los valores por defecto del bloque param:
# según cómo se invoque el script, $PSScriptRoot todavía no está disponible
# cuando se evalúan esos defaults, y las rutas salen relativas a la nada.
$RaizScript = Split-Path -Parent $MyInvocation.MyCommand.Definition
$Raiz = Split-Path -Parent $RaizScript

if (-not $BaseDatos) { $BaseDatos = Join-Path $Raiz 'packages\backend\data\brisas.sqlite' }
if (-not $DestinoLocal) { $DestinoLocal = Join-Path $Raiz 'respaldos' }

function Escribir($mensaje) {
  Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $mensaje"
}

if (-not (Test-Path $BaseDatos)) {
  Escribir "ERROR: no se encontro la base en $BaseDatos"
  exit 1
}

$marca = Get-Date -Format 'yyyy-MM-dd_HHmm'
$nombre = "brisas_$marca.sqlite"

# ── Destinos ────────────────────────────────────────────────────────────────

$destinos = @()

if (-not (Test-Path $DestinoLocal)) {
  New-Item -ItemType Directory -Force -Path $DestinoLocal | Out-Null
}
$destinos += (Resolve-Path $DestinoLocal).Path

# La ruta se arma concatenando, NO con Join-Path: si la unidad no existe,
# Join-Path lanza DriveNotFoundException y con $ErrorActionPreference='Stop'
# se cae el respaldo entero — justo en la PC que no tiene la USB conectada,
# que es cuando más importa que el respaldo local igual se haga.
$raizUsb = $UnidadUsb.TrimEnd('\')
$destinoUsb = "$raizUsb\BrisasPOS\respaldos"

$usbConectada = $false
try { $usbConectada = Test-Path -LiteralPath "$raizUsb\" } catch { $usbConectada = $false }

if ($usbConectada) {
  if (-not (Test-Path -LiteralPath $destinoUsb)) {
    New-Item -ItemType Directory -Force -Path $destinoUsb | Out-Null
  }
  $destinos += $destinoUsb
} else {
  # Aviso, no error: la copia local igual se hace.
  Escribir "AVISO: la llave USB ($UnidadUsb) no esta conectada. Solo respaldo local."
}

# ── Copia ───────────────────────────────────────────────────────────────────

# Sin `?.`: Windows 10 y 11 traen PowerShell 5.1 por defecto, que no entiende
# ese operador y ni siquiera llega a ejecutar el archivo — falla al parsearlo
# entero.
$comandoSqlite = Get-Command sqlite3.exe -ErrorAction SilentlyContinue
$sqlite3 = if ($comandoSqlite) { $comandoSqlite.Source } else { $null }

$primero = Join-Path $destinos[0] $nombre

if ($sqlite3) {
  # Copia consistente en caliente, sin detener el servicio.
  & $sqlite3 $BaseDatos ".backup '$primero'"
  if ($LASTEXITCODE -ne 0) { throw "sqlite3 .backup fallo con codigo $LASTEXITCODE" }
  Escribir "Respaldo con sqlite3 .backup -> $primero"
} else {
  Copy-Item $BaseDatos $primero -Force
  foreach ($sufijo in '-wal', '-shm') {
    $extra = "$BaseDatos$sufijo"
    if (Test-Path $extra) { Copy-Item $extra "$primero$sufijo" -Force }
  }
  Escribir "Respaldo por copia de archivos -> $primero"
  Escribir "  (instala sqlite3.exe para respaldos en caliente mas seguros)"
}

if ($destinos.Count -gt 1) {
  foreach ($destino in $destinos[1..($destinos.Count - 1)]) {
    Copy-Item $primero (Join-Path $destino $nombre) -Force
    foreach ($sufijo in '-wal', '-shm') {
      $extra = "$primero$sufijo"
      if (Test-Path $extra) { Copy-Item $extra (Join-Path $destino "$nombre$sufijo") -Force }
    }
    Escribir "Copiado a $destino"
  }
}

# ── Retención ───────────────────────────────────────────────────────────────

$limite = (Get-Date).AddDays(-$DiasRetencion)
$borrados = 0
foreach ($destino in $destinos) {
  Get-ChildItem -Path $destino -Filter 'brisas_*.sqlite*' -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt $limite } |
    ForEach-Object {
      Remove-Item $_.FullName -Force
      $borrados++
    }
}
Escribir "Retencion: $borrados archivo(s) de mas de $DiasRetencion dias eliminados"

$tamano = [math]::Round((Get-Item $primero).Length / 1MB, 2)
Escribir "Listo. Tamano: $tamano MB"
