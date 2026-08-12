import csv
import json
import logging
import os
import io
import concurrent.futures
from wp_api import create_event, get_robust_session

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# ワークスペースルートは2階層上 (apps/event-manager -> ROOT)
WORKSPACE_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))

CONFIG_FILE = os.path.join(WORKSPACE_ROOT, 'config.json')
RECURRING_EVENTS_FILE = os.path.join(WORKSPACE_ROOT, 'recurring_events.json')
CSV_FILE = os.path.join(WORKSPACE_ROOT, 'shared', 'data', 'events.csv')
LOG_FILE = os.path.join(WORKSPACE_ROOT, 'shared', 'data', 'update_log.txt')


# ログの設定
logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    encoding='utf-8'
)
console = logging.StreamHandler()
console.setLevel(logging.INFO)
logging.getLogger('').addHandler(console)

def load_config():
    """設定ファイル読み込み"""
    if not os.path.exists(CONFIG_FILE):
        logging.error(f"設定ファイルが見つかりません: {CONFIG_FILE}")
        return None
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logging.error(f"設定ファイルの読み込みに失敗しました: {e}")
        return None

def load_recurring_events():
    """定期イベント設定ファイルの読み込み"""
    if not os.path.exists(RECURRING_EVENTS_FILE):
        return {}
    try:
        with open(RECURRING_EVENTS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        # recurring_events.json は定期イベントの補完用補助情報であるため、
        # ファイルが存在しなくても単体イベントの登録自体は実行可能とするフェイルセーフ。
        logging.warning(f"定期イベント設定ファイルの読み込みに失敗しました（通常フローは続行）: {e}")
        return {}

def main():
    logging.info("--- スケジュール更新処理を開始します ---")
    config = load_config()
    if not config:
        print("設定エラーで終了します。")
        return

    recurring_events = load_recurring_events()

    if not os.path.exists(CSV_FILE):
        logging.error(f"CSVファイルが見つかりません: {CSV_FILE}")
        return

    success_count = 0
    error_count = 0
    skip_count = 0

    try:
        # バイナリで読み込んでcp932(Shift-JIS)とutf-8の両方に対応する
        with open(CSV_FILE, 'rb') as f:
            raw_data = f.read()
        
        try:
            text = raw_data.decode('utf-8-sig')
        except UnicodeDecodeError:
            text = raw_data.decode('cp932')

        reader = csv.DictReader(io.StringIO(text, newline=''))
        
        session = get_robust_session()
        
        valid_rows = []
        for row in reader:
            if not (row.get('イベントタイトル') or '').strip() or not (row.get('開始日付') or '').strip():
                continue
            valid_rows.append(row)
            
        def process_row(row):
            logging.info(f"処理中: {row['イベントタイトル']}")
            return create_event(config, recurring_events, row, session=session)

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            for result in executor.map(process_row, valid_rows):
                if result == 'skip':
                    skip_count += 1
                elif result:
                    success_count += 1
                else:
                    error_count += 1
    except Exception as e:
        logging.error(f"CSV読み込みエラー: {e}")

    logging.info(f"--- 処理完了 ---")
    logging.info(f"成功: {success_count}件, スキップ(重複): {skip_count}件, 失敗: {error_count}件")

if __name__ == '__main__':
    main()
