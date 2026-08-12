import requests
import urllib.parse
from bs4 import BeautifulSoup
import re
import csv
import sys
from datetime import datetime
import concurrent.futures
from constants import DrinkType, TARGET_SCHEDULE_URL_BASE
from wp_api import get_robust_session
import logging

def parse_price_info(text):
    fee = ""
    drink = ""
    food = ""
    
    fee_match = re.search(r'([0-9,]+円|¥[0-9,]+|無料)', text)
    if fee_match:
        fee = fee_match.group(1)
    
    if 'ドリンク' in text:
        drink = DrinkType.INCLUDED
    
    if '軽食' in text or 'フード' in text:
        food = 'x'

    if not fee and text:
        # Avoid putting the whole text if it's too long, just clean it up
        cleaned = re.sub(r'\(.*?\)|（.*?）', '', text).strip()
        fee = cleaned if cleaned else text.strip()
        
    return fee, drink, food

def fetch_event_urls(target_month, session_or_headers):
    """指定した月のイベント一覧ページから、各イベント詳細のURLリストを取得する"""
    url = urllib.parse.urljoin(TARGET_SCHEDULE_URL_BASE, f'month/{target_month}/')
    logging.info(f"[{target_month}] のスケジュールを取得しています...")
    
    if hasattr(session_or_headers, 'get'):
        response = session_or_headers.get(url)
    else:
        response = requests.get(url, headers=session_or_headers)
    if response.status_code != 200:
        logging.error(f"スケジュールの取得に失敗しました。ステータスコード: {response.status_code}")
        return []
        
    soup = BeautifulSoup(response.content, 'html.parser')
    events_urls = []
    
    for a in soup.find_all('a', href=True):
        href = a['href']
        # ターゲットサイト（The Events Calendar）の仕様上、
        # /schedule_/ 配下に月別・日別・タグ別などのナビゲーションリンクが大量に含まれるため、
        # これらを正規表現で除外し、個別のイベント詳細ページURLのみをフィルタリングする。
        if href.startswith(TARGET_SCHEDULE_URL_BASE) and \
           not re.search(r'/schedule_/(month|today|category|tag|author|page|20\d{2}-\d{2}-\d{2})/', href) and \
           href != TARGET_SCHEDULE_URL_BASE:
            events_urls.append(href)
                
    return list(dict.fromkeys(events_urls))

def extract_event_details(e_soup, e_url, target_month):
    """個別のイベントページ(BeautifulSoupオブジェクト)から詳細情報を抽出する"""
    # 「参加型イベント」かどうかの判定
    # The Events Calendar のHTML出力仕様に依存したクラス名指定
    cats = e_soup.find_all(class_=re.compile('tribe-events-event-categories'))
    cat_text = " ".join([c.get_text(strip=True) for c in cats])
    if '参加型イベント' not in cat_text:
        return None
        
    # タイトルの抽出
    title_tag = e_soup.find(class_='tribe-events-single-event-title')
    title = title_tag.get_text(strip=True) if title_tag else ""
    if not title:
        title_tag = e_soup.find('h1')
        title = title_tag.get_text(strip=True) if title_tag else e_url
        
    # コンテンツの抽出
    content_tag = e_soup.find(class_='tribe-events-single-event-description')
    if not content_tag:
        content_tag = e_soup.find('div', class_='entry-content')
    content_text = content_tag.get_text(separator=" ") if content_tag else ""
    
    # 日付の抽出
    date_match = re.search(r'【開催日】\s*(20\d{2}年\d{1,2}月\d{1,2}日)', content_text)
    if not date_match:
        date_match = re.search(r'開催日[：:]\s*(20\d{2}年\d{1,2}月\d{1,2}日)', content_text)
    
    if date_match:
        date_str = date_match.group(1)
    else:
        meta = e_soup.find(class_='tribe-events-meta-group')
        meta_text = meta.get_text(separator=" ") if meta else ""
        date_match = re.search(r'(\d{1,2}月\d{1,2}日)', meta_text)
        date_str = date_match.group(1) if date_match else "不明"
        
    # 指定された月と一致するかチェック（前月/翌月のイベントがリストアップされる場合の除外）
    target_m = f'{datetime.strptime(target_month, "%Y-%m").month}月'
    if date_str != "不明" and target_m not in date_str:
        logging.info(f" -> スキップ (月違い): {date_str} - {title}")
        return None
        
    # 時間の抽出
    time_match = re.search(r'【開演時間】\s*(\d{1,2}:\d{2})', content_text)
    if not time_match:
        time_match = re.search(r'開演時間[：:]\s*(\d{1,2}:\d{2})', content_text)
    start_time = time_match.group(1) if time_match else ""
    if not start_time:
        time_match = re.search(r'Start\s*(\d{1,2}:\d{2})', content_text, re.IGNORECASE)
        start_time = time_match.group(1) if time_match else ""
    if not start_time:
        meta = e_soup.find(class_='tribe-events-meta-group')
        meta_text = meta.get_text(separator=" ") if meta else ""
        time_match = re.search(r'時間:\s*(\d{1,2}:\d{2})', meta_text)
        start_time = time_match.group(1) if time_match else "不明"
        
    # 料金情報の抽出
    fee, drink, food = "", "", ""
    price_match = re.search(r'【料金】(.*?)(?:【|$)', content_text, re.DOTALL)
    if not price_match:
        price_match = re.search(r'料金[：:]\s*(.*?)(?:詳細[：:]|お問い合わせ[：:]|$)', content_text, re.DOTALL)
    
    if price_match:
        price_text = price_match.group(1).strip()
        fee, drink, food = parse_price_info(price_text)
    else:
        cost_tag = e_soup.find(class_='tribe-events-event-cost')
        if cost_tag:
            fee_raw = cost_tag.get_text(strip=True)
            fee, drink, food = parse_price_info(fee_raw)
            
    # ドリンクとフードの再確認
    if not drink and 'ドリンク' in content_text:
        drink = DrinkType.INCLUDED
    if not food and ('軽食' in content_text or 'フード' in content_text):
        food = 'x'
            
    return {
        '日付': date_str,
        'イベント': title,
        '開演時間': start_time,
        '料金': fee,
        'ドリンク': drink,
        '軽食': food
    }



def get_events(target_month):
    """指定された月の参加型イベント一覧を取得する"""
    session = get_robust_session()
    # requestsデフォルトのUser-AgentによるリクエストがWAFやセキュリティ設定で
    # 403 Forbidden 弾かれるのを防ぐためのUA偽装。
    session.headers.update({'User-Agent': 'Mozilla/5.0'})
    
    events_urls = fetch_event_urls(target_month, session)
    
    if not events_urls:
        return []
        
    logging.info(f"{len(events_urls)}件のイベントが見つかりました。「参加型イベント」を抽出しています...")
    results = []
    
    def fetch_and_parse(e_url):
        try:
            e_resp = session.get(e_url, timeout=15)
            if e_resp.status_code != 200:
                return None
            e_soup = BeautifulSoup(e_resp.content, 'html.parser')
            return extract_event_details(e_soup, e_url, target_month)
        except requests.RequestException as e:
            logging.error(f"URL {e_url} の取得中に通信エラーが発生しました: {e}")
            return None

    # スクレイピング速度向上のための並列処理。
    # ターゲットサーバーへDoS攻撃のような過負荷をかけないよう、5並列に制限している。
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        for event_info in executor.map(fetch_and_parse, events_urls):
            if event_info:
                results.append(event_info)
                logging.info(f" -> 抽出: {event_info['日付']} - {event_info['イベント']}")
            
    return results

if __name__ == "__main__":
    target_month = ""
    if len(sys.argv) > 1:
        target_month = sys.argv[1]
    else:
        try:
            target_month = input("抽出したい月を YYYY-MM の形式で入力してください (例: 2026-05): ").strip()
        except EOFError:
            pass
            
    if not target_month or not re.match(r'20\d{2}-\d{2}', target_month):
        logging.error("エラー: 有効な YYYY-MM 形式ではありません。")
        sys.exit(1)

    events = get_events(target_month)
    
    if not events:
        logging.info("条件に一致するイベントは見つかりませんでした。")
        sys.exit(0)
        
    out_file = f"participatory_events_{target_month}.csv"
    with open(out_file, 'w', encoding='utf-8-sig', newline='') as f:
        headers = ['日付', 'イベント', '開演時間', '料金', 'ドリンク', '軽食']
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(events)
        
    logging.info(f"\n完了！ {len(events)} 件のイベントを {out_file} に保存しました。")
