@echo off
chcp 65001 > nul
echo ==============================================
echo  スタジオOWL スケジュール更新ツール
echo ==============================================
echo.
echo 設定ファイル (config.json) と データファイル (events.csv) を確認しています...

python ..\apps\event-manager\update_events.py

echo.
echo 処理が終了しました。結果は上記のメッセージ、または update_log.txt を確認してください。
pause
