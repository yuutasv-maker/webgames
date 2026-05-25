#!/bin/bash
cd "$(dirname "$0")"

echo "======================================"
echo "参加型イベント抽出ツール"
echo "======================================"

# Check if venv exists, if not, wait
if [ ! -d ".tmp_venv" ]; then
    echo "初回セットアップを行っています..."
    python3 -m venv .tmp_venv
    .tmp_venv/bin/pip install beautifulsoup4 requests
fi

# Run the python script
.tmp_venv/bin/python export_participatory_events.py

echo "何かキーを押して終了してください..."
read -n 1 -s
