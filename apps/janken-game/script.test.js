const assert = require('assert');
const { GameLogic } = require('./script.js');

try {
    console.log("Testing Janken Rush GameLogic...");

    // 1. getExpectedHand の検証 (全9通りの正解マッピング)
    // 相手が✊
    assert.strictEqual(GameLogic.getExpectedHand('rock', 'win'), 'paper');
    assert.strictEqual(GameLogic.getExpectedHand('rock', 'lose'), 'scissors');
    assert.strictEqual(GameLogic.getExpectedHand('rock', 'draw'), 'rock');

    // 相手が✌️
    assert.strictEqual(GameLogic.getExpectedHand('scissors', 'win'), 'rock');
    assert.strictEqual(GameLogic.getExpectedHand('scissors', 'lose'), 'paper');
    assert.strictEqual(GameLogic.getExpectedHand('scissors', 'draw'), 'scissors');

    // 相手が🖐️
    assert.strictEqual(GameLogic.getExpectedHand('paper', 'win'), 'scissors');
    assert.strictEqual(GameLogic.getExpectedHand('paper', 'lose'), 'rock');
    assert.strictEqual(GameLogic.getExpectedHand('paper', 'draw'), 'paper');

    // 2. evaluateHand の全27パターン検証
    const hands = ['rock', 'scissors', 'paper'];
    const instructions = ['win', 'lose', 'draw'];

    hands.forEach(opponent => {
        instructions.forEach(inst => {
            const expected = GameLogic.getExpectedHand(opponent, inst);
            hands.forEach(player => {
                const result = GameLogic.evaluateHand(opponent, inst, player);
                if (player === expected) {
                    assert.strictEqual(result, true, `Player ${player} should be correct for ${opponent} + ${inst}`);
                } else {
                    assert.strictEqual(result, false, `Player ${player} should be incorrect for ${opponent} + ${inst}`);
                }
            });
        });
    });

    // 3. クーポン判定テスト (3回クリアでOK)
    assert.strictEqual(GameLogic.isEligibleForCoupon(3, 5.0), true, '3 clears in 5.0s is eligible');
    assert.strictEqual(GameLogic.isEligibleForCoupon(3, 8.5), true, '3 clears in 8.5s is eligible');
    assert.strictEqual(GameLogic.isEligibleForCoupon(2, 4.0), false, '2 clears is NOT eligible');
    assert.strictEqual(GameLogic.isEligibleForCoupon(3, -1), false, 'invalid time is NOT eligible');

    // 4. ランク判定テスト
    assert.strictEqual(GameLogic.getRank(3, 4.0).rank, 'S');
    assert.strictEqual(GameLogic.getRank(3, 6.5).rank, 'A');
    assert.strictEqual(GameLogic.getRank(2, 4.0).rank, 'C');

    console.log("All Janken Rush tests passed successfully!");
} catch (e) {
    console.error("Test failed:", e.message);
    process.exit(1);
}
