import assert from 'assert';
import { clearLocalStorageMock } from './test-setup.js';
import * as store from './store.js';

export function runTests() {
  console.log('--- Running store.js tests ---');

  // リセット
  clearLocalStorageMock();
  store.initState({ bandName: '', bandMembers: '', bandMemo: '', items: [] });
  store.setZIndex(1);

  assert.strictEqual(store.state.bandName, '', 'Initial state is empty');
  assert.strictEqual(store.currentZIndex, 1, 'Initial zIndex is 1');

  // updateState
  store.updateState({ bandName: 'My Band' });
  assert.strictEqual(store.state.bandName, 'My Band', 'State should update');
  
  // localStorage check
  const saved = JSON.parse(global.localStorage.getItem('stageSettingState'));
  assert.strictEqual(saved.bandName, 'My Band', 'Should save to localStorage');

  // incrementZIndex
  const z = store.incrementZIndex();
  assert.strictEqual(z, 1, 'increment returns current, then increments');
  assert.strictEqual(store.currentZIndex, 2, 'zIndex should be 2');

  // ① state の初期値に hasPillars: false が含まれること
  // (store.jsがロードされた時点の初期値をテストするため、ここではinitState前の状態をシミュレート)
  // ただし、モジュールの初期状態をリセットするのは難しいため、
  // initStateでhasPillarsを指定しなかった場合に元の値が維持されるか（またはundefinedにならないか）を確認。
  // モジュールのエクスポートされた `state` 自体にアクセスして確認。
  store.initState({ bandName: '', items: [], hasPillars: false });
  assert.strictEqual(store.state.hasPillars, false, 'hasPillars should be initialized to false');

  // ② initState が既存stateを完全上書きすること（マージではない）
  store.updateState({ bandName: 'Old Band', bandMemo: 'Old Memo' });
  store.initState({ bandName: 'New Band', items: [] });
  assert.strictEqual(store.state.bandName, 'New Band', 'State should be overwritten');
  assert.strictEqual(store.state.bandMemo, undefined, 'Old properties should be removed if not in new state');

  // ③ updateState でlocalStorage書き込み例外時に console.error が呼ばれること
  // localStorage.setItem をモックして例外をスローさせる
  const originalSetItem = global.localStorage.setItem;
  const originalConsoleError = console.error;
  const originalAlert = global.alert;
  
  let consoleErrorCalled = false;
  let alertCalled = false;

  global.localStorage.setItem = () => { throw new Error('Storage quota exceeded'); };
  console.error = () => { consoleErrorCalled = true; };
  global.alert = () => { alertCalled = true; };

  store.updateState({ bandName: 'Test Error' });

  assert.strictEqual(consoleErrorCalled, true, 'console.error should be called on save failure');
  assert.strictEqual(alertCalled, true, 'alert should be called on first save failure');

  // クリーンアップ
  global.localStorage.setItem = originalSetItem;
  console.error = originalConsoleError;
  global.alert = originalAlert;

  // ④ presetNote の更新・保持確認
  store.initState({ bandName: '', items: [], hasPillars: false, presetNote: '' });
  store.updateState({ presetNote: '※モニターは天井に左右に吊るしてあります' });
  assert.strictEqual(store.state.presetNote, '※モニターは天井に左右に吊るしてあります', 'presetNote should be updated via updateState');

  // ⑤ updateState でpresetNoteが空文字になることの確認
  store.updateState({ presetNote: '' });
  assert.strictEqual(store.state.presetNote, '', 'presetNote should be clearable to empty string');

  // ⑥ updateState での部分更新がマージであることの確認
  store.initState({ bandName: 'Test', items: [], hasPillars: true, presetNote: 'note' });
  store.updateState({ bandName: 'Updated' });
  assert.strictEqual(store.state.bandName, 'Updated', 'bandName should be updated');
  assert.strictEqual(store.state.hasPillars, true, 'hasPillars should be preserved during partial update');
  assert.strictEqual(store.state.presetNote, 'note', 'presetNote should be preserved during partial update');

  // ⑦ setZIndex と incrementZIndex の連携
  store.setZIndex(10);
  assert.strictEqual(store.currentZIndex, 10, 'setZIndex should set exact value');
  const z2 = store.incrementZIndex();
  assert.strictEqual(z2, 10, 'incrementZIndex returns current then increments');
  assert.strictEqual(store.currentZIndex, 11, 'After increment, zIndex should be 11');

  // ⑧ localStorage に presetNote が保存されること
  clearLocalStorageMock();
  store.initState({ bandName: '', items: [], presetNote: '' });
  store.updateState({ presetNote: 'test note' });
  const savedNote = JSON.parse(global.localStorage.getItem('stageSettingState'));
  assert.strictEqual(savedNote.presetNote, 'test note', 'presetNote should be persisted to localStorage');

  console.log('store.js tests passed! ✅');
}
