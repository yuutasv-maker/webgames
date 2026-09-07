@echo off
cd /d "%~dp0"

echo ==============================================
echo       スタジオOWL イベント管理システム        
echo ==============================================
echo.

set PYTHON_CMD=python
set PIP_CMD=pip

if exist "venv\Scripts\python.exe" (
    set PYTHON_CMD=venv\Scripts\python.exe
    set PIP_CMD=venv\Scripts\pip.exe
)

echo 必要なパッケージのインストール状況を確認しています...
"%PIP_CMD%" install flask requests beautifulsoup4 >nul 2>&1

echo 1. ブラウザで管理画面を開く準備をしています...
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:5001"

echo 2. 登録フォームサーバーを起動します (ポート 5001)...
echo.
echo ----------------------------------------------
echo Web管理アプリが起動しました：
echo  - PCから: http://localhost:5001
echo  - スマホから: 同じWi-Fiに繋いだ状態でマニュアル記載のURLへアクセス
echo ----------------------------------------------
echo 【終了方法】このウィンドウを閉じるか、Ctrl+C を押してください。
echo.

"%PYTHON_CMD%" apps\event-manager\app.py
