$ErrorActionPreference = 'Stop'

# Runs slinktool (SeedLink client) + export_pga_point.py (miniSEED -> JSON) together.
# Stop with Ctrl+C in this window.

$root = $PSScriptRoot
$repoRoot = Resolve-Path (Join-Path $root '..\..')
$slinktool = Join-Path $root 'slinktool.exe'
$python = Join-Path $root '.venv\Scripts\python.exe'

function Get-BasePython {
  $candidates = @('py', 'python', 'python3')
  foreach ($name in $candidates) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
  }
  return $null
}

function Ensure-Venv {
  param(
    [Parameter(Mandatory=$true)][string]$Root,
    [Parameter(Mandatory=$true)][string]$PythonExe
  )

  if (Test-Path $PythonExe) { return }

  $basePy = Get-BasePython
  if (-not $basePy) {
    throw "Base Python not found (install Python 3 and ensure 'py' or 'python' is in PATH)."
  }

  Write-Host "Creating venv in $Root/.venv ..." -ForegroundColor Cyan
  & $basePy -m venv (Join-Path $Root '.venv')
  if ($LASTEXITCODE -ne 0) { throw "Failed to create venv (exit=$LASTEXITCODE)." }

  Write-Host "Upgrading pip ..." -ForegroundColor Cyan
  & $PythonExe -m pip install -U pip
  if ($LASTEXITCODE -ne 0) { throw "Failed to upgrade pip (exit=$LASTEXITCODE)." }

  $req = Join-Path $Root 'requirements.txt'
  if (-not (Test-Path $req)) {
    throw "requirements.txt not found: $req"
  }
  Write-Host "Installing Python deps from $req ..." -ForegroundColor Cyan
  & $PythonExe -m pip install -r $req
  if ($LASTEXITCODE -ne 0) { throw "Failed to install deps (exit=$LASTEXITCODE)." }
}

if (-not (Test-Path $slinktool)) {
  throw "slinktool.exe not found: $slinktool"
}
Ensure-Venv -Root $root -PythonExe $python

$server = 'rtserve.iris.washington.edu:18000'
$stream = 'JP_JCJ:BHE.D,JP_JCJ:BHN.D,JP_JCJ:BHZ.D'

$mseed = Join-Path $root 'JP_JCJ_BHZ_live.mseed'
$state = 'JP_JCJ.state'
$outJson = Join-Path $repoRoot 'public\pga_points.json'

$lat = 27.06
$lon = 142.208
$mode = 'waveform'
$every = 1
$maxPoints = 2000
$unit = $(if ($env:KANAMEISHI_UNIT_VEL) { $env:KANAMEISHI_UNIT_VEL } else { 'counts' })
$interval = 1.0

$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$slinkOutLog = Join-Path $logDir 'slinktool.out.log'
$slinkErrLog = Join-Path $logDir 'slinktool.err.log'
$exportOutLog = Join-Path $logDir 'export.out.log'
$exportErrLog = Join-Path $logDir 'export.err.log'

Write-Host "Starting slinktool -> $mseed" -ForegroundColor Cyan
Write-Host "Starting exporter -> $outJson" -ForegroundColor Cyan
Write-Host "Server: $server" -ForegroundColor DarkGray
Write-Host "Stream: $stream" -ForegroundColor DarkGray

$existing = Get-Process slinktool -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "Stopping existing slinktool process(es): $($existing.Id -join ', ')" -ForegroundColor Yellow
  $existing | Stop-Process -Force
}

# slinktool: keep running, auto-reconnect, append miniSEED records
$slinkArgs = @(
  '-v',
  '-k', '60',
  '-nd', '10',
  '-x', "${state}:100",
  '-o', $mseed,
  '-S', $stream,
  $server
)

# exporter: follow growing file and rewrite JSON periodically (atomic replace)
$exportArgs = @(
  'export_pga_point.py',
  $mseed,
  '--follow',
  '--interval', ($interval.ToString()),
  '--mode', $mode,
  '--every', ($every.ToString()),
  '--max-points', ($maxPoints.ToString()),
  '--lat', $lat,
  '--lon', $lon,
  '--assume-unit', $unit,
  '--out', $outJson
)

$slinkProc = Start-Process -FilePath $slinktool -ArgumentList $slinkArgs -WorkingDirectory $root -PassThru -NoNewWindow -RedirectStandardOutput $slinkOutLog -RedirectStandardError $slinkErrLog
$exportProc = Start-Process -FilePath $python -ArgumentList $exportArgs -WorkingDirectory $root -PassThru -NoNewWindow -RedirectStandardOutput $exportOutLog -RedirectStandardError $exportErrLog

Write-Host "slinktool PID: $($slinkProc.Id) (log: $slinkOutLog / $slinkErrLog)" -ForegroundColor Green
Write-Host "exporter PID: $($exportProc.Id) (log: $exportOutLog / $exportErrLog)" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop (will terminate both)." -ForegroundColor Yellow

try {
  while (-not $slinkProc.HasExited -and -not $exportProc.HasExited) {
    Start-Sleep -Seconds 1
  }
  if ($slinkProc.HasExited) {
    Write-Host "slinktool exited with code $($slinkProc.ExitCode). See $slinkOutLog / $slinkErrLog" -ForegroundColor Red
  }
  if ($exportProc.HasExited) {
    Write-Host "exporter exited with code $($exportProc.ExitCode). See $exportOutLog / $exportErrLog" -ForegroundColor Red
  }
}
finally {
  foreach ($p in @($slinkProc, $exportProc)) {
    if ($null -ne $p -and -not $p.HasExited) {
      try { Stop-Process -Id $p.Id -Force } catch {}
    }
  }
}
