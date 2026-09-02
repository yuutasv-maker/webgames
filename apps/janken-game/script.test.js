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

    // 3. クーポン判定テスト (10問クリア かつ 12秒以内)
    assert.strictEqual(GameLogic.isEligibleForCoupon(10, 9.5), true, '10 clears in 9.5s is eligible');
    assert.strictEqual(GameLogic.isEligibleForCoupon(10, 12.0), true, '10 clears in 12.0s is eligible');
    assert.strictEqual(GameLogic.isEligibleForCoupon(10, 12.1), false, '10 clears in 12.1s is NOT eligible');
    assert.strictEqual(GameLogic.isEligibleForCoupon(9, 8.0), false, '9 clears is NOT eligible even if fast');
    assert.strictEqual(GameLogic.isEligibleForCoupon(10, -1), false, 'invalid time is NOT eligible');

    // 4. ランク判定テスト
    assert.strictEqual(GameLogic.getRank(10, 7.0).rank, 'S');
    assert.strictEqual(GameLogic.getRank(10, 11.5).rank, 'A');
    assert.strictEqual(GameLogic.getRank(10, 15.0).rank, 'B');
    assert.strictEqual(GameLogic.getRank(8, 10.0).rank, 'C');

    console.log("All Janken Rush tests passed successfully!");
} catch (e) {
    console.error("Test failed:", e.message);
    process.exit(1);
}
