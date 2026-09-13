/**
 * 脳バグ！後出しじゃんけん - Versus モード
 * JankenVersusLogic 単体テストスイート
 */

const assert = require('assert');
const { JankenVersusLogic } = require('./versus.js');

console.log('=== Running Janken Rush VersusLogic Tests ===\n');

// 1. CONFIG 定数の検証
console.log('Test 1: CONFIG 定数の検証');
assert.strictEqual(JankenVersusLogic.CONFIG.maxPoints, 3, '勝利条件は3問先取');
assert.strictEqual(JankenVersusLogic.CONFIG.roundTimeSec, 5.0, '1問あたり制限時間は5秒');
console.log('  ✔ CONFIG passed\n');

// 2. getExpectedHand の全9通り検証
console.log('Test 2: getExpectedHand の検証');
// 相手が✊
assert.strictEqual(JankenVersusLogic.getExpectedHand('rock', 'win'), 'paper');
assert.strictEqual(JankenVersusLogic.getExpectedHand('rock', 'lose'), 'scissors');
assert.strictEqual(JankenVersusLogic.getExpectedHand('rock', 'draw'), 'rock');
// 相手が✌️
assert.strictEqual(JankenVersusLogic.getExpectedHand('scissors', 'win'), 'rock');
assert.strictEqual(JankenVersusLogic.getExpectedHand('scissors', 'lose'), 'paper');
assert.strictEqual(JankenVersusLogic.getExpectedHand('scissors', 'draw'), 'scissors');
// 相手が🖐️
assert.strictEqual(JankenVersusLogic.getExpectedHand('paper', 'win'), 'scissors');
assert.strictEqual(JankenVersusLogic.getExpectedHand('paper', 'lose'), 'rock');
assert.strictEqual(JankenVersusLogic.getExpectedHand('paper', 'draw'), 'paper');
console.log('  ✔ getExpectedHand passed\n');

// 3. evaluatePlayerAnswer の検証（正誤判定）
console.log('Test 3: evaluatePlayerAnswer の検証');
assert.strictEqual(JankenVersusLogic.evaluatePlayerAnswer('rock', 'win', 'paper'), true, 'グーに勝て！でパーは正解');
assert.strictEqual(JankenVersusLogic.evaluatePlayerAnswer('rock', 'win', 'rock'), false, 'グーに勝て！でグーは不正解');
assert.strictEqual(JankenVersusLogic.evaluatePlayerAnswer('scissors', 'lose', 'paper'), true, 'チョキに負けろ！でパーは正解');
assert.strictEqual(JankenVersusLogic.evaluatePlayerAnswer('scissors', 'lose', 'rock'), false, 'チョキに負けろ！でグーは不正解');
console.log('  ✔ evaluatePlayerAnswer passed\n');

// 4. evaluateAction の検証（早押し即決着：仕切り直しなし）
console.log('Test 4: evaluateAction の検証（正解＝自分に1点、誤答＝相手に1点）');
// P1が正解
const p1Correct = JankenVersusLogic.evaluateAction('p1', 'rock', 'win', 'paper');
assert.strictEqual(p1Correct.winner, 'p1');
assert.strictEqual(p1Correct.p1Point, 1);
assert.strictEqual(p1Correct.p2Point, 0);
assert.strictEqual(p1Correct.isCorrect, true);

// P1が誤答（相手P2に1点）
const p1Wrong = JankenVersusLogic.evaluateAction('p1', 'rock', 'win', 'rock');
assert.strictEqual(p1Wrong.winner, 'p2', 'P1誤答時は即座にP2に1点');
assert.strictEqual(p1Wrong.p1Point, 0);
assert.strictEqual(p1Wrong.p2Point, 1);
assert.strictEqual(p1Wrong.isCorrect, false);

// P2が正解
const p2Correct = JankenVersusLogic.evaluateAction('p2', 'paper', 'lose', 'rock');
assert.strictEqual(p2Correct.winner, 'p2');
assert.strictEqual(p2Correct.p1Point, 0);
assert.strictEqual(p2Correct.p2Point, 1);
assert.strictEqual(p2Correct.isCorrect, true);

// P2が誤答（相手P1に1点）
const p2Wrong = JankenVersusLogic.evaluateAction('p2', 'paper', 'lose', 'scissors');
assert.strictEqual(p2Wrong.winner, 'p1', 'P2誤答時は即座にP1に1点');
assert.strictEqual(p2Wrong.p1Point, 1);
assert.strictEqual(p2Wrong.p2Point, 0);
assert.strictEqual(p2Wrong.isCorrect, false);
console.log('  ✔ evaluateAction passed\n');

// 5. スコア更新とマッチ勝者判定の検証
console.log('Test 5: updateScore および checkMatchWinner の検証');
let scores = { p1: 0, p2: 0 };
assert.strictEqual(JankenVersusLogic.checkMatchWinner(scores), null);

scores = JankenVersusLogic.updateScore(scores, p1Correct);
assert.strictEqual(scores.p1, 1);
assert.strictEqual(scores.p2, 0);

scores = JankenVersusLogic.updateScore(scores, p1Correct);
scores = JankenVersusLogic.updateScore(scores, p1Correct);
assert.strictEqual(scores.p1, 3);
assert.strictEqual(JankenVersusLogic.checkMatchWinner(scores), 'p1', '3問先取でP1の勝利');

const p2WinScores = { p1: 2, p2: 3 };
assert.strictEqual(JankenVersusLogic.checkMatchWinner(p2WinScores), 'p2', 'P2が3問でP2の勝利');
console.log('  ✔ スコア＆マッチ終了判定 passed\n');

console.log('🎉 All Janken Rush VersusLogic unit tests passed successfully!');
