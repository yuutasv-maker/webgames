# 海の家 ミニゲームコレクション (uminoie)

ブラウザですぐに遊べる、海の家をテーマにしたカジュアルミニゲームのコレクションです。友人と一緒に手軽に楽しめる設計になっています。

## 🎮 収録ゲーム

### 1. スイカ割りタイミングゲーム (`apps/watermelon-game/`)
タイミングを合わせてタップし、真ん中を狙って綺麗なスイカを割るゲームです。
- **特徴:** 反射神経とタイミング重視のアクションゲーム。

### 2. 爆速BBQ串メーカー (`apps/bbq-game/`)
制限時間内にお手本通りの具材を串に刺しまくるスピード勝負のゲームです。
- **特徴:** 素早い判断と操作スピードが求められるタイムアタック。

### 3. 映えアサイー職人 (`apps/acai-game/`)
一瞬だけ表示されるお手本を記憶して、完璧なアサイーボウルを再現するゲームです。
- **特徴:** 瞬間記憶力と正確な配置能力を試す記憶ゲーム。

## 📁 ディレクトリ構成

```text
uminoie/
└── webgames/
    ├── index.html        # エントリーポイント / ポータル画面（自動リダイレクト機能付き）
    ├── config.js         # 今週のゲーム・運用スケジュール設定
    ├── config.test.js    # 設定・リダイレクト判定テスト
    ├── style.css         # ポータル画面用スタイルシート
    ├── common/           # 共通コンポーネント（クーポンマネージャー等）
    └── apps/             # 各ミニゲームのディレクトリ
        ├── acai-game/    # 映えアサイー職人
        ├── bbq-game/     # 爆速BBQ串メーカー
        └── watermelon-game/ # スイカ割りタイミングゲーム
```

※各ゲームディレクトリには、個別の `index.html`, `style.css`, `script.js` に加えて、テストコード (`script.test.js`) が含まれています。

## 🔄 「今週のゲーム」週替わり運用方法

`webgames/index.html` にアクセスした際、設定されたゲームへ自動的にリダイレクトします。

### 1. 手動でゲームを切り替える場合
`webgames/config.js` の `activeGame` の値を変更します。

```javascript
// webgames/config.js
const GAME_CONFIG = {
    // 公開したいゲームのIDを指定 ('watermelon' | 'bbq' | 'acai')
    activeGame: 'watermelon', 
    ...
};
```

### 2. 日付指定で自動切り替え（スケジュール運用）する場合
`activeGame: null` に設定し、`schedule` 配列に切り替え日時を定義します。

```javascript
// webgames/config.js
const GAME_CONFIG = {
    activeGame: null, // スケジュール優先
    schedule: [
        { startDate: '2026-08-01', game: 'watermelon' },
        { startDate: '2026-08-10', game: 'bbq' },
        { startDate: '2026-08-17', game: 'acai' }
    ],
    ...
};
```

### 3. ポータル一覧画面の確認・デバッグ
- **全ゲーム一覧を表示する場合**: `index.html?portal=true` にアクセス
- **特定ゲームを直接指定して開く場合**: `index.html?game=bbq` などパラメータを付与

## 🛠️ 技術スタック

* **フロントエンド:** HTML5, CSS3, JavaScript (Vanilla JS)
* **テスト:** JavaScriptによるユニットテスト (`script.test.js`, `config.test.js`)
* **フォント:** Google Fonts (Outfit, Zen Maru Gothic)

## 🚀 動作確認・テスト

各テストスクリプトは Node.js で直接実行できます：

```bash
# 設定・リダイレクト判定テスト
node webgames/config.test.js

# 各ゲーム・クーポンマネージャーの単体テスト
node webgames/common/coupon-manager.test.js
node webgames/apps/watermelon-game/script.test.js
node webgames/apps/bbq-game/script.test.js
node webgames/apps/acai-game/script.test.js
```

