#!/bin/bash
echo "=============================================="
echo " スタジオOWL スケジュール更新ツール"
echo "=============================================="
echo ""
echo "設定ファイル (config.json) と データファイル (events.csv) を確認しています..."

# スクリプト自身のディレクトリに移動（ダブルクリック実行時にも対応）
cd "$(dirname "$0")"

if [ -d "../../venv" ]; then
    ../../venv/bin/python3 ../../apps/event-manager/update_events.py
else
    python3 ../../apps/event-manager/update_events.py
fi

echo ""
echo "処理が終了しました。結果は上記のメッセージ、または update_log.txt を確認してください。"
read -p "Enterキーを押すと終了します..."
