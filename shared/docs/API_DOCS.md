# API仕様書

本ドキュメントでは、スタジオOWLイベント管理システムにおいて提供・利用されているAPIの仕様について定義します。
システム内には大きく分けて「フロントエンドからFlaskサーバーを呼び出す内部API」と、「本システムから外部のWordPressサイトへアクセスするAPI」が存在します。

---

## 1. 内部Web API (Flaskエンドポイント)
**実装ファイル**: `apps/event-manager/app.py`
イベント入力フォーム（ブラウザ）などから利用されるAPIエンドポイント群です。

### 1.1. 単体イベント登録
- **エンドポイント**: `POST /api/submit`
- **概要**: フォーム入力されたイベントデータをWordPressへ登録（または下書き保存）します。
- **リクエストボディ (JSON)**:
  ```json
  {
    "title": "イベントタイトル",
    "start_date": "2024-05-01",
    "start_time": "19:00",
    "end_date": "2024-05-01",
    "end_time": "21:00",
    "all_day": false,
    "category": "ランチライブ",
    "description": "出演者情報など",
    "advance_price": "2000",
    "door_price": "2500",
    "drink": true,
    "other": "特記事項",
    "featured": false,
    "status": "publish",
    "image_id": 1234
  }
  ```
- **レスポンス (JSON)**:
  - `200 OK` (成功): `{"status": "success", "message": "..."}`
  - `200 OK` (重複スキップ): `{"status": "skip", "message": "..."}`
  - `200 OK` (エラー): `{"status": "error", "message": "..."}`

### 1.2. 画像アップロード中継
- **エンドポイント**: `POST /api/upload-image`
- **概要**: アップロードされた画像を直接WordPressのメディアライブラリへ転送し、取得したメディアIDを返します。
- **リクエスト**: `multipart/form-data`
  - `image`: 画像ファイル本体
- **レスポンス (JSON)**:
  - 成功時: `{"status": "success", "message": "...", "media_id": 1234}`

### 1.3. イベント情報AI・テキスト解析
- **エンドポイント**: `POST /api/analyze-event-details`
- **概要**: SNS告知等の自由記述テキストから日付・時間・料金・出演者情報などを抽出・構造化して返します。
- **リクエストボディ (JSON)**: `{"text": "5/10(日) OPEN 18:30..."}`

### 1.4. 定期イベント・カテゴリ情報取得
- **エンドポイント**: `GET /api/recurring-events`
- **概要**: フロントエンドの入力補完用として、カテゴリ一覧と定期イベントのテンプレート設定一覧を取得します。

### 1.5. イベント検索・更新 (編集機能)
- **エンドポイント**: `GET /api/search-events` / `POST /api/update-event`
- **概要**: 既存イベントのキーワード・日付検索、および編集内容のWordPressへの上書き更新。

### 1.6. 参加型イベント エクスポートプレビュー / CSVダウンロード
- **エンドポイント**: `GET /api/export-events` / `GET /api/download-csv`
- **概要**: 指定した月の参加型イベント一覧のプレビューおよびCSVダウンロード。
- **クエリパラメータ**: `month=YYYY-MM` (例: `2024-05`)

---

## 2. WordPress連携 API (外部通信クライアント仕様)
**実装ファイル**: `apps/event-manager/wp_api.py`
本システムがThe Events CalendarプラグインおよびWordPress本体のREST APIを操作する際の仕様です。

**認証に関する特記事項**:
- ホスティングサーバー（ロリポップ等）のCGI制限やWAFによる弾きを回避するため、標準の `Authorization` ヘッダーではなく、独自ヘッダー `X-Owl-Auth` を用いてBasic認証（アプリケーションパスワード）情報を送信しています。

### 2.1. イベント作成
- **リクエスト**: `POST /wp-json/tribe/events/v1/events`
- **概要**: 指定されたデータに基づき、WordPress上に新規イベントを作成します。
- **主要ペイロード**:
  - `title`: イベント名
  - `start_date` / `end_date`: YYYY-MM-DD HH:MM:SS 形式
  - `status`: publish または draft
  - `description`: HTML整形済みの詳細文
  - `cost`: 料金
  - `categories`: カテゴリIDの配列
  - `featured`: ピックアップフラグ (boolean)

### 2.2. イベント重複チェック
- **リクエスト**: `GET /wp-json/tribe/events/v1/events`
- **概要**: 登録前に同一日・同一タイトルのイベントが既に存在しないか検索します。
- **クエリパラメータ**:
  - `search`: タイトル文字列
  - `start_date`: 検索対象の日付
  - `end_date`: 検索対象の日付
  - `status`: `publish,draft`

### 2.3. 画像アップロード
- **リクエスト**: `POST /wp-json/wp/v2/media`
- **概要**: イベントのアイキャッチ画像などをアップロードします。日本語ファイル名はタイムスタンプ等を利用した安全なファイル名にリネームしてから送信されます。

### 2.4. アイキャッチ画像の設定
- **リクエスト**: `POST /wp-json/wp/v2/tribe_events/{event_id}`
- **概要**: 登録済みのイベントに対して、アップロード済みメディアIDをアイキャッチ画像として紐付けます。
- **ペイロード**: `{"featured_media": <media_id>}`
