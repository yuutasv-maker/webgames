/**
 * 最後の一本フランクフルト（Frankfurt Grab）- Versus モード
 * VersusLogic 単体テストスイート
 */

const assert = require('assert');
const { VersusLogic } = require('./versus.js');

console.log('=== Running Frankfurt Grab VersusLogic Tests ===\n');

// 1. CONFIG 定数の検証
console.log('Test 1: CONFIG 定数の検証');
assert.strictEqual(VersusLogic.CONFIG.maxPoints, 3, '勝利条件は3本先取');
assert.strictEqual(VersusLogic.CONFIG.minWaitTimeMs, 1500, '最小待機時間は1500ms');
assert.strictEqual(VersusLogic.CONFIG.maxWaitTimeMs, 3800, '最大待機時間は3800ms');
assert.strictEqual(VersusLogic.CONFIG.foulPenaltyMs, 9999, 'お手つきペナルティは9999ms');
assert.strictEqual(VersusLogic.CONFIG.drawThresholdMs, 5, '同着判定閾値は5ms未満');
console.log('  ✔ CONFIG passed\n');

// 2. 待機時間の計算範囲検証
console.log('Test 2: calculateWaitTime の範囲検証');
const waitMin = VersusLogic.calculateWaitTime(1500, 3800, () => 0.0);
const waitMid = VersusLogic.calculateWaitTime(1500, 3800, () => 0.5);
const waitMax = VersusLogic.calculateWaitTime(1500, 3800, () => 0.999);
assert.strictEqual(waitMin >= 1500 && waitMin <= 3800, true, '最小値が1500以上であること');
assert.strictEqual(waitMid, 2650, '中央値が2650であること');
assert.strictEqual(waitMax >= 1500 && waitMax <= 3800, true, '最大値が3800以下であること');
console.log('  ✔ calculateWaitTime passed\n');

// 3. 反応時間計算の検証
console.log('Test 3: calculateReactionTime の検証');
assert.strictEqual(VersusLogic.calculateReactionTime(1000, 1220), 220, '差分が220msと算出されること');
assert.strictEqual(VersusLogic.calculateReactionTime(1000, 950), 9999, '合図前タップは9999msのFOUL扱いになること');
console.log('  ✔ calculateReactionTime passed\n');

// 4. ラウンド判定の検証 (通常勝利)
console.log('Test 4: evaluateRound 通常勝利の検証');
const p1Fast = VersusLogic.evaluateRound({ p1Time: 230, p2Time: 280, p1Foul: false, p2Foul: false });
assert.strictEqual(p1Fast.winner, 'p1', 'P1が速い場合はP1勝利');
assert.strictEqual(p1Fast.p1Point, 1, 'P1に1ポイント');
assert.strictEqual(p1Fast.p2Point, 0, 'P2は0ポイント');
assert.strictEqual(p1Fast.diffMs, 50, '差分は50ms');

const p2Fast = VersusLogic.evaluateRound({ p1Time: 310, p2Time: 260, p1Foul: false, p2Foul: false });
assert.strictEqual(p2Fast.winner, 'p2', 'P2が速い場合はP2勝利');
assert.strictEqual(p2Fast.p1Point, 0, 'P1は0ポイント');
assert.strictEqual(p2Fast.p2Point, 1, 'P2に1ポイント');
assert.strictEqual(p2Fast.diffMs, 50, '差分は50ms');
console.log('  ✔ 通常勝利 passed\n');

// 5. ラウンド判定の検証 (同着判定)
console.log('Test 5: evaluateRound 同着(DRAW)の検証');
const drawRound = VersusLogic.evaluateRound({ p1Time: 250, p2Time: 253, p1Foul: false, p2Foul: false });
assert.strictEqual(drawRound.winner, 'draw', '差が5ms未満なら引き分け');
assert.strictEqual(drawRound.p1Point, 0, 'ポイントなし');
assert.strictEqual(drawRound.p2Point, 0, 'ポイントなし');
assert.strictEqual(drawRound.reason, 'simultaneous');
console.log('  ✔ 同着判定 passed\n');

// 6. ラウンド判定の検証 (お手つき・警告システム)
console.log('Test 6: evaluateRound お手つき(FOUL・警告制)の検証');
// 1回目のお手つき: 警告のみで得点変動なし（仕切り直し）
const p1FirstFoul = VersusLogic.evaluateRound({ p1Time: 9999, p2Time: 300, p1Foul: true, p2Foul: false, p1Warnings: 0, p2Warnings: 0 });
assert.strictEqual(p1FirstFoul.winner, 'none', '1回目のお手つきは勝敗なし（仕切り直し）');
assert.strictEqual(p1FirstFoul.p1Point, 0, 'P1は0ポイント');
assert.strictEqual(p1FirstFoul.p2Point, 0, 'P2へのポイント献上なし');
assert.strictEqual(p1FirstFoul.p1AddWarning, 1, 'P1に警告+1');
assert.strictEqual(p1FirstFoul.reason, 'p1_warning');

const p2FirstFoul = VersusLogic.evaluateRound({ p1Time: 250, p2Time: 9999, p1Foul: false, p2Foul: true, p1Warnings: 0, p2Warnings: 0 });
assert.strictEqual(p2FirstFoul.winner, 'none', '1回目のお手つきは勝敗なし（仕切り直し）');
assert.strictEqual(p2FirstFoul.p1Point, 0);
assert.strictEqual(p2FirstFoul.p2Point, 0);
assert.strictEqual(p2FirstFoul.p2AddWarning, 1, 'P2に警告+1');
assert.strictEqual(p2FirstFoul.reason, 'p2_warning');

// 2回目のお手つき: 警告保持中に再ファウルで相手に1本
const p1SecondFoul = VersusLogic.evaluateRound({ p1Time: 9999, p2Time: 300, p1Foul: true, p2Foul: false, p1Warnings: 1, p2Warnings: 0 });
assert.strictEqual(p1SecondFoul.winner, 'p2', '警告保持中の再お手つきで相手が勝利');
assert.strictEqual(p1SecondFoul.p1Point, 0);
assert.strictEqual(p1SecondFoul.p2Point, 1, '相手に1ポイント献上');
assert.strictEqual(p1SecondFoul.p1AddWarning, -1, '警告は消化リセット');
assert.strictEqual(p1SecondFoul.reason, 'p1_foul_penalty');

const bothFoul = VersusLogic.evaluateRound({ p1Time: 9999, p2Time: 9999, p1Foul: true, p2Foul: true, p1Warnings: 0, p2Warnings: 0 });
assert.strictEqual(bothFoul.winner, 'draw', '両者お手つき時は引き分け');
assert.strictEqual(bothFoul.p1Point, 0);
assert.strictEqual(bothFoul.p2Point, 0);
assert.strictEqual(bothFoul.reason, 'both_foul');
console.log('  ✔ お手つき警告判定 passed\n');

// 7. スコア更新とマッチ勝者判定の検証
console.log('Test 7: updateScore および checkMatchWinner の検証');
let scores = { p1: 0, p2: 0 };
assert.strictEqual(VersusLogic.checkMatchWinner(scores), null, '初期スコアは勝者なし');

scores = VersusLogic.updateScore(scores, p1Fast);
assert.strictEqual(scores.p1, 1);
assert.strictEqual(scores.p2, 0);
assert.strictEqual(VersusLogic.checkMatchWinner(scores), null, '1点ではまだ勝者なし');

scores = VersusLogic.updateScore(scores, p1Fast);
scores = VersusLogic.updateScore(scores, p1Fast);
assert.strictEqual(scores.p1, 3);
assert.strictEqual(VersusLogic.checkMatchWinner(scores), 'p1', '3本先取でP1がマッチ勝者');

const p2Scores = { p1: 2, p2: 3 };
assert.strictEqual(VersusLogic.checkMatchWinner(p2Scores), 'p2', 'P2が3本ならP2がマッチ勝者');
// 8. 警告更新の検証
console.log('Test 8: updateWarnings の検証');
let warnings = { p1: 0, p2: 0 };
warnings = VersusLogic.updateWarnings(warnings, p1FirstFoul);
assert.strictEqual(warnings.p1, 1, 'P1の警告が1に加算');
assert.strictEqual(warnings.p2, 0);

warnings = VersusLogic.updateWarnings(warnings, p1SecondFoul);
assert.strictEqual(warnings.p1, 0, '2回目ファウル後に警告リセット');
console.log('  ✔ updateWarnings passed\n');

console.log('🎉 All VersusLogic unit tests passed successfully!');
