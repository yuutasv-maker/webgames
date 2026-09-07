#!/bin/bash

# スクリプト自身のディレクトリに移動
cd "$(dirname "$0")"

PID_FILE="logs/form_app.pid"

if [ -d "../../venv" ]; then
    PIP_CMD="../../venv/bin/pip"
    PYTHON_CMD="../../venv/bin/python3"
else
    PIP_CMD="pip3"
    PYTHON_CMD="python3"
fi

# ==========================================
# 停止処理 (stopオプション)
# ==========================================
if [ "$1" == "stop" ]; then
    STOPPED=false

    # 1. PIDファイルがあれば、まずそのPIDを試す
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null 2>&1; then
            echo "登録フォーム (PID: $PID) を停止しています..."
            kill $PID
            STOPPED=true
        fi
        rm "$PID_FILE"
    fi

    # 2. プロセス名で検索して、まだ残っているプロセスがあれば停止する
    #    (PIDファイルと実際のプロセスがずれていた場合のフォールバック)
    PIDS=$(pgrep -f "app.py" 2>/dev/null)
    if [ ! -z "$PIDS" ]; then
        echo "登録フォームのプロセスを見つけました。停止します..."
        kill $PIDS
        STOPPED=true
    fi

    if [ "$STOPPED" = true ]; then
        echo "停止が完了しました。"
    else
        echo "実行中の登録フォームが見つかりません。"
    fi
    exit 0
fi

# ==========================================
# 起動処理 (start または 引数なし)
# ==========================================
if [ "$1" == "start" ] || [ -z "$1" ]; then
    # 既に起動しているかチェック（PIDファイル + pgrepの両方で確認）
    EXISTING_PID=$(pgrep -f "app.py" 2>/dev/null)
    if [ ! -z "$EXISTING_PID" ]; then
        echo "既に登録フォームは起動しています (PID: $EXISTING_PID)"
        echo "停止する場合は ./run_form.sh stop を実行してください。"
        exit 0
    fi

    # 古いPIDファイルが残っていたら掃除
    [ -f "$PID_FILE" ] && rm "$PID_FILE"

    echo "=============================================="
    echo " スタジオOWL イベント登録フォーム"
    echo "=============================================="
    echo ""

    echo "必要なパッケージがインストールされていない場合は自動でインストールします..."
    $PIP_CMD install flask requests beautifulsoup4 > /dev/null 2>&1

    echo "バックグラウンドで登録フォームを起動します..."
    
    # Pythonを直接バックグラウンドで起動（nohupを使わず正確なPIDを取得）
    $PYTHON_CMD ../../apps/event-manager/app.py > logs/form_app.log 2>&1 &
    
    # 起動したPythonプロセスのIDを保存
    echo $! > "$PID_FILE"

    echo ""
    echo "✅ 起動が完了しました！ (バックグラウンドで実行中)"
    echo "スマホや他のPCからは、同じWi-Fiに繋いだ状態で以下のURLにアクセスしてください："
    echo "※IPアドレスは変更される場合があります。logs/form_app.log を見ると現在のURLが確認できます。"
    echo ""
    echo "停止させたい時は、以下のコマンドを実行してください："
    echo "  ./run_form.sh stop"
    echo ""
    exit 0
fi

echo "使用方法: ./run_form.sh [start|stop]"
