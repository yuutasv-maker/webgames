/**
 * WebGames 運用設定
 * 
 * 海の家 WebGames の「今週のゲーム」設定ファイルです。
 * index.html にアクセスした際、ここで指定されたゲームへ自動的に遷移します。
 */

const GAME_CONFIG = {
    // ==========================================
    // 1. 今日のゲーム手動指定
    // ==========================================
    // 候補: 'daily' | 'watermelon' | 'bbq' | 'acai' | 'acai-tower' | 'portal'
    // ※ 'daily' または null を設定すると dailySettings（日替わりローテーション）に従って自動判定します
    // ※ 'portal' を設定すると自動リダイレクトせず一覧ポータルを表示します
    // ※ 特定のゲームIDを指定すると日替わりを無効化してそのゲームに固定します
    activeGame: 'daily',

    // ==========================================
    // 2. 日替わりローテーション設定
    // ==========================================
    dailySettings: {
        // 基準日（インデックス0のゲームが配信される日: YYYY-MM-DD）
        baseDate: '2026-08-31',
        // ローテーション順序（ゲームIDの配列）
        // 配列の長さ（.length）に応じて自動的に循環周期（余り計算）が連動します
        rotation: [
            'acai',        // 8/31 (Day 0)
            'acai-tower',  // 9/1  (Day 1)
            'bbq',         // 9/2  (Day 2)
            'watermelon',  // 9/3  (Day 3)
            'frankfurt',   // 9/4  (Day 4)
            'janken'       // 9/5  (Day 5)
        ]
    },

    // ==========================================
    // 3. 週間スケジュール設定（特定日ピンポイント指定用・任意）
    // ==========================================
    // 指定した開始日時（startDate）以降に優先して切り替える場合に設定します
    schedule: [],

    // ==========================================
    // 4. ゲーム定義マッピング
    // ==========================================
    games: {
        watermelon: {
            id: 'watermelon',
            name: 'スイカ割りタイミングゲーム',
            icon: '🍉',
            path: 'apps/watermelon-game/index.html',
            description: 'タイミングを合わせてタップ！真ん中を狙って綺麗なスイカを割ろう！'
        },
        bbq: {
            id: 'bbq',
            name: '爆速BBQ串メーカー',
            icon: '🍖',
            path: 'apps/bbq-game/index.html',
            description: '制限時間内にお手本通りの具材を串に刺しまくるスピード勝負！'
        },
        acai: {
            id: 'acai',
            name: '映えアサイー職人',
            icon: '🫐',
            path: 'apps/acai-game/index.html',
            description: 'お手本を覚えて素早くトッピング！映えるアサイーボウルを作ろう！'
        },
        'acai-tower': {
            id: 'acai-tower',
            name: '30秒アサイータワー・スタック',
            icon: '🥣',
            path: 'apps/acai-tower/index.html',
            description: 'カップをスライドしてフルーツをキャッチ！30秒で豪華な映えタワーを作ろう！'
        },
        'frankfurt': {
            id: 'frankfurt',
            name: '最後の一本フランクフルト',
            icon: '🌭',
            path: 'apps/frankfurt-game/index.html',
            description: '合図が出たら素早くタップ！ライバルから最後の一本を奪い取れ！'
        },
        'janken': {
            id: 'janken',
            name: '脳バグ！後出しじゃんけん',
            icon: '✌️',
            path: 'apps/janken-game/index.html',
            description: '相手の手と指示（勝て・負けろ・あいこ）を瞬時に判断してタップする脳トレ勝負！'
        }
    },

    // どの設定にも該当しない場合のフォールバック先
    defaultGame: 'acai'
};

/**
 * JST基準で基準日からの経過日数を基に日替わりゲームキーを解決する
 * @param {Object} dailySettings - 日替わり設定オブジェクト
 * @param {Date} currentDate - 判定日時
 * @returns {string|null} ゲームID
 */
function getDailyGameKey(dailySettings, currentDate = new Date()) {
    if (!dailySettings || !Array.isArray(dailySettings.rotation) || dailySettings.rotation.length === 0) {
        return null;
    }

    const rotation = dailySettings.rotation;
    const baseDateStr = dailySettings.baseDate || '2026-08-31';

    // JST（日本標準時）ベースで年・月・日を取得
    const formatter = new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    const parts = formatter.formatToParts(currentDate);
    let year, month, day;
    for (const p of parts) {
        if (p.type === 'year') year = p.value;
        if (p.type === 'month') month = p.value;
        if (p.type === 'day') day = p.value;
    }

    // タイムゾーンによるずれを防ぐためUTC時刻で差分日数を計算
    const baseParts = baseDateStr.split('-').map(Number);
    const baseUtc = Date.UTC(baseParts[0], baseParts[1] - 1, baseParts[2]);
    const currentUtc = Date.UTC(Number(year), Number(month) - 1, Number(day));

    const diffDays = Math.floor((currentUtc - baseUtc) / (1000 * 60 * 60 * 24));

    // 配列の長さ（rotation.length）で動的に剰余を計算（負数対応）
    const index = ((diffDays % rotation.length) + rotation.length) % rotation.length;
    return rotation[index];
}

/**
 * 遷移先ゲーム情報を解決する関数
 * @param {Object} config - GAME_CONFIG 設定オブジェクト
 * @param {URLSearchParams|Object|string} [params] - URLパラメータ
 * @param {Date} [currentDate] - 判定日時（デフォルトは現在日時）
 * @returns {{ key: string|null, game: Object|null, redirectUrl: string|null, isPortal: boolean }}
 */
function resolveActiveGame(config = GAME_CONFIG, params = null, currentDate = new Date()) {
    let urlParams;
    if (params === null || params === undefined) {
        if (typeof window !== 'undefined' && window.location && window.location.search) {
            urlParams = new URLSearchParams(window.location.search);
        } else {
            urlParams = new URLSearchParams('');
        }
    } else if (typeof params === 'string') {
        urlParams = new URLSearchParams(params);
    } else if (params instanceof URLSearchParams) {
        urlParams = params;
    } else {
        urlParams = new URLSearchParams(params);
    }

    // 1. ?portal=true / ?list=true の場合はポータル一覧を表示（リダイレクトバイパス）
    if (urlParams.get('portal') === 'true' || urlParams.get('list') === 'true') {
        return { key: null, game: null, redirectUrl: null, isPortal: true };
    }

    // 2. ?game=xxx によるURLパラメータ指定
    const overrideGameKey = urlParams.get('game');
    if (overrideGameKey && config.games && config.games[overrideGameKey]) {
        return {
            key: overrideGameKey,
            game: config.games[overrideGameKey],
            redirectUrl: config.games[overrideGameKey].path,
            isPortal: false
        };
    }

    // 3. 手動固定指定（'portal' または 特定ゲームID）
    if (config.activeGame && config.activeGame !== 'daily') {
        if (config.activeGame === 'portal') {
            return { key: null, game: null, redirectUrl: null, isPortal: true };
        }
        if (config.games && config.games[config.activeGame]) {
            return {
                key: config.activeGame,
                game: config.games[config.activeGame],
                redirectUrl: config.games[config.activeGame].path,
                isPortal: false
            };
        }
    }

    // 4. スケジュール判定（個別指定スケジュールが存在する場合）
    if (Array.isArray(config.schedule) && config.schedule.length > 0) {
        const now = currentDate.getTime();
        const sortedSchedule = [...config.schedule].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
        for (const item of sortedSchedule) {
            if (new Date(item.startDate).getTime() <= now) {
                if (item.game === 'portal') {
                    return { key: null, game: null, redirectUrl: null, isPortal: true };
                }
                if (config.games && config.games[item.game]) {
                    return {
                        key: item.game,
                        game: config.games[item.game],
                        redirectUrl: config.games[item.game].path,
                        isPortal: false
                    };
                }
            }
        }
    }

    // 5. 日替わりローテーション判定（activeGame が 'daily' または未指定の場合）
    if (config.dailySettings) {
        const dailyKey = getDailyGameKey(config.dailySettings, currentDate);
        if (dailyKey && config.games && config.games[dailyKey]) {
            return {
                key: dailyKey,
                game: config.games[dailyKey],
                redirectUrl: config.games[dailyKey].path,
                isPortal: false
            };
        }
    }

    // 6. デフォルトゲームへのフォールバック
    if (config.defaultGame && config.games && config.games[config.defaultGame]) {
        return {
            key: config.defaultGame,
            game: config.games[config.defaultGame],
            redirectUrl: config.games[config.defaultGame].path,
            isPortal: false
        };
    }

    return { key: null, game: null, redirectUrl: null, isPortal: true };
}

// CommonJS module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GAME_CONFIG, getDailyGameKey, resolveActiveGame };
}
