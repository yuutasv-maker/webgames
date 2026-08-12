import { state } from './store.js';

export const TYPE_NAMES = {
  vocal_mic: 'Voマイク', cho_mic: 'Choマイク', inst_mic: 'Mic(楽器)', short_mic: 'S.Mic', gt_amp: 'Gtアンプ', ba_amp: 'Baアンプ', drum_set: 'ドラム',
  keyboard: 'キーボード', di: 'DI', chair: 'イス', music_stand: '譜面台', table: '机', 
  free_text_s: 'カスタム(小)', free_text_m: 'カスタム(中)', free_text_l: 'カスタム(大)'
};

export const ITEM_SIZES = {
  vocal_mic: { w: 9.5, h: 16.9 },
  inst_mic:  { w: 9.5, h: 16.9 },
  cho_mic:   { w: 9.5, h: 16.9 },
  short_mic: { w: 9.5, h: 16.9 },
  gt_amp:    { w: 12, h: 21.2 },
  ba_amp:    { w: 12, h: 21.2 },
  drum_set:  { w: 36, h: 64 },
  keyboard:  { w: 16, h: 28.4 },
  table:     { w: 9.5, h: 16.9 },
  music_stand: { w: 9, h: 7 },
  di:        { w: 7.5, h: 13.3 },
  free_text_s: { w: 5, h: 8.9 },
  free_text_m: { w: 8, h: 14.2 },
  free_text_l: { w: 14, h: 14.9 },
  free_text_pf: { w: 36, h: 21 },
  default:   { w: 10, h: 17.7 }
};

// DOM Elements
export const stageEl = document.getElementById('stage');
export const trashZone = document.getElementById('trash-zone');
export const paletteEl = document.getElementById('palette');
export const exportContainer = document.getElementById('export-container');

export const detailModal = document.getElementById('item-detail-modal');
export const btnCloseDetail = document.getElementById('btn-close-detail');
export const detailBringIn = document.getElementById('detail-bring-in');
export const detailMemo = document.getElementById('detail-memo');
export const detailNameGroup = document.getElementById('detail-name-group');
export const detailName = document.getElementById('detail-name');
export const detailPhantom = document.getElementById('detail-phantom');
export const btnDeleteItem = document.getElementById('btn-delete-item');
export const btnSaveItem = document.getElementById('btn-save-item');
export const modeHint = document.getElementById('mode-hint');

export const btnClear = document.getElementById('btn-clear');
export const btnExport = document.getElementById('btn-export');
export const bandNameInput = document.getElementById('band-name');
export const bandMembersInput = document.getElementById('band-members');
export const bandMemoInput = document.getElementById('band-memo');
export const modal = document.getElementById('export-modal');
export const btnCloseModal = document.getElementById('btn-close-modal');
export const modalImageContainer = document.getElementById('modal-image-container');

export const presetModal = document.getElementById('preset-modal');
export const btnClosePreset = document.getElementById('btn-close-preset');
export const btnPresetOptions = document.querySelectorAll('.btn-preset-option');

export const clearModal = document.getElementById('clear-modal');
export const btnCloseClear = document.getElementById('btn-close-clear');

export function renderBringInTable() {
  const container = document.getElementById('bring-in-table-container');
  const tbody = document.getElementById('bring-in-tbody');
  if (!container || !tbody) return;
  
  tbody.innerHTML = '';
  
  const bringInItems = state.items.filter(i => i.bringIn || i.isBringIn);
  if (bringInItems.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';
  
  bringInItems.forEach(item => {
    const phantomMark = item.phantom ? '*' : '';
    const name = item.type.startsWith('free_text') ? (item.customName || 'カスタム') : (TYPE_NAMES[item.type] || item.type);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${name}${phantomMark}</td>
      <td>${item.memo || ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

export function renderStage() {
  if (!stageEl) return;
  stageEl.innerHTML = '';
  renderBringInTable();
  
  const presetNoteEl = document.getElementById('preset-note');
  if (presetNoteEl) {
    if (state.presetNote) {
      presetNoteEl.textContent = state.presetNote;
      presetNoteEl.style.display = 'block';
    } else {
      presetNoteEl.style.display = 'none';
    }
  }

  const phantomLegend = document.getElementById('phantom-legend');
  if (phantomLegend) {
    const hasPhantom = state.items.some(i => i.phantom);
    phantomLegend.style.display = hasPhantom ? 'block' : 'none';
  }
  
  if (state.hasPillars) {
    stageEl.classList.add('has-pillars');
    // 左手前のせり出しスペースを追加
    const ext = document.createElement('div');
    ext.className = 'stage-extension';
    stageEl.appendChild(ext);
  } else {
    stageEl.classList.remove('has-pillars');
  }

  state.items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'stage-item';
    el.classList.add(item.type);
    if (item.bringIn || item.isBringIn) el.classList.add('bring-in');
    el.dataset.id = item.id;
    
    const img = document.createElement('img');
    let svgType = item.type;
    if (item.type === 'free_text_s') svgType = 'free_text_circle';
    else if (item.type.startsWith('free_text')) svgType = 'free_text';
    img.src = `assets/${svgType}.svg?v=8`;
    img.alt = item.type;
    // 【設計判断：絶対配置ハックの理由】
    // ステージコンテナはアスペクト比を維持するため `padding-top: 100%` ハックを使っている。
    // その結果、親要素の高さ（height）は仕様上 `0` 扱いとなる。
    // 親のheightが0の状態で子要素に `%` ベースの高さを指定するとSafari等で崩れるため、
    // ここではimg要素を `position: absolute` にして強制的に100%に広げている。
    img.style.position = 'absolute';
    img.style.top = '0';
    img.style.left = '0';
    img.style.width = '100%';
    img.style.height = '100%';
    el.appendChild(img);

    if (item.type.startsWith('free_text')) {
      const span = document.createElement('span');
      span.className = 'free-text-label';
      const text = item.customName || '';
      span.textContent = text;
      
      // 【設計判断：コンテナクエリ（cqw）を用いた動的フォントサイズ計算】
      // カスタムテキストは機材のサイズ（幅・高さ）や文字数によって文字がはみ出さないように動的に縮小する必要がある。
      // また、スマホとPCで画面幅が変わっても比率を維持するため、ステージ幅に依存する `cqw` 単位を最終的に使用している。
      const sizeConfig = ITEM_SIZES[item.type] || ITEM_SIZES.default;
      
      const lines = text.split('\n');
      const lineCount = lines.length;
      // 最も長い行の文字数を取得
      const maxLineLen = Math.max(1, ...lines.map(l => l.length));
      
      // 文字幅の限界 (幅の80%)
      const maxFontSize = sizeConfig.w * 0.8;
      // 高さの限界 (高さの70%を行数で割る)
      const maxHeight = (sizeConfig.h * 0.7) / lineCount;
      
      let fontSize = Math.min(maxFontSize / maxLineLen, maxHeight);
      // 最小フォントサイズ (これ以上ははみ出しても文字を潰さない)
      fontSize = Math.max(fontSize, 1.2);
      // 最大フォントサイズ (横長パーツ等で巨大になりすぎるのを防ぐ)
      fontSize = Math.min(fontSize, 4.5);
      
      span.style.fontSize = `${fontSize}cqw`;
      el.appendChild(span);
    }

    if (item.phantom) {
      const pMark = document.createElement('span');
      pMark.className = 'phantom-mark';
      pMark.textContent = '*';
      el.appendChild(pMark);
    }

    const size = ITEM_SIZES[item.type] || ITEM_SIZES.default;
    el.style.width = `${size.w}%`;
    // Safariバグ対策: heightではなくpaddingTopで高さを算出(幅基準の%指定を利用)
    el.style.height = '0';
    el.style.paddingTop = `${size.h * (9 / 16)}%`;
    el.style.left = `${item.x}%`;
    el.style.top = `${item.y}%`;
    el.style.marginLeft = `-${size.w / 2}%`; 
    el.style.marginTop = `-${(size.h * (9 / 16)) / 2}%`;  
    el.style.transform = `rotate(${item.rotation}deg)`;
    el.style.zIndex = item.zIndex;

    stageEl.appendChild(el);
  });
}

// トースト通知を表示する関数
export function showToast(message) {
  let toast = document.getElementById('toast-message');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-message';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  
  // 既存のタイマーがあればクリア
  if (toast.timeoutId) {
    clearTimeout(toast.timeoutId);
  }
  
  toast.timeoutId = setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}
