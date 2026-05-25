"""
スタジオOWL 単体イベント登録フォーム (Flask Webアプリ)
- ブラウザ上のフォームから1件ずつイベントを登録できます。
- 既存の update_events.py のロジック（自動補完・重複チェック等）を再利用しています。
"""
import json
import threading
import webbrowser
from flask import Flask, render_template, request, jsonify

# update_events.py から必要な関数・定数をインポート
from update_events import (
    load_config,
    load_recurring_events,
    create_event,
    upload_image_to_wp,
    CATEGORY_MAP,
    TITLE_ALIASES
)

app = Flask(__name__)

# ==========================================
# カテゴリ一覧（ドロップダウン用、重複を除いた正式名のみ）
# ==========================================
CATEGORIES = [
    'アーティストイベント',
    'オープンイベント',
    'ランチライブ',
    'ワークショップ',
    '参加型イベント',
    '貸切イベント',
    '野外イベント'
]


@app.route('/')
def index():
    """フォーム画面を表示"""
    return render_template('index.html')


@app.route('/api/recurring-events')
def get_recurring_events():
    """定期イベント一覧・略称マッピング・カテゴリ一覧を返す（フォームの自動補完用）"""
    recurring = load_recurring_events()
    return jsonify({
        'recurring_events': recurring,
        'title_aliases': TITLE_ALIASES,
        'categories': CATEGORIES
    })


@app.route('/api/upload-image', methods=['POST'])
def upload_image():
    """アイキャッチ画像をWordPressにアップロード"""
    config = load_config()
    if not config:
        return jsonify({'status': 'error', 'message': '設定ファイルの読み込みに失敗しました。'})

    if 'image' not in request.files:
        return jsonify({'status': 'error', 'message': '画像ファイルが選択されていません。'})

    file = request.files['image']
    if file.filename == '':
        return jsonify({'status': 'error', 'message': '画像ファイルが選択されていません。'})

    file_data = file.read()
    file_name = file.filename

    media_id = upload_image_to_wp(config, file_data=file_data, file_name=file_name)

    if media_id:
        return jsonify({'status': 'success', 'media_id': media_id, 'message': f'画像をアップロードしました (ID: {media_id})'})
    else:
        return jsonify({'status': 'error', 'message': '画像のアップロードに失敗しました。'})


@app.route('/api/submit', methods=['POST'])
def submit_event():
    """フォームからのイベント登録リクエストを処理"""
    config = load_config()
    if not config:
        return jsonify({'status': 'error', 'message': '設定ファイル (config.json) の読み込みに失敗しました。'})

    recurring_events = load_recurring_events()
    data = request.json

    # フォームのデータを update_events.py の create_event が期待する辞書形式に変換
    event_data = {
        'イベントタイトル': data.get('title', ''),
        '開始日付': data.get('start_date', ''),
        '開場時間': data.get('open_time', ''),
        '開始時間': data.get('start_time', ''),
        '終了日付': data.get('end_date', ''),
        '終了時間': data.get('end_time', ''),
        '終日イベント(1で終日)': '1' if data.get('all_day') else '',
        'イベントカテゴリー': data.get('category', ''),
        '出演者・詳細': data.get('description', ''),
        '前売り料金': data.get('advance_price', ''),
        '当日料金': data.get('door_price', ''),
        'ドリンク': 'x' if data.get('drink') else '',
        'その他': data.get('other', ''),
        '注目イベント': '1' if data.get('featured') else '',
        '公開ステータス(publish/draft)': data.get('status', 'publish'),
        '_image_id': data.get('image_id'),  # アイキャッチ画像のメディアID
    }

    result = create_event(config, recurring_events, event_data)

    if result == 'skip':
        return jsonify({
            'status': 'skip',
            'message': f"同じイベントが既に登録されています（スキップしました）: {data.get('title', '')}"
        })
    elif result:
        return jsonify({
            'status': 'success',
            'message': f"イベントを登録しました！: {data.get('title', '')}"
        })
    else:
        return jsonify({
            'status': 'error',
            'message': 'イベントの登録に失敗しました。update_log.txt を確認してください。'
        })


if __name__ == '__main__':
    import socket
    port = 5001

    # ローカルIPアドレスの取得（スマホからのアクセス用）
    def get_local_ip():
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(('8.8.8.8', 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return '不明'

    local_ip = get_local_ip()

    # サーバー起動後にブラウザを自動で開く機能を無効化（バックグラウンド常時稼働用）
    # def open_browser():
    #     webbrowser.open(f'http://localhost:{port}')
    # threading.Timer(1.5, open_browser).start()

    print("=" * 50)
    print(" スタジオOWL イベント登録フォーム")
    print(f" PC:     http://localhost:{port}")
    print(f" スマホ:  http://{local_ip}:{port}")
    print(" 終了するには Ctrl+C を押してください")
    print("=" * 50)

    app.run(debug=False, port=port, host='0.0.0.0')
