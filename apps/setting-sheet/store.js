const STORAGE_KEY = 'stageSettingState';

export let state = {
  bandName: '',
  bandMembers: '',
  bandMemo: '',
  items: [],
  hasPillars: false,
  presetNote: ''
};

export let currentZIndex = 1;
let hasAlertedSaveError = false;


export function updateState(newState) {
  state = { ...state, ...newState };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state:', e);
    if (!hasAlertedSaveError) {
      alert('【警告】端末の容量不足やブラウザの設定により、自動保存ができません。ページをリロードすると作業内容が消えてしまいますのでご注意ください。');
      hasAlertedSaveError = true;
    }
  }
}

export function initState(initialState) {
  state = initialState;
}

export function setZIndex(z) {
  currentZIndex = z;
}

export function incrementZIndex() {
  return currentZIndex++;
}
