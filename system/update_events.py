import csv
import json
import logging
import mimetypes
import os
import requests
import base64
import io
import re
from datetime import datetime, timedelta

# ==========================================
# 設定
# ==========================================
CONFIG_FILE = 'config.json'
CSV_FILE = 'events.csv'
LOG_FILE = 'update_log.txt'
RECURRING_EVENTS_FILE = 'recurring_events.json'

# ==========================================
# カテゴリ定義 (スラッグ名や表示名からカテゴリIDへのマッピング)
# ==========================================
CATEGORY_MAP = {
    'アーティストイベント': 11,
    'オープンイベント': 24,
    'ランチライブ': 19,
    'ワークショップ': 26,
    '参加型イベント': 12,
    '貸切イベント': 13,
    '野外イベント': 27,
    # CSVで手入力されやすい表記ゆれなどがあればここに追加可能
    'ライブ': 11,
    '貸切': 13
}

# ==========================================
# 参加型イベント等のタイトル略称マッピング
# ==========================================
TITLE_ALIASES = {
    '弾キガタリスト': '弾キガタリスト大集合！',
    'フォーク酒場': '生オケ！フォーク酒場',
    '町家': '町家ず〜っと輝こうライブ',
    '気まま': '気ままにステージ',
    'レコード': 'レコードライブ',
    '昭和歌謡': '昭和歌謡ナイト',
    'リセッツ': 'リセッツナイト',
    'ゆず': 'ゆずdeナイト',
    '沖縄': '沖縄ナイト'
}

# ログの設定
logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    encoding='utf-8'
)
console = logging.StreamHandler()
console.setLevel(logging.INFO)
logging.getLogger('').addHandler(console)

def load_config():
    """設定ファイル読み込み"""
    if not os.path.exists(CONFIG_FILE):
        logging.error(f"設定ファイルが見つかりません: {CONFIG_FILE}")
        return None
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logging.error(f"設定ファイルの読み込みに失敗しました: {e}")
        return None

def load_recurring_events():
    """定期イベント設定ファイルの読み込み"""
    if not os.path.exists(RECURRING_EVENTS_FILE):
        return {}
    try:
        with open(RECURRING_EVENTS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logging.warning(f"定期イベント設定ファイルの読み込みに失敗しました（通常フローは続行）: {e}")
        return {}

def format_datetime(date_str, time_str):
    """日付と時間を合わせてYY-MM-DD HH:MM:SS形式にする（不要になったため削除予定/互換用として残す）"""
    try:
        date_str = date_str.replace('/', '-')
        dt_str = f"{date_str} {time_str}"
        dt = datetime.strptime(dt_str, '%Y-%m-%d %H:%M')
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except ValueError as e:
        logging.error(f"日時のフォーマットエラー: {date_str} {time_str} - {e}")
        return None

def parse_date_string(date_str):
    """様々な形式の日付文字列を解析して datetime.date オブジェクトにして返す"""
    if not date_str:
        return None
    date_str = date_str.strip()

    # M月D日の対応
    m = re.match(r'^(\d{1,2})月(\d{1,2})日$', date_str)
    if m:
        return datetime(datetime.now().year, int(m.group(1)), int(m.group(2))).date()

    # YYYY年M月D日の対応
    m = re.match(r'^(\d{4})年(\d{1,2})月(\d{1,2})日$', date_str)
    if m:
        return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3))).date()

    # M/D または M-D の対応
    date_str_normalized = date_str.replace('/', '-')
    m = re.match(r'^(\d{1,2})-(\d{1,2})$', date_str_normalized)
    if m:
        return datetime(datetime.now().year, int(m.group(1)), int(m.group(2))).date()

    # YYYY-MM-DD または YYYY-M-D の対応
    m = re.match(r'^(\d{4})-(\d{1,2})-(\d{1,2})$', date_str_normalized)
    if m:
        return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3))).date()

    # フォールバック
    try:
        return datetime.strptime(date_str.replace('/', '-'), "%Y-%m-%d").date()
    except ValueError:
        return None

def parse_and_fill_datetime(event_data, is_all_day=False):
    """入力された日付・時間を解析し、補完して返す"""
    start_date_raw = (event_data.get('開始日付') or '').strip()
    start_time_raw = (event_data.get('開始時間') or '').strip()
    end_date_raw = (event_data.get('終了日付') or '').strip()
    end_time_raw = (event_data.get('終了時間') or '').strip()

    if not start_date_raw:
        logging.error("開始日付が設定されていません。")
        return None, None

    # 終日イベントの場合、時間が空なら「00:00」などを仮置きする
    if not start_time_raw:
        if is_all_day:
            start_time_raw = "00:00"
            if not end_time_raw:
                end_time_raw = "23:59"
        else:
            logging.error("開始日付または開始時間が設定されていません（終日フラグなし）。")
            return None, None

    try:
        # 開始日時の生成
        start_dt_base_date = parse_date_string(start_date_raw)
        if not start_dt_base_date:
            raise ValueError(f"開始日付の形式を認識できません: {start_date_raw}")
            
        start_dt = datetime.combine(start_dt_base_date, datetime.strptime(start_time_raw, "%H:%M").time())
        
        # 終了日付の補完 (空なら開始日付と同じ)
        if not end_date_raw:
            end_dt_base_date = start_dt_base_date
        else:
            end_dt_base_date = parse_date_string(end_date_raw)
            if not end_dt_base_date:
                raise ValueError(f"終了日付の形式を認識できません: {end_date_raw}")
        
        # 終了時間の補完 (空なら開始時間 + 3時間)
        if not end_time_raw:
            if is_all_day:
                end_dt = datetime.combine(end_dt_base_date, datetime.strptime("23:59", "%H:%M").time())
            else:
                end_dt = datetime.combine(end_dt_base_date, start_dt.time()) + timedelta(hours=3)
        else:
            end_dt = datetime.combine(end_dt_base_date, datetime.strptime(end_time_raw, "%H:%M").time())

        return start_dt.strftime('%Y-%m-%d %H:%M:%S'), end_dt.strftime('%Y-%m-%d %H:%M:%S')

    except ValueError as e:
        logging.error(f"日時のパースエラー - {e}")
        return None, None

def get_category_id(category_name):
    """カテゴリ名からカテゴリIDを取得する"""
    if not category_name:
        return None
    
    # 登録されているマッピング情報と照合
    return CATEGORY_MAP.get(category_name)

def generate_contact_info(category_name):
    """カテゴリごとに予約・問い合わせのテキストを生成する"""
    if category_name == '貸切イベント':
        return "" # 貸切の場合は別途本文自体も空にするが、ここでも空を返しておく

    if category_name == 'アーティストイベント':
        return "<strong>ご予約・問い合わせ：</strong>スタジオOWL(<a href='https://owl21.info/%e3%83%81%e3%82%b1%e3%83%83%e3%83%88%e4%ba%88%e7%b4%84/'>HP予約</a>, 電話番号:089-941-0036, E-mail:<a href='mailto:studio.owl.contact@gmail.com'>studio.owl.contact@gmail.com</a>)"
    else:
        return "<strong>お問い合わせ：</strong>スタジオOWL(電話番号:089-941-0036, E-mail:<a href='mailto:studio.owl.contact@gmail.com'>studio.owl.contact@gmail.com</a>)"

def format_price(price_str):
    """数字のみの料金を「2,000円」形式にフォーマットし、0なら無料を返す"""
    if not price_str:
        return ""
    if price_str == "0" or price_str == "無料" or price_str == "０":
        return "無料"
    try:
        val = int(price_str.replace(',', '').replace('円', ''))
        return f"{val:,}円"
    except ValueError:
        return price_str

def upload_image_to_wp(config, file_path=None, file_data=None, file_name=None):
    """WordPress のメディアライブラリに画像をアップロードし、メディアIDを返す。
    file_path (ファイルパス指定) または file_data + file_name (バイナリデータ指定) のいずれかを使用。
    """
    url = f"{config['WP_URL'].rstrip('/')}/wp-json/wp/v2/media"

    auth_string = f"{config['WP_USERNAME']}:{config['WP_APP_PASSWORD']}"
    auth_base64 = base64.b64encode(auth_string.encode('utf-8')).decode('utf-8')

    if file_path:
        file_name = os.path.basename(file_path)
        with open(file_path, 'rb') as f:
            file_data = f.read()

    if not file_data or not file_name:
        logging.error("画像データまたはファイル名が指定されていません。")
        return None

    mime_type, _ = mimetypes.guess_type(file_name)
    if not mime_type:
        mime_type = 'image/jpeg'

    headers = {
        'Content-Disposition': f'attachment; filename="{file_name}"',
        'Content-Type': mime_type,
        'X-Owl-Auth': f"Basic {auth_base64}"
    }

    try:
        response = requests.post(url, headers=headers, data=file_data)
        if response.status_code in (200, 201):
            media_id = response.json().get('id')
            logging.info(f"画像アップロード成功: {file_name} (Media ID: {media_id})")
            return media_id
        else:
            logging.error(f"画像アップロード失敗: {file_name} - HTTP {response.status_code}")
            logging.error(f"詳細: {response.text}")
            return None
    except Exception as e:
        logging.error(f"画像アップロード通信エラー: {file_name} - {e}")
        return None


def check_duplicate_event(config, title, start_date_str):
    """同じ日付・同じタイトルのイベントが既に登録済みかチェックする。
    重複があれば True（スキップすべき）、なければ False を返す。
    """
    url = f"{config['WP_URL'].rstrip('/')}/wp-json/tribe/events/v1/events"

    auth_string = f"{config['WP_USERNAME']}:{config['WP_APP_PASSWORD']}"
    auth_base64 = base64.b64encode(auth_string.encode('utf-8')).decode('utf-8')
    headers = {
        'X-Owl-Auth': f"Basic {auth_base64}"
    }

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
        response = requests.get(url, params=params, headers=headers)
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
            logging.warning(f"  > 重複チェックAPIの応答: HTTP {response.status_code} - チェックをスキップして登録を続行します")
    except Exception as e:
        logging.warning(f"  > 重複チェック時に通信エラー: {e} - チェックをスキップして登録を続行します")

    return False


def create_event(config, recurring_events, event_data):
    """The Events Calendar APIを使ってイベントを作成"""
    url = f"{config['WP_URL'].rstrip('/')}/wp-json/tribe/events/v1/events"
    
    # -------------------------------------------------------------------
    # 定期イベントの自動補完ロジック
    # (event_data内にキーが存在し、かつ空欄の場合に recurring_events の値を埋める)
    # -------------------------------------------------------------------
    title = (event_data.get('イベントタイトル') or '').strip()

    # ★略称が入力された場合の正式名称への自動変換★
    if title in TITLE_ALIASES:
        title = TITLE_ALIASES[title]
        event_data['イベントタイトル'] = title # 以降のログ用や処理用に書き換え

    if title in recurring_events:
        template = recurring_events[title]
        # 「料金（画面表示用）」などの旧いキー名が設定ファイルにある場合でもフォールバックする
        for key, default_val in template.items():
            # CSVの列が空（または存在しない場合）、設定ファイルの値を代入
            target_key = key
            if key == '料金（画面表示用）' and not event_data.get('前売り料金'):
                target_key = '前売り料金'
            
            if not (event_data.get(target_key) or '').strip():
                event_data[target_key] = default_val

    # -------------------------------------------------------------------
    # 終日イベント(All Day)対応
    # -------------------------------------------------------------------
    # ヘッダー名「公開ステータス(public/draft)」などのリクエスト対応
    # CSVの内容に合わせるためキー名の揺れを吸収するか、新しいヘッダー名で固定
    all_day_key = '終日イベント(1で終日)'
    is_all_day_raw = (event_data.get(all_day_key) or '').strip()
    is_all_day = (is_all_day_raw == '1')

    # -------------------------------------------------------------------
    # ヘッダーや日時の用意
    # -------------------------------------------------------------------
    # ロリポップのCGI制限回避のため、独自ヘッダーにBasic認証情報を載せる
    auth_string = f"{config['WP_USERNAME']}:{config['WP_APP_PASSWORD']}"
    auth_base64 = base64.b64encode(auth_string.encode('utf-8')).decode('utf-8')
    headers = {
        'Content-Type': 'application/json',
        'X-Owl-Auth': f"Basic {auth_base64}"
    }

    start_date, end_date = parse_and_fill_datetime(event_data, is_all_day)

    if not start_date or not end_date:
        return False

    # -------------------------------------------------------------------
    # 本文（詳細）とカテゴリの用意
    # -------------------------------------------------------------------
    # カテゴリの取得キーの揺れを吸収
    cat_keys = [
        'イベントカテゴリー(アーティストイベント/オープンイベント/ランチライブ/ワークショップ/参加型イベント/貸切イベント/野外イベント)',
        'イベントカテゴリー(アーティストイベント等)',
        'イベントカテゴリー'
    ]
    cat_name_raw = next((event_data.get(k) for k in cat_keys if event_data.get(k)), None)
    cat_name = (cat_name_raw or '').strip()
    
    # 貸切イベントの場合は詳細を空にする
    if cat_name == '貸切イベント':
        description_html = ""
    else:
        # html要素のリストを用意し、最後に結合する（不要な空行やマージンをなくすため）
        html_parts = []
        
        # 1. 開催日
        start_date_raw = (event_data.get('開始日付') or '').strip()
        start_dt_obj = parse_date_string(start_date_raw)
        
        if start_dt_obj:
            # ゼロ埋めなしのフォーマット (Windows/Linux非依存)
            formatted_date = f"{start_dt_obj.year}年{start_dt_obj.month}月{start_dt_obj.day}日"
            html_parts.append(f"<strong>開催日：</strong>{formatted_date}")
        elif start_date_raw:
            html_parts.append(f"<strong>開催日：</strong>{start_date_raw}")
            
        # 2. 開場・開演時間
        open_time = (event_data.get('開場時間') or '').strip()
        start_time = (event_data.get('開始時間') or '').strip()
        
        if open_time:
            html_parts.append(f"<strong>開場時間：</strong>{open_time}　<strong>開演時間：</strong>{start_time}")
        elif start_time:
            html_parts.append(f"<strong>開演時間：</strong>{start_time}")

        # 3. 料金
        # CSVのキー揺れ対応かつ前売り0円（または無料）対応
        adv_price = (event_data.get('前売り料金') or event_data.get('料金（画面表示用）') or '').strip()
        door_price = (event_data.get('当日料金') or '').strip()
        
        disp_adv_price = format_price(adv_price)
        disp_door_price = format_price(door_price)

        # ドリンク・その他列の判定
        drink_flag = (event_data.get('ドリンク') or '').strip().lower()
        other_text = (event_data.get('その他') or '').strip()
        
        if other_text:
            drink_text = f"(1ドリンク・{other_text}付)"
        else:
            drink_text = "(1ドリンク付)" if drink_flag == 'x' else "※要1ドリンクオーダー"

        if door_price:
            html_parts.append(f"<strong>前売り料金：</strong>{disp_adv_price}　<strong>当日料金：</strong>{disp_door_price} {drink_text}")
        elif adv_price:
            if disp_adv_price == '無料':
                html_parts.append(f"<strong>料金：</strong>無料 {drink_text}")
            else:
                html_parts.append(f"<strong>料金：</strong>{disp_adv_price} {drink_text}")
        else:
            # 料金自体の入力がない場合でもドリンク表記が必要な場合
            html_parts.append(f"<strong>料金：</strong>{drink_text}")

        # 4. 出演者・詳細
        base_desc = (event_data.get('出演者・詳細') or '').replace('\n', '<br>')
        if base_desc:
            desc_label = "詳細：" if cat_name == '参加型イベント' else "出演者・詳細："
            html_parts.append(f"<strong>{desc_label}</strong><br>{base_desc}")
            
        # 5. 問い合わせ先
        contact_html = generate_contact_info(cat_name)
        if contact_html:
            html_parts.append(contact_html)

        description_html = '<div class="event-details">\n' + '<br>\n'.join(html_parts) + '\n</div>'

    # -------------------------------------------------------------------
    # ペイロード（システム送信データ）の組み立て
    # -------------------------------------------------------------------
    # 公開ステータスの取得（キー名の揺れを吸収）
    status_key = '公開ステータス(public/draft)' if '公開ステータス(public/draft)' in event_data else '公開ステータス(publish/draft)'
    status_raw = (event_data.get(status_key) or event_data.get('公開ステータス') or '').strip().lower()

    if not status_raw:
        status_raw = 'publish'
    elif status_raw in ['p', 'public', 'publish']:
        status_raw = 'publish'
    elif status_raw in ['d', 'draft']:
        status_raw = 'draft'
    else:
        status_raw = 'publish' # 不明な場合はデフォルトでpublish

    payload = {
        'title': title,
        'start_date': start_date,
        'end_date': end_date,
        'status': status_raw,
        'all_day': is_all_day
    }
    
    if description_html:
        payload['description'] = description_html

    # 費用(システム登録用) に「前売り料金」の値（あるいは料金表示用）を送信
    cost_val = adv_price if 'adv_price' in locals() else (event_data.get('前売り料金') or event_data.get('料金（画面表示用）') or '').strip()
    if cost_val:
        # APIが半角の0を空文字として無視・パースエラーにする仕様（PHP empty('0')）を回避するため、「無料」を送る
        if cost_val == '0' or cost_val == '０':
            payload['cost'] = '無料'
        else:
            # 「1,200円(1ドリンク付)」のように文字が混ざると、The Events Calendarが「1」としてパースしてしまうため、
            # 最初の金額部分の数字のみをキレイに抽出してシステム値として送信する
            m = re.search(r'([\d,]+)', cost_val)
            if m:
                # '1,200' などを '1200' にする
                clean_cost = m.group(1).replace(',', '')
                payload['cost'] = clean_cost
            else:
                # 数字が含まれていない場合（無料などのテキスト）はそのまま送るか、無料にする
                if cost_val == '無料':
                    payload['cost'] = '無料'
                else:
                    payload['cost'] = cost_val

    # カテゴリの追加
    cat_id = get_category_id(cat_name)
    if cat_id:
        payload['categories'] = [cat_id]
    elif cat_name:
         logging.warning(f"  > 警告: カテゴリ '{cat_name}' はシステムに登録されていないため設定されませんでした。")
         
    # -------------------------------------------------------------------
    # カスタムフィールド・拡張プロパティ (注目フラグ等)
    # -------------------------------------------------------------------
    # 注目イベント(Pick Up Live!)対応
    pickup_flag = (event_data.get('注目イベント') or '').strip()
    if pickup_flag == '1' or pickup_flag.lower() == 'true':
        payload['featured'] = True

    # アイキャッチ画像（メディアID）の取得（イベント作成後に別途設定する）
    image_id = event_data.get('_image_id')

    # -------------------------------------------------------------------
    # 重複チェック: 同じ日付・同じタイトルのイベントが存在すればスキップ
    # -------------------------------------------------------------------
    if check_duplicate_event(config, title, start_date):
        logging.info(f"[スキップ] 既に同じイベントが存在します: {title} ({start_date[:10]})")
        return 'skip'

    try:
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code in (200, 201):
            event_id = response.json().get('id')
            feat_mark = "[PickUp]" if payload.get('featured') else ""
            logging.info(f"成功: {event_data['イベントタイトル']} [{status_raw}] {feat_mark} (ID: {event_id})")

            # アイキャッチ画像の設定（WordPress標準REST APIで featured_media を設定）
            if image_id and event_id:
                try:
                    wp_url = f"{config['WP_URL'].rstrip('/')}/wp-json/wp/v2/tribe_events/{event_id}"
                    wp_response = requests.post(wp_url, json={'featured_media': int(image_id)}, headers=headers)
                    if wp_response.status_code in (200, 201):
                        logging.info(f"  > アイキャッチ画像を設定しました (Media ID: {image_id})")
                    else:
                        logging.warning(f"  > アイキャッチ画像の設定に失敗 (HTTP {wp_response.status_code}): {wp_response.text}")
                except Exception as img_e:
                    logging.warning(f"  > アイキャッチ画像の設定中にエラー: {img_e}")

            return True
        else:
            logging.error(f"失敗: {event_data['イベントタイトル']} - HTTP {response.status_code}")
            logging.error(f"詳細: {response.text}")
            return False
    except Exception as e:
        logging.error(f"通信エラー: {event_data['イベントタイトル']} - {e}")
        return False


def main():
    logging.info("--- スケジュール更新処理を開始します ---")
    config = load_config()
    if not config:
        print("設定エラーで終了します。")
        return

    recurring_events = load_recurring_events()

    if not os.path.exists(CSV_FILE):
        logging.error(f"CSVファイルが見つかりません: {CSV_FILE}")
        return

    success_count = 0
    error_count = 0
    skip_count = 0

    try:
        # バイナリで読み込んでcp932(Shift-JIS)とutf-8の両方に対応する
        with open(CSV_FILE, 'rb') as f:
            raw_data = f.read()
        
        try:
            text = raw_data.decode('utf-8-sig')
        except UnicodeDecodeError:
            text = raw_data.decode('cp932')

        reader = csv.DictReader(io.StringIO(text, newline=''))
        
        for row in reader:
            # 必須項目のチェック (Excelで保存された空行をスキップ)
            if not (row.get('イベントタイトル') or '').strip() or not (row.get('開始日付') or '').strip():
                continue
            
            logging.info(f"処理中: {row['イベントタイトル']}")
            result = create_event(config, recurring_events, row)
            if result == 'skip':
                skip_count += 1
            elif result:
                success_count += 1
            else:
                error_count += 1
    except Exception as e:
        logging.error(f"CSV読み込みエラー: {e}")

    logging.info(f"--- 処理完了 ---")
    logging.info(f"成功: {success_count}件, スキップ(重複): {skip_count}件, 失敗: {error_count}件")

if __name__ == '__main__':
    main()
