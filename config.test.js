const assert = require('assert');
const { GAME_CONFIG, resolveActiveGame } = require('./config.js');

try {
    // 1. デフォルト設定（activeGame: 'watermelon'）のテスト
    const configWatermelon = { ...GAME_CONFIG, activeGame: 'watermelon' };
    const resDefault = resolveActiveGame(configWatermelon, '');
    assert.strictEqual(resDefault.key, 'watermelon');
    assert.strictEqual(resDefault.redirectUrl, 'apps/watermelon-game/index.html');
    assert.strictEqual(resDefault.isPortal, false);

    // 1-b. 現在の GAME_CONFIG の解決テスト（activeGame: 'daily'）
    const resCurrent = resolveActiveGame(GAME_CONFIG, '', new Date('2026-08-31T12:00:00+09:00'));
    assert.strictEqual(resCurrent.key, 'acai');
    assert.strictEqual(resCurrent.redirectUrl, 'apps/acai-game/index.html');

    // 2. activeGame による手動固定切り替え（'bbq', 'acai', 'acai-tower'）のテスト
    const configBbq = { ...GAME_CONFIG, activeGame: 'bbq' };
    const resBbq = resolveActiveGame(configBbq, '');
    assert.strictEqual(resBbq.key, 'bbq');
    assert.strictEqual(resBbq.redirectUrl, 'apps/bbq-game/index.html');

    const configAcai = { ...GAME_CONFIG, activeGame: 'acai' };
    const resAcai = resolveActiveGame(configAcai, '');
    assert.strictEqual(resAcai.key, 'acai');
    assert.strictEqual(resAcai.redirectUrl, 'apps/acai-game/index.html');

    const configAcaiTower = { ...GAME_CONFIG, activeGame: 'acai-tower' };
    const resAcaiTower = resolveActiveGame(configAcaiTower, '');
    assert.strictEqual(resAcaiTower.key, 'acai-tower');
    assert.strictEqual(resAcaiTower.redirectUrl, 'apps/acai-tower/index.html');

    const configFrankfurt = { ...GAME_CONFIG, activeGame: 'frankfurt' };
    const resFrankfurt = resolveActiveGame(configFrankfurt, '');
    assert.strictEqual(resFrankfurt.key, 'frankfurt');
    assert.strictEqual(resFrankfurt.redirectUrl, 'apps/frankfurt-game/index.html');

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

    // 6. 日替わりローテーション（activeGame: 'daily'）の5日周期テスト
    // 8/31 (Day 0) -> acai
    const res831 = resolveActiveGame(GAME_CONFIG, '', new Date('2026-08-31T09:00:00+09:00'));
    assert.strictEqual(res831.key, 'acai');

    // 9/1 (Day 1) -> acai-tower
    const res901 = resolveActiveGame(GAME_CONFIG, '', new Date('2026-09-01T15:30:00+09:00'));
    assert.strictEqual(res901.key, 'acai-tower');

    // 9/2 (Day 2) -> bbq
    const res902 = resolveActiveGame(GAME_CONFIG, '', new Date('2026-09-02T23:59:59+09:00'));
    assert.strictEqual(res902.key, 'bbq');

    // 9/3 (Day 3) -> watermelon
    const res903 = resolveActiveGame(GAME_CONFIG, '', new Date('2026-09-03T00:00:01+09:00'));
    assert.strictEqual(res903.key, 'watermelon');

    // 9/4 (Day 4) -> frankfurt
    const res904 = resolveActiveGame(GAME_CONFIG, '', new Date('2026-09-04T12:00:00+09:00'));
    assert.strictEqual(res904.key, 'frankfurt');

    // 9/5 (Day 5) -> 循環して acai (Day 0)
    const res905 = resolveActiveGame(GAME_CONFIG, '', new Date('2026-09-05T12:00:00+09:00'));
    assert.strictEqual(res905.key, 'acai');

    // 7. ゲーム数変更（動的周期）のテスト: 3ゲームの場合（3日周期）
    const config3Games = {
        ...GAME_CONFIG,
        activeGame: 'daily',
        dailySettings: {
            baseDate: '2026-08-31',
            rotation: ['watermelon', 'bbq', 'acai']
        }
    };
    assert.strictEqual(resolveActiveGame(config3Games, '', new Date('2026-08-31T12:00:00+09:00')).key, 'watermelon');
    assert.strictEqual(resolveActiveGame(config3Games, '', new Date('2026-09-01T12:00:00+09:00')).key, 'bbq');
    assert.strictEqual(resolveActiveGame(config3Games, '', new Date('2026-09-02T12:00:00+09:00')).key, 'acai');
    assert.strictEqual(resolveActiveGame(config3Games, '', new Date('2026-09-03T12:00:00+09:00')).key, 'watermelon'); // 3日周期で0番目に戻る

    // 8. スケジュール判定のテスト (activeGame: null, dailySettings: null の場合)
    const scheduleConfig = {
        ...GAME_CONFIG,
        activeGame: null,
        dailySettings: null,
        schedule: [
            { startDate: '2026-08-01', game: 'watermelon' },
            { startDate: '2026-08-10', game: 'bbq' },
            { startDate: '2026-08-17', game: 'acai' }
        ]
    };

    const resSched1 = resolveActiveGame(scheduleConfig, '', new Date('2026-08-05T12:00:00Z'));
    assert.strictEqual(resSched1.key, 'watermelon');

    const resSched2 = resolveActiveGame(scheduleConfig, '', new Date('2026-08-12T12:00:00Z'));
    assert.strictEqual(resSched2.key, 'bbq');

    // 9. 不正な activeGame や空設定の場合のフォールバック
    const configInvalid = { ...GAME_CONFIG, activeGame: 'unknown_game', dailySettings: null, defaultGame: 'bbq' };
    const resInvalid = resolveActiveGame(configInvalid, '');
    assert.strictEqual(resInvalid.key, 'bbq');

    console.log('GameConfig all tests passed successfully!');
} catch (e) {
    console.error('GameConfig test failed:', e);
    process.exit(1);
}
