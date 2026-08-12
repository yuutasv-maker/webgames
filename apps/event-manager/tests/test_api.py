import json
import io
from unittest.mock import patch, MagicMock
import pytest

# =====================================================================
# 1. 画面表示ルートのテスト
# =====================================================================
def test_static_routes(client):
    # トップページ
    res = client.get('/')
    assert res.status_code == 200
    
    # チケット予約作成ページ
    res = client.get('/ticket-form')
    assert res.status_code == 200
    
    # 参加型イベント出力ページ
    res = client.get('/export-events')
    assert res.status_code == 200

# =====================================================================
# 2. /api/recurring-events のテスト
# =====================================================================
def test_api_recurring_events(client):
    res = client.get('/api/recurring-events')
    assert res.status_code == 200
    data = json.loads(res.data.decode('utf-8'))
    assert 'recurring_events' in data
    assert 'title_aliases' in data
    assert 'categories' in data
    # conftest.py で設定した mock_load_recurring_events の値が入っていること
    assert "テスト定期ライブ" in data['recurring_events']

# =====================================================================
# 3. /api/export-events (参加型イベント抽出API) のテスト
# =====================================================================
@patch("app.get_events")
def test_api_export_events_success(mock_get_events, client):
    # 正常系のモック
    mock_get_events.return_value = [
        {'日付': '2026-05-15', 'イベント': 'セッション', '開演時間': '19:00', '料金': '1500円', 'ドリンク': 'x', '軽食': ''}
    ]
    
    res = client.get('/api/export-events?month=2026-05')
    assert res.status_code == 200
    data = json.loads(res.data.decode('utf-8'))
    assert data['status'] == 'success'
    assert len(data['events']) == 1
    assert data['events'][0]['イベント'] == 'セッション'

def test_api_export_events_invalid_month(client):
    # 無効な月フォーマット
    res = client.get('/api/export-events?month=2026/05')
    assert res.status_code == 200
    data = json.loads(res.data.decode('utf-8'))
    assert data['status'] == 'error'
    assert '無効な月形式' in data['message']

def test_api_export_events_missing_month(client):
    # month パラメータ未指定の場合
    res = client.get('/api/export-events')
    assert res.status_code == 200
    data = json.loads(res.data.decode('utf-8'))
    assert data['status'] == 'error'

@patch("app.get_events")
def test_api_export_events_exception(mock_get_events, client):
    # get_events が例外を投げた場合に error ステータスが返ること
    mock_get_events.side_effect = Exception("接続エラー")
    res = client.get('/api/export-events?month=2026-05')
    assert res.status_code == 200
    data = json.loads(res.data.decode('utf-8'))
    assert data['status'] == 'error'
    assert 'エラー' in data['message']

# =====================================================================
# 4. /api/download-csv (CSVダウンロードAPI) のテスト
# =====================================================================
@patch("app.get_events")
def test_api_download_csv_success(mock_get_events, client):
    mock_get_events.return_value = [
        {'日付': '2026-05-15', 'イベント': 'セッション', '開演時間': '19:00', '料金': '1500', 'ドリンク': 'x', '軽食': ''}
    ]
    
    res = client.get('/api/download-csv?month=2026-05')
    assert res.status_code == 200
    assert res.headers["Content-Disposition"] == "attachment; filename=participatory_events_2026-05.csv"
    assert "text/csv" in res.headers["Content-Type"]
    
    csv_content = res.data.decode('utf-8-sig')
    assert "日付,イベント,開演時間,料金,ドリンク,軽食" in csv_content
    assert "2026-05-15,セッション,19:00,1500,x," in csv_content

@patch("app.get_events", return_value=[])
def test_api_download_csv_not_found(mock_get_events, client):
    # データが存在しない場合は 404
    res = client.get('/api/download-csv?month=2026-05')
    assert res.status_code == 404

def test_api_download_csv_invalid_month(client):
    res = client.get('/api/download-csv?month=invalid')
    assert res.status_code == 400

# =====================================================================
# 5. /api/upload-image (画像アップロードAPI) のテスト
# =====================================================================
@patch("app.upload_image_to_wp")
def test_api_upload_image_success(mock_upload, client):
    mock_upload.return_value = 888
    
    data = {
        'image': (io.BytesIO(b"fake image content"), 'test.png')
    }
    res = client.post('/api/upload-image', data=data, content_type='multipart/form-data')
    assert res.status_code == 200
    res_data = json.loads(res.data.decode('utf-8'))
    assert res_data['status'] == 'success'
    assert res_data['media_id'] == 888

@patch("app.upload_image_to_wp", return_value=None)
def test_api_upload_image_fail(mock_upload, client):
    data = {
        'image': (io.BytesIO(b"fake image content"), 'test.png')
    }
    res = client.post('/api/upload-image', data=data, content_type='multipart/form-data')
    assert res.status_code == 200
    res_data = json.loads(res.data.decode('utf-8'))
    assert res_data['status'] == 'error'

def test_api_upload_image_no_file(client):
    # 画像ファイルが添付されていない場合
    res = client.post('/api/upload-image', data={}, content_type='multipart/form-data')
    assert res.status_code == 200
    res_data = json.loads(res.data.decode('utf-8'))
    assert res_data['status'] == 'error'
    assert '画像ファイル' in res_data['message']

# =====================================================================
# 6. /api/submit (イベント登録API) のテスト
# =====================================================================
@patch("app.create_event")
def test_api_submit_success(mock_create_event, client):
    mock_create_event.return_value = True
    
    payload = {
        'title': 'テスト登録ライブ',
        'start_date': '2026-07-26',
        'start_time': '18:00',
        'category': 'アーティストイベント'
    }
    res = client.post('/api/submit', json=payload)
    assert res.status_code == 200
    res_data = json.loads(res.data.decode('utf-8'))
    assert res_data['status'] == 'success'
    assert '登録しました' in res_data['message']

@patch("app.create_event")
def test_api_submit_skip(mock_create_event, client):
    mock_create_event.return_value = 'skip'
    
    payload = {
        'title': 'テスト登録ライブ',
        'start_date': '2026-07-26',
        'start_time': '18:00',
        'category': 'アーティストイベント'
    }
    res = client.post('/api/submit', json=payload)
    assert res.status_code == 200
    res_data = json.loads(res.data.decode('utf-8'))
    assert res_data['status'] == 'skip'
    assert '既に登録されています' in res_data['message']

@patch("app.create_event")
def test_api_submit_fail(mock_create_event, client):
    mock_create_event.return_value = False
    
    payload = {
        'title': 'テスト登録ライブ',
        'start_date': '2026-07-26',
        'start_time': '18:00',
        'category': 'アーティストイベント'
    }
    res = client.post('/api/submit', json=payload)
    assert res.status_code == 200
    res_data = json.loads(res.data.decode('utf-8'))
    assert res_data['status'] == 'error'

@patch("app.get_events")
def test_api_download_csv_exception(mock_get_events, client):
    # ダウンロード中に例外が発生した場合500エラーになること
    mock_get_events.side_effect = Exception("予期せぬエラー")
    res = client.get('/api/download-csv?month=2026-05')
    assert res.status_code == 500
    assert 'エラーが発生しました' in res.data.decode('utf-8')

# =====================================================================
# 7. ヘルパー関数のテスト
# =====================================================================
from app import is_valid_month_format, map_form_to_event_data

def test_is_valid_month_format():
    assert is_valid_month_format('2026-05') is True
    assert is_valid_month_format('2026-12') is True
    assert is_valid_month_format('202-05') is False  # 年が3桁
    assert is_valid_month_format('2026/05') is False # スラッシュ
    assert is_valid_month_format('2026-5') is False  # 月が1桁
    assert is_valid_month_format('') is False
    assert is_valid_month_format(None) is False

def test_map_form_to_event_data():
    # 全てのフィールドが入力された場合
    input_data = {
        'title': 'テストタイトル',
        'start_date': '2026-08-01',
        'open_time': '18:00',
        'start_time': '18:30',
        'end_date': '2026-08-01',
        'end_time': '21:00',
        'all_day': True,
        'category': 'ライブ',
        'description': '詳細テキスト',
        'advance_price': '2000',
        'door_price': '2500',
        'drink': True,
        'other': '備考',
        'featured': True,
        'status': 'draft',
        'image_id': 123
    }
    result = map_form_to_event_data(input_data)
    assert result['イベントタイトル'] == 'テストタイトル'
    assert result['終日イベント(1で終日)'] == '1'
    assert result['ドリンク'] == 'x'
    assert result['注目イベント'] == '1'
    assert result['公開ステータス(publish/draft)'] == 'draft'
    assert result['_image_id'] == 123

    # no_drink が True の場合
    input_data_no_drink = input_data.copy()
    input_data_no_drink['drink'] = False
    input_data_no_drink['no_drink'] = True
    result_no_drink = map_form_to_event_data(input_data_no_drink)
    assert result_no_drink['ドリンク'] == '-'

    # デフォルト値・未入力項目がある場合
    empty_data = {}
    result_empty = map_form_to_event_data(empty_data)
    assert result_empty['イベントタイトル'] == ''
    assert result_empty['終日イベント(1で終日)'] == ''
    assert result_empty['ドリンク'] == ''
    assert result_empty['注目イベント'] == ''
    assert result_empty['公開ステータス(publish/draft)'] == 'publish' # デフォルトは publish

# =====================================================================
# 8. APIの異常系（設定ファイル読み込みエラー等）のテスト
# =====================================================================
@patch("app.load_config", return_value=None)
def test_api_upload_image_config_error(mock_load_config, client):
    res = client.post('/api/upload-image')
    assert res.status_code == 200
    res_data = json.loads(res.data.decode('utf-8'))
    assert res_data['status'] == 'error'
    assert '設定ファイルの読み込みに失敗' in res_data['message']

def test_api_upload_image_empty_filename(client):
    # ファイル名が空の場合
    data = {
        'image': (io.BytesIO(b""), '')
    }
    res = client.post('/api/upload-image', data=data, content_type='multipart/form-data')
    assert res.status_code == 200
    res_data = json.loads(res.data.decode('utf-8'))
    assert res_data['status'] == 'error'
    assert '画像ファイルが選択されていません' in res_data['message']

@patch("app.load_config", return_value=None)
def test_api_submit_config_error(mock_load_config, client):
    res = client.post('/api/submit', json={})
    assert res.status_code == 200
    res_data = json.loads(res.data.decode('utf-8'))
    assert res_data['status'] == 'error'
    assert '設定ファイル (config.json) の読み込みに失敗' in res_data['message']
