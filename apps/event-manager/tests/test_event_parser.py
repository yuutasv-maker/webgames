import datetime
from unittest.mock import patch, MagicMock
import pytest
import requests
import wp_api
import event_parser
import update_events

def test_parse_date_string_japanese_md():
    result = event_parser.parse_date_string('7月26日')
    assert result is not None
    assert result.month == 7
    assert result.day == 26

def test_parse_date_string_japanese_ymd():
    result = event_parser.parse_date_string('2026年07月26日')
    assert result == datetime.date(2026, 7, 26)

def test_parse_date_string_slash_md():
    result = event_parser.parse_date_string('7/26')
    assert result is not None
    assert result.month == 7
    assert result.day == 26

def test_parse_date_string_dash_ymd():
    result = event_parser.parse_date_string('2026-07-26')
    assert result == datetime.date(2026, 7, 26)

def test_parse_date_string_slash_ymd():
    result = event_parser.parse_date_string('2026/7/26')
    assert result == datetime.date(2026, 7, 26)

def test_parse_date_string_invalid():
    assert event_parser.parse_date_string('') is None
    assert event_parser.parse_date_string('あいうえお') is None
    assert event_parser.parse_date_string('2026/13/45') is None

def test_parse_and_fill_datetime_normal():
    event_data = {'開始日付': '2026-07-26', '開始時間': '18:00', '終了日付': '', '終了時間': ''}
    start_str, end_str = event_parser.parse_and_fill_datetime(event_data, is_all_day=False)
    assert start_str == '2026-07-26 18:00:00'
    assert end_str == '2026-07-26 21:00:00'

def test_parse_and_fill_datetime_all_day():
    event_data = {'開始日付': '2026-07-26', '開始時間': '', '終了日付': '2026-07-27', '終了時間': ''}
    start_str, end_str = event_parser.parse_and_fill_datetime(event_data, is_all_day=True)
    assert start_str == '2026-07-26 00:00:00'
    assert end_str == '2026-07-27 23:59:00'

def test_parse_and_fill_datetime_missing_start_date():
    event_data = {'開始日付': '', '開始時間': '18:00'}
    start_str, end_str = event_parser.parse_and_fill_datetime(event_data)
    assert start_str is None
    assert end_str is None

def test_parse_and_fill_datetime_missing_start_time_not_all_day():
    event_data = {'開始日付': '2026-07-26', '開始時間': '', '終了日付': '', '終了時間': ''}
    start_str, end_str = event_parser.parse_and_fill_datetime(event_data, is_all_day=False)
    assert start_str is None
    assert end_str is None

def test_format_price_empty():
    assert event_parser.format_price('') == ''

def test_format_price_free():
    assert event_parser.format_price('0') == '無料'
    assert event_parser.format_price('無料') == '無料'
    assert event_parser.format_price('０') == '無料'

def test_format_price_normal():
    assert event_parser.format_price('2000') == '2,000円'
    assert event_parser.format_price('3500円') == '3,500円'
    assert event_parser.format_price('10,000') == '10,000円'

def test_format_price_fallback():
    assert event_parser.format_price('応相談') == '応相談'

def test_get_category_id():
    assert event_parser.get_category_id('アーティストイベント') == 11
    assert event_parser.get_category_id('参加型イベント') == 12
    assert event_parser.get_category_id('不明なカテゴリ') is None

def test_generate_contact_info():
    artist_contact = event_parser.generate_contact_info('アーティストイベント')
    assert 'HP予約' in artist_contact
    assert 'https://owl21.info/チケット予約/' in artist_contact
    assert '089-941-0036' in artist_contact
    custom_contact = event_parser.generate_contact_info('アーティストイベント', 'https://tiget.net/12345')
    assert 'チケット予約' in custom_contact
    assert 'https://tiget.net/12345' in custom_contact
    assert 'https://owl21.info/チケット予約/' not in custom_contact
    assert event_parser.generate_contact_info('貸切イベント') == ''
    open_contact = event_parser.generate_contact_info('オープンイベント')
    assert 'チケット予約' not in open_contact
    assert 'お問い合わせ' in open_contact

def test_parse_event_status_draft():
    assert event_parser.parse_event_status({'公開ステータス(publish/draft)': 'draft'}) == 'draft'
    assert event_parser.parse_event_status({'公開ステータス': 'd'}) == 'draft'
    assert event_parser.parse_event_status({'公開ステータス': 'unknown'}) == 'publish'

def test_parse_event_cost_zero():
    assert event_parser.parse_event_cost({'前売り料金': '0'}) == '無料'
    assert event_parser.parse_event_cost({'当日料金': '０', '料金（画面表示用）': '０'}) == '無料'
    assert event_parser.parse_event_cost({'前売り料金': '1,500円(1ドリンク付)'}) == '1500'

def test_build_event_description_html_price_patterns():
    event_data1 = {'開始日付': '2026-08-01', '開始時間': '18:00', '前売り料金': '1,500円', 'ドリンク': 'x'}
    html1 = event_parser.build_event_description_html(event_data1, 'オープンイベント')
    assert '<strong>料金：</strong>1,500円 (1ドリンク付)' in html1
    event_data2 = {'開始日付': '2026-08-01', '前売り料金': '0'}
    html2 = event_parser.build_event_description_html(event_data2, 'オープンイベント')
    assert '<strong>料金：</strong>無料 ※要1ドリンクオーダー' in html2
    event_data3 = {'開始日付': '2026-08-01', 'ドリンク': 'x', 'その他': '軽食'}
    html3 = event_parser.build_event_description_html(event_data3, 'オープンイベント')
    assert '<strong>料金：</strong>(1ドリンク・軽食付)' in html3

def test_build_event_description_html_invalid_date():
    event_data4 = {'開始日付': '未定'}
    html4 = event_parser.build_event_description_html(event_data4, 'オープンイベント')
    assert '<strong>開催日：</strong>未定' in html4
import threading
import time