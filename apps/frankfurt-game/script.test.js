/**
 * 最後の一本フランクフルト（Frankfurt Grab）
 * GameLogic 単体テストスイート
 */

const assert = require('assert');
const { GameLogic } = require('./script.js');

console.log('=== Running Frankfurt Grab GameLogic Tests ===\n');

// 1. GAME_CONFIG 定数およびライバル設定の検証
console.log('Test 1: GAME_CONFIG 定数およびライバル設定');
assert.strictEqual(GameLogic.GAME_CONFIG.maxAttempts, 3, '挑戦回数は3回であること');
assert.strictEqual(GameLogic.GAME_CONFIG.targetThresholdMs, 480, 'クーポン獲得基準は480ms以下であること');
assert.strictEqual(GameLogic.GAME_CONFIG.foulPenaltyMs, 9999, 'お手つきペナルティは9999msであること');
assert.strictEqual(Array.isArray(GameLogic.GAME_CONFIG.rivals), true, 'rivals は配列であること');
assert.strictEqual(GameLogic.GAME_CONFIG.rivals.length, 3, 'ライバルは3名定義されていること');
assert.strictEqual(GameLogic.GAME_CONFIG.rivals[0].name, '腹ペコ店長');
assert.strictEqual(GameLogic.GAME_CONFIG.rivals[0].reactionTimeMs, 300, 'R1 腹ペコ店長の反応速度は300ms（難）');
assert.strictEqual(GameLogic.GAME_CONFIG.rivals[1].name, '海の男');
assert.strictEqual(GameLogic.GAME_CONFIG.rivals[1].reactionTimeMs, 380, 'R2 海の男の反応速度は380ms（中）');
assert.strictEqual(GameLogic.GAME_CONFIG.rivals[2].name, 'のんびり客');
assert.strictEqual(GameLogic.GAME_CONFIG.rivals[2].reactionTimeMs, 480, 'R3 のんびり客の反応速度は480ms（易）');
console.log('  ✔ GAME_CONFIG passed\n');

// 2. 待機時間の計算範囲検証
console.log('Test 2: calculateWaitTime の範囲検証');
const waitMin = GameLogic.calculateWaitTime(1500, 3500, () => 0.0);
const waitMid = GameLogic.calculateWaitTime(1500, 3500, () => 0.5);
const waitMax = GameLogic.calculateWaitTime(1500, 3500, () => 0.999);
assert.strictEqual(waitMin >= 1500 && waitMin <= 3500, true, '最小値が1500以上であること');
assert.strictEqual(waitMid, 2500, '中央値が2500であること');
assert.strictEqual(waitMax >= 1500 && waitMax <= 3500, true, '最大値が3500以下であること');
console.log('  ✔ calculateWaitTime passed\n');

// 3. 反応時間計算の検証
console.log('Test 3: calculateReactionTime の検証');
assert.strictEqual(GameLogic.calculateReactionTime(1000, 1250), 250, '差分が250msと算出されること');
assert.strictEqual(GameLogic.calculateReactionTime(1000, 900), 9999, '合図前タップは9999msのFOUL扱いになること');
console.log('  ✔ calculateReactionTime passed\n');

// 4. ラウンド勝敗判定の検証
console.log('Test 4: evaluateRound の検証');
// プレイヤーがライバルより早い
const winRound = GameLogic.evaluateRound(240, 380, false);
assert.strictEqual(winRound.result, 'WIN', 'ライバルより早ければWIN');
assert.strictEqual(winRound.winner, 'player');

// プレイヤーがライバルより遅い
const loseRound = GameLogic.evaluateRound(400, 380, false);
assert.strictEqual(loseRound.result, 'LOSE', 'ライバルより遅ければLOSE');
assert.strictEqual(loseRound.winner, 'rival');

// お手つき
const foulRound = GameLogic.evaluateRound(9999, 380, true);
assert.strictEqual(foulRound.result, 'FOUL', 'お手つき時はFOUL');
assert.strictEqual(foulRound.timeMs, 9999);
console.log('  ✔ evaluateRound passed\n');

// 5. ベストタイム算出の検証
console.log('Test 5: calculateBestTime の検証');
assert.strictEqual(GameLogic.calculateBestTime([450, 320, 290]), 290, '最小値290がベストタイム');
assert.strictEqual(GameLogic.calculateBestTime([9999, 380, 420]), 380, 'FOUL混在でも有効最小値が選ばれること');
assert.strictEqual(GameLogic.calculateBestTime([9999, 9999, 9999]), 9999, '全FOUL時は9999');
assert.strictEqual(GameLogic.calculateBestTime([]), 9999, '空配列時は9999');
console.log('  ✔ calculateBestTime passed\n');

// 6. ランク判定およびクーポン資格の検証
console.log('Test 6: getRank および isEligibleForCoupon の検証');
const rankS = GameLogic.getRank(220);
assert.strictEqual(rankS.rank, 'S', '250ms未満はSランク');
assert.strictEqual(rankS.eligible, true, 'Sランクはクーポン対象');

const rankA = GameLogic.getRank(310);
assert.strictEqual(rankA.rank, 'A', '250〜350msはAランク');
assert.strictEqual(rankA.eligible, true, 'Aランクはクーポン対象');

const rankB = GameLogic.getRank(420);
assert.strictEqual(rankB.rank, 'B', '351〜480msはBランク');
assert.strictEqual(rankB.eligible, true, 'Bランクもクーポン対象（1勝達成）');

const rankC = GameLogic.getRank(510);
assert.strictEqual(rankC.rank, 'C', '481ms以上はCランク');
assert.strictEqual(rankC.eligible, false, 'Cランクはクーポン対象外');

assert.strictEqual(GameLogic.isEligibleForCoupon(480), true, '境界値480msはクーポン対象');
assert.strictEqual(GameLogic.isEligibleForCoupon(481), false, '境界値481msはクーポン対象外');
console.log('  ✔ getRank & isEligibleForCoupon passed\n');

console.log('🎉 All Frankfurt Grab unit tests passed successfully!');
