@echo off
setlocal
set PORT=8000
echo ======================================================
echo  GTI / Fretboard Tools - Local Development Server
echo ======================================================
echo Starting server at http://localhost:%PORT%
echo.
echo [To stop the server, press Ctrl+C twice or close this window.]
echo.
python -m http.server %PORT%
pause
