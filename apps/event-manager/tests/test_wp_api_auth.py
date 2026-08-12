import pytest
import base64
from unittest.mock import patch, MagicMock
import os
import sys

# パスの設定 (backendをインポートできるようにする)

from wp_api import (
    upload_image_to_wp,
    check_duplicate_event,
    create_event,
    search_events,
    update_event
)

@pytest.fixture
def dummy_config():
    return {
        'WP_URL': 'https://example.com',
        'WP_USERNAME': 'testuser',
        'WP_APP_PASSWORD': 'testpassword'
    }

@pytest.fixture
def expected_auth_header(dummy_config):
    auth_string = f"{dummy_config['WP_USERNAME']}:{dummy_config['WP_APP_PASSWORD']}"
    auth_base64 = base64.b64encode(auth_string.encode('utf-8')).decode('utf-8')
    return f"Basic {auth_base64}"

def test_upload_image_to_wp_auth_header(dummy_config, expected_auth_header):
    mock_session = MagicMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {'id': 123}
    mock_session.post.return_value = mock_response

    upload_image_to_wp(dummy_config, file_data=b"dummy", file_name="test.jpg", session=mock_session)
    
    # 呼び出された引数からヘッダーを取得
    assert mock_session.post.called
    call_args = mock_session.post.call_args
    headers = call_args[1].get('headers', {})
    
    assert headers.get('X-Owl-Auth') == expected_auth_header
    assert 'User-Agent' in headers

def test_check_duplicate_event_auth_header(dummy_config, expected_auth_header):
    mock_session = MagicMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {'events': []}
    mock_session.get.return_value = mock_response

    check_duplicate_event(dummy_config, "テスト", "2026-07-26 12:00:00", session=mock_session)
    
    assert mock_session.get.called
    call_args = mock_session.get.call_args
    headers = call_args[1].get('headers', {})
    
    assert headers.get('X-Owl-Auth') == expected_auth_header
    assert 'User-Agent' in headers

def test_create_event_auth_header(dummy_config, expected_auth_header):
    mock_session = MagicMock()
    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_response.json.return_value = {'id': 999}
    mock_session.post.return_value = mock_response

    event_data = {
        'イベントタイトル': 'テスト登録',
        '開始日付': '2026/07/26',
        '開演時間': '18:00',
        'イベントカテゴリー': 'ライブ'
    }
    
    with patch('wp_api.build_api_payload', return_value=({'title': 'テスト登録', 'status': 'publish'}, 'テスト登録', '2026-07-26 18:00:00', 'ライブ')):
        
        mock_session.get.return_value = MagicMock(status_code=404)
        create_event(dummy_config, {}, event_data, session=mock_session)
    
    assert mock_session.post.called
    call_args = mock_session.post.call_args
    headers = call_args[1].get('headers', {})
    
    assert headers.get('X-Owl-Auth') == expected_auth_header
    assert 'User-Agent' in headers

def test_search_events_auth_header(dummy_config, expected_auth_header):
    mock_session = MagicMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {'events': []}
    mock_session.get.return_value = mock_response

    search_events(dummy_config, "クエリ", session=mock_session)
    
    assert mock_session.get.called
    call_args = mock_session.get.call_args
    headers = call_args[1].get('headers', {})
    
    assert headers.get('X-Owl-Auth') == expected_auth_header
    assert 'User-Agent' in headers

def test_update_event_auth_header(dummy_config, expected_auth_header):
    mock_session = MagicMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {'id': 999}
    mock_session.post.return_value = mock_response

    event_data = {
        'イベントタイトル': 'テスト更新',
        '開始日付': '2026/07/26',
        '開演時間': '18:00'
    }

    with patch('wp_api.build_api_payload', return_value=({'title': 'テスト更新', 'status': 'publish'}, 'テスト更新', '2026-07-26 18:00:00', 'ライブ')):
        
        update_event(dummy_config, 100, {}, event_data, session=mock_session)
    
    assert mock_session.post.called
    call_args = mock_session.post.call_args
    headers = call_args[1].get('headers', {})
    
    assert headers.get('X-Owl-Auth') == expected_auth_header
    assert 'User-Agent' in headers
