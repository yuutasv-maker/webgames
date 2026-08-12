import os
import re
import json
import base64
import mimetypes
import logging
import threading
import requests
import urllib.parse
from datetime import datetime
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from event_builder import build_api_payload

_processing_lock = threading.Lock()
_processing_events = set()

def _get_auth_headers(config, additional_headers=None):
    """WordPressへのAPIリクエスト用の共通ヘッダーを生成する"""
    auth_string = f"{config['WP_USERNAME']}:{config['WP_APP_PASSWORD']}"
    auth_base64 = base64.b64encode(auth_string.encode('utf-8')).decode('utf-8')
    # ロリポップ！等のCGI環境で標準の Authorization ヘッダーがサーバー層で削除される
    # 問題を回避するため、WP側で受け取り用にカスタマイズされた独自ヘッダーを使用する。
    headers = {
        'X-Owl-Auth': f"Basic {auth_base64}",
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    if additional_headers:
        headers.update(additional_headers)
    return headers

def get_robust_session():
    """リトライ機能付きの堅牢なHTTPセッションを返す"""
    session = requests.Session()
    retry_strategy = Retry(
        total=3,
        backoff_factor=1.0,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["HEAD", "GET", "OPTIONS", "POST"]
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session

def upload_image_to_wp(config, file_path=None, file_data=None, file_name=None, session=None):
    """WordPress のメディアライブラリに画像をアップロードし、メディアIDを返す。
    file_path (ファイルパス指定) または file_data + file_name (バイナリデータ指定) のいずれかを使用。
    """
    url = urllib.parse.urljoin(config['WP_URL'] + '/', 'wp-json/wp/v2/media')

    if file_path:
        file_name = os.path.basename(file_path)
        with open(file_path, 'rb') as f:
            file_data = f.read()

    if not file_data or not file_name:
        logging.error("画像データまたはファイル名が指定されていません。")
        return None

    # ASCII以外の文字（日本語など）が含まれる場合、安全なファイル名に変換する
    try:
        file_name.encode('ascii')
        safe_file_name = file_name
    except UnicodeEncodeError:
        # 日本語などのマルチバイト文字を含むファイル名をそのままWP APIに送信すると、
        # サーバー環境依存でファイル破損や文字化け、500エラーとなるリスクがあるための回避策。
        _, ext = os.path.splitext(file_name)
        ext = ext.lower()
        if not re.match(r'^\.[a-z0-9]+$', ext):
            ext = '.jpg'
        safe_file_name = f"upload_{datetime.now().strftime('%Y%m%d_%H%M%S')}{ext}"
        logging.info(f"日本語ファイル名を安全なファイル名に変換しました: {file_name} -> {safe_file_name}")

    mime_type, _ = mimetypes.guess_type(safe_file_name)
    if not mime_type:
        mime_type = 'image/jpeg'

    headers = _get_auth_headers(config, {
        'Content-Disposition': f'attachment; filename="{safe_file_name}"',
        'Content-Type': mime_type
    })

    try:
        client = session or get_robust_session()
        response = client.post(url, headers=headers, data=file_data)
        if response.status_code in (200, 201):
            media_id = response.json().get('id')
            logging.info(f"画像アップロード成功: {file_name} (Media ID: {media_id})")
            return media_id
        else:
            logging.error(f"画像アップロード失敗: {file_name} - HTTP {response.status_code}")
            logging.error(f"詳細: {response.text}")
            return None
    except requests.RequestException as e:
        logging.error(f"画像アップロード通信エラー: {file_name} - {e}")
        return None

def check_duplicate_event(config, title, start_date_str, session=None):
    """同じ日付・同じタイトルのイベントが既に登録済みかチェックする。
    重複があれば True（スキップすべき）、なければ False を返す。
    """
    url = urllib.parse.urljoin(config['WP_URL'] + '/', 'wp-json/tribe/events/v1/events')

    headers = _get_auth_headers(config)

    # start_date_str は 'YYYY-MM-DD HH:MM:SS' 形式 → 日付部分だけ取り出す
    target_date = start_date_str[:10]  # 'YYYY-MM-DD'

    params = {
        'search': title,
        'start_date': target_date,
        'end_date': target_date,
        'per_page': 50,
        'status': 'publish,draft',
    }

    try:
        client = session or get_robust_session()
        response = client.get(url, params=params, headers=headers)
        if response.status_code == 200:
            data = response.json()
            events = data.get('events', [])
            for event in events:
                existing_title = (event.get('title') or '').strip()
                existing_start = (event.get('start_date') or '')[:10]
                if existing_title == title and existing_start == target_date:
                    return True
        elif response.status_code == 404:
            # 該当イベントなし（空の結果）
            return False
        else:
            logging.error(f"  > 重複チェックAPIの異常応答: HTTP {response.status_code} - 安全のためエラー扱いとします")
            return 'error'
    except requests.RequestException as e:
        logging.error(f"  > 重複チェック時に通信エラー: {e} - 安全のためエラー扱いとします")
        return 'error'

    return False

def set_featured_image(config, event_id, image_id, headers, session=None):
    """WordPress標準REST APIでアイキャッチ画像を設定する"""
    try:
        # The Events Calendar API(v1)のエンドポイントではアイキャッチ画像(featured_media)
        # の登録が直接サポートされていないため、画像設定のみWP標準のREST APIを併用する。
        wp_url = urllib.parse.urljoin(config['WP_URL'] + '/', f'wp-json/wp/v2/tribe_events/{event_id}')
        client = session or get_robust_session()
        wp_response = client.post(wp_url, json={'featured_media': int(image_id)}, headers=headers)
        if wp_response.status_code in (200, 201):
            logging.info(f"  > アイキャッチ画像を設定しました (Media ID: {image_id})")
        else:
            logging.warning(f"  > アイキャッチ画像の設定に失敗 (HTTP {wp_response.status_code}): {wp_response.text}")
    except requests.RequestException as img_e:
        logging.warning(f"  > アイキャッチ画像の設定中にエラー: {img_e}")

def create_event(config, recurring_events, event_data, session=None):
    """The Events Calendar APIを使ってイベントを作成"""
    url = urllib.parse.urljoin(config['WP_URL'] + '/', 'wp-json/tribe/events/v1/events')
    
    # 1. ペイロードと基本情報の構築
    payload, title, start_date, cat_name = build_api_payload(event_data, recurring_events)
    if not payload:
        return False

    # 2. 接続認証ヘッダーの生成
    # ロリポップのCGI制限回避のため、独自ヘッダーにBasic認証情報を載せる
    headers = _get_auth_headers(config, {'Content-Type': 'application/json'})

    # 3. 排他制御（競合状態防止）: 処理中のイベントを記録し、同時実行による二重登録を防ぐ
    event_key = (title, start_date[:10])
    with _processing_lock:
        if event_key in _processing_events:
            logging.info(f"[スキップ] 同一イベントが並行処理中のためスキップします: {title} ({start_date[:10]})")
            return 'skip'
        _processing_events.add(event_key)

    try:
        # 4. 重複チェック
        dup_check = check_duplicate_event(config, title, start_date, session=session)
        if dup_check == 'error':
            # ネットワーク不安定等でチェックが失敗した場合、誤って同一イベントを
            # 二重登録してしまう障害を防ぐためのフェイルセーフ。
            logging.error(f"重複チェック中にエラーが発生したため、安全のためにスキップします: {title} ({start_date[:10]})")
            return 'skip'
        elif dup_check:
            logging.info(f"[スキップ] 既に同じイベントが存在します: {title} ({start_date[:10]})")
            return 'skip'
    
        # 5. APIへの作成リクエスト送信
        client = session or get_robust_session()
        response = client.post(url, json=payload, headers=headers)
        if response.status_code in (200, 201):
            event_id = response.json().get('id')
            status = payload.get('status', 'draft')
            feat_mark = "[PickUp]" if payload.get('featured') else ""
            logging.info(f"成功: {event_data.get('イベントタイトル', title)} [{status}] {feat_mark} (ID: {event_id})")
    
            # 6. アイキャッチ画像の紐付け（画像IDが存在する場合）
            image_id = event_data.get('_image_id')
            if image_id and event_id:
                set_featured_image(config, event_id, image_id, headers, session=session)
    
            return True
        else:
            logging.error(f"失敗: {event_data.get('イベントタイトル', title)} - HTTP {response.status_code}")
            if response.status_code == 403:
                logging.error(f"403 Forbidden Payload: {json.dumps(payload, ensure_ascii=False)}")
            logging.error(f"詳細: {response.text}")
            return False
    except requests.RequestException as e:
        logging.error(f"通信エラー: {event_data.get('イベントタイトル', title)} - {e}")
        return False
    finally:
        with _processing_lock:
            if event_key in _processing_events:
                _processing_events.remove(event_key)

def search_events(config, search_query, session=None):
    """タイトルや内容でイベントを検索する"""
    url = urllib.parse.urljoin(config['WP_URL'] + '/', 'wp-json/tribe/events/v1/events')
    headers = _get_auth_headers(config)
    params = {
        'search': search_query,
        'per_page': 50,
        'status': 'publish,draft'
    }
    try:
        client = session or get_robust_session()
        response = client.get(url, params=params, headers=headers)
        if response.status_code == 200:
            return response.json().get('events', [])
        else:
            logging.error(f"イベント検索APIエラー: HTTP {response.status_code} - {response.text}")
            return []
    except requests.RequestException as e:
        logging.error(f"イベント検索時通信エラー: {e}")
        return []

def update_event(config, event_id, recurring_events, event_data, session=None):
    """The Events Calendar APIを使って既存イベントを更新"""
    url = urllib.parse.urljoin(config['WP_URL'] + '/', f'wp-json/tribe/events/v1/events/{event_id}')
    
    payload, title, start_date, cat_name = build_api_payload(event_data, recurring_events)
    if not payload:
        return False
    
    headers = _get_auth_headers(config, {'Content-Type': 'application/json'})

    try:
        client = session or get_robust_session()
        response = client.post(url, json=payload, headers=headers)
        if response.status_code in (200, 201):
            logging.info(f"更新成功: {title} (ID: {event_id})")
            
            image_id = event_data.get('_image_id')
            if image_id:
                set_featured_image(config, event_id, image_id, headers, session=session)
            
            return True
        else:
            logging.error(f"更新失敗: {title} - HTTP {response.status_code}")
            logging.error(f"詳細: {response.text}")
            return False
    except requests.RequestException as e:
        logging.error(f"通信エラー (更新): {title} - {e}")
        return False
