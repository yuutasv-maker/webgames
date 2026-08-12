"""
スタジオOWL 単体イベント登録フォーム (Flask Webアプリ)
- ブラウザ上のフォームから1件ずつイベントを登録できます。
- 既存の update_events.py のロジック（自動補完・重複チェック等）を再利用しています。
"""
import json
import io
import csv
import re
import requests
import logging
from flask import Flask, render_template, request, jsonify, make_response

# 各モジュールから必要な関数・定数をインポート
from update_events import load_config, load_recurring_events
from wp_api import create_event, upload_image_to_wp, search_events, update_event
from event_parser import extract_event_info_from_text
from constants import CATEGORY_MAP, TITLE_ALIASES, CATEGORIES, DrinkType
import os
from datetime import datetime as dt
from export_participatory_events import get_events

app = Flask(__name__)


# ==========================================
# ヘルパー関数
# ==========================================
def error_response(message):
    """標準的なエラーレスポンスを生成する"""
    return jsonify({'status': 'error', 'message': message})

def success_response(message=None, **kwargs):
    """標準的な成功レスポンスを生成する"""
    res = {'status': 'success'}
    if message:
        res['message'] = message
    res.update(kwargs)
    return jsonify(res)

def is_valid_month_format(month_str):
    """月指定の文字列が YYYY-MM 形式か検証する"""
    if not month_str or not re.match(r'^20\d{2}-\d{2}$', month_str):
        return False
    try:
        dt.strptime(month_str, '%Y-%m')
        return True
    except (ValueError, TypeError):
        return False

def map_form_to_event_data(data):
    """フォームからのJSONデータを update_events.py が期待する辞書形式に変換する"""
    return {
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
        'ドリンク': DrinkType.NONE if data.get('no_drink') else (DrinkType.INCLUDED if data.get('drink') else DrinkType.ORDER_REQUIRED),
        'その他': data.get('other', ''),
        '注目イベント': '1' if data.get('featured') else '',
        '公開ステータス(publish/draft)': data.get('status', 'publish'),
        'チケット予約URL': data.get('ticket_url', ''),
        '_image_id': data.get('image_id'),  # アイキャッチ画像のメディアID
    }


@app.route('/')
def index():
    """フォーム画面を表示"""
    return render_template('index.html')


@app.route('/ticket-form')
def ticket_form():
    """チケット予約プルダウン生成画面を表示"""
    return render_template('ticket_form.html')


@app.route('/export-events')
def export_events_page():
    """参加型イベント出力画面を表示"""
    return render_template('export_events.html')


@app.route('/api/export-events')
def api_export_events():
    """参加型イベントを抽出してプレビュー用に返す"""
    month = request.args.get('month', '')
    if not is_valid_month_format(month):
        return error_response('無効な月形式（YYYY-MM）です。')
        
    try:
        events = get_events(month)
        return success_response(events=events)
    except requests.exceptions.RequestException as e:
        return error_response(f'イベント取得先の通信でエラーが発生しました。時間をおいて再試行してください: {str(e)}')
    except Exception as e:
        return error_response(f'エラーが発生しました: {str(e)}')


@app.route('/api/download-csv')
def api_download_csv():
    """抽出した参加型イベントをCSVとしてダウンロード"""
    month = request.args.get('month', '')
    if not is_valid_month_format(month):
        return '無効な月形式（YYYY-MM）です。', 400
        
    try:
        events = get_events(month)
        if not events:
            return '指定した月のイベントは見つかりませんでした。', 404
        
        output = io.StringIO()
        output.write('\ufeff')  # BOM for Excel UTF-8
        headers = ['日付', 'イベント', '開演時間', '料金', 'ドリンク', '軽食']
        writer = csv.DictWriter(output, fieldnames=headers)
        writer.writeheader()
        writer.writerows(events)
        
        response = make_response(output.getvalue())
        response.headers["Content-Disposition"] = f"attachment; filename=participatory_events_{month}.csv"
        response.headers["Content-Type"] = "text/csv; charset=utf-8-sig"
        return response
    except requests.exceptions.RequestException as e:
        return f'通信エラーが発生しました。時間をおいて再試行してください: {str(e)}', 503
    except Exception as e:
        return f'エラーが発生しました: {str(e)}', 500


@app.route('/api/recurring-events')
def get_recurring_events():
    """定期イベント一覧・略称マッピング・カテゴリ一覧を返す（フォームの自動補完用）"""
    recurring = load_recurring_events()
    return jsonify({
        'recurring_events': recurring,
        'title_aliases': TITLE_ALIASES,
        'categories': CATEGORIES
    })


@app.route('/api/scrape-ticket-options')
def api_scrape_ticket_options():
    """本番サイトのチケット予約ページから「希望公演」の既存プルダウンを取得して返す"""
    try:
        # 日本語URL対策としてエンコードされたURLを指定
        url = 'https://owl21.info/%e3%83%81%e3%82%b1%e3%83%83%e3%83%88%e4%ba%88%e7%b4%84/'
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        html = response.text
        
        # name="select-artist" の select タグ内を抽出
        select_match = re.search(r'<select[^>]*name="select-artist"[^>]*>(.*?)</select>', html, re.IGNORECASE | re.DOTALL)
        options = []
        if select_match:
            select_html = select_match.group(1)
            # optionのvalue属性を抽出
            option_matches = re.finditer(r'<option[^>]*value="([^"]+)"[^>]*>', select_html, re.IGNORECASE)
            for m in option_matches:
                val = m.group(1).strip()
                if val:
                    options.append(val)
        
        return success_response(options=options)
    except Exception as e:
        return error_response(f'スクレイピングに失敗しました: {str(e)}')



@app.route('/api/upload-image', methods=['POST'])
def upload_image():
    """アイキャッチ画像をWordPressにアップロード"""
    config = load_config()
    if not config:
        return error_response('設定ファイルの読み込みに失敗しました。')

    file = request.files.get('image')
    if not file or file.filename == '':
        return error_response('画像ファイルが選択されていません。')

    file_data = file.read()
    file_name = file.filename

    media_id = upload_image_to_wp(config, file_data=file_data, file_name=file_name)

    if media_id:
        return success_response(f'画像をアップロードしました (ID: {media_id})', media_id=media_id)
    return error_response('画像のアップロードに失敗しました。')


@app.route('/api/submit', methods=['POST'])
def submit_event():
    """フォームからのイベント登録リクエストを処理"""
    config = load_config()
    if not config:
        return error_response('設定ファイル (config.json) の読み込みに失敗しました。')

    recurring_events = load_recurring_events()
    data = request.json or {}

    # フォームのデータを辞書形式に変換
    event_data = map_form_to_event_data(data)
    result = create_event(config, recurring_events, event_data)

    if result == 'skip':
        return jsonify({
            'status': 'skip',
            'message': f"同じイベントが既に登録されています（スキップしました）: {data.get('title', '')}"
        })
    if result == 'error':
         return error_response(f"イベント '{data.get('title', '')}' の重複チェック処理中にエラーが発生したため、安全のために登録をスキップしました。通信状態を確認してください。")
    if result:
        return success_response(f"イベントを登録しました！: {data.get('title', '')}")
    
    return error_response('イベントの登録に失敗しました。update_log.txt を確認してください。')


@app.route('/api/analyze-event-details', methods=['POST'])
def analyze_event_details():
    """イベント詳細から日時・料金を抽出する"""
    data = request.json or {}
    text = data.get('description', '')
    if not text:
        return success_response(results={})

    parsed_info = extract_event_info_from_text(text)
    
    # 抽出失敗の判定 (主要な日付と料金が両方取れなかった場合などを失敗とする)
    if not parsed_info.get('start_date') and not parsed_info.get('advance_price'):
        # 失敗をログに記録
        log_dir = os.path.join(os.path.dirname(__file__), 'data')
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(log_dir, 'parse_failures.log')
        try:
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(f"[{dt.now().isoformat()}] Parse Failed.\n")
                f.write(f"Text: {text}\n")
                f.write("-" * 40 + "\n")
        except OSError as e:
            # ログファイルへの書き込みに失敗した場合でも、
            # メインのレスポンス（Webページ表示）を止めてしまわないように例外を許容する
            logging.warning(f"Failed to write log: {e}")

    return success_response(results=parsed_info)


@app.route('/edit')
def edit_event_page():
    """イベント編集画面を表示"""
    return render_template('edit.html')

@app.route('/api/search-events', methods=['GET'])
def api_search_events():
    """イベントを検索して一覧を返す"""
    config = load_config()
    if not config:
        return error_response('設定ファイルの読み込みに失敗しました。')
        
    query = request.args.get('q', '').strip()
    if not query:
        return success_response(events=[])
        
    events = search_events(config, query)
    return success_response(events=events)

@app.route('/api/update', methods=['POST'])
def api_update_event():
    """フォームからのイベント更新リクエストを処理"""
    config = load_config()
    if not config:
        return error_response('設定ファイルの読み込みに失敗しました。')

    recurring_events = load_recurring_events()
    data = request.json or {}
    
    event_id = data.get('event_id')
    if not event_id:
        return error_response('イベントIDが指定されていません。')

    event_data = map_form_to_event_data(data)
    result = update_event(config, event_id, recurring_events, event_data)

    if result:
        return success_response(f"イベントを更新しました！: {data.get('title', '')}")
    
    return error_response('イベントの更新に失敗しました。')


if __name__ == '__main__':
    import socket
    port = int(os.environ.get("PORT", 5001))
    host = os.environ.get("HOST", "0.0.0.0")

    # ローカルIPアドレスの取得（スマホからのアクセス用）
    def get_local_ip():
        try:
            # UDPソケットで Google Public DNS (8.8.8.8) へ接続を試みる。
            # 実際のパケットは送信されず、OSのルーティングテーブルから
            # LAN内（デフォルトゲートウェイ経由）の自身のIPを安全に取得するためのハック。
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(('8.8.8.8', 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return '不明'

    local_ip = get_local_ip()

    # サーバー起動後にブラウザを自動で開く機能を無効化（バックグラウンド常時稼働用）

    print("=" * 50)
    print(" スタジオOWL イベント登録フォーム")
    print(f" PC:     http://localhost:{port}")
    print(f" スマホ:  http://{local_ip}:{port}")
    print(" 終了するには Ctrl+C を押してください")
    print("=" * 50)

    app.run(debug=False, port=port, host=host)
