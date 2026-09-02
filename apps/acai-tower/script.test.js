const assert = require('assert');
const { GameLogic } = require('./script.js');

try {
    console.log("=== Running Acai Tower Stack GameLogic Tests ===");

    // 1. アイテム定義テスト
    assert.ok(GameLogic.ITEMS, 'GameLogic.ITEMS should be defined');
    assert.ok(GameLogic.ITEMS.strawberry, 'Strawberry item should exist');
    assert.strictEqual(GameLogic.ITEMS.strawberry.score, 100);
    assert.strictEqual(GameLogic.ITEMS.honey.score, 150);
    assert.strictEqual(GameLogic.ITEMS.honey.isFever, true);
    assert.strictEqual(GameLogic.ITEMS.crab.isHazard, true);

    // 2. アイテム抽選テスト (getRandomItem)
    const itemsSample = [];
    for (let i = 0; i < 100; i++) {
        const item = GameLogic.getRandomItem(() => Math.random());
        assert.ok(item && item.type, 'Item must have a type');
        itemsSample.push(item.type);
    }
    assert.ok(itemsSample.includes('strawberry'), 'Should generate strawberry');

    // 3. キャッチ精度判定テスト (evaluateCatch)
    // targetWidth = 100 (半幅 = 50)
    // PERFECT (diffRatio <= 0.25 -> diff <= 12.5)
    let evalResult = GameLogic.evaluateCatch(105, 100, 100); // 5px off (0.1)
    assert.strictEqual(evalResult.accuracy, 'PERFECT');
    assert.strictEqual(evalResult.accuracyMultiplier, 1.5);

    // GREAT (diffRatio <= 0.60 -> diff <= 30)
    evalResult = GameLogic.evaluateCatch(120, 100, 100); // 20px off (0.4)
    assert.strictEqual(evalResult.accuracy, 'GREAT');
    assert.strictEqual(evalResult.accuracyMultiplier, 1.0);

    // GOOD (diffRatio <= 1.00 -> diff <= 50)
    evalResult = GameLogic.evaluateCatch(145, 100, 100); // 45px off (0.9)
    assert.strictEqual(evalResult.accuracy, 'GOOD');
    assert.strictEqual(evalResult.accuracyMultiplier, 0.8);

    // MISS (diffRatio > 1.00 -> diff > 50)
    evalResult = GameLogic.evaluateCatch(155, 100, 100); // 55px off (1.1)
    assert.strictEqual(evalResult.accuracy, 'MISS');
    assert.strictEqual(evalResult.accuracyMultiplier, 0);

    // 4. コンボ倍率テスト (calculateComboMultiplier)
    assert.strictEqual(GameLogic.calculateComboMultiplier(0), 1.0);
    assert.strictEqual(GameLogic.calculateComboMultiplier(4), 1.0);
    assert.strictEqual(GameLogic.calculateComboMultiplier(5), 1.2);
    assert.strictEqual(GameLogic.calculateComboMultiplier(9), 1.2);
    assert.strictEqual(GameLogic.calculateComboMultiplier(10), 1.5);
    assert.strictEqual(GameLogic.calculateComboMultiplier(14), 1.5);
    assert.strictEqual(GameLogic.calculateComboMultiplier(15), 2.0);
    assert.strictEqual(GameLogic.calculateComboMultiplier(30), 2.0);

    // 5. スコア計算テスト (calculateItemScore)
    // 基礎点100, PERFECT(1.5), Combo 5(1.2), 通常 -> 100 * 1.5 * 1.2 = 180
    assert.strictEqual(GameLogic.calculateItemScore(GameLogic.ITEMS.strawberry, 1.5, 1.2, false), 180);
    // フィーバー時 (1.5倍) -> 180 * 1.5 = 270
    assert.strictEqual(GameLogic.calculateItemScore(GameLogic.ITEMS.strawberry, 1.5, 1.2, true), 270);
    // カニ接触時 (ペナルティ -200)
    assert.strictEqual(GameLogic.calculateItemScore(GameLogic.ITEMS.crab, 1.0, 1.0, false), -200);

    // 6. スタック管理テスト (updateStack)
    let stack = [];
    stack = GameLogic.updateStack(stack, GameLogic.ITEMS.strawberry, 5);
    assert.strictEqual(stack.length, 1);
    assert.strictEqual(stack[0].type, 'strawberry');
    assert.strictEqual(stack[0].offsetX, 5);

    stack = GameLogic.updateStack(stack, GameLogic.ITEMS.banana, -3);
    assert.strictEqual(stack.length, 2);

    // カニでお邪魔処理（最上段が崩れる）
    stack = GameLogic.updateStack(stack, GameLogic.ITEMS.crab, 0);
    assert.strictEqual(stack.length, 1, 'Crab should remove the top item of the stack');
    assert.strictEqual(stack[0].type, 'strawberry');

    // 空スタック時のカニ接触テスト（例外が発生せず空配列が維持されること）
    let emptyStack = [];
    emptyStack = GameLogic.updateStack(emptyStack, GameLogic.ITEMS.crab, 0);
    assert.strictEqual(emptyStack.length, 0, 'Crab on empty stack should remain empty without error');

    // ハニー接触テスト（スタックは変化せずフィーバーのみ）
    stack = GameLogic.updateStack(stack, GameLogic.ITEMS.honey, 0);
    assert.strictEqual(stack.length, 1, 'Honey should not be added to the stack');

    // 7. 一品完成 & リセット判定テスト (isBowlComplete & calculateCompletionBonus)
    assert.strictEqual(GameLogic.COMPLETE_THRESHOLD, 5, 'Default complete threshold should be 5');
    assert.strictEqual(GameLogic.isBowlComplete(4), false);
    assert.strictEqual(GameLogic.isBowlComplete(5), true);
    assert.strictEqual(GameLogic.isBowlComplete(6), true);

    // 完成ボーナス (1杯目: 500, 2杯目: 600, 3杯目: 700)
    assert.strictEqual(GameLogic.calculateCompletionBonus(1), 500);
    assert.strictEqual(GameLogic.calculateCompletionBonus(2), 600);
    assert.strictEqual(GameLogic.calculateCompletionBonus(3), 700);

    // 7-b. ボーナス役判定テスト (evaluateBowlBonus)
    // 全部同じフルーツ (ALL_SAME: +800pt)
    const allSameStack = [
        { type: 'strawberry', name: 'イチゴ', emoji: '🍓' },
        { type: 'strawberry', name: 'イチゴ', emoji: '🍓' },
        { type: 'strawberry', name: 'イチゴ', emoji: '🍓' },
        { type: 'strawberry', name: 'イチゴ', emoji: '🍓' },
        { type: 'strawberry', name: 'イチゴ', emoji: '🍓' }
    ];
    const sameResult = GameLogic.evaluateBowlBonus(allSameStack, 1);
    assert.strictEqual(sameResult.type, 'ALL_SAME');
    assert.strictEqual(sameResult.bonusName, '🍓 イチゴ一色盛り！');
    assert.strictEqual(sameResult.extraScore, 800);
    assert.strictEqual(sameResult.totalScore, 1300); // 500 + 800

    // 全部別のフルーツ (ALL_DIFFERENT: +800pt)
    const rainbowStack = [
        { type: 'strawberry', name: 'イチゴ', emoji: '🍓' },
        { type: 'banana', name: 'バナナ', emoji: '🍌' },
        { type: 'blueberry', name: 'ブルーベリー', emoji: '🫐' },
        { type: 'mango', name: 'マンゴー', emoji: '🥭' },
        { type: 'coconut', name: 'グラノーラ', emoji: '🥥' }
    ];
    const rainbowResult = GameLogic.evaluateBowlBonus(rainbowStack, 2);
    assert.strictEqual(rainbowResult.type, 'ALL_DIFFERENT');
    assert.strictEqual(rainbowResult.bonusName, '🌈 トロピカルレインボー！');
    assert.strictEqual(rainbowResult.extraScore, 800);
    assert.strictEqual(rainbowResult.totalScore, 1400); // 600 + 800

    // 通常ミックス (NORMAL)
    const normalStack = [
        { type: 'strawberry', name: 'イチゴ', emoji: '🍓' },
        { type: 'strawberry', name: 'イチゴ', emoji: '🍓' },
        { type: 'banana', name: 'バナナ', emoji: '🍌' },
        { type: 'banana', name: 'バナナ', emoji: '🍌' },
        { type: 'mango', name: 'マンゴー', emoji: '🥭' }
    ];
    const normalResult = GameLogic.evaluateBowlBonus(normalStack, 1);
    assert.strictEqual(normalResult.type, 'NORMAL');
    assert.strictEqual(normalResult.bonusName, 'アサイーボウル完成！');
    assert.strictEqual(normalResult.extraScore, 0);
    assert.strictEqual(normalResult.totalScore, 500);

    // 7-c. 推奨オーダー生成 & 一致判定テスト (generateTargetOrder, checkOrderMatch, SPECIAL_ORDER)
    const generatedOrder = GameLogic.generateTargetOrder(5);
    assert.strictEqual(generatedOrder.length, 5);
    generatedOrder.forEach(type => {
        assert.ok(['strawberry', 'banana', 'blueberry', 'mango', 'coconut'].includes(type));
    });

    const fixedOrder = ['strawberry', 'strawberry', 'banana', 'mango', 'blueberry'];
    // 一致スタック（順不同）
    const matchedStack = [
        { type: 'banana', name: 'バナナ', emoji: '🍌' },
        { type: 'strawberry', name: 'イチゴ', emoji: '🍓' },
        { type: 'blueberry', name: 'ブルーベリー', emoji: '🫐' },
        { type: 'strawberry', name: 'イチゴ', emoji: '🍓' },
        { type: 'mango', name: 'マンゴー', emoji: '🥭' }
    ];
    assert.strictEqual(GameLogic.checkOrderMatch(matchedStack, fixedOrder), true);

    // 不一致スタック
    const unmatchedStack = [
        { type: 'banana', name: 'バナナ', emoji: '🍌' },
        { type: 'banana', name: 'バナナ', emoji: '🍌' },
        { type: 'blueberry', name: 'ブルーベリー', emoji: '🫐' },
        { type: 'strawberry', name: 'イチゴ', emoji: '🍓' },
        { type: 'mango', name: 'マンゴー', emoji: '🥭' }
    ];
    assert.strictEqual(GameLogic.checkOrderMatch(unmatchedStack, fixedOrder), false);

    // スペシャルオーダー達成時のボーナス評価 (SPECIAL_ORDER: +1200pt)
    const specialResult = GameLogic.evaluateBowlBonus(matchedStack, 1, fixedOrder);
    assert.strictEqual(specialResult.type, 'SPECIAL_ORDER');
    assert.strictEqual(specialResult.bonusName, '✨ シェフの推奨レシピ達成！');
    assert.strictEqual(specialResult.extraScore, 1200);
    assert.strictEqual(specialResult.totalScore, 1700); // 500 + 1200

    // 8. ランク評価 & クーポン付与テスト (S:15000〜, A:10000〜, B:5000〜, C:〜4999)
    assert.deepStrictEqual(GameLogic.getRank(16000), { rank: 'S', title: '👑 伝説のアサイーマスター' });
    assert.deepStrictEqual(GameLogic.getRank(15000), { rank: 'S', title: '👑 伝説のアサイーマスター' });
    assert.deepStrictEqual(GameLogic.getRank(14999), { rank: 'A', title: '🌟 プロアサイー職人' });
    assert.deepStrictEqual(GameLogic.getRank(10000), { rank: 'A', title: '🌟 プロアサイー職人' });
    assert.deepStrictEqual(GameLogic.getRank(9999), { rank: 'B', title: '🍓 一人前スタッフ' });
    assert.deepStrictEqual(GameLogic.getRank(5000), { rank: 'B', title: '🍓 一人前スタッフ' });
    assert.deepStrictEqual(GameLogic.getRank(4999), { rank: 'C', title: '🫐 見習いスタッフ' });
    assert.deepStrictEqual(GameLogic.getRank(0), { rank: 'C', title: '🫐 見習いスタッフ' });

    assert.strictEqual(GameLogic.isEligibleForCoupon(15000), true);
    assert.strictEqual(GameLogic.isEligibleForCoupon(10000), true);
    assert.strictEqual(GameLogic.isEligibleForCoupon(9999), false);
    assert.strictEqual(GameLogic.isEligibleForCoupon(5000), false);
    assert.strictEqual(GameLogic.isEligibleForCoupon(0), false);

    console.log("✅ All tests passed successfully!");
} catch (e) {
    console.error("❌ Test failed:", e.message);
    process.exit(1);
}
