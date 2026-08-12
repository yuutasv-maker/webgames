import re
import html
import logging
from datetime import datetime, timedelta

from constants import CATEGORY_MAP, TITLE_ALIASES, STORE_INFO, DrinkType

def parse_date_string(date_str):
    """様々な形式の日付文字列を解析して datetime.date オブジェクトにして返す"""
    if not date_str:
        return None
    date_str = date_str.strip()

    # M/D などを M-D に正規化
    date_str_normalized = date_str.replace('/', '-')
    
    # 年の指定がない場合（例:「12月25日」）、実行時の「現在の年」をデフォルトとして補完する。
    # ※年末に翌年のイベントを登録する際は、年を明記してもらう運用前提。
    current_year = datetime.now().year

    # (正規表現パターン, 年を追加するかどうか, グループのインデックス)
    patterns = [
        (r'^(\d{1,2})月(\d{1,2})日$', True, (1, 2)),
        (r'^(\d{4})年(\d{1,2})月(\d{1,2})日$', False, (1, 2, 3)),
        (r'^(\d{1,2})-(\d{1,2})$', True, (1, 2)),
        (r'^(\d{4})-(\d{1,2})-(\d{1,2})$', False, (1, 2, 3)),
    ]

    for pattern, needs_year, groups in patterns:
        m = re.match(pattern, date_str_normalized)
        if m:
            try:
                if needs_year:
                    return datetime(current_year, int(m.group(groups[0])), int(m.group(groups[1]))).date()
                else:
                    return datetime(int(m.group(groups[0])), int(m.group(groups[1])), int(m.group(groups[2]))).date()
            except ValueError:
                return None

    # フォールバック
    try:
        return datetime.strptime(date_str_normalized, "%Y-%m-%d").date()
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

    if not start_time_raw and is_all_day:
        start_time_raw = "00:00"
        if not end_time_raw:
            end_time_raw = "23:59"
    elif not start_time_raw:
        logging.error("開始日付または開始時間が設定されていません（終日フラグなし）。")
        return None, None

    try:
        start_dt_base_date = parse_date_string(start_date_raw)
        if not start_dt_base_date:
            raise ValueError(f"開始日付の形式を認識できません: {start_date_raw}")
            
        start_dt = datetime.combine(start_dt_base_date, datetime.strptime(start_time_raw, "%H:%M").time())
        
        if not end_date_raw:
            end_dt_base_date = start_dt_base_date
        else:
            end_dt_base_date = parse_date_string(end_date_raw)
            if not end_dt_base_date:
                raise ValueError(f"終了日付の形式を認識できません: {end_date_raw}")
        
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
    return CATEGORY_MAP.get(category_name)

def generate_contact_info(category_name, ticket_url=None):
    """カテゴリごとに予約・問い合わせのテキストを生成する。ticket_url があればそれを優先する"""
    if category_name == '貸切イベント':
        return ""

    phone = STORE_INFO['phone']
    email = STORE_INFO['email']
    store_name = STORE_INFO['name']

    if category_name == 'アーティストイベント':
        link_url = ticket_url.strip() if ticket_url else STORE_INFO['ticket_url_default']
        link_text = "チケット予約" if ticket_url else "HP予約"
        return f"<strong>ご予約・問い合わせ：</strong>{store_name}(<a href=\"{link_url}\" target=\"_blank\" rel=\"noopener noreferrer\">{link_text}</a>, 電話番号:<a href=\"tel:{phone}\">{phone}</a>, E-mail:<a href=\"mailto:{email}\">{email}</a>)"
    else:
        return f"<strong>お問い合わせ：</strong>{store_name}(電話番号:<a href=\"tel:{phone}\">{phone}</a>, E-mail:<a href=\"mailto:{email}\">{email}</a>)"

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
        # パース失敗時にエラーとせず元の文字列を返すことで、
        # 「投げ銭制」「要1オーダー」などの数値に変換できない特殊な金額設定テキストを破壊せずに維持する。
        return price_str

def apply_recurring_templates_and_aliases(event_data, recurring_events):
    """定期イベントの場合のテンプレート適用と略称変換"""
    title = (event_data.get('イベントタイトル') or '').strip()
    
    # 略称の変換
    for alias, formal_name in TITLE_ALIASES.items():
        if alias in title and formal_name not in title:
            title = title.replace(alias, formal_name)
    
    # 定期イベントのテンプレートがあれば適用
    for rec_name, template in recurring_events.items():
        if rec_name in title:
            if not event_data.get('イベントカテゴリー'):
                event_data['イベントカテゴリー'] = template.get('category', '')
            if not event_data.get('開場時間'):
                event_data['開場時間'] = template.get('開場時間', '')
            if not event_data.get('開始時間'):
                event_data['開始時間'] = template.get('開始時間', '')
            if not event_data.get('終了時間'):
                event_data['終了時間'] = template.get('終了時間', '')
            if not event_data.get('前売り料金'):
                event_data['前売り料金'] = template.get('前売り料金', '')
            break

    return title

# --- build_event_description_html 関連の分割 ---

def _build_date_html(event_data):
    start_date_raw = (event_data.get('開始日付') or '').strip()
    start_dt_obj = parse_date_string(start_date_raw)
    
    if start_dt_obj:
        return f"<strong>開催日：</strong>{start_dt_obj.year}年{start_dt_obj.month}月{start_dt_obj.day}日"
    elif start_date_raw:
        return f"<strong>開催日：</strong>{start_date_raw}"
    return ""

def _build_time_html(event_data):
    open_time = (event_data.get('開場時間') or '').strip()
    start_time = (event_data.get('開始時間') or '').strip()
    
    if open_time:
        return f"<strong>開場時間：</strong>{open_time}　<strong>開演時間：</strong>{start_time}"
    elif start_time:
        return f"<strong>開演時間：</strong>{start_time}"
    return ""

def _build_price_html(event_data):
    adv_price = (event_data.get('前売り料金') or event_data.get('料金（画面表示用）') or '').strip()
    door_price = (event_data.get('当日料金') or '').strip()
    
    disp_adv_price = format_price(adv_price)
    disp_door_price = format_price(door_price)

    drink_flag = (event_data.get('ドリンク') or '').strip().lower()
    other_text = (event_data.get('その他') or '').strip()
    
    if other_text:
        drink_text = f"(1ドリンク・{other_text}付)"
    elif drink_flag == DrinkType.NONE:
        drink_text = ""
    else:
        drink_text = "(1ドリンク付)" if drink_flag == DrinkType.INCLUDED else "※要1ドリンクオーダー"

    drink_part = f" {drink_text}" if drink_text else ""

    if door_price:
        return f"<strong>前売り料金：</strong>{disp_adv_price}　<strong>当日料金：</strong>{disp_door_price}{drink_part}"
    elif adv_price:
        if disp_adv_price == '無料':
            return f"<strong>料金：</strong>無料{drink_part}"
        else:
            return f"<strong>料金：</strong>{disp_adv_price}{drink_part}"
    else:
        if drink_text:
            return f"<strong>料金：</strong>{drink_text}"
    return ""

def _build_detail_html(event_data, category_name):
    base_desc = html.escape(event_data.get('出演者・詳細') or '').replace('\n', '<br>')
    if base_desc:
        desc_label = "詳細：" if category_name == '参加型イベント' else "出演者・詳細："
        return f"<strong>{desc_label}</strong><br>{base_desc}"
    return ""

def build_event_description_html(event_data, category_name):
    """
    登録するイベント内容から、WordPressの本文（description）に挿入するHTML文字列を生成する
    """
    if category_name == '貸切イベント':
        return ""

    html_parts = []
    
    date_html = _build_date_html(event_data)
    if date_html: html_parts.append(date_html)

    time_html = _build_time_html(event_data)
    if time_html: html_parts.append(time_html)

    price_html = _build_price_html(event_data)
    if price_html: html_parts.append(price_html)

    detail_html = _build_detail_html(event_data, category_name)
    if detail_html: html_parts.append(detail_html)

    contact_html = generate_contact_info(category_name, event_data.get('チケット予約URL'))
    if contact_html: html_parts.append(contact_html)

    return '<div class="event-details">\n' + '<br>\n'.join(html_parts) + '\n</div>'

def parse_event_status(event_data):
    """公開ステータス(publish/draft)を判定して返す"""
    status_raw = (event_data.get('公開ステータス(public/draft)') or
                  event_data.get('公開ステータス(publish/draft)') or
                  event_data.get('公開ステータス') or '').strip().lower()

    if not status_raw:
        return 'publish'
    elif status_raw in ['p', 'public', 'publish']:
        return 'publish'
    elif status_raw in ['d', 'draft']:
        return 'draft'
    else:
        return 'publish'

def parse_event_cost(event_data):
    """費用(システム登録用)に設定する値を抽出して返す"""
    cost_val = (event_data.get('前売り料金') or event_data.get('料金（画面表示用）') or '').strip()
    if not cost_val:
        return None
    if cost_val in ("無料", "0", "０"):
        return '無料'
    m = re.search(r'([\d,]+)', cost_val)
    if m:
        val_str = m.group(1).replace(',', '')
        if val_str == "0":
            return '無料'
        return val_str
        
    return cost_val

# --- extract_event_info_from_text 関連の分割 ---

def _extract_date_info(text, result):
    m_date_label = re.search(r'開催日[：:]\s*(\d{4})年(\d{1,2})月(\d{1,2})日', text)
    if m_date_label:
        result['start_date'] = f"{m_date_label.group(1)}-{int(m_date_label.group(2)):02d}-{int(m_date_label.group(3)):02d}"
    else:
        m_date = re.search(r'(\d{4})[年/](\d{1,2})[月/](\d{1,2})(?:日)?', text)
        if m_date:
            result['start_date'] = f"{m_date.group(1)}-{int(m_date.group(2)):02d}-{int(m_date.group(3)):02d}"

def _extract_time_info(text, result):
    m_open_label = re.search(r'開場時間[：:]\s*(\d{1,2}[:時]\d{2})', text)
    if m_open_label:
        result['open_time'] = m_open_label.group(1).replace('時', ':')
        
    m_start_label = re.search(r'(?:開演時間|開始時間|START)[：:]\s*(\d{1,2}[:時]\d{2})', text, re.IGNORECASE)
    if m_start_label:
        result['start_time'] = m_start_label.group(1).replace('時', ':')

    if not result['start_time']:
        times = re.findall(r'(\d{1,2}[:時]\d{2})', text)
        if times:
            times = [t.replace('時', ':') for t in times]
            result['start_time'] = times[0]
            if len(times) >= 2:
                result['end_time'] = times[1]

def _extract_price_info(text, result):
    m_adv = re.search(r'(?:前売り料金|料金)[：:]\s*(?:¥|￥)?([\d,]+)円?', text)
    if m_adv:
        result['advance_price'] = m_adv.group(1).replace(',', '')

    m_door = re.search(r'当日料金[：:]\s*(?:¥|￥)?([\d,]+)円?', text)
    if m_door:
        result['door_price'] = m_door.group(1).replace(',', '')

    if not result['advance_price']:
        prices = re.findall(r'(?:¥|￥)?([\d,]+)円', text)
        if prices:
            prices_int = [int(p.replace(',', '')) for p in prices if p.replace(',', '').isdigit()]
            if prices_int:
                prices_int.sort()
                result['advance_price'] = str(prices_int[0])
                if len(prices_int) > 1:
                    result['door_price'] = str(prices_int[-1])

def extract_event_info_from_text(text):
    """
    イベント詳細テキストから正規表現を用いて日時や料金を抽出する。
    
    ※この関数は、WebフォームにてユーザーがSNSの告知文などを自由入力欄に貼り付けた際、
    「自動抽出」ボタンひとつで各入力フィールド（日時・料金など）に推測値を自動補完する
    アシスト機能のためのユースケースで利用される。
    """
    result = {
        'start_date': None,
        'open_time': None,
        'start_time': None,
        'end_time': None,
        'advance_price': None,
        'door_price': None,
    }
    if not text:
        return result
        
    _extract_date_info(text, result)
    _extract_time_info(text, result)
    _extract_price_info(text, result)

    return result
