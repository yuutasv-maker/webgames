import pytest
import sys
import os
from unittest.mock import patch, MagicMock

# backendディレクトリをパスに追加

from event_builder import build_api_payload
from constants import DrinkType

def test_build_payload_standard():
    config = {"WP_URL": "http://test", "WP_USERNAME": "u", "WP_APP_PASSWORD": "p"}
    recurring_events = {}
    event_data = {
        'イベントタイトル': '標準ライブ',
        '開始日付': '2026-08-01',
        '開場時間': '18:00',
        '開始時間': '18:30',
        '前売り料金': '2000',
        '当日料金': '2500',
        'ドリンク': DrinkType.INCLUDED,
        'イベントカテゴリー': 'オープンイベント',
        '出演者・詳細': '出演者A'
    }
    
    payload, title, start_date, cat_name = build_api_payload(event_data, recurring_events)
    
    assert payload['title'] == '標準ライブ'
    assert payload['start_date'] == '2026-08-01 18:30:00'
    assert '1ドリンク' in payload['description']
    assert payload['all_day'] is False
    assert payload['cost'] == '2000'
    assert 'sticky' not in payload or payload['sticky'] is False

def test_build_payload_private_event():
    config = {"WP_URL": "http://test"}
    event_data = {
        'イベントタイトル': '貸切パーティー',
        '開始日付': '2026-08-10',
        '開始時間': '17:00',
        'イベントカテゴリー': '貸切イベント',
        '出演者・詳細': '貸切です'
    }
    
    payload, title, start_date, cat_name = build_api_payload(event_data, {})
    
    # 貸切イベントはdescriptionが設定されないべき
    assert 'description' not in payload
    assert payload['title'] == '貸切パーティー'

def test_build_payload_all_day():
    config = {"WP_URL": "http://test"}
    event_data = {
        'イベントタイトル': '終日イベント',
        '開始日付': '2026-08-15',
        '終日イベント(1で終日)': '1',
        'イベントカテゴリー': 'オープンイベント'
    }
    
    payload, title, start_date, cat_name = build_api_payload(event_data, {})
    
    assert payload['all_day'] is True
    # 終日の場合、時間は 00:00:00 等になるかパースロジックに依存するが、all_dayがTrueであることは保証される

def test_build_payload_artist_event_with_ticket_url():
    config = {"WP_URL": "http://test"}
    event_data = {
        'イベントタイトル': 'アーティストライブ',
        '開始日付': '2026-08-20',
        '開始時間': '19:00',
        'イベントカテゴリー': 'アーティストイベント',
        'チケット予約URL': 'https://example.com/ticket'
    }
    
    payload, title, start_date, cat_name = build_api_payload(event_data, {})
    
    assert 'https://example.com/ticket' in payload['description']
    # 予約URLが反映されていることを確認

def test_build_payload_featured_event():
    config = {"WP_URL": "http://test"}
    event_data = {
        'イベントタイトル': '注目ライブ',
        '開始日付': '2026-08-25',
        '開始時間': '19:00',
        '注目イベント': '1'
    }
    
    payload, title, start_date, cat_name = build_api_payload(event_data, {})
    
    assert payload.get('featured') is True
