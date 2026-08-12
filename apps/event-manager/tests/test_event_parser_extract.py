import pytest
import sys
import os

# backendディレクトリをパスに追加

from event_parser import extract_event_info_from_text

def test_extract_standard_text():
    text = """
    開催日：2026年08月20日(木)
    開場時間：18:30 / START：19:00
    料金：2,500円 / 当日料金：3,000円
    """
    event_data = {}
    result = extract_event_info_from_text(text)
    assert result['start_date'] == '2026-08-20'
    assert result['open_time'] == '18:30'
    assert result['start_time'] == '19:00'
    assert result['advance_price'] == '2500'
    assert result['door_price'] == '3000'

def test_extract_date_only():
    text = """
    次回ライブは2026年10月01日を予定しています！
    """
    event_data = {}
    result = extract_event_info_from_text(text)
    assert result['start_date'] == '2026-10-01'
    assert result.get('open_time') is None
    assert result.get('start_time') is None
    assert result.get('advance_price') is None

def test_extract_prices_multi_line():
    text = """
    2026/09/15
    料金：3,500円
    当日料金：4,000円
    """
    event_data = {}
    result = extract_event_info_from_text(text)
    assert result['advance_price'] == '3500'
    assert result['door_price'] == '4000'

def test_extract_price_mixed_currency():
    # 円のみを抽出対象とする実装となっているか確認
    text = """
    2026/10/20
    料金：1500円 / $10
    """
    event_data = {}
    result = extract_event_info_from_text(text)
    assert result['advance_price'] == '1500'
    assert result.get('door_price') is None

def test_extract_empty_text():
    text = ""
    event_data = {}
    result = extract_event_info_from_text(text)
    assert result.get('start_date') is None
    assert result.get('open_time') is None
    assert result.get('advance_price') is None

def test_extract_japanese_labels():
    text = """
    2026/11/03
    開場時間：17:00
    開始時間：17:30
    料金：2000円 当日料金：2500円
    """
    event_data = {}
    result = extract_event_info_from_text(text)
    assert result['open_time'] == '17:00'
    assert result['start_time'] == '17:30'
    assert result['advance_price'] == '2000'
    assert result['door_price'] == '2500'
