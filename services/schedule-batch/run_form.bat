@echo off
chcp 65001 > nul
echo ==============================================
echo  スタジオOWL イベント登録フォーム
echo ==============================================
echo.
echo 必要なパッケージがインストールされていない場合は自動でインストールします...
pip install flask requests beautifulsoup4 >nul 2>&1

echo.
echo ブラウザで登録フォームを開きます...
echo 終了するには このウィンドウを閉じるか、Ctrl+C を押してください。
echo.

python ..\apps\event-manager\app.py
pause
