import assert from 'assert';
import fs from 'fs';
// setup is already imported globally via test.js
import { state, initState } from './store.js';
import { renderStage, stageEl, renderBringInTable } from './ui.js';

export function runTests() {
  console.log('--- Running ui.js tests ---');

  // リセット
  initState({
    eventName: 'UI Test',
    items: [
      { id: '1', type: 'vocal_mic', x: 50, y: 50, rotation: 45, bringIn: false, zIndex: 1 },
      { id: '2', type: 'free_text_m', customName: 'My Custom Text', x: 10, y: 10, rotation: 0, bringIn: true, zIndex: 2 }
    ]
  });

  // renderStage実行
  renderStage();

  // stageElの中身を検証
  const items = stageEl.querySelectorAll('.stage-item');
  assert.strictEqual(items.length, 2, 'Should render 2 items');

  // 要素1 (vocal_mic)
  const el1 = stageEl.querySelector('[data-id="1"]');
  assert.ok(el1, 'Element 1 exists');
  assert.strictEqual(el1.classList.contains('bring-in'), false, 'Not bringIn');
  assert.strictEqual(el1.style.left, '50%', 'Left is 50%');
  assert.strictEqual(el1.style.transform, 'rotate(45deg)', 'Rotation is 45deg');
  assert.ok(el1.querySelector('img'), 'Should have img child');

  // 要素2 (free_text)
  const el2 = stageEl.querySelector('[data-id="2"]');
  assert.ok(el2, 'Element 2 exists');
  assert.strictEqual(el2.classList.contains('bring-in'), true, 'Is bringIn');
  const span = el2.querySelector('.free-text-label');
  assert.ok(span, 'Should have span for free_text');
  assert.strictEqual(span.textContent, 'My Custom Text', 'Custom name rendered correctly');

  // DOMレイアウトの基本構造のテスト
  console.log('Testing DOM layout structure...');
  const exportContainer = document.getElementById('export-container');
  const controlArea = document.querySelector('.control-area');
  
  assert.ok(exportContainer, 'export-container must exist');
  assert.ok(controlArea, 'control-area must exist');
  
  // export-container の中には stage がある
  assert.ok(exportContainer.querySelector('#stage'), 'export-container must contain #stage');
  
  // バンド情報や機材リストは export-container 内にあってはならない（エクスポート時にのみ一時移動する仕様）
  assert.strictEqual(exportContainer.querySelector('#band-info-header'), null, 'band-info-header must NOT be inside export-container initially');
  assert.strictEqual(exportContainer.querySelector('#bring-in-table-container'), null, 'bring-in-table-container must NOT be inside export-container initially');

  // controlAreaの中にパレット、バンド情報、ボタン、機材リストの順で存在するか確認
  const palette = document.getElementById('palette');
  const bandInfo = document.getElementById('band-info-header');
  const actionButtons = document.querySelector('.action-buttons');
  const bringInTable = document.getElementById('bring-in-table-container');

  assert.ok(controlArea.contains(palette), 'control-area must contain palette');
  assert.ok(controlArea.contains(bandInfo), 'control-area must contain band-info-header');
  assert.ok(controlArea.contains(actionButtons), 'control-area must contain action-buttons');
  assert.ok(controlArea.contains(bringInTable), 'control-area must contain bring-in-table-container');

  // DOMツリー内の出現順序を検証 (DocumentPositionを利用)
  const pos1 = palette.compareDocumentPosition(bandInfo);
  assert.ok(pos1 & window.Node.DOCUMENT_POSITION_FOLLOWING, 'bandInfo must follow palette');

  const pos2 = bandInfo.compareDocumentPosition(actionButtons);
  assert.ok(pos2 & window.Node.DOCUMENT_POSITION_FOLLOWING, 'actionButtons must follow bandInfo');

  const pos3 = actionButtons.compareDocumentPosition(bringInTable);
  assert.ok(pos3 & window.Node.DOCUMENT_POSITION_FOLLOWING, 'bringInTable must follow actionButtons');

  // renderBringInTableの検証
  console.log('Testing renderBringInTable...');
  renderBringInTable();
  assert.strictEqual(bringInTable.style.display, 'block', 'Table should be visible');
  const tbody = document.getElementById('bring-in-tbody');
  const rows = tbody.querySelectorAll('tr');
  assert.strictEqual(rows.length, 1, 'Only 1 bringIn item');
  
  const cols = rows[0].querySelectorAll('td');
  assert.strictEqual(cols[0].textContent, 'My Custom Text', 'Custom name should be used');
  
  // カスタム名がない場合は「カスタム」にフォールバックされるか
  initState({
    eventName: 'UI Test 2',
    items: [
      { id: '3', type: 'free_text_s', customName: '', x: 0, y: 0, rotation: 0, bringIn: true, zIndex: 1, memo: 'test memo' }
    ]
  });
  renderBringInTable();
  const rows2 = tbody.querySelectorAll('tr');
  assert.strictEqual(rows2[0].querySelectorAll('td')[0].textContent, 'カスタム', 'Fallback to カスタム');
  assert.strictEqual(rows2[0].querySelectorAll('td')[1].textContent, 'test memo', 'Memo rendered');

  // 新規テストケース
  // ① hasPillars: true で has-pillars classが付与されること
  // ② hasPillars: true で stage-extension 要素が生成されること
  initState({ items: [], hasPillars: true });
  renderStage();
  assert.strictEqual(stageEl.classList.contains('has-pillars'), true, 'Should have has-pillars class');
  assert.ok(stageEl.querySelector('.stage-extension'), 'Should create stage-extension element');

  // ③ hasPillars: false で has-pillars classが除去されること
  initState({ items: [], hasPillars: false });
  renderStage();
  assert.strictEqual(stageEl.classList.contains('has-pillars'), false, 'Should remove has-pillars class');
  assert.strictEqual(stageEl.querySelector('.stage-extension'), null, 'Should remove stage-extension element');

  // ④ renderBringInTable で bringInアイテムが0件の場合 display: none になること
  initState({ items: [{ id: '1', type: 'amp', bringIn: false }] });
  renderBringInTable();
  assert.strictEqual(bringInTable.style.display, 'none', 'BringIn table should be hidden if empty');

  // ⑤ 非free_textタイプの bringInアイテムの名前が TYPE_NAMES から取得されること
  initState({ items: [{ id: '2', type: 'vocal_mic', bringIn: true, memo: 'mic test' }] });
  renderBringInTable();
  const rows3 = tbody.querySelectorAll('tr');
  // ui.js の TYPE_NAMES['vocal_mic'] は 'Voマイク'
  assert.strictEqual(rows3[0].querySelectorAll('td')[0].textContent, 'Voマイク', 'Should use TYPE_NAMES for non-free_text');

  // ⑥ unknown typeのアイテムがdefaultサイズで描画されること
  initState({ items: [{ id: '3', type: 'unknown_type', x: 10, y: 10, rotation: 0, bringIn: false, zIndex: 1 }] });
  renderStage();
  const unknownEl = stageEl.querySelector('[data-id="3"]');
  // ui.js の ITEM_SIZES.default は { w: 10, h: 17.7 } => w: 10%, h: 17.7%
  assert.strictEqual(unknownEl.style.width, '10%', 'Unknown type should use default width');

  // ⑦ CSSにflex-shrink: 0が設定されているかの検証（レイアウト崩れ再発防止）
  console.log('Testing CSS for flex-shrink preventions...');
  const cssContent = fs.readFileSync('style.css', 'utf8');
  const requiredSelectors = ['.palette-area', '.trash-zone', '.palette-header', '.form-header'];
  
  requiredSelectors.forEach(selector => {
    // セレクタのブロック内に flex-shrink: 0 が存在するかチェックする正規表現
    const escapedSelector = selector.replace(/\./g, '\\.');
    const regex = new RegExp(`${escapedSelector}\\s*\\{[^}]*flex-shrink:\\s*0\\s*;?[^}]*\\}`);
    assert.ok(regex.test(cssContent), `CSS rule for ${selector} must contain "flex-shrink: 0" to prevent layout collapse`);
  });

  // ⑧ presetNote が設定されている場合、preset-note 要素に表示されること
  initState({ items: [], presetNote: '※モニターは天井に左右に吊るしてあります' });
  renderStage();
  const presetNoteEl = document.getElementById('preset-note');
  assert.ok(presetNoteEl, 'preset-note element must exist');
  assert.strictEqual(presetNoteEl.textContent, '※モニターは天井に左右に吊るしてあります', 'presetNote text should be rendered');
  assert.strictEqual(presetNoteEl.style.display, 'block', 'presetNote should be visible when set');

  // ⑨ presetNote が空の場合、preset-note 要素が非表示であること
  initState({ items: [], presetNote: '' });
  renderStage();
  assert.strictEqual(presetNoteEl.style.display, 'none', 'presetNote should be hidden when empty');

  // ⑩ phantom アイテムに *マーク が表示されること
  initState({ items: [
    { id: 'ph1', type: 'di', x: 50, y: 50, rotation: 0, bringIn: false, zIndex: 1, phantom: true }
  ] });
  renderStage();
  const phantomItem = stageEl.querySelector('[data-id="ph1"]');
  const phantomMark = phantomItem.querySelector('.phantom-mark');
  assert.ok(phantomMark, 'Phantom item should have .phantom-mark element');
  assert.strictEqual(phantomMark.textContent, '*', 'Phantom mark should show *');

  // ⑪ phantom-legend の表示/非表示
  const phantomLegend2 = document.getElementById('phantom-legend');
  assert.ok(phantomLegend2, 'phantom-legend element must exist');
  assert.strictEqual(phantomLegend2.style.display, 'block', 'phantom-legend should be visible when phantom items exist');

  // ⑫ phantom アイテムがない場合 phantom-legend は非表示
  initState({ items: [
    { id: 'nph1', type: 'vocal_mic', x: 50, y: 50, rotation: 0, bringIn: false, zIndex: 1, phantom: false }
  ] });
  renderStage();
  assert.strictEqual(phantomLegend2.style.display, 'none', 'phantom-legend should be hidden when no phantom items');

  // ⑬ free_text_pf タイプが正しいSVGパスを使用すること
  initState({ items: [
    { id: 'pf1', type: 'free_text_pf', customName: 'Pf', x: 6, y: 60, rotation: -90, zIndex: 1, isLocked: true }
  ] });
  renderStage();
  const pfEl = stageEl.querySelector('[data-id="pf1"]');
  assert.ok(pfEl, 'Pf element should be rendered');
  const pfImg = pfEl.querySelector('img');
  assert.ok(pfImg.src.includes('free_text.svg'), 'free_text_pf should use free_text.svg');
  const pfLabel = pfEl.querySelector('.free-text-label');
  assert.ok(pfLabel, 'free_text_pf should have a label');
  assert.strictEqual(pfLabel.textContent, 'Pf', 'free_text_pf label should show Pf');

  // ⑭ free_text_s タイプが free_text_circle.svg を使うこと
  initState({ items: [
    { id: 'fts1', type: 'free_text_s', customName: 'A', x: 30, y: 30, rotation: 0, bringIn: true, zIndex: 1 }
  ] });
  renderStage();
  const ftsEl = stageEl.querySelector('[data-id="fts1"]');
  const ftsImg = ftsEl.querySelector('img');
  assert.ok(ftsImg.src.includes('free_text_circle.svg'), 'free_text_s should use free_text_circle.svg');

  // ⑮ renderBringInTable の phantom マーク表示
  initState({ items: [
    { id: 'phtbl1', type: 'di', bringIn: true, phantom: true, zIndex: 1, memo: 'condenser mic' }
  ] });
  renderBringInTable();
  const phantomRows = tbody.querySelectorAll('tr');
  assert.strictEqual(phantomRows.length, 1, 'Should show 1 bringIn phantom item');
  const nameCell = phantomRows[0].querySelectorAll('td')[0];
  assert.ok(nameCell.textContent.includes('*'), 'Phantom bringIn item name should include * mark');

  // ⑯ CSSで #export-container に position: sticky が設定されていること（スマホ時の上部固定担保）
  assert.ok(/#export-container\s*\{[^}]*position:\s*sticky/s.test(cssContent), '#export-container must have position: sticky in CSS');

  console.log('ui.js tests passed! ✅');
}
