@echo off
title Sahelha Backend (GPU Accelerated - Lahgtna OmniVoice)
echo =======================================================
echo   Starting Sahelha Backend with NVIDIA RTX 2050 GPU
echo =======================================================
cd /d "%~dp0\backend"
"..\venv311\Scripts\python.exe" -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
pause
