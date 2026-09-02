const assert = require('assert');
const { CouponManager } = require('./coupon-manager.js');

// モックストレージ作成用ヘルパー
function createMockStorage(initial = {}) {
    const store = { ...initial };
    return {
        getItem: (key) => store[key] !== undefined ? store[key] : null,
        setItem: (key, val) => { store[key] = String(val); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { Object.keys(store).forEach(k => delete store[k]); },
        _dump: () => store
    };
}

try {
    const today = new Date(2026, 7, 17); // 2026-08-17
    const yesterday = new Date(2026, 7, 16); // 2026-08-16

    // 1. getTodayDateString
    assert.strictEqual(CouponManager.getTodayDateString(today), '2026-08-17');
    assert.strictEqual(CouponManager.getTodayDateString(yesterday), '2026-08-16');

    // 2. getStorageKey
    assert.strictEqual(CouponManager.getStorageKey('acai'), 'uminoie_coupon_acai_claimed_date');
    assert.strictEqual(CouponManager.getStorageKey('watermelon'), 'uminoie_coupon_watermelon_claimed_date');

    // 3. canClaimToday & claimCoupon (新規ストレージ)
    const storage1 = createMockStorage();
    assert.strictEqual(CouponManager.canClaimToday('acai', today, storage1), true, 'First time can claim');
    
    // クーポン獲得
    CouponManager.claimCoupon('acai', today, storage1);
    assert.strictEqual(storage1.getItem('uminoie_coupon_acai_claimed_date'), '2026-08-17');
    assert.strictEqual(CouponManager.canClaimToday('acai', today, storage1), false, 'Already claimed today cannot claim');
    // 別ゲームには影響しない
    assert.strictEqual(CouponManager.canClaimToday('watermelon', today, storage1), true, 'Different game can claim');

    // 4. 前日獲得済みの場合の当日再獲得
    const storage2 = createMockStorage({
        'uminoie_coupon_acai_claimed_date': '2026-08-16'
    });
    assert.strictEqual(CouponManager.canClaimToday('acai', today, storage2), true, 'Claimed yesterday can claim today');

    // 5. 旧キー（acai_game_coupon_claimed_date）の後方互換性テスト
    const storageLegacy = createMockStorage({
        'acai_game_coupon_claimed_date': '2026-08-17'
    });
    assert.strictEqual(CouponManager.canClaimToday('acai', today, storageLegacy), false, 'Legacy key claimed today blocks claim');

    // 6. getStatus
    const status = CouponManager.getStatus('acai', today, storage1);
    assert.strictEqual(status.today, '2026-08-17');
    assert.strictEqual(status.lastClaimed, '2026-08-17');
    assert.strictEqual(status.isClaimedToday, true);

    // 7. getCouponUrl
    assert.strictEqual(CouponManager.getCouponUrl('acai'), '../../common/coupon.html?game=acai');
    assert.strictEqual(CouponManager.getCouponUrl('acai', { time: '5.42' }), '../../common/coupon.html?game=acai&time=5.42');
    assert.strictEqual(CouponManager.getCouponUrl('bbq', { record: '15本' }), '../../common/coupon.html?game=bbq&record=15%E6%9C%AC');

    // 8. getGameConfig
    const acaiConfig = CouponManager.getGameConfig('acai');
    assert.strictEqual(acaiConfig.name, '映えアサイー職人');
    assert.strictEqual(acaiConfig.codePrefix, 'ACAI');
    assert.strictEqual(acaiConfig.theme, 'acai');
    assert.strictEqual(acaiConfig.image, 'images/acai_ice.png');

    const acaiTowerConfig = CouponManager.getGameConfig('acai-tower');
    assert.strictEqual(acaiTowerConfig.name, '30秒アサイータワー・スタック');
    assert.strictEqual(acaiTowerConfig.codePrefix, 'TOWER');
    assert.strictEqual(acaiTowerConfig.theme, 'acai');
    assert.strictEqual(acaiTowerConfig.image, 'images/acai_ice.png');

    const suikaConfig = CouponManager.getGameConfig('watermelon');
    assert.strictEqual(suikaConfig.name, 'スイカ割りタイミングゲーム');
    assert.strictEqual(suikaConfig.codePrefix, 'SUIKA');
    assert.strictEqual(suikaConfig.theme, 'watermelon');
    assert.strictEqual(suikaConfig.icon, '🍉');
    assert.strictEqual(suikaConfig.benefit, 'バニラアイストッピング追加 または 100円引き');
    assert.strictEqual(suikaConfig.image, 'images/watermelon_coupon.jpg');

    const bbqConfig = CouponManager.getGameConfig('bbq');
    assert.strictEqual(bbqConfig.name, '爆速BBQ串メーカー');
    assert.strictEqual(bbqConfig.codePrefix, 'BBQ');
    assert.strictEqual(bbqConfig.theme, 'bbq');
    assert.strictEqual(bbqConfig.icon, '🍖');
    assert.strictEqual(bbqConfig.benefit, 'バニラアイストッピング追加 または 100円引き');
    assert.strictEqual(bbqConfig.image, 'images/bbq_coupon.jpg');

    const frankfurtConfig = CouponManager.getGameConfig('frankfurt');
    assert.strictEqual(frankfurtConfig.name, '最後の一本フランクフルト');
    assert.strictEqual(frankfurtConfig.codePrefix, 'FRANK');
    assert.strictEqual(frankfurtConfig.theme, 'frankfurt');
    assert.strictEqual(frankfurtConfig.icon, '🌭');
    assert.strictEqual(frankfurtConfig.benefit, 'バニラアイストッピング追加 または 100円引き');
    assert.strictEqual(frankfurtConfig.image, 'images/frankfurt_coupon.jpg');
    assert.strictEqual(frankfurtConfig.backUrl, '../apps/frankfurt-game/index.html');

    const unknownConfig = CouponManager.getGameConfig('unknown');
    assert.strictEqual(unknownConfig.codePrefix, 'GIFT');

    // 9. 例外をスローするストレージ（Safariプライベートブラウズやクォータ超過等）のテスト
    const throwingStorage = {
        getItem: () => { throw new Error("SecurityError: Access is denied"); },
        setItem: () => { throw new Error("QuotaExceededError"); }
    };
    assert.strictEqual(CouponManager.getClaimedDate('acai', throwingStorage), null, 'Throwing storage should return null without crash');
    assert.strictEqual(CouponManager.canClaimToday('acai', today, throwingStorage), true, 'Throwing storage can claim by default');
    assert.strictEqual(CouponManager.claimCoupon('acai', today, throwingStorage), false, 'Throwing storage claim returns false safely');

    console.log("CouponManager all tests passed!");
} catch (e) {
    console.error("CouponManager test failed:", e.message);
    process.exit(1);
}
