$ErrorActionPreference = 'Stop'

# Collect JP_* + selected PS stations BHZ waveform data with slinktool into per-station miniSEED files,
# then convert them into per-station JSON files for kanameishi.
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
# Multi-station stream list (-S) format: NET_STA,...
# Keep JP_* and add specific PS stations requested.
$stream = 'JP_*:BHE.D,JP_*:BHN.D,JP_*:BHZ.D,PS_MCSJ:BHE.D,PS_MCSJ:BHN.D,PS_MCSJ:BHZ.D,PS_ISG:BHE.D,PS_ISG:BHN.D,PS_ISG:BHZ.D,PS_INU:BHE.D,PS_INU:BHN.D,PS_INU:BHZ.D'

$inDir = Join-Path $root 'slwave'
$outDir = Join-Path $repoRoot 'public\waveforms'
New-Item -ItemType Directory -Force -Path $inDir | Out-Null
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# IMPORTANT: use relative path for -x because Windows drive letter (E:) includes ':'
$state = 'JP_ALL.state'

$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$slinkOutLog = Join-Path $logDir 'slinktool.jp_all.out.log'
$slinkErrLog = Join-Path $logDir 'slinktool.jp_all.err.log'
$exportOutLog = Join-Path $logDir 'export.jp_all.out.log'
$exportErrLog = Join-Path $logDir 'export.jp_all.err.log'

Write-Host "Starting slinktool (JP_*) -> $inDir" -ForegroundColor Cyan
Write-Host "Starting exporter -> $outDir" -ForegroundColor Cyan
Write-Host "Server: $server" -ForegroundColor DarkGray
Write-Host "Stream: $stream" -ForegroundColor DarkGray

$existing = Get-Process slinktool -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "Stopping existing slinktool process(es): $($existing.Id -join ', ')" -ForegroundColor Yellow
  $existing | Stop-Process -Force
}

# slinktool: archive into per-station files (NET_STA_CHAN.mseed)
# -A format uses %n %s %c as defining keys
$archiveFormat = 'slwave/%n_%s_%c.mseed'
$slinkArgs = @(
  '-v',
  '-k', '60',
  '-nd', '10',
  '-x', "${state}:200",
  '-A', $archiveFormat,
  '-S', $stream,
  $server
)

# exporter: follow all .mseed files in directory and emit per-station JSON
$exportScript = Join-Path $root 'export_waveforms_dir.py'
if (-not (Test-Path $exportScript)) {
  throw "export_waveforms_dir.py not found: $exportScript"
}

$exportArgs = @(
  $exportScript,
  '--in-dir', $inDir,
  '--out-dir', $outDir,
  '--mode', 'waveform',
  '--every', '1',
  '--max-points', '3000',
  '--window-sec', '180',
  '--interval', '1',
  '--assume-unit', ($(if ($env:KANAMEISHI_UNIT_VEL) { $env:KANAMEISHI_UNIT_VEL } else { 'counts' }))
)

if ($env:KANAMEISHI_CALIBRATE_STATIONXML -eq '1') {
  $exportArgs += @('--calibrate-stationxml', '--calibrate-output-unit', 'um/s')
  Write-Host "StationXML calibration: enabled (counts -> μm/s)" -ForegroundColor Cyan
}

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
