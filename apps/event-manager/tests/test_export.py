from unittest.mock import patch, MagicMock
import pytest
import requests

import export_participatory_events

# =====================================================================
# 1. parse_price_info のテスト
# =====================================================================
def test_parse_price_info_various():
    # 料金、ドリンク、軽食が揃っているケース
    fee, drink, food = export_participatory_events.parse_price_info("2,000円（ドリンク・フード付き）")
    assert fee == "2,000円"
    assert drink == "x"
    assert food == "x"

    # ドリンクのみのケース
    fee, drink, food = export_participatory_events.parse_price_info("1,500円(1ドリンク付)")
    assert fee == "1,500円"
    assert drink == "x"
    assert food == ""

    # 無料・要ドリンクオーダーのケース
    fee, drink, food = export_participatory_events.parse_price_info("無料（要1ドリンクオーダー）")
    assert fee == "無料"
    assert drink == "x"
    assert food == ""

    # 料金のみ、その他なしのケース
    fee, drink, food = export_participatory_events.parse_price_info("¥3,000")
    assert fee == "¥3,000"
    assert drink == ""
    assert food == ""

    # テキストのみで金額パターンがないフォールバックケース
    fee, drink, food = export_participatory_events.parse_price_info("投げ銭（お気持ち）")
    assert fee == "投げ銭"
    assert drink == ""
    assert food == ""

def test_parse_price_info_empty():
    # 空文字列の場合は全て空が返る
    fee, drink, food = export_participatory_events.parse_price_info("")
    assert fee == ""
    assert drink == ""
    assert food == ""

# =====================================================================
# 2. get_events (スクレイピングロジック) のテスト
# =====================================================================
@patch("export_participatory_events.requests.Session")
def test_get_events_scraping(mock_session_class):
    mock_session = MagicMock()
    mock_session_class.return_value = mock_session
    # 月カレンダーHTMLのモック
    calendar_html = """
    <html>
        <body>
            <a href="https://owl21.info/schedule_/event-a/">イベントA</a>
            <a href="https://owl21.info/schedule_/event-b/">イベントB</a>
            <a href="https://owl21.info/schedule_/month/2026-05/">カレンダーナビ</a>
        </body>
    </html>
    """
    
    # イベントA（参加型イベント、対象月マッチ）
    event_a_html = """
    <html>
        <body>
            <h1 class="tribe-events-single-event-title">参加型セッション</h1>
            <div class="tribe-events-event-categories">カテゴリ: 参加型イベント</div>
            <div class="tribe-events-single-event-description">
                【開催日】 2026年05月15日<br>
                【開演時間】 19:30<br>
                【料金】 1,500円(1ドリンク付)
            </div>
        </body>
    </html>
    """

    # イベントB（アーティストイベント、対象外カテゴリ）
    event_b_html = """
    <html>
        <body>
            <h1 class="tribe-events-single-event-title">スペシャルライブ</h1>
            <div class="tribe-events-event-categories">カテゴリ: アーティストイベント</div>
        </body>
    </html>
    """

    # mock_session.getの振る舞いをURLごとに切り分ける
    def side_effect(url, **kwargs):
        response = MagicMock()
        response.status_code = 200
        if "month" in url:
            response.content = calendar_html.encode('utf-8')
        elif "event-a" in url:
            response.content = event_a_html.encode('utf-8')
        elif "event-b" in url:
            response.content = event_b_html.encode('utf-8')
        else:
            response.status_code = 404
        return response

    mock_session.get.side_effect = side_effect

    # 2026-05 のデータを取得するテスト
    events = export_participatory_events.get_events("2026-05")
    
    # イベントAのみが抽出されているはず（イベントBは非・参加型イベントのため除外される）
    assert len(events) == 1
    event = events[0]
    assert event['イベント'] == "参加型セッション"
    assert event['日付'] == "2026年05月15日"
    assert event['開演時間'] == "19:30"
    assert event['料金'] == "1,500円"
    assert event['ドリンク'] == "x"
    assert event['軽食'] == ""

@patch("export_participatory_events.requests.Session")
def test_get_events_scraping_date_mismatch(mock_session_class):
    mock_session = MagicMock()
    mock_session_class.return_value = mock_session
    # イベントAの日付が「2026年06月15日」になっていて、対象月「2026-05」と不一致のケース
    calendar_html = """
    <html>
        <body>
            <a href="https://owl21.info/schedule_/event-a/">イベントA</a>
        </body>
    </html>
    """
    
    event_a_html = """
    <html>
        <body>
            <h1 class="tribe-events-single-event-title">参加型セッション</h1>
            <div class="tribe-events-event-categories">カテゴリ: 参加型イベント</div>
            <div class="tribe-events-single-event-description">
                【開催日】 2026年06月15日<br>
                【開演時間】 19:30<br>
                【料金】 1,500円
            </div>
        </body>
    </html>
    """

    def side_effect(url, **kwargs):
        response = MagicMock()
        response.status_code = 200
        if "month" in url:
            response.content = calendar_html.encode('utf-8')
        elif "event-a" in url:
            response.content = event_a_html.encode('utf-8')
        return response

    mock_session.get.side_effect = side_effect

    # 2026-05で取得すると、6月のイベントなので除外されて空になるはず
    events = export_participatory_events.get_events("2026-05")
    assert len(events) == 0

@patch("export_participatory_events.requests.Session")
def test_get_events_calendar_fetch_failure(mock_session_class):
    mock_session = MagicMock()
    mock_session_class.return_value = mock_session
    # カレンダーページの取得が失敗した場合は空リストが返る
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_session.get.return_value = mock_response

    events = export_participatory_events.get_events("2026-05")
    assert events == []

# =====================================================================
# 3. extract_event_details (フォールバック) のテスト (P2)
# =====================================================================
def test_extract_event_details_fallbacks():
    # class指定で見つからず、フォールバックを利用して情報を抽出するパターンのHTML
    # ・タイトル: classがなく、<h1>で抽出
    # ・本文: classがなく、<div class="entry-content">で抽出
    # ・日付: コンテンツ内に「開催日」がなく、メタデータから抽出
    # ・時間: コンテンツ内に「開演時間」がなく、メタデータから抽出
    # ・料金: コンテンツ内に「料金」がなく、tribe-events-event-cost から抽出
    html = """
    <html>
        <body>
            <div class="tribe-events-event-categories">カテゴリ: 参加型イベント</div>
            <h1>フォールバックテスト</h1>
            <div class="entry-content">
                ここは本文ですが、日付も時間も料金も書かれていません。
            </div>
            <div class="tribe-events-meta-group">
                <span>5月20日</span>
                <span>時間: 18:30</span>
            </div>
            <div class="tribe-events-event-cost">2,000円</div>
        </body>
    </html>
    """
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, 'html.parser')
    
    result = export_participatory_events.extract_event_details(soup, "https://dummy", "2026-05")
    assert result is not None
    assert result['イベント'] == 'フォールバックテスト'
    assert result['日付'] == '5月20日'
    assert result['開演時間'] == '18:30'
    assert result['料金'] == '2,000円'

