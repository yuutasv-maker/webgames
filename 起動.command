#!/bin/bash

# このスクリプトが存在するディレクトリに移動
cd "$(dirname "$0")"

echo "=============================================="
echo "      スタジオOWL イベント管理システム        "
echo "=============================================="
echo ""

# ウィンドウが閉じられた際や、Ctrl+C が押された際にサーバーを確実に停止させる処理
cleanup() {
  echo ""
  echo "サーバーを停止しています..."
  kill $FLASK_PID 2>/dev/null
  exit
}
trap cleanup INT TERM EXIT

# Python仮想環境の検出
if [ -d "venv" ]; then
    PYTHON_CMD="./venv/bin/python3"
    PIP_CMD="./venv/bin/pip"
else
    PYTHON_CMD="python3"
    PIP_CMD="pip3"
fi

echo "必要なパッケージのインストール状況を確認しています..."
$PIP_CMD install flask requests beautifulsoup4 > /dev/null 2>&1

echo "1. 登録フォームサーバーを起動中 (ポート 5001)..."
$PYTHON_CMD apps/event-manager/app.py > /dev/null 2>&1 &
FLASK_PID=$!

echo "2. ブラウザで管理画面を開いています..."
sleep 2.0
open "http://localhost:5001"

echo ""
echo "----------------------------------------------"
echo "Web管理アプリが起動しました："
echo " - PCから: http://localhost:5001"
echo " - スマホから: 同じWi-Fiに繋いだ状態でマニュアル記載のURLへアクセス"
echo "----------------------------------------------"
echo "【終了方法】このウィンドウを閉じるか、Ctrl+C を押してください。"
echo ""

# サーバープロセスの終了を待機
wait
