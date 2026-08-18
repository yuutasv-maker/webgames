const assert = require('assert');
const { GameLogic } = require('./script.js');

const gaugeWidth = 200;
const centerPos = 100;

try {
    // Test CRITICAL (<= 0.04)
    let result = GameLogic.calculateScore(102, centerPos, gaugeWidth);
    assert.strictEqual(result.rank, 'CRITICAL', '2px off (0.02) should be CRITICAL');
    assert.strictEqual(result.score, 1000, 'CRITICAL should give max score 1000');
    assert.strictEqual(GameLogic.isEligibleForCoupon(result.rank), true, 'CRITICAL must be eligible for coupon');
    assert.match(result.message, /アイストッピング or 100円引き/, 'CRITICAL should contain coupon reward');

    // Test CRITICAL boundary (0.04)
    result = GameLogic.calculateScore(104, centerPos, gaugeWidth);
    assert.strictEqual(result.rank, 'CRITICAL', '4px off (0.04) should be CRITICAL');

    // Test PERFECT (> 0.04 and <= 0.15)
    result = GameLogic.calculateScore(108, centerPos, gaugeWidth);
    assert.strictEqual(result.rank, 'PERFECT', '8px off (0.08) should be PERFECT');
    assert.strictEqual(GameLogic.isEligibleForCoupon(result.rank), false, 'PERFECT must not be eligible for coupon');
    assert.doesNotMatch(result.message, /100円引きGET/, 'PERFECT should not have coupon reward');
    assert.match(result.message, /ナイススマッシュ/, 'PERFECT message check');

    // Test PERFECT threshold
    result = GameLogic.calculateScore(115, centerPos, gaugeWidth);
    assert.strictEqual(result.rank, 'PERFECT', '15px off (0.15) should be PERFECT');

    // Test GREAT (<= 0.30)
    result = GameLogic.calculateScore(120, centerPos, gaugeWidth);
    assert.strictEqual(result.rank, 'GREAT', '20px off (0.20) should be GREAT');
    assert.doesNotMatch(result.message, /無料券GET/, 'GREAT should not have coupon reward');
    assert.match(result.message, /いい感じ！/, 'GREAT message check');

    // Test GOOD (<= 0.40)
    result = GameLogic.calculateScore(135, centerPos, gaugeWidth);
    assert.strictEqual(result.rank, 'GOOD', '35px off (0.35) should be GOOD');

    // Test MISS (> 0.40)
    result = GameLogic.calculateScore(150, centerPos, gaugeWidth);
    assert.strictEqual(result.rank, 'MISS', '50px off (0.50) should be MISS');

    console.log("All tests passed!");
} catch (e) {
    console.error("Test failed:", e.message);
    process.exit(1);
}
