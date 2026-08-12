import json
import requests
import base64

def load_config():
    with open('config.json', 'r', encoding='utf-8') as f:
        return json.load(f)

config = load_config()
url = f"{config['WP_URL'].rstrip('/')}/wp-json/tribe/events/v1/events"
auth_string = f"{config['WP_USERNAME']}:{config['WP_APP_PASSWORD']}"
auth_base64 = base64.b64encode(auth_string.encode('utf-8')).decode('utf-8')
headers = {
    'Content-Type': 'application/json',
    'X-Owl-Auth': f"Basic {auth_base64}",
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

payload = {
    "title": "WAF Test Event",
    "start_date": "2026-08-01 18:00:00",
    "end_date": "2026-08-01 21:00:00",
    "status": "draft",
    "all_day": False,
    "description": "test",
    "cost": "1000",
    "categories": [11]
}

def test_payload(desc):
    payload["description"] = desc
    res = requests.post(url, json=payload, headers=headers)
    print(f"Status: {res.status_code}")
    if res.status_code == 201:
        print("Success, ID:", res.json().get('id'))
        # Clean up
        del_url = f"{config['WP_URL'].rstrip('/')}/wp-json/wp/v2/tribe_events/{res.json().get('id')}"
        requests.delete(del_url, headers=headers)

desc_a = """<div class="event-details">
<strong>開催日：</strong>2026年7月26日<br>
<strong>開場時間：</strong>17:30　<strong>開演時間：</strong>18:00<br>
<strong>前売り料金：</strong>3,500円　<strong>当日料金：</strong>4,000円 ※要1ドリンクオーダー<br>
<strong>出演者・詳細：</strong><br>画像のテキストは以下の通りです。<br><br>2026年7月26日(日)<br>Blues Rock Show Ⅱ<br>松山 スタジオOWL<br>出演：柳沢二三男(Vo,Gt)<br>17:30 open / 18:00 start<br>ADV¥3,500 / DOOR¥4,000 (+drink)<br>ご予約は OWL または TIGET にて<br>"""

desc_b_2 = """<strong>ご予約・問い合わせ：</strong>スタジオOWL(HP予約: https://owl21.info/チケット予約/ , 電話番号: 089-941-0036, E-mail: studio.owl.contact@gmail.com)
</div>"""

print("Test A + B_2:")
test_payload(desc_a + desc_b_2)

