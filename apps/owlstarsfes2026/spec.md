# `spec.md`: 井上ヤスオバーガーALL(OWL)-STARS FESTIVAL（仮）LP  
  
## 1. プロジェクト概要・目的    
*   **目的**: 2026年11月1日開催のフェス告知および、既存フォーム流用によるチケット予約の獲得。    
*   **インフラ**: 既存サーバー（`owl21.info`）に静的ファイル（HTML/CSS/JS）としてアップロード。本番環境はビルド不要の構成とする。    
*   **フォーム仕様**: 既存の予約フォームのHTML構造およびPOST先を流用し、LP内に埋め込む。    
*   **コンバージョン計測**: Google Analytics 4 (GA4) を導入し、チケット予約完了時にカスタムイベント（`reserve_ticket`）を送信。集客施策の分析に繋げる。    
  
## 2. ディレクトリ構成  
本番環境へのデプロイを容易にするため、以下の構成を標準とする。  
```text  
/  
├── index.html  
├── assets/  
│   ├── js/ (ロジックとUI層のスクリプト)  
│   └── images/ (no-image.jpgや固定画像)  
└── data/  
    ├── info.json (イベント基本情報・料金・会場)  
    ├── performers.json (出演者)  
    ├── timetable.json (タイムテーブル)  
    └── foods.json (フード出店)  
```  
  
## 3. プロジェクト独自のドメイン知識（ユビキタス言語）辞書    
*   **フェス**: 「井上ヤスオバーガーALL(OWL)-STARS FESTIVAL」を指す。    
*   **ステージ**: ライブが行われる場所。1ステージ制か複数ステージ制か未定のため、データ上は可変（Nullable）として扱う。    
*   **No Image**: 出演者やフードの画像が未提供、またはリンク切れの際に表示する共通のプレースホルダー画像（`assets/images/no-image.jpg`）。    
  
## 4. UI/UX・デザイントークンガイド    
*   **デザイン方針**: 賑やかでポップ（フェスのワクワク感・特別感を演出）。    
*   **技術スタック (UI)**: HTML5, CSS3, Tailwind CSS (CDN経由で導入)    
*   **レスポンシブ方針**: Tailwind CSSのデフォルトブレークポイント（`sm`, `md`, `lg`, `xl`）を基準に、モバイルファーストでコーディングする。    
*   **状態表示（Loading）**: ページ読み込み時のJSONデータFetch中は、コンテンツエリアにローディングスピナー（Skeleton UIまたはCSSアニメーション）を表示し、ユーザーに待機状態を明示する。  
*   **画像最適化ガイドライン**: 表示速度低下を防ぐため、JSONで指定する画像は可能な限りWebPフォーマットを使用し、ファイルサイズは1枚あたり最大500KB以下を推奨する。    
*   **OGP設定**: X（旧Twitter）やLINEでのシェアを想定し、フェス用のサムネイルと説明文が適切に展開されるようメタタグを設定する。    
  
## 5. Phase 1（MVP）のスコープ定義    
### 実装スコープ    
*   レスポンシブ対応のシングルページLP実装。    
*   外部JSONファイルからのデータFetchおよび動的DOM生成（ページへのアクセス時の初回読み込み時に1回のみ取得）。    
*   JSON取得時のキャッシュバスター実装（クエリパラメータ付与）。    
*   1ステージ / 複数ステージ両対応のタイムテーブル描画ロジック。    
*   初期値（公演名・日付）が自動入力された予約フォームの設置。    
*   GA4カスタムイベント（`reserve_ticket`）の送信設定。  
*   通信エラー時やデータ欠損時のフォールバック処理。    
  
### やらないこと (Out of Scope)    
*   予約処理バックエンドの新規構築、および送信成功/失敗のUI制御（既存フォームシステムの仕様に依存するため）。    
*   情報更新用のCMSや管理画面の構築（手動でのJSONファイル書き換えで運用）。    
*   複雑なアニメーションや、パフォーマンスを低下させるDOM依存の重い処理。    
*   **本番成果物**におけるNode.js環境を用いたビルドプロセス。    
  
## 6. UI層とLogic層の分離方針    
*   **Logic層**: DOMに一切アクセスしない純粋関数群。    
    *   `fetchEventData(url)`: JSONの非同期取得とパース。リクエストURLにタイムスタンプ（`?v=...`）を付与。    
    *   `formatTimetable(data)`: JSONからステージ数を判別し、時間（昇順）でソート、描画用データへ整形。    
    *   `validateData(data, schema)`: 必須項目が欠損していないかチェックする。エラーがある場合は例外をスローする。  
*   **UI層**: Logic層から受け取った整形済みデータを元に、DOM要素を生成してマウントする処理。    
  
## 7. Logic層のテストケース (TDD前提)    
*   **`validateData`のテスト**:  
    *   *入力*: `[{ id: "p1", name: "" }]` (必須項目`name`が空)  
    *   *期待される出力*: 例外をスロー。  
*   **`formatTimetable`のテスト**:    
    *   *入力*: `[{time: "13:30", stage: "Stage B", performerId: "p2"}, {time: "13:00", stage: "Stage A", performerId: "p1"}]`    
    *   *期待される出力*: 時間昇順ソート＆マトリクス化されたJSON。    
  
## 8. 画面構成ごとの詳細要件とエッジケース    
*   **JSON読み込み中**: データ取得完了までローディングスピナーを表示する。  
*   **JSONバリデーション・読み込みエラー**: データ不整合（必須項目の欠損など）や通信エラーが発生した場合は該当セクションの読み込みを中止し、レイアウトを崩さず「現在情報を更新中です」というプレースホルダーテキストを表示する。    
*   **画像URL欠損・リンク切れ**: `imageUrl` が空、または404エラーの場合は、共通の `no-image.jpg` に自動置換する（`onerror`イベント等）。    
*   **GA4イベント送信**:  
    *   **イベント名**: `reserve_ticket`  
    *   **パラメータ**: `event_name` (例: "inoue_yasuo_burger_fes_2026")  
    *   **トリガー**: 予約フォームの送信ボタン押下（または既存フォームの送信完了動作にフック）。  
  
## 9. 決定事項まとめ (Decision Log)    
| 項目 | 決定事項 | 理由・背景 |    
| :--- | :--- | :--- |    
| **技術スタック** | HTML/JS + Tailwind CDN + JSON | 更新スピード最優先のため。 |    
| **ディレクトリ構成** | `index.html` + `assets/` + `data/` | ビルド不要でそのままアップロードできるシンプルな構成とするため。 |  
| **データ取得** | ページ読み込み時のみ1回 | 実装のシンプルさとサーバー負荷軽減のため。読み込み中はスピナーを表示。 |  
| **エラー時の挙動** | セクション読込中止＋プレースホルダー | 必須項目の欠損時など、データ不整合が起きた際に画面崩れを防ぐため。 |  
| **フォームUI** | 既存システムに依存 | 既存のHTML構造とPOST先を流用するため、本LP側での送信中表示等はスコープ外とする。 |  
| **計測設定** | GA4カスタムイベント (`reserve_ticket`) | 今後のスタジオやイベント集客分析において、独自のパラメータを取得・活用しやすくするため。 |    
  
## 10. データスキーマ定義 (Schema-Driven)  
JSONの構造不整合を防ぐため、以下のスキーマとサンプルを定義する。  
  
### `info.json` (基本情報)  
```typescript  
// 型定義  
interface InfoSchema {  
  festivalName: string; // 必須  
  date: string;         // 必須 (YYYY-MM-DD)  
  venue: {  
    name: string;       // 必須  
    address: string;    // 必須  
    mapUrl: string;     // 任意 (空文字可)  
    accessNote: string; // 任意 (空文字可)  
  };  
  tickets: {  
    advance: string;    // 必須  
    door: string;       // 必須  
    notes: string[];    // 任意  
  };  
}  
  
// サンプルデータ  
{  
  "festivalName": "井上ヤスオバーガーALL(OWL)-STARS FESTIVAL",  
  "date": "2026-11-01",  
  "venue": {  
    "name": "スタジオOWL",  
    "address": "愛媛県松山市三番町...",  
    "mapUrl": "[https://maps.google.com/](https://maps.google.com/)...",  
    "accessNote": "駐車場は近隣のコインパーキングをご利用ください"  
  },  
  "tickets": {  
    "advance": "前売 3,500円",  
    "door": "当日 4,000円",  
    "notes": ["ドリンク代別途600円", "小学生以下無料"]  
  }  
}  
```  
  
### `performers.json` (出演者情報)  
```typescript  
// 型定義  
interface PerformerSchema {  
  id: string;          // 必須 (一意の識別子)  
  name: string;        // 必須  
  description: string; // 任意 (空文字可)  
  imageUrl: string;    // 任意 (空文字可)  
}  
  
// サンプルデータ  
[  
  {  
    "id": "p01",  
    "name": "井上ヤスオバーガー",  
    "description": "熱い弾き語りをお届けします。",  
    "imageUrl": "./assets/images/burger.jpg"  
  }  
]  
```  
  
### `timetable.json` (タイムテーブル)  
```typescript  
// 型定義  
interface TimetableSchema {  
  time: string;        // 必須 (HH:MM)  
  stage: string | null;// 任意 (1ステージの場合はnullまたは空文字)  
  performerId: string; // 必須 (performers.jsonのidと紐付け)  
}  
  
// サンプルデータ  
[  
  {  
    "time": "13:00",  
    "stage": null,  
    "performerId": "p01"  
  }  
]  
```  
  
### `foods.json` (フード出店情報)  
```typescript  
// 型定義  
interface FoodVendorSchema {  
  id: string;          // 必須  
  name: string;        // 必須  
  description: string; // 任意  
  imageUrl: string;    // 任意  
}  
  
// サンプルデータ  
[  
  {  
    "id": "f01",  
    "name": "OWL特製メニュー",  
    "description": "名物のフードをお楽しみください。",  
    "imageUrl": "./assets/images/food.jpg"  
  }  
]  
```  
