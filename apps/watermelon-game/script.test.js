const assert = require('assert');
const { GameLogic } = require('./script.js');

const gaugeWidth = 200;
const centerPos = 100;

try {
    // Test PERFECT
    let result = GameLogic.calculateScore(108, centerPos, gaugeWidth);
    assert.strictEqual(result.rank, 'PERFECT', '8px off (0.08) should be PERFECT');

    // Test PERFECT threshold
    result = GameLogic.calculateScore(115, centerPos, gaugeWidth);
    assert.strictEqual(result.rank, 'PERFECT', '15px off (0.15) should be PERFECT');

    // Test GREAT
    result = GameLogic.calculateScore(120, centerPos, gaugeWidth);
    assert.strictEqual(result.rank, 'GREAT', '20px off (0.20) should be GREAT');

    // Test GOOD
    result = GameLogic.calculateScore(135, centerPos, gaugeWidth);
    assert.strictEqual(result.rank, 'GOOD', '35px off (0.35) should be GOOD');

    // Test MISS
    result = GameLogic.calculateScore(150, centerPos, gaugeWidth);
    assert.strictEqual(result.rank, 'MISS', '50px off (0.50) should be MISS');

    console.log("All tests passed!");
} catch (e) {
    console.error("Test failed:", e.message);
    process.exit(1);
}
