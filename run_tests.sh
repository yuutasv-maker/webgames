#!/bin/bash
cd "$(dirname "$0")"

# Pythonパスに apps/event-manager/ ディレクトリを追加してインポートを可能にする
export PYTHONPATH="apps/event-manager"

# venvのpytestを実行
if [ -d "venv" ]; then
    ./venv/bin/pytest -v "$@"
else
    pytest -v "$@"
fi
