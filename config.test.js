const assert = require('assert');
const { GAME_CONFIG, resolveActiveGame } = require('./config.js');

try {
    // 1. デフォルト設定（activeGame: 'watermelon'）のテスト
    const configWatermelon = { ...GAME_CONFIG, activeGame: 'watermelon' };
    const resDefault = resolveActiveGame(configWatermelon, '');
    assert.strictEqual(resDefault.key, 'watermelon');
    assert.strictEqual(resDefault.redirectUrl, 'apps/watermelon-game/index.html');
    assert.strictEqual(resDefault.isPortal, false);

    // 1-b. 現在の GAME_CONFIG の解決テスト
    const resCurrent = resolveActiveGame(GAME_CONFIG, '');
    const expectedKey = GAME_CONFIG.activeGame || GAME_CONFIG.defaultGame;
    assert.strictEqual(resCurrent.key, expectedKey);
    assert.strictEqual(resCurrent.redirectUrl, `apps/${expectedKey}-game/index.html`);

    // 2. activeGame による手動切り替え（'bbq', 'acai'）のテスト
    const configBbq = { ...GAME_CONFIG, activeGame: 'bbq' };
    const resBbq = resolveActiveGame(configBbq, '');
    assert.strictEqual(resBbq.key, 'bbq');
    assert.strictEqual(resBbq.redirectUrl, 'apps/bbq-game/index.html');

    const configAcai = { ...GAME_CONFIG, activeGame: 'acai' };
    const resAcai = resolveActiveGame(configAcai, '');
    assert.strictEqual(resAcai.key, 'acai');
    assert.strictEqual(resAcai.redirectUrl, 'apps/acai-game/index.html');

    // 3. activeGame: 'portal' の場合は一覧表示
    const configPortal = { ...GAME_CONFIG, activeGame: 'portal' };
    const resPortal = resolveActiveGame(configPortal, '');
    assert.strictEqual(resPortal.isPortal, true);
    assert.strictEqual(resPortal.redirectUrl, null);

    // 4. クエリパラメータ ?portal=true によるバイパス
    const resParamPortal = resolveActiveGame(GAME_CONFIG, '?portal=true');
    assert.strictEqual(resParamPortal.isPortal, true);
    assert.strictEqual(resParamPortal.redirectUrl, null);

    const resParamList = resolveActiveGame(GAME_CONFIG, '?list=true');
    assert.strictEqual(resParamList.isPortal, true);
    assert.strictEqual(resParamList.redirectUrl, null);

    // 5. クエリパラメータ ?game=xxx による一時的オーバーライド
    const resParamOverride = resolveActiveGame(GAME_CONFIG, '?game=bbq');
    assert.strictEqual(resParamOverride.key, 'bbq');
    assert.strictEqual(resParamOverride.redirectUrl, 'apps/bbq-game/index.html');

    // 6. スケジュール判定のテスト (activeGame: null の場合)
    const scheduleConfig = {
        ...GAME_CONFIG,
        activeGame: null,
        schedule: [
            { startDate: '2026-08-01', game: 'watermelon' },
            { startDate: '2026-08-10', game: 'bbq' },
            { startDate: '2026-08-17', game: 'acai' }
        ]
    };

    // 2026-08-05 (スイカ割り期間)
    const resSched1 = resolveActiveGame(scheduleConfig, '', new Date('2026-08-05T12:00:00Z'));
    assert.strictEqual(resSched1.key, 'watermelon');
    assert.strictEqual(resSched1.redirectUrl, 'apps/watermelon-game/index.html');

    // 2026-08-12 (BBQ期間)
    const resSched2 = resolveActiveGame(scheduleConfig, '', new Date('2026-08-12T12:00:00Z'));
    assert.strictEqual(resSched2.key, 'bbq');
    assert.strictEqual(resSched2.redirectUrl, 'apps/bbq-game/index.html');

    // 2026-08-20 (アサイー期間)
    const resSched3 = resolveActiveGame(scheduleConfig, '', new Date('2026-08-20T12:00:00Z'));
    assert.strictEqual(resSched3.key, 'acai');
    assert.strictEqual(resSched3.redirectUrl, 'apps/acai-game/index.html');

    // スケジュール前 (2026-07-31) -> デフォルトゲームにフォールバック
    const resSchedBefore = resolveActiveGame(scheduleConfig, '', new Date('2026-07-31T12:00:00Z'));
    assert.strictEqual(resSchedBefore.key, 'watermelon');

    // 7. 不正な activeGame や空設定の場合のフォールバック
    const configInvalid = { ...GAME_CONFIG, activeGame: 'unknown_game', defaultGame: 'bbq' };
    const resInvalid = resolveActiveGame(configInvalid, '');
    assert.strictEqual(resInvalid.key, 'bbq');

    console.log('GameConfig all tests passed successfully!');
} catch (e) {
    console.error('GameConfig test failed:', e);
    process.exit(1);
}
