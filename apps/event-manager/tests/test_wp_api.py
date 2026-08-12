from unittest.mock import patch, MagicMock
import pytest
import requests
import wp_api

def test_check_duplicate_event_exists(mock_wp_session, mock_load_config):
    mock_wp_session.get.return_value.status_code = 200
    mock_wp_session.get.return_value.json.return_value = {"events": [{"title": "Test", "start_date": "2026-08-01 18:00:00"}]}
    with patch("requests.Session", return_value=mock_wp_session):
        assert wp_api.check_duplicate_event(mock_load_config, "Test", "2026-08-01") is True

def test_check_duplicate_event_not_exists(mock_wp_session, mock_load_config):
    mock_wp_session.get.return_value.status_code = 200
    mock_wp_session.get.return_value.json.return_value = {"events": []}
    with patch("requests.Session", return_value=mock_wp_session):
        assert wp_api.check_duplicate_event(mock_load_config, "Test", "2026-08-01") is False

def test_check_duplicate_event_404(mock_wp_session, mock_load_config):
    mock_wp_session.get.return_value.status_code = 404
    with patch("requests.Session", return_value=mock_wp_session):
        assert wp_api.check_duplicate_event(mock_load_config, "Test", "2026-08-01") is False

def test_check_duplicate_event_exception(mock_load_config):
    with patch("requests.Session") as mock_session_cls:
        mock_session_cls.return_value.get.side_effect = requests.RequestException()
        # 通信エラー時は 'error' が返る仕様
        assert wp_api.check_duplicate_event(mock_load_config, "Test", "2026-08-01") == 'error'

def test_upload_image_to_wp_success(mock_wp_session, mock_load_config):
    mock_wp_session.post.return_value.status_code = 201
    mock_wp_session.post.return_value.json.return_value = {"id": 100}
    with patch("requests.Session", return_value=mock_wp_session):
        assert wp_api.upload_image_to_wp(mock_load_config, file_data=b"data", file_name="test.jpg") == 100

def test_upload_image_to_wp_fail(mock_wp_session, mock_load_config):
    mock_wp_session.post.return_value.status_code = 400
    with patch("requests.Session", return_value=mock_wp_session):
        assert wp_api.upload_image_to_wp(mock_load_config, file_data=b"data", file_name="test.jpg") is None

def test_upload_image_to_wp_missing_data(mock_load_config):
    assert wp_api.upload_image_to_wp(mock_load_config, file_data=None, file_name="test.jpg") is None

def test_upload_image_to_wp_japanese_filename(mock_wp_session, mock_load_config):
    mock_wp_session.post.return_value.status_code = 201
    mock_wp_session.post.return_value.json.return_value = {"id": 101}
    with patch("requests.Session", return_value=mock_wp_session):
        assert wp_api.upload_image_to_wp(mock_load_config, file_data=b"data", file_name="テスト.jpg") == 101

@patch("wp_api.check_duplicate_event")
def test_create_event_title_alias(mock_dup, mock_wp_session, mock_load_config):
    mock_dup.return_value = False
    mock_wp_session.post.return_value.status_code = 201
    with patch("requests.Session", return_value=mock_wp_session):
        payload = {"イベントタイトル": "エイリアステスト", "開始日付": "2026-08-01", "開始時間": "18:00"}
        result = wp_api.create_event(mock_load_config, {}, payload)
        assert result is True

@patch("wp_api.check_duplicate_event")
def test_create_event_recurring_autofill(mock_dup, mock_wp_session, mock_load_config):
    mock_dup.return_value = False
    mock_wp_session.post.return_value.status_code = 201
    recurring_events = {"テスト定期ライブ": {"advance_price": "1500"}}
    payload = {"イベントタイトル": "テスト定期ライブ", "開始日付": "2026-08-01", "開始時間": "18:00"}
    with patch("requests.Session", return_value=mock_wp_session):
        result = wp_api.create_event(mock_load_config, recurring_events, payload)
        assert result is True

@patch("wp_api.check_duplicate_event")
def test_create_event_network_exception(mock_dup, mock_load_config):
    mock_dup.return_value = False
    with patch("requests.Session") as mock_session_cls:
        mock_session_cls.return_value.post.side_effect = requests.RequestException()
        payload = {"イベントタイトル": "テスト", "開始日付": "2026-08-01", "開始時間": "18:00"}
        result = wp_api.create_event(mock_load_config, {}, payload)
        assert result is False

@patch("wp_api.check_duplicate_event")
def test_create_event_featured_flag(mock_dup, mock_wp_session, mock_load_config):
    mock_dup.return_value = False
    mock_wp_session.post.return_value.status_code = 201
    with patch("requests.Session", return_value=mock_wp_session):
        payload = {"イベントタイトル": "注目", "開始日付": "2026-08-01", "開始時間": "18:00", "注目イベント": "1"}
        result = wp_api.create_event(mock_load_config, {}, payload)
        assert result is True

@patch("wp_api.check_duplicate_event")
def test_create_event_private_empty_description(mock_dup, mock_wp_session, mock_load_config):
    mock_dup.return_value = False
    mock_wp_session.post.return_value.status_code = 201
    with patch("requests.Session", return_value=mock_wp_session):
        payload = {"イベントタイトル": "貸切", "開始日付": "2026-08-01", "開始時間": "18:00", "イベントカテゴリー": "貸切イベント"}
        result = wp_api.create_event(mock_load_config, {}, payload)
        assert result is True

def test_set_featured_image_success(mock_wp_session, mock_load_config):
    mock_wp_session.post.return_value.status_code = 200
    with patch("requests.Session", return_value=mock_wp_session):
        assert wp_api.set_featured_image(mock_load_config, 10, 100, headers={}) is None

def test_set_featured_image_fail(mock_wp_session, mock_load_config):
    mock_wp_session.post.return_value.status_code = 400
    with patch("requests.Session", return_value=mock_wp_session):
        assert wp_api.set_featured_image(mock_load_config, 10, 100, headers={}) is None

@patch("wp_api.check_duplicate_event")
def test_create_event_thread_safety(mock_dup, mock_wp_session, mock_load_config):
    import threading
    mock_dup.return_value = False
    mock_wp_session.post.return_value.status_code = 201
    results = []
    def worker():
        payload = {"イベントタイトル": "スレッド", "開始日付": "2026-08-01", "開始時間": "18:00"}
        with patch("requests.Session", return_value=mock_wp_session):
            results.append(wp_api.create_event(mock_load_config, {}, payload))
    threads = [threading.Thread(target=worker) for _ in range(5)]
    for t in threads: t.start()
    for t in threads: t.join()
    assert all(results)
