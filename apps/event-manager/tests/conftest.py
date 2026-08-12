import pytest
from unittest.mock import patch, MagicMock

@pytest.fixture
def mock_wp_session():
    """成功レスポンスを返すモックセッション"""
    session = MagicMock()
    response = MagicMock()
    response.status_code = 201
    response.json.return_value = {"id": 100}
    session.post.return_value = response
    session.get.return_value = response
    return session

@pytest.fixture(autouse=True)
def mock_load_config():
    """設定ファイルをダミーデータに差し替えるフィクスチャ。
    update_events と event_form_app の双方でインポートされているため、両方をパッチします。
    """
    dummy_config = {
        "WP_URL": "https://dummy-site.local",
        "WP_USERNAME": "dummy_user",
        "WP_APP_PASSWORD": "dummy_password"
    }
    with patch("update_events.load_config", return_value=dummy_config), \
         patch("app.load_config", return_value=dummy_config):
        yield dummy_config

@pytest.fixture(autouse=True)
def mock_load_recurring_events():
    """定期イベント設定をダミーデータに差し替えるフィクスチャ。"""
    dummy_recurring = {
        "テスト定期ライブ": {
            "category": "アーティストイベント",
            "open_time": "18:00",
            "start_time": "18:30",
            "advance_price": "1500"
        }
    }
    with patch("update_events.load_recurring_events", return_value=dummy_recurring), \
         patch("app.load_recurring_events", return_value=dummy_recurring):
        yield dummy_recurring

@pytest.fixture
def app():
    """Flaskアプリのテスト用インスタンス。"""
    from app import app as flask_app
    flask_app.config.update({
        "TESTING": True,
    })
    return flask_app

@pytest.fixture
def client(app):
    """Flaskのテストクライアント。"""
    return app.test_client()
