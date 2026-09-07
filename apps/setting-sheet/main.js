/**
 * UI Layer (DOM操作とイベントリスナーのエントリーポイント)
 */
import { state, updateState, initState, setZIndex } from './store.js';
import { 
  renderStage, 
  detailModal, btnCloseDetail, btnDeleteItem, btnSaveItem, 
  detailBringIn, detailMemo, detailNameGroup, detailName, detailPhantom,
  modeHint, btnClear, btnExport, exportContainer,
  bandNameInput, bandMembersInput, bandMemoInput,
  modal, btnCloseModal, modalImageContainer, paletteEl,
  presetModal, btnClosePreset, btnPresetOptions,
  clearModal, btnCloseClear,
  showToast
} from './ui.js';
import { setupDragDrop, setEditMode, setActiveItemId, activeItemId, currentEditMode } from './dragdrop.js';
import { safeParseLocalStorage } from './logic.js';

// ==========================================
// 1. Action Buttons & Input Listeners
// ==========================================
const editModeRadios = document.querySelectorAll('input[name="edit-mode"]');

editModeRadios.forEach(r => r.addEventListener('change', (e) => {
  setEditMode(e.target.value);
  if (modeHint) {
    if (e.target.value === 'move') {
      modeHint.textContent = '💡 機材タップで詳細設定（持込/備考）';
    } else {
      modeHint.textContent = '💡 機材タップで45度回転';
    }
  }
}));

btnCloseDetail.addEventListener('click', () => detailModal.classList.add('hidden'));

btnDeleteItem.addEventListener('click', () => {
  if (activeItemId) {
    const newItems = state.items.filter(i => i.id !== activeItemId);
    updateState({ items: newItems });
    detailModal.classList.add('hidden');
    renderStage();
  }
});

btnSaveItem.addEventListener('click', () => {
  if (activeItemId) {
    const newItems = [...state.items];
    const idx = newItems.findIndex(i => i.id === activeItemId);
    if (idx !== -1) {
      newItems[idx] = { ...newItems[idx], bringIn: detailBringIn.checked, memo: detailMemo.value, phantom: detailPhantom.checked };
      if (newItems[idx].type.startsWith('free_text')) {
        newItems[idx].customName = detailName.value;
      }
      updateState({ items: newItems });
      renderStage();
    }
    detailModal.classList.add('hidden');
  }
});

if (btnClear && clearModal) {
  btnClear.addEventListener('click', () => {
    clearModal.classList.remove('hidden');
  });
}

if (btnCloseClear && clearModal) {
  btnCloseClear.addEventListener('click', () => {
    clearModal.classList.add('hidden');
  });
}

const btnClearOwlInit = document.getElementById('btn-clear-owl-init');
if (btnClearOwlInit) {
  btnClearOwlInit.addEventListener('click', () => {
    if (confirm('スタジオOWL初期状態にクリアしますか？\n（形状・固定ピアノ・注釈を残し、追加機材とバンド情報を消去します）')) {
      const owlInitItems = [
        { id: `preset_pf_${Date.now()}`, type: 'free_text_pf', customName: 'Pf', x: 6, y: 60, rotation: -90, zIndex: 1, isLocked: true }
      ];
      updateState({ 
        items: owlInitItems, 
        hasPillars: true,
        presetNote: '※モニターは天井に左右に吊るしてあります',
        bandName: '',
        bandMembers: '',
        bandMemo: ''
      });
      bandNameInput.value = '';
      bandMembersInput.value = '';
      bandMemoInput.value = '';
      renderStage();
      if (clearModal) clearModal.classList.add('hidden');
    }
  });
}

const btnClearBlank = document.getElementById('btn-clear-blank');
if (btnClearBlank) {
  btnClearBlank.addEventListener('click', () => {
    if (confirm('完全クリア（白紙状態）にしますか？\n（形状や固定ピアノも含め、すべて消去されます）')) {
      updateState({ 
        items: [], 
        hasPillars: false,
        bandName: '',
        bandMembers: '',
        bandMemo: '',
        presetNote: ''
      });
      bandNameInput.value = '';
      bandMembersInput.value = '';
      bandMemoInput.value = '';
      renderStage();
      if (clearModal) clearModal.classList.add('hidden');
    }
  });
}

const btnPreset = document.getElementById('btn-preset');
if (btnPreset) {
  btnPreset.addEventListener('click', () => {
    presetModal.classList.remove('hidden');
  });
}

if (btnClosePreset) {
  btnClosePreset.addEventListener('click', () => {
    presetModal.classList.add('hidden');
  });
}

if (btnPresetOptions) {
  btnPresetOptions.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const type = e.target.dataset.preset;
      if (confirm('現在の配置は上書きされます。よろしいですか？')) {
        loadPreset(type);
        presetModal.classList.add('hidden');
      }
    });
  });
}

// チュートリアル動画モーダル制御
const btnTutorial = document.getElementById('btn-tutorial');
const tutorialModal = document.getElementById('tutorial-modal');
const btnCloseTutorial = document.getElementById('btn-close-tutorial');
const btnDismissTutorial = document.getElementById('btn-dismiss-tutorial');
const tutorialVideo = document.getElementById('tutorial-video');

function openTutorialModal() {
  if (tutorialModal) {
    tutorialModal.classList.remove('hidden');
    if (tutorialVideo) {
      tutorialVideo.currentTime = 0;
      tutorialVideo.play().catch(() => {});
    }
  }
}

function closeTutorialModal() {
  if (tutorialModal) {
    tutorialModal.classList.add('hidden');
    if (tutorialVideo) {
      tutorialVideo.pause();
    }
  }
}

if (btnTutorial) btnTutorial.addEventListener('click', openTutorialModal);
if (btnCloseTutorial) btnCloseTutorial.addEventListener('click', closeTutorialModal);
if (btnDismissTutorial) btnDismissTutorial.addEventListener('click', closeTutorialModal);
if (tutorialModal) {
  tutorialModal.addEventListener('click', (e) => {
    if (e.target === tutorialModal) closeTutorialModal();
  });
}

const formatModal = document.getElementById('format-modal');
const btnCloseFormat = document.getElementById('btn-close-format');
const btnExportImage = document.getElementById('btn-export-image');
const btnExportPdf = document.getElementById('btn-export-pdf');

btnExport.addEventListener('click', () => {
  formatModal.classList.remove('hidden');
});

btnCloseFormat.addEventListener('click', () => {
  formatModal.classList.add('hidden');
});

let isExporting = false;

function generateExportImage(onSuccess) {
  if (isExporting) return;
  isExporting = true;
  
  const tableContainer = document.getElementById('bring-in-table-container');
  const bandInfoHeader = document.getElementById('band-info-header');

  // 【設計判断：画像エクスポート時のDOMの再構成】
  // html-to-image は指定したDOMノード（ここでは exportContainer）をそのままCanvasに書き出す。
  // しかし、通常時は「バンド情報」「ステージ」「持ち込み機材リスト」が画面上でバラバラの場所にあるため、
  // 1枚の画像に綺麗に収めるために、書き出しの瞬間だけこれらを exportContainer の中に物理的に移動させている。
  const originalTableParent = tableContainer.parentNode;
  const originalTableNextSibling = tableContainer.nextSibling;
  const originalHeaderParent = bandInfoHeader.parentNode;
  const originalHeaderNextSibling = bandInfoHeader.nextSibling;

  exportContainer.appendChild(bandInfoHeader);
  exportContainer.appendChild(tableContainer);

  // 【設計判断：未入力プレースホルダーの非表示化】
  // placeholder 属性を持つ input 要素が空の場合、グレーの文字で「バンド名を入力」などが表示されたまま画像化されてしまう。
  // これを防ぐため、書き出しの瞬間だけ placeholder を削除し、後で復元する。
  const inputs = bandInfoHeader.querySelectorAll('input, textarea');
  inputs.forEach(input => {
    if (!input.value.trim() && input.hasAttribute('placeholder')) {
      input.dataset.tempPlaceholder = input.getAttribute('placeholder');
      input.setAttribute('placeholder', '');
    }
  });

  const options = {
    pixelRatio: window.devicePixelRatio || 2,
    backgroundColor: '#ffffff'
  };

  const restoreDOM = () => {
    inputs.forEach(input => {
      if (input.dataset.tempPlaceholder != null) {
        input.setAttribute('placeholder', input.dataset.tempPlaceholder);
        delete input.dataset.tempPlaceholder;
      }
    });

    if (originalHeaderNextSibling) {
      originalHeaderParent.insertBefore(bandInfoHeader, originalHeaderNextSibling);
    } else {
      originalHeaderParent.appendChild(bandInfoHeader);
    }

    if (originalTableNextSibling) {
      originalTableParent.insertBefore(tableContainer, originalTableNextSibling);
    } else {
      originalTableParent.appendChild(tableContainer);
    }
  };

  try {
    if (!window.htmlToImage) {
      throw new Error('html-to-image library is not loaded');
    }
    window.htmlToImage.toPng(exportContainer, options).then(dataUrl => {
      onSuccess(dataUrl);
    }).catch(e => {
      console.error('html-to-image rendering failed:', e);
      alert('【書き出しエラー】\n画像の生成に失敗しました。\n・お使いの端末やブラウザが対応していない可能性があります。\n・メモリ不足の場合は、不要なタブを閉じてから再度お試しください。');
    }).finally(() => {
      restoreDOM();
      isExporting = false;
    });
  } catch (e) {
    console.error('Export setup failed:', e);
    alert('【システムエラー】\n画像生成ライブラリの読み込みに失敗しました。\n通信環境の良い場所でページを再読み込みしてください。');
    restoreDOM();
    isExporting = false;
  }
}

btnExportImage.addEventListener('click', () => {
  formatModal.classList.add('hidden');
  generateExportImage(dataUrl => {
    try {
      modalImageContainer.innerHTML = '';
      const img = document.createElement('img');
      img.src = dataUrl;
      modalImageContainer.appendChild(img);
      modal.classList.remove('hidden');
    } catch (e) {
      console.error('Export display failed:', e);
      alert('【表示エラー】\n生成された画像の表示に失敗しました。\n端末の空き容量やメモリが不足している可能性があります。');
    }
  });
});

btnExportPdf.addEventListener('click', () => {
  formatModal.classList.add('hidden');
  generateExportImage(dataUrl => {
    try {
      // jsPDFオブジェクトの作成 (A4, 縦向き(portrait), pt単位)
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'pt', 'a4');
      
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      // 画像を追加 (0, 0から、幅はPDF全体、高さは比率維持)
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      let bandName = document.getElementById('band-name').value.trim();
      let filename = bandName ? `${bandName}.pdf` : `セッティングシート.pdf`;
      
      pdf.save(filename);
    } catch (e) {
      console.error('PDF export failed:', e);
      alert('【PDF生成エラー】\nPDFの作成に失敗しました。\n端末のメモリ不足か、未対応のブラウザ（一部の古いスマートフォン等）の可能性があります。');
    }
  });
});

btnCloseModal.addEventListener('click', () => {
  modal.classList.add('hidden');
});

// モーダル表示コールバック（dragdrop.jsからの呼び出し用）
export function onShowDetailModal(item) {
  setActiveItemId(item.id);
  detailBringIn.checked = item.bringIn || item.isBringIn || false;
  detailPhantom.checked = item.phantom || false;
  detailMemo.value = item.memo || '';
  if (item.type.startsWith('free_text')) {
    if (detailNameGroup) detailNameGroup.style.display = 'block';
    if (detailName) detailName.value = item.customName || '';
  } else {
    if (detailNameGroup) detailNameGroup.style.display = 'none';
  }
  
  if (item.isLocked) {
    btnDeleteItem.style.display = 'none';
  } else {
    btnDeleteItem.style.display = '';
  }

  detailModal.classList.remove('hidden');
}

// ==========================================
// 2. Initialization
// ==========================================

// ==========================================
// 4. Drag & Drop Initialization (init()内で実行)
// ==========================================

export function loadPreset(presetType = 'owl_basic') {
  let presetItems = [];
  let hasPillars = false;
  let presetNote = '';

  if (presetType === 'owl_basic') {
    presetItems = [
      { id: `preset_pf_${Date.now()}`, type: 'free_text_pf', customName: 'Pf', x: 6, y: 60, rotation: -90, zIndex: 1, isLocked: true },
      { id: `preset_ba_${Date.now()}`, type: 'ba_amp', x: 25, y: 15, rotation: 0, zIndex: 2 },
      { id: `preset_dr_${Date.now()}`, type: 'drum_set', x: 65, y: 20, rotation: 0, zIndex: 3 },
      { id: `preset_ga_${Date.now()}`, type: 'gt_amp', x: 94, y: 50, rotation: -90, zIndex: 4 },
      { id: `preset_vo_${Date.now()}`, type: 'vocal_mic', x: 50, y: 70, rotation: 0, zIndex: 5 }
    ];
    hasPillars = true;
    presetNote = '※モニターは天井に左右に吊るしてあります';
  } else if (presetType === 'acoustic') {
    presetItems = [
      { id: `preset_pf_${Date.now()}`, type: 'free_text_pf', customName: 'Pf', x: 6, y: 60, rotation: -90, zIndex: 1, isLocked: true },
      { id: `preset_ch_${Date.now()}`, type: 'chair', x: 50, y: 50, rotation: 0, zIndex: 2 },
      { id: `preset_di_${Date.now()}`, type: 'di', x: 40, y: 55, rotation: 0, zIndex: 3 },
      { id: `preset_vo_${Date.now()}`, type: 'vocal_mic', x: 50, y: 65, rotation: 0, zIndex: 4 },
      { id: `preset_ms_${Date.now()}`, type: 'music_stand', x: 50, y: 80, rotation: 0, zIndex: 5 }
    ];
    hasPillars = true;
    presetNote = '※モニターは天井に左右に吊るしてあります';
  } else if (presetType === 'acoustic_simple') {
    presetItems = [
      { id: `preset_ch_${Date.now()}`, type: 'chair', x: 50, y: 50, rotation: 0, zIndex: 1 },
      { id: `preset_di_${Date.now()}`, type: 'di', x: 40, y: 55, rotation: 0, zIndex: 2 },
      { id: `preset_vo_${Date.now()}`, type: 'vocal_mic', x: 50, y: 65, rotation: 0, zIndex: 3 },
      { id: `preset_ms_${Date.now()}`, type: 'music_stand', x: 50, y: 80, rotation: 0, zIndex: 4 },
      { id: `preset_mon_${Date.now()}`, type: 'free_text', customName: 'モニター', x: 62, y: 88, rotation: 315, zIndex: 5 }
    ];
    hasPillars = false;
  } else if (presetType === 'band_simple') {
    presetItems = [
      { id: `preset_ba_${Date.now()}`, type: 'ba_amp', x: 20, y: 25, rotation: 315, zIndex: 1 },
      { id: `preset_dr_${Date.now()}`, type: 'drum_set', x: 50, y: 25, rotation: 0, zIndex: 2 },
      { id: `preset_ga_${Date.now()}`, type: 'gt_amp', x: 80, y: 25, rotation: 45, zIndex: 3 },
      { id: `preset_vo_${Date.now()}`, type: 'vocal_mic', x: 50, y: 70, rotation: 0, zIndex: 4 },
      { id: `preset_mon1_${Date.now()}`, type: 'free_text', customName: 'モニター', x: 35, y: 85, rotation: 45, zIndex: 5 },
      { id: `preset_mon2_${Date.now()}`, type: 'free_text', customName: 'モニター', x: 65, y: 85, rotation: 315, zIndex: 6 }
    ];
    hasPillars = false;
  }

  updateState({ items: presetItems, hasPillars: hasPillars, presetNote: presetNote });
  setZIndex(presetItems.length + 1);
  renderStage();
}

export function init() {
  const STORAGE_KEY = 'stageSettingState';
  const dataStr = localStorage.getItem(STORAGE_KEY);
  
  const parsedState = safeParseLocalStorage(dataStr);
  initState(parsedState);

  // 初回アクセス時（保存データがない場合）はプリセットを配置
  if (!dataStr || state.items.length === 0) {
    // 過去にクリアして空になった場合との区別が難しいですが、
    // 今回の仕様では「何もなければ初期セット」とします。
    // もし嫌ならbtn-presetのみにするなど調整可能ですが、案Aの要望通りとします。
    if (!dataStr) { // 完全初回のみ自動ロード
      loadPreset();
    }
  }

  if (state.items.length > 0) {
    const maxZ = Math.max(...state.items.map(i => i.zIndex || 1));
    setZIndex(maxZ + 1);
  }

  bandNameInput.value = state.bandName || '';
  bandMembersInput.value = state.bandMembers || '';
  bandMemoInput.value = state.bandMemo || '';

  [bandNameInput, bandMembersInput, bandMemoInput].forEach(input => {
    input.addEventListener('input', () => {
      updateState({
        bandName: bandNameInput.value,
        bandMembers: bandMembersInput.value,
        bandMemo: bandMemoInput.value
      });
    });
  });

  setupDragDrop({
    paletteEl,
    stageEl: document.getElementById('stage'),
    trashZone: document.getElementById('trash-zone'),
    onShowDetailModal,
    onChange: renderStage,
    showToast
  });
  renderStage();

  // 複数タブでの競合（localStorageのLast Write Wins）対策
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      if (confirm('別のタブでデータが更新されました。\n最新のデータで画面を再読み込みしますか？')) {
        location.reload();
      }
    }
  });
}

// 起動
init();
