import os
import pytest
import json
import update_events

def test_config_file_path_exists():
    """設定ファイル(config.json)のパスが正しく解決でき、ファイルが存在するか"""
    assert os.path.exists(update_events.CONFIG_FILE), f"設定ファイルが見つかりません: {update_events.CONFIG_FILE}"

def test_recurring_events_file_path_exists():
    """定期イベント設定(recurring_events.json)のパスが正しく解決でき、ファイルが存在するか"""
    assert os.path.exists(update_events.RECURRING_EVENTS_FILE), f"定期イベント設定ファイルが見つかりません: {update_events.RECURRING_EVENTS_FILE}"

def test_data_dir_exists():
    """ログなどを出力する shared/data/ ディレクトリが存在するか"""
    data_dir = os.path.dirname(update_events.LOG_FILE)
    assert os.path.exists(data_dir), f"データディレクトリが見つかりません: {data_dir}"

def test_load_config_success():
    """load_config 関数が正常に設定を読み込めるか（Noneを返さないか）"""
    config = update_events.load_config()
    assert config is not None, "設定の読み込みに失敗しました(Noneが返されました)"
    assert isinstance(config, dict), "設定は辞書型で返されるべきです"

def test_load_recurring_events_success():
    """load_recurring_events 関数が正常に設定を読み込めるか"""
    events = update_events.load_recurring_events()
    assert events is not None, "定期イベント設定の読み込みに失敗しました"
    assert isinstance(events, dict), "定期イベント設定は辞書型で返されるべきです"
