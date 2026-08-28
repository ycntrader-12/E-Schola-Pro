@echo off
echo =======================================
echo     Demarrage de E-Schola Pro...
echo =======================================

:: Se placer dans le dossier où se trouve ce script
cd /d "%~dp0"

echo Demarrage du Backend...
start "Backend E-Schola Pro" cmd /k "cd backend && venv\Scripts\activate && uvicorn app.main:app --reload"

echo Demarrage du Frontend...
start "Frontend E-Schola Pro" cmd /k "cd frontend && npm run dev"

echo.
echo Les deux serveurs sont en cours d'execution dans de nouvelles fenetres !
echo - Backend API : http://127.0.0.1:8000
echo - Frontend : http://localhost:3000
echo.
pause
