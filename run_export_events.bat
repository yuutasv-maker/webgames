@echo off
cd /d %~dp0

echo ======================================
echo 参加型イベント抽出ツール
echo ======================================

IF NOT EXIST ".tmp_venv" (
    echo 初回セットアップを行っています...
    python -m venv .tmp_venv
    call .tmp_venv\Scripts\activate.bat
    pip install beautifulsoup4 requests
    deactivate
)

.tmp_venv\Scripts\python.exe export_participatory_events.py

pause
