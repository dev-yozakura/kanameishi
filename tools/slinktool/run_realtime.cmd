@echo off
setlocal
cd /d %~dp0
if /i "%~1"=="calibrate" (
	set "KANAMEISHI_CALIBRATE_STATIONXML=1"
)
if "%KANAMEISHI_CALIBRATE_STATIONXML%"=="1" (
	echo StationXML calibration: ENABLED  ^(counts -^> μm/s^)
) else (
	echo StationXML calibration: disabled  ^(set KANAMEISHI_CALIBRATE_STATIONXML=1 or run: %~nx0 calibrate^)
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_realtime.ps1"
