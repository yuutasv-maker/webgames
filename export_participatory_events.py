import requests
from bs4 import BeautifulSoup
import re
import csv
import sys
from datetime import datetime

def parse_price_info(text):
    fee = ""
    drink = ""
    food = ""
    
    fee_match = re.search(r'([0-9,]+円|¥[0-9,]+|無料)', text)
    if fee_match:
        fee = fee_match.group(1)
    
    if 'ドリンク' in text:
        drink = 'x'
    
    if '軽食' in text or 'フード' in text:
        food = 'x'

    if not fee and text:
        # Avoid putting the whole text if it's too long, just clean it up
        cleaned = re.sub(r'\(.*?\)|（.*?）', '', text).strip()
        fee = cleaned if cleaned else text.strip()
        
    return fee, drink, food

def get_events(target_month):
    url = f'https://owl21.info/schedule_/month/{target_month}/'
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    print(f"[{target_month}] のスケジュールを取得しています...")
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        print(f"スケジュールの取得に失敗しました。ステータスコード: {response.status_code}")
        return []
        
    soup = BeautifulSoup(response.content, 'html.parser')
    
    events_urls = []
    for a in soup.find_all('a', href=True):
        href = a['href']
        if href.startswith('https://owl21.info/schedule_/') and \
           not re.search(r'/schedule_/(month|today|category|tag|author|page|20\d{2}-\d{2}-\d{2})/', href) and \
           href != 'https://owl21.info/schedule_/':
            if href not in events_urls:
                events_urls.append(href)
                
    print(f"{len(events_urls)}件のイベントが見つかりました。「参加型イベント」を抽出しています...")
    
    results = []
    
    for e_url in events_urls:
        e_resp = requests.get(e_url, headers=headers)
        if e_resp.status_code != 200:
            continue
            
        e_soup = BeautifulSoup(e_resp.content, 'html.parser')
        
        cats = e_soup.find_all(class_=re.compile('tribe-events-event-categories'))
        cat_text = " ".join([c.get_text(strip=True) for c in cats])
        if '参加型イベント' not in cat_text:
            continue
            
        title_tag = e_soup.find(class_='tribe-events-single-event-title')
        title = title_tag.get_text(strip=True) if title_tag else ""
        if not title:
            title_tag = e_soup.find('h1')
            title = title_tag.get_text(strip=True) if title_tag else e_url
            
        content_tag = e_soup.find(class_='tribe-events-single-event-description')
        if not content_tag:
            content_tag = e_soup.find('div', class_='entry-content')
        content_text = content_tag.get_text(separator=" ") if content_tag else ""
        
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
            
        target_m = str(int(target_month.split('-')[1])) + '月'
        if date_str != "不明" and target_m not in date_str:
            print(f" -> スキップ (月違い): {date_str} - {title}")
            continue
            
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
            
        fee, drink, food = "", "", ""
        price_match = re.search(r'【料金】(.*?)(?:【|$)', content_text)
        if not price_match:
            price_match = re.search(r'料金[：:]\s*(.*?)(?:詳細[：:]|お問い合わせ[：:]|$)', content_text)
        
        if price_match:
            price_text = price_match.group(1).strip()
            fee, drink, food = parse_price_info(price_text)
        else:
            cost_tag = e_soup.find(class_='tribe-events-event-cost')
            if cost_tag:
                fee_raw = cost_tag.get_text(strip=True)
                fee, drink, food = parse_price_info(fee_raw)
                
        # Also double check the full description for drink and food if not found in price
        if not drink and 'ドリンク' in content_text:
            drink = 'x'
        if not food and ('軽食' in content_text or 'フード' in content_text):
            food = 'x'
                
        results.append({
            '日付': date_str,
            'イベント': title,
            '開演時間': start_time,
            '料金': fee,
            'ドリンク': drink,
            '軽食': food
        })
        
        print(f" -> 抽出: {date_str} - {title}")
        
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
        print("エラー: 有効な YYYY-MM 形式ではありません。")
        sys.exit(1)

    events = get_events(target_month)
    
    if not events:
        print("条件に一致するイベントは見つかりませんでした。")
        sys.exit(0)
        
    out_file = f"participatory_events_{target_month}.csv"
    with open(out_file, 'w', encoding='utf-8-sig', newline='') as f:
        headers = ['日付', 'イベント', '開演時間', '料金', 'ドリンク', '軽食']
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(events)
        
    print(f"\n完了！ {len(events)} 件のイベントを {out_file} に保存しました。")
