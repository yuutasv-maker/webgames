import pytest
import sys
import os


from event_parser import (
    build_event_description_html,
    parse_and_fill_datetime,
    parse_event_cost,
    format_price,
    apply_recurring_templates_and_aliases,
    generate_contact_info
)
from constants import DrinkType

def test_build_event_description_html_no_drink():
    event_data = {
        '開始日付': '2026-08-01',
        '開始時間': '18:00',
        '前売り料金': '2000',
        'ドリンク': DrinkType.NONE
    }
    html = build_event_description_html(event_data, 'オープンイベント')
    
    assert '料金' in html
    assert '2,000円' in html
    assert 'ドリンク' not in html  # DrinkType.NONE の場合はドリンク表記が出ないこと

def test_build_event_description_html_private_event():
    event_data = {
        '開始日付': '2026-08-01',
        '開始時間': '18:00',
        '前売り料金': '2000'
    }
    html = build_event_description_html(event_data, '貸切イベント')
    
    # 貸切イベントの場合は空文字を返す
    assert html == ""

def test_parse_and_fill_datetime_end_date_and_time():
    event_data = {
        '開始日付': '2026-08-01',
        '開始時間': '18:00',
        '終了時間': '21:00',
        '終了日付': '2026-08-02'  # 終了日付も指定
    }
    start_dt, end_dt = parse_and_fill_datetime(event_data)
    
    assert start_dt == '2026-08-01 18:00:00'
    assert end_dt == '2026-08-02 21:00:00'

def test_parse_event_cost_none():
    assert parse_event_cost({}) is None
    assert parse_event_cost({'前売り料金': ''}) is None

def test_format_price_none():
    assert format_price(None) == ""
    assert format_price("") == ""

def test_apply_recurring_templates_and_aliases():
    event_data = {
        'イベントタイトル': '略称テスト',
        '開始時間': ''
    }
    recurring = {
        '略称テスト': {
            '開場時間': '18:30',
            '開始時間': '19:00',
            '前売り料金': '3000',
            'category': 'オープンイベント'
        }
    }
    
    title = apply_recurring_templates_and_aliases(event_data, recurring)
    
    assert title == '略称テスト'
    assert event_data['開始時間'] == '19:00'
    assert event_data['開場時間'] == '18:30'
    assert event_data['前売り料金'] == '3000'
    assert event_data['イベントカテゴリー'] == 'オープンイベント'

def test_generate_contact_info_artist_with_url():
    event_data = {
        'チケット予約URL': 'https://example.com/reserve'
    }
    html = generate_contact_info('アーティストイベント', event_data.get('チケット予約URL'))
    
    assert 'チケット予約' in html
    assert 'https://example.com/reserve' in html
