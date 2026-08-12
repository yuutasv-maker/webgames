import pytest
from unittest.mock import patch, MagicMock

import app as flask_app

@patch("app.load_config")
def test_edit_event_page(mock_load_config, client):
    mock_load_config.return_value = {"WP_URL": "http://test"}
    response = client.get('/edit')
    assert response.status_code == 200
    assert b'id="search_query"' in response.data
    # 検索機能のJSが依存しているDOMのIDが存在することを担保
    assert b'id="search-message"' in response.data
    assert b'id="search-results"' in response.data
    # JSでロード時に利用する要素クラスが存在することを担保
    assert b'class="card"' in response.data

@patch("app.load_config")
def test_common_css_includes_search_styles(mock_load_config, client):
    """common.css に検索結果表示に必要なスタイルが定義されていることを担保"""
    mock_load_config.return_value = {"WP_URL": "http://test"}
    response = client.get('/static/css/common.css')
    assert response.status_code == 200
    assert b'.search-result-item' in response.data

@patch("app.load_config")
@patch("app.search_events")
def test_api_search_events_success(mock_search_events, mock_load_config, client):
    mock_load_config.return_value = {"WP_URL": "http://test"}
    mock_search_events.return_value = [{"id": 1, "title": {"rendered": "Test"}}]
    
    response = client.get('/api/search-events?q=Test')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'success'
    assert len(data['events']) == 1

@patch("app.load_config")
def test_api_search_events_missing_query(mock_load_config, client):
    mock_load_config.return_value = {"WP_URL": "http://test"}
    
    response = client.get('/api/search-events')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'success'
    assert data['events'] == []

@patch("app.load_config")
@patch("app.update_event")
def test_api_update_event_success(mock_update_event, mock_load_config, client):
    mock_load_config.return_value = {"WP_URL": "http://test"}
    mock_update_event.return_value = True
    
    payload = {
        "event_id": 100,
        "title": "更新タイトル",
        "date": "2026-08-01"
    }
    response = client.post('/api/update', json=payload)
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'success'

@patch("app.load_config")
@patch("app.update_event")
def test_api_update_event_fail(mock_update_event, mock_load_config, client):
    mock_load_config.return_value = {"WP_URL": "http://test"}
    mock_update_event.return_value = False
    
    payload = {
        "event_id": 100,
        "title": "更新タイトル"
    }
    response = client.post('/api/update', json=payload)
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'error'

def test_api_analyze_event_details_success(client):
    payload = {
        "description": "開催日：2026年9月1日 開場時間：18:00 料金：2000円"
    }
    response = client.post('/api/analyze-event-details', json=payload)
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'success'
    assert 'results' in data
    assert data['results']['start_date'] == '2026-09-01'
    assert data['results']['open_time'] == '18:00'
    assert data['results']['advance_price'] == '2000'

def test_api_analyze_event_details_empty(client):
    payload = {
        "description": ""
    }
    response = client.post('/api/analyze-event-details', json=payload)
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'success'
    assert data['results'] == {}
