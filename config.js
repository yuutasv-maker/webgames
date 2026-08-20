/**
 * WebGames 運用設定
 * 
 * 海の家 WebGames の「今週のゲーム」設定ファイルです。
 * index.html にアクセスした際、ここで指定されたゲームへ自動的に遷移します。
 */

const GAME_CONFIG = {
    // ==========================================
    // 1. 今週のゲーム手動指定
    // ==========================================
    // 候補: 'watermelon' | 'bbq' | 'acai'
    // ※ 'portal' を設定すると自動リダイレクトせず一覧ポータルを表示します
    // ※ null を設定すると下の schedule（週間スケジュール）に従って自動判定します
    activeGame: 'acai',

    // ==========================================
    // 2. 週間スケジュール設定（activeGame が null の場合に使用）
    // ==========================================
    // 指定した開始日時（startDate）以降に自動的に切り替わります
    schedule: [
        // { startDate: '2026-08-01', game: 'watermelon' },
        // { startDate: '2026-08-10', game: 'bbq' },
        // { startDate: '2026-08-17', game: 'acai' }
    ],

    // ==========================================
    // 3. ゲーム定義マッピング
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
            description: '一瞬だけ表示されるお手本を記憶して、完璧なアサイーボウルを再現！'
        }
    },

    // どの設定にも該当しない場合のフォールバック先
    defaultGame: 'watermelon'
};

/**
 * 遷移先ゲーム情報を解決する関数
 * @param {Object} config - GAME_CONFIG 設定オブジェクト
 * @param {URLSearchParams|Object|string} [params] - URLパラメータ（テスト用）
 * @param {Date} [currentDate] - 判定日時（テスト用、デフォルトは現在日時）
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

    // 2. ?game=xxx によるURLパラメータ優先の直接指定（テスト・デバッグ用）
    const overrideGameKey = urlParams.get('game');
    if (overrideGameKey && config.games && config.games[overrideGameKey]) {
        return {
            key: overrideGameKey,
            game: config.games[overrideGameKey],
            redirectUrl: config.games[overrideGameKey].path,
            isPortal: false
        };
    }

    // 3. activeGame による手動指定
    if (config.activeGame) {
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

    // 4. スケジュール判定（activeGame が未設定の場合）
    if (Array.isArray(config.schedule) && config.schedule.length > 0) {
        const now = currentDate.getTime();
        // startDate の降順でソートして現在時刻以前の最新のものを探す
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

    // 5. デフォルトゲーム
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

// Node.js環境（テスト用）でのエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GAME_CONFIG, resolveActiveGame };
}
