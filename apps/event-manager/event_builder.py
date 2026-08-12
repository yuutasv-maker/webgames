import logging
from event_parser import (
    apply_recurring_templates_and_aliases,
    parse_and_fill_datetime,
    build_event_description_html,
    parse_event_status,
    parse_event_cost,
    get_category_id
)

def build_api_payload(event_data, recurring_events):
    """
    フォームやCSVから受け取った event_data と、recurring_events の情報をもとに、
    WordPress REST API に送信するためのペイロード辞書を構築する。

    戻り値:
        payload (dict): APIに送信するJSONデータ
        title (str): 整形後のイベントタイトル
        start_date (str): YYYY-MM-DD HH:MM:SS 形式の開始日時
        cat_name (str): カテゴリ名
    """
    # 1. 定期イベントの自動補完と略称変換
    title = apply_recurring_templates_and_aliases(event_data, recurring_events)

    # 2. 終日イベント(All Day)判定
    all_day_key = '終日イベント(1で終日)'
    is_all_day_raw = (event_data.get(all_day_key) or '').strip()
    is_all_day = (is_all_day_raw == '1')

    # 3. 日時のパースと補完
    start_date, end_date = parse_and_fill_datetime(event_data, is_all_day)
    if not start_date or not end_date:
        # 日付パースに失敗した場合、異常な日付データがWP側に送信されるのを防ぐため、
        # 処理を中断して安全にエラーとして上位へ返す（フェイルセーフ）。
        return None, title, None, None

    # 4. カテゴリ判定と詳細HTMLの組み立て
    # 過去のCSVテンプレートやWebフォームでのフィールド名変更の履歴（表記揺れ）を吸収し、
    # 後方互換性を保つための優先検索キーリスト。
    cat_keys = [
        'イベントカテゴリー(アーティストイベント/オープンイベント/ランチライブ/ワークショップ/参加型イベント/貸切イベント/野外イベント)',
        'イベントカテゴリー(アーティストイベント等)',
        'イベントカテゴリー'
    ]
    cat_name_raw = next((event_data.get(k) for k in cat_keys if event_data.get(k)), None)
    cat_name = (cat_name_raw or '').strip()
    description_html = build_event_description_html(event_data, cat_name)

    # 5. ステータス判定
    status = parse_event_status(event_data)

    # 6. ペイロードの組み立て
    payload = {
        'title': title,
        'start_date': start_date,
        'end_date': end_date,
        'status': status,
        'all_day': is_all_day
    }
    
    if description_html:
        payload['description'] = description_html

    cost = parse_event_cost(event_data)
    if cost is not None:
        payload['cost'] = cost

    # カテゴリの追加
    cat_id = get_category_id(cat_name)
    if cat_id:
        payload['categories'] = [cat_id]
    elif cat_name:
         logging.warning(f"  > 警告: カテゴリ '{cat_name}' はシステムに登録されていないため設定されませんでした。")

    # 注目イベント設定
    pickup_flag = (event_data.get('注目イベント') or '').strip()
    if pickup_flag == '1' or pickup_flag.lower() == 'true':
        payload['featured'] = True
    else:
        payload['featured'] = False

    return payload, title, start_date, cat_name
