# スタジオOWL イベント管理・楽曲検索システム

## プロジェクト概要
本リポジトリは、スタジオOWLのイベント管理、スケジュールの自動連携、および楽曲検索システムを統合したプロジェクトです。
主にPythonを利用したバックエンド処理、WordPress(WP)と連携するAPI操作、および楽曲検索用のフロントエンド実装から構成されています。

## ディレクトリ構成と各コンポーネントの役割

| ディレクトリ/ファイル | 役割・概要 |
| --- | --- |
| `apps/event-manager/` | イベント登録・編集、チケット予約作成、参加型イベント出力を行うFlask Webアプリケーション本体およびAPI群（`app.py`, `wp_api.py`, `event_parser.py`, `tests/`）。 |
| `apps/setting-sheet/` | 出演者向けステージセッティングシート作成ツール（HTML5/JS/SVG、画像・PDF出力、自動デプロイ機能）。 |
| `apps/owlstarsfes2026/` | 特設フェス用LP（2026年11月開催・JSON駆動型動的タイムテーブル・チケット予約導線）。 |
| `apps/freeLabo/` | フリーライブ(+ラボ) 特設ランディングページ。 |
| `services/schedule-batch/` | スケジュールデータ（`events.csv` 等）をもとにWordPressに一括反映するバッチ処理・起動スクリプト群（`run_form.sh`, `run_update.sh` 等）。 |
| `services/wordpress-sync/` | 楽曲検索プラグイン（`wp-song-search`）や認証修正プラグイン（`owl-auth-fix`）、PHPスニペット群。 |
| `shared/docs/` | アーキテクチャ設計書、API仕様書、運用マニュアル（`Manual.html`）等のドキュメント。 |
| `shared/data/` | スケジュールデータ（`events.csv`）や更新ログ。 |
| `config.json` | システム全体の動作設定ファイル（WP接続情報など）。 |
| `起動.bat` / `起動.command` | Web管理アプリ（`apps/event-manager`）のワンクリック起動スクリプト（Windows / Mac用）。 |

## アーキテクチャの概要
本システムは大きく分けて以下の機能ブロックで構成されます。
1. **イベント管理・登録機能 (`apps/event-manager/app.py`)**
   - 運用者がイベントを登録・編集・抽出するためのWebインターフェース。
2. **バッチ更新機能 (`apps/event-manager/update_events.py` / `services/schedule-batch/`)**
   - CSVファイルなどのデータを元に、一括でイベント情報を更新する処理。
3. **WordPress連携 (`apps/event-manager/wp_api.py` / `services/wordpress-sync/`)**
   - 更新されたイベント情報などを、実際のスタジオOWLのWebサイト(WordPress)へ反映。
4. **セッティングシート・特設LP (`apps/setting-sheet/`, `apps/owlstarsfes2026/`, `apps/freeLabo/`)**
   - 出演者向けツールおよび集客・告知用Webフロントエンド群。

## 環境構築 (開発環境)

### 前提条件
- OS: macOS (推奨), Linux, Windows
- Python 3.x 以上

### セットアップ手順
1. **仮想環境の作成と有効化**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
2. **依存パッケージのインストール**
   テスト用パッケージ等は以下でインストールします。
   ```bash
   pip install -r requirements-test.txt
   ```
   *(※ メインのrequirements.txtがある場合はそちらも実行してください)*
3. **設定ファイルの準備**
   `config.json` が適切に設定されていることを確認してください。

## テストの実行
プロジェクトルートにあるテスト実行スクリプトを利用してテストを走らせます。
```bash
./run_tests.sh
```
※テスト設定は `pytest.ini` に記載されています。
