import assert from 'assert';
import { setupDragDrop, setEditMode } from './dragdrop.js';
import { paletteEl, stageEl, trashZone } from './ui.js';
import { state, initState } from './store.js';

export function runTests() {
  console.log('--- Running dragdrop.js tests ---');

  // リセット
  initState({ items: [] });
  stageEl.innerHTML = '';
  document.body.innerHTML = '';
  document.body.appendChild(stageEl);
  document.body.appendChild(trashZone);

  // セットアップ
  setupDragDrop({
    paletteEl,
    stageEl,
    trashZone,
    onShowDetailModal: () => {},
    onChange: () => {},
    showToast: () => {}
  });

  // 1. パレットからのクローン作成 (pointerdown -> pointermove -> pointerup)
  const paletteItem = paletteEl.querySelector('.palette-item[data-type="vocal_mic"]');
  
  // mock touches
  const touch = { clientX: 100, clientY: 100, identifier: 1 };
  const touchStartEvent = new window.Event('pointerdown', { bubbles: true });
  touchStartEvent.pointerId = 1;
  touchStartEvent.clientX = 100;
  touchStartEvent.clientY = 100;
  paletteItem.dispatchEvent(touchStartEvent);

  // Ghostが生成されたか確認
  const ghosts = document.body.querySelectorAll('.dragging');
  assert.strictEqual(ghosts.length, 1, 'Ghost element should be created');
  assert.ok(ghosts[0].querySelector('img'), 'Ghost should have img');

  const touchMoveEvent = new window.Event('pointermove', { bubbles: true });
  touchMoveEvent.pointerId = 1;
  touchMoveEvent.clientX = 150;
  touchMoveEvent.clientY = 150;
  document.dispatchEvent(touchMoveEvent);

  const touchEndEvent = new window.Event('pointerup', { bubbles: true });
  touchEndEvent.pointerId = 1;
  touchEndEvent.clientX = 50; // stage内にドロップ
  touchEndEvent.clientY = 50;
  document.dispatchEvent(touchEndEvent);

  // アイテムが追加されたか
  assert.strictEqual(state.items.length, 1, 'Item should be added to state');
  assert.strictEqual(state.items[0].type, 'vocal_mic', 'Added item type should be vocal_mic');
  
  // Ghostが消えたか
  const remainingGhosts = document.body.querySelectorAll('.dragging');
  assert.strictEqual(remainingGhosts.length, 0, 'Ghost should be removed after drop');

  // ----------------------------------------------------
  // 2. ステージ上のアイテム移動 (pointerdown -> pointermove -> pointerup)
  // ----------------------------------------------------
  // 事前にアイテムをDOMに追加してシミュレート
  const itemEl = document.createElement('div');
  itemEl.className = 'stage-item';
  itemEl.dataset.id = state.items[0].id;
  stageEl.appendChild(itemEl);

  const moveStartEvent = new window.Event('pointerdown', { bubbles: true });
  moveStartEvent.pointerId = 2;
  moveStartEvent.clientX = 50;
  moveStartEvent.clientY = 50;
  itemEl.dispatchEvent(moveStartEvent);

  const moveMoveEvent = new window.Event('pointermove', { bubbles: true });
  moveMoveEvent.pointerId = 2;
  moveMoveEvent.clientX = 80;
  moveMoveEvent.clientY = 80;
  document.dispatchEvent(moveMoveEvent);

  const moveEndEvent = new window.Event('pointerup', { bubbles: true });
  moveEndEvent.pointerId = 2;
  moveEndEvent.clientX = 80;
  moveEndEvent.clientY = 80;
  document.dispatchEvent(moveEndEvent);

  assert.strictEqual(state.items.length, 1, 'Item count should remain 1 after move');
  assert.notStrictEqual(state.items[0].x, 50, 'Item x should be updated after move');
  
  // ----------------------------------------------------
  // 3. アイテムの削除 (ゴミ箱へのドロップ)
  // ----------------------------------------------------
  const deleteStartEvent = new window.Event('pointerdown', { bubbles: true });
  deleteStartEvent.pointerId = 3;
  deleteStartEvent.clientX = 80;
  deleteStartEvent.clientY = 80;
  itemEl.dispatchEvent(deleteStartEvent);

  const deleteMoveEvent = new window.Event('pointermove', { bubbles: true });
  deleteMoveEvent.pointerId = 3;
  deleteMoveEvent.clientX = 150; // assuming trashZone is here
  deleteMoveEvent.clientY = 950;
  document.dispatchEvent(deleteMoveEvent);

  // mock trashZone checking logic by putting coordinates far away and relying on trashZone bounding box 
  // Wait, JSDOM getBoundingClientRect returns 0. Let's mock it for the test.
  trashZone.getBoundingClientRect = () => ({ left: 100, right: 200, top: 900, bottom: 1000 });
  
  const deleteEndEvent = new window.Event('pointerup', { bubbles: true });
  deleteEndEvent.pointerId = 3;
  deleteEndEvent.clientX = 150;
  deleteEndEvent.clientY = 950;
  document.dispatchEvent(deleteEndEvent);

  assert.strictEqual(state.items.length, 0, 'Item should be deleted when dropped in trashZone');

  // ----------------------------------------------------
  // 4. 回転モードでの動作とロック判定
  // ----------------------------------------------------
  initState({ items: [
    { id: 'rot1', type: 'amp', x: 10, y: 10, rotation: 0, isLocked: false },
    { id: 'loc1', type: 'pf', x: 20, y: 20, rotation: -90, isLocked: true }
  ]});
  
  setEditMode('rotate');
  
  const rotItemEl = document.createElement('div');
  rotItemEl.className = 'stage-item';
  rotItemEl.dataset.id = 'rot1';
  stageEl.appendChild(rotItemEl);

  // タップをシミュレート
  const tapStartEvent = new window.Event('pointerdown', { bubbles: true });
  tapStartEvent.pointerId = 4;
  tapStartEvent.clientX = 10;
  tapStartEvent.clientY = 10;
  rotItemEl.dispatchEvent(tapStartEvent);

  const tapEndEvent = new window.Event('pointerup', { bubbles: true });
  tapEndEvent.pointerId = 4;
  tapEndEvent.clientX = 10;
  tapEndEvent.clientY = 10;
  document.dispatchEvent(tapEndEvent);

  assert.strictEqual(state.items[0].rotation, 45, 'Item rotation should increase by 45 on tap in rotate mode');

  // ロックアイテムの回転防止
  const locItemEl = document.createElement('div');
  locItemEl.className = 'stage-item';
  locItemEl.dataset.id = 'loc1';
  stageEl.appendChild(locItemEl);

  const locTapStartEvent = new window.Event('pointerdown', { bubbles: true });
  locTapStartEvent.pointerId = 5;
  locTapStartEvent.clientX = 20;
  locTapStartEvent.clientY = 20;
  locItemEl.dispatchEvent(locTapStartEvent);

  const locTapEndEvent = new window.Event('pointerup', { bubbles: true });
  locTapEndEvent.pointerId = 5;
  locTapEndEvent.clientX = 20;
  locTapEndEvent.clientY = 20;
  document.dispatchEvent(locTapEndEvent);

  assert.strictEqual(state.items[1].rotation, -90, 'Locked item should NOT rotate');
  setEditMode('move'); // reset mode

  // ----------------------------------------------------
  // 5. 範囲外ドロップ時の位置判定テスト（微小な範囲外＝スナップ、大幅な範囲外＝リセット）
  // ----------------------------------------------------
  initState({ items: [
    { id: 'reset1', type: 'vocal_mic', x: 50, y: 50, rotation: 0, isLocked: false }
  ]});
  
  const resetItemEl = document.createElement('div');
  resetItemEl.className = 'stage-item';
  resetItemEl.dataset.id = 'reset1';
  stageEl.innerHTML = '';
  stageEl.appendChild(resetItemEl);

  stageEl.getBoundingClientRect = () => ({ left: 0, right: 100, top: 0, bottom: 100, width: 100, height: 100 });
  trashZone.getBoundingClientRect = () => ({ left: 100, right: 200, top: 900, bottom: 1000 });

  // テストA: 軽微な範囲外 (105%, 105%) -> 境界 (100, 100) にスナップするはず
  const startA = new window.Event('pointerdown', { bubbles: true });
  startA.pointerId = 7;
  startA.clientX = 50;
  startA.clientY = 50;
  startA.pointerType = 'mouse';
  resetItemEl.dispatchEvent(startA);

  const moveA = new window.Event('pointermove', { bubbles: true });
  moveA.pointerId = 7;
  moveA.clientX = 105;
  moveA.clientY = 105;
  moveA.pointerType = 'mouse';
  document.dispatchEvent(moveA);

  const endA = new window.Event('pointerup', { bubbles: true });
  endA.pointerId = 7;
  endA.clientX = 105;
  endA.clientY = 105;
  endA.pointerType = 'mouse';
  document.dispatchEvent(endA);

  assert.strictEqual(state.items[0].x, 100, 'Slightly out of bounds drop should clamp to 100');
  assert.strictEqual(state.items[0].y, 100, 'Slightly out of bounds drop should clamp to 100');

  // テストB: 大幅な範囲外 (140%, 140%) -> 元の位置 (100, 100 から開始して元の位置に戻る)
  // ※現在の位置は100, 100なので、ドラッグ開始位置を100, 100とする
  const startB = new window.Event('pointerdown', { bubbles: true });
  startB.pointerId = 8;
  startB.clientX = 100;
  startB.clientY = 100;
  startB.pointerType = 'mouse';
  resetItemEl.dispatchEvent(startB);

  const moveB = new window.Event('pointermove', { bubbles: true });
  moveB.pointerId = 8;
  moveB.clientX = 140;
  moveB.clientY = 140;
  moveB.pointerType = 'mouse';
  document.dispatchEvent(moveB);

  const endB = new window.Event('pointerup', { bubbles: true });
  endB.pointerId = 8;
  endB.clientX = 140;
  endB.clientY = 140;
  endB.pointerType = 'mouse';
  document.dispatchEvent(endB);

  assert.strictEqual(state.items[0].x, 100, 'Far out of bounds drop should restore original x');
  assert.strictEqual(state.items[0].y, 100, 'Far out of bounds drop should restore original y');

  // ----------------------------------------------------
  // 6. 新規追加テストケース
  // ----------------------------------------------------
  
  // ① ステージ外にクローンドロップでアイテムが追加されないこと
  const paletteItem2 = paletteEl.querySelector('.palette-item[data-type="gt_amp"]');
  const cloneStartEvent = new window.Event('pointerdown', { bubbles: true });
  cloneStartEvent.pointerId = 9;
  cloneStartEvent.clientX = 100;
  cloneStartEvent.clientY = 100;
  paletteItem2.dispatchEvent(cloneStartEvent);

  const cloneMoveEvent = new window.Event('pointermove', { bubbles: true });
  cloneMoveEvent.pointerId = 9;
  cloneMoveEvent.clientX = 500; // ステージ外へ
  cloneMoveEvent.clientY = 500;
  document.dispatchEvent(cloneMoveEvent);

  const cloneEndEvent = new window.Event('pointerup', { bubbles: true });
  cloneEndEvent.pointerId = 9;
  cloneEndEvent.clientX = 500; // ステージ外
  cloneEndEvent.clientY = 500;
  document.dispatchEvent(cloneEndEvent);

  assert.strictEqual(state.items.length, 1, 'Item should NOT be added if dropped outside stage');

  // ② hasPillars 時のせり出し領域（x≤25%, y:100〜120%）へのクローンドロップ
  initState({ items: [], hasPillars: true });
  const paletteItemExt = paletteEl.querySelector('.palette-item'); // get first available item
  const cloneExtStartEvent = new window.Event('pointerdown', { bubbles: true });
  cloneExtStartEvent.pointerId = 10;
  cloneExtStartEvent.clientX = 10;
  cloneExtStartEvent.clientY = 100;
  cloneExtStartEvent.pointerType = 'mouse';
  paletteItemExt.dispatchEvent(cloneExtStartEvent);

  const cloneExtMoveEvent = new window.Event('pointermove', { bubbles: true });
  cloneExtMoveEvent.pointerId = 10;
  cloneExtMoveEvent.clientX = 10; // x < 25%
  cloneExtMoveEvent.clientY = 110; // 100% <= y <= 120%
  cloneExtMoveEvent.pointerType = 'mouse';
  document.dispatchEvent(cloneExtMoveEvent);

  const cloneExtEndEvent = new window.Event('pointerup', { bubbles: true });
  cloneExtEndEvent.pointerId = 10;
  cloneExtEndEvent.clientX = 10;
  cloneExtEndEvent.clientY = 110;
  cloneExtEndEvent.pointerType = 'mouse';
  document.dispatchEvent(cloneExtEndEvent);

  assert.strictEqual(state.items.length, 1, 'Item SHOULD be added to extension stage area');

  // ③ pointercancel イベント発火時のcleanup（ghostの除去、draggingクラス除去）
  const cloneCancelStartEvent = new window.Event('pointerdown', { bubbles: true });
  cloneCancelStartEvent.pointerId = 11;
  cloneCancelStartEvent.clientX = 100;
  cloneCancelStartEvent.clientY = 100;
  paletteItemExt.dispatchEvent(cloneCancelStartEvent);

  // ghost生成確認
  assert.strictEqual(document.body.querySelectorAll('.dragging').length, 1, 'Ghost created before cancel');

  const cancelEvent = new window.Event('pointercancel', { bubbles: true });
  cancelEvent.pointerId = 11;
  document.dispatchEvent(cancelEvent);

  assert.strictEqual(document.body.querySelectorAll('.dragging').length, 0, 'Ghost should be removed on pointercancel');

  // ④ ロックアイテムの移動防止（isLocked=trueのアイテムが座標変更されないこと）
  initState({ items: [
    { id: 'loc2', type: 'pf', x: 20, y: 20, rotation: 0, isLocked: true }
  ]});
  const loc2ItemEl = document.createElement('div');
  loc2ItemEl.className = 'stage-item';
  loc2ItemEl.dataset.id = 'loc2';
  stageEl.appendChild(loc2ItemEl);

  const loc2MoveStartEvent = new window.Event('pointerdown', { bubbles: true });
  loc2MoveStartEvent.pointerId = 12;
  loc2MoveStartEvent.clientX = 20;
  loc2MoveStartEvent.clientY = 20;
  loc2ItemEl.dispatchEvent(loc2MoveStartEvent);

  const loc2MoveMoveEvent = new window.Event('pointermove', { bubbles: true });
  loc2MoveMoveEvent.pointerId = 12;
  loc2MoveMoveEvent.clientX = 80;
  loc2MoveMoveEvent.clientY = 80;
  document.dispatchEvent(loc2MoveMoveEvent);

  const loc2MoveEndEvent = new window.Event('pointerup', { bubbles: true });
  loc2MoveEndEvent.pointerId = 12;
  loc2MoveEndEvent.clientX = 80;
  loc2MoveEndEvent.clientY = 80;
  document.dispatchEvent(loc2MoveEndEvent);

  assert.strictEqual(state.items[0].x, 20, 'Locked item x should not change');
  assert.strictEqual(state.items[0].y, 20, 'Locked item y should not change');

  console.log('dragdrop.js tests passed! ✅');
}
