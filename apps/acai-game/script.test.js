const assert = require('assert');
const { GameLogic } = require('./script.js');

try {
    const availableTypes = ['strawberry', 'banana', 'blueberry', 'mango'];
    
    // Test: generateReference
    const ref = GameLogic.generateReference(4, availableTypes);
    assert.strictEqual(ref.length, 4, 'Reference should have 4 items');
    ref.forEach(item => {
        assert.ok(availableTypes.includes(item), `Item ${item} must be valid`);
    });

    // Test: calculateScore
    const refArray = ['strawberry', 'banana', 'mango', 'blueberry'];
    
    // Perfect match
    assert.strictEqual(GameLogic.calculateScore(refArray, ['strawberry', 'banana', 'mango', 'blueberry']), 4);
    
    // Partial match (2 correct)
    assert.strictEqual(GameLogic.calculateScore(refArray, ['strawberry', 'banana', 'blueberry', 'mango']), 2);
    
    // No match
    assert.strictEqual(GameLogic.calculateScore(refArray, ['mango', 'blueberry', 'strawberry', 'banana']), 0);

    // Test: isEligibleForCoupon (7秒以内かつ全問正解)
    assert.strictEqual(GameLogic.isEligibleForCoupon(4, 5.0), true, '4 points in 5.0s is eligible');
    assert.strictEqual(GameLogic.isEligibleForCoupon(4, 7.0), true, '4 points in 7.0s is eligible');
    assert.strictEqual(GameLogic.isEligibleForCoupon(4, 7.01), false, '4 points in 7.01s is not eligible');
    assert.strictEqual(GameLogic.isEligibleForCoupon(4, 10.0), false, '4 points in 10.0s is not eligible');
    assert.strictEqual(GameLogic.isEligibleForCoupon(3, 5.0), false, '3 points in 5.0s is not eligible');
    assert.strictEqual(GameLogic.isEligibleForCoupon(0, 3.0), false, '0 points in 3.0s is not eligible');

    // Test: getTodayDateString
    const fixedDate = new Date(2026, 7, 17); // 2026-08-17 (Month is 0-indexed: 7 is August)
    assert.strictEqual(GameLogic.getTodayDateString(fixedDate), '2026-08-17');

    // Test: canClaimCouponToday (1日1回制限)
    assert.strictEqual(GameLogic.canClaimCouponToday(null, '2026-08-17'), true, 'Never claimed before is allowed');
    assert.strictEqual(GameLogic.canClaimCouponToday('2026-08-16', '2026-08-17'), true, 'Claimed yesterday is allowed');
    assert.strictEqual(GameLogic.canClaimCouponToday('2026-08-17', '2026-08-17'), false, 'Already claimed today is not allowed');

    console.log("All tests passed!");
} catch (e) {
    console.error("Test failed:", e.message);
    process.exit(1);
}
