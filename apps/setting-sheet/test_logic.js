import assert from 'assert';
import * as logic from './logic.js';

export function runTests() {
  console.log('--- Running logic.js tests ---');

  // 1. checkDropLocation
  const stageRect = { left: 10, right: 100, top: 10, bottom: 100 };
  assert.strictEqual(logic.checkDropLocation(50, 50, stageRect), true, 'Inside rect should be true');
  assert.strictEqual(logic.checkDropLocation(5, 50, stageRect), false, 'Outside rect should be false');
  assert.strictEqual(logic.checkDropLocation(10, 10, stageRect), true, 'On top-left edge should be true');
  assert.strictEqual(logic.checkDropLocation(100, 100, stageRect), true, 'On bottom-right edge should be true');

  // 2. calculateNextRotation
  assert.strictEqual(logic.calculateNextRotation(0), 45);
  assert.strictEqual(logic.calculateNextRotation(45), 90);
  assert.strictEqual(logic.calculateNextRotation(315), 0);

  // 3. determineTouchAction
  assert.strictEqual(logic.determineTouchAction(10, 10, 12, 12, 10), 'tap', 'Short distance is tap');
  assert.strictEqual(logic.determineTouchAction(10, 10, 50, 50, 10), 'drag', 'Long distance is drag');
  assert.strictEqual(logic.determineTouchAction(10, 10, 10, 20, 10), 'drag', 'Distance equal to threshold is drag');

  // 5. safeParseLocalStorage
  assert.strictEqual(logic.safeParseLocalStorage(null).items.length, 0);
  assert.strictEqual(logic.safeParseLocalStorage('').items.length, 0);
  assert.strictEqual(logic.safeParseLocalStorage('invalid json').items.length, 0);
  
  // 型チェックとフォールバックのテスト
  const malformedData = {
    bandName: 123, // string以外
    items: [
      null, // nullは無視されるべき
      { id: '1', type: 'amp', x: '50', y: null, rotation: '0', zIndex: '2' } // 不正な型
    ]
  };
  const parsed = logic.safeParseLocalStorage(JSON.stringify(malformedData));
  assert.strictEqual(parsed.bandName, '', 'Invalid type should fallback to default');
  assert.strictEqual(parsed.items.length, 1, 'Null items should be filtered out');
  assert.strictEqual(typeof parsed.items[0].x, 'number', 'x should be cast/fallback to number');
  assert.strictEqual(parsed.items[0].x, 50, 'x invalid number should fallback to default');
  assert.strictEqual(typeof parsed.items[0].zIndex, 'number', 'zIndex should fallback to number');
  assert.strictEqual(parsed.items[0].zIndex, 1, 'zIndex invalid type should fallback to default 1');

  // count マイグレーションテスト
  const oldData = { items: [{ id: '1', type: 'amp', x: 10, y: 10, count: 2 }] };
  const oldParsed = logic.safeParseLocalStorage(JSON.stringify(oldData));
  assert.strictEqual(oldParsed.items.length, 2, 'Should expand items with count');
  assert.strictEqual(oldParsed.items[0].id, '1_migrated_0');
  assert.strictEqual(oldParsed.items[1].id, '1_migrated_1');

  // マイグレーションのテスト
  const oldDataStr = JSON.stringify({
    items: [
      { id: 'item1', type: 'free_text', x: 10, y: 10, isBringIn: true },
      { id: 'item2', type: 'vocal_mic', x: 50, y: 50, count: 3 },
      { id: 'item3', type: 'free_text_pf', x: 6, y: 50, isLocked: true }
    ]
  });
  const migrated = logic.safeParseLocalStorage(oldDataStr);
  assert.strictEqual(migrated.items.length, 5, '1 item + 3 duplicated items + 1 locked item = 5');
  
  // free_textの移行
  const freeTextItem = migrated.items.find(i => i.id === 'item1');
  assert.strictEqual(freeTextItem.type, 'free_text_m', 'Old free_text should be migrated to free_text_m');
  assert.strictEqual(freeTextItem.bringIn, true, 'isBringIn should be migrated to bringIn');
  assert.strictEqual(freeTextItem.zIndex, 1, 'Default zIndex should be added');

  // isLockedの維持
  const lockedItem = migrated.items.find(i => i.id === 'item3');
  assert.strictEqual(lockedItem.isLocked, true, 'isLocked property should be preserved');

  // countの展開
  const duplicatedMics = migrated.items.filter(i => i.type === 'vocal_mic');
  assert.strictEqual(duplicatedMics.length, 3, 'Should create 3 individual mics');
  assert.strictEqual(duplicatedMics[0].x, 50, 'First copy has original x');
  assert.strictEqual(duplicatedMics[1].x, 52, 'Second copy has x + 2');
  assert.strictEqual(duplicatedMics[2].x, 54, 'Third copy has x + 4');
  assert.strictEqual(duplicatedMics[0].id, 'item2_migrated_0', 'ID should be appended with migrated index');

  // 6. generateUUID
  const uuid1 = logic.generateUUID();
  const uuid2 = logic.generateUUID();
  assert.strictEqual(typeof uuid1, 'string');
  assert.notStrictEqual(uuid1, uuid2);

  // 7. createNewItem
  const newItem = logic.createNewItem('vocal_mic', 10, 20, true, 5);
  assert.strictEqual(typeof newItem.id, 'string');
  assert.strictEqual(newItem.type, 'vocal_mic');
  assert.strictEqual(newItem.x, 10);
  assert.strictEqual(newItem.y, 20);
  assert.strictEqual(newItem.bringIn, true);
  assert.strictEqual(newItem.zIndex, 5);

  // 8. 新規追加テストケース
  // ① 負の回転値（presetのPfで使用）に対する挙動確認
  assert.strictEqual(logic.calculateNextRotation(-90), 315, 'Negative rotation should calculate properly');

  // ② 非objectのパース結果がdefaultに戻ること
  assert.strictEqual(logic.safeParseLocalStorage(JSON.stringify("string")).hasPillars, false, 'Non-object should return default');

  // ③ type未定義/非stringのフォールバック
  const typeMissingData = { items: [{ id: '1' }, { id: '2', type: 123 }] };
  const typeMissingParsed = logic.safeParseLocalStorage(JSON.stringify(typeMissingData));
  assert.strictEqual(typeMissingParsed.items[0].type, 'free_text_m', 'Missing type should fallback to free_text_m');
  assert.strictEqual(typeMissingParsed.items[1].type, 'free_text_m', 'Non-string type should fallback to free_text_m');

  // ④ 非数値countのマイグレーション安全性
  const invalidCountData = { items: [{ id: '1', type: 'amp', count: 'abc' }] };
  const invalidCountParsed = logic.safeParseLocalStorage(JSON.stringify(invalidCountData));
  assert.strictEqual(invalidCountParsed.items.length, 1, 'Invalid count string should be treated as count 1');

  // ⑤ 高座標+大量countでの境界テスト
  const highCoordCountData = { items: [{ id: '1', type: 'amp', x: 94, y: 94, count: 3 }] };
  const highCoordCountParsed = logic.safeParseLocalStorage(JSON.stringify(highCoordCountData));
  assert.strictEqual(highCoordCountParsed.items.length, 3, 'Should expand items with count near edge');
  assert.strictEqual(highCoordCountParsed.items[2].x, 95, 'x should be clamped at 95');
  assert.strictEqual(highCoordCountParsed.items[2].y, 95, 'y should be clamped at 95');

  // ⑥ hasPillarsの型フォールバック
  assert.strictEqual(logic.safeParseLocalStorage(JSON.stringify({ hasPillars: 'yes' })).hasPillars, false, 'hasPillars string should fallback to false');

  // ⑦ bandMemoの正常保存・復元
  assert.strictEqual(logic.safeParseLocalStorage(JSON.stringify({ bandMemo: 'test memo' })).bandMemo, 'test memo', 'bandMemo should be parsed correctly');

  // ⑧ bringIn: true（旧isBringInではなく）のパス
  const bringInData = { items: [{ id: '1', type: 'amp', bringIn: true }] };
  const bringInParsed = logic.safeParseLocalStorage(JSON.stringify(bringInData));
  assert.strictEqual(bringInParsed.items[0].bringIn, true, 'bringIn flag should be preserved');

  // ⑨ createNewItem のデフォルト引数テスト
  const defaultNewItem = logic.createNewItem('amp', 10, 20);
  assert.strictEqual(defaultNewItem.bringIn, false, 'Default bringIn should be false');
  assert.strictEqual(defaultNewItem.zIndex, 1, 'Default zIndex should be 1');

  // ⑩ createNewItem の初期値保証
  assert.strictEqual(defaultNewItem.rotation, 0, 'Initial rotation should be 0');
  assert.strictEqual(defaultNewItem.memo, '', 'Initial memo should be empty');
  assert.strictEqual(defaultNewItem.customName, '', 'Initial customName should be empty');
  // ⑪ presetNote のパース・フォールバック
  const presetNoteData = { presetNote: '※モニターは天井に左右に吊るしてあります', items: [] };
  const presetNoteParsed = logic.safeParseLocalStorage(JSON.stringify(presetNoteData));
  assert.strictEqual(presetNoteParsed.presetNote, '※モニターは天井に左右に吊るしてあります', 'presetNote should be preserved through parse');

  // ⑪b presetNote の非string型フォールバック
  const badPresetNoteData = { presetNote: 123, items: [] };
  const badPresetNoteParsed = logic.safeParseLocalStorage(JSON.stringify(badPresetNoteData));
  assert.strictEqual(badPresetNoteParsed.presetNote, '', 'Non-string presetNote should fallback to empty string');

  // ⑫ phantom フラグのパース検証
  const phantomData = { items: [{ id: 'ph1', type: 'di', phantom: true, x: 10, y: 10 }] };
  const phantomParsed = logic.safeParseLocalStorage(JSON.stringify(phantomData));
  assert.strictEqual(phantomParsed.items[0].phantom, true, 'phantom flag should be preserved through parse');

  // ⑬ phantom=false のデフォルト検証
  const noPhantomData = { items: [{ id: 'np1', type: 'vocal_mic', x: 10, y: 10 }] };
  const noPhantomParsed = logic.safeParseLocalStorage(JSON.stringify(noPhantomData));
  assert.strictEqual(noPhantomParsed.items[0].phantom, false, 'phantom should default to false');

  // ⑭ createNewItem で DI タイプの自動phantom設定（bringIn=false の場合 phantom=true）
  const diItem = logic.createNewItem('di', 50, 50, false, 1);
  assert.strictEqual(diItem.phantom, true, 'DI with bringIn=false should auto-set phantom=true');

  // ⑮ createNewItem で DI タイプ + bringIn=true の場合 phantom=false
  const diBringInItem = logic.createNewItem('di', 50, 50, true, 1);
  assert.strictEqual(diBringInItem.phantom, false, 'DI with bringIn=true should have phantom=false');

  // ⑯ memo フィールドのパース検証
  const memoData = { items: [{ id: 'm1', type: 'vocal_mic', x: 10, y: 10, memo: 'SHURE SM58' }] };
  const memoParsed = logic.safeParseLocalStorage(JSON.stringify(memoData));
  assert.strictEqual(memoParsed.items[0].memo, 'SHURE SM58', 'memo field should be preserved');

  // ⑰ memo フィールドの非string型フォールバック
  const badMemoData = { items: [{ id: 'm2', type: 'vocal_mic', x: 10, y: 10, memo: 123 }] };
  const badMemoParsed = logic.safeParseLocalStorage(JSON.stringify(badMemoData));
  assert.strictEqual(badMemoParsed.items[0].memo, '', 'Non-string memo should fallback to empty string');

  // ⑱ customName のパース検証
  const cnData = { items: [{ id: 'cn1', type: 'free_text_m', x: 10, y: 10, customName: 'PC' }] };
  const cnParsed = logic.safeParseLocalStorage(JSON.stringify(cnData));
  assert.strictEqual(cnParsed.items[0].customName, 'PC', 'customName should be preserved');

  // ⑲ 空のitemsを含む正常なstate
  const emptyItemsData = { bandName: 'Test Band', bandMembers: 'Vo,Gt', bandMemo: '', items: [] };
  const emptyItemsParsed = logic.safeParseLocalStorage(JSON.stringify(emptyItemsData));
  assert.strictEqual(emptyItemsParsed.bandName, 'Test Band', 'bandName should be preserved with empty items');
  assert.strictEqual(emptyItemsParsed.items.length, 0, 'Empty items array should remain empty');

  console.log('logic.js tests passed! ✅');
}
