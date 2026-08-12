import { state, updateState, incrementZIndex } from './store.js';
import { ITEM_SIZES } from './ui.js';
import { checkDropLocation, calculateNextRotation, determineTouchAction, createNewItem } from './logic.js';

// ----------------------------------------------------
// 定数（マジックナンバーの由来）
// ----------------------------------------------------
// TAP_THRESHOLD: ユーザーが「タップした」とみなす最大移動距離（ピクセル）。
// スマホでは指の腹で触るため、意図せず数pxズレることが多い。そのため10pxの遊びを設けている。
const TAP_THRESHOLD = 10;

// FAT_FINGER_OFFSET: スマホで機材をドラッグする際、指の下に機材が隠れて見えなくなるのを防ぐための補正値。
// タッチ位置より40px上に要素をずらして描画・配置判定することで、ユーザーが「どこに置くか」を目視できるようにしている。
const FAT_FINGER_OFFSET = 40;

let dragInfo = null;

// main.jsから渡されるモードを受け取る
export let currentEditMode = 'move';
export function setEditMode(mode) {
  currentEditMode = mode;
}

export let activeItemId = null;
export function setActiveItemId(id) {
  activeItemId = id;
}

// setupDragDropから渡される参照を保持する内部変数
let _stageEl = null;
let _trashZone = null;
let _showToast = null;
let _onChange = null;

function getStageRelativeCoords(clientX, clientY) {
  const rect = _stageEl.getBoundingClientRect();
  return {
    xPct: ((clientX - rect.left) / rect.width) * 100,
    yPct: ((clientY - rect.top) / rect.height) * 100
  };
}

function updateGhostPosition(clientX, clientY) {
  if (dragInfo && dragInfo.ghostEl) {
    dragInfo.ghostEl.style.left = `${clientX}px`;
    dragInfo.ghostEl.style.top = `${clientY}px`;
  }
}

function getActivePointer(e) {
  if (!dragInfo) return null;
  if (e.pointerId === dragInfo.pointerId) {
    return e;
  }
  return null;
}

function handleCloneDrop(pointer, stageRect) {
  if (dragInfo.ghostEl && document.body.contains(dragInfo.ghostEl)) {
    document.body.removeChild(dragInfo.ghostEl);
  }
  let isInside = checkDropLocation(pointer.clientX, pointer.clientY, stageRect);
  
  // マウス操作時はカーソルの先端が指し示す位置、タッチ操作時（スマホ等）は指の腹で隠れないよう上方にオフセットした位置を実際のドロップY座標とする
  const offset = pointer.pointerType === 'mouse' ? 0 : FAT_FINGER_OFFSET;
  const dropY = pointer.clientY - offset;
  const { xPct, yPct } = getStageRelativeCoords(pointer.clientX, dropY);

  // せり出し部分の許容判定
  // 通常のステージ外（手前下部）であっても、柱ありレイアウト（hasPillars）の場合は左手前に「せり出しステージ」が存在するため、その領域内であればドロップを許可する
  if (!isInside && state.hasPillars) {
    if (xPct >= 0 && xPct <= 25 && yPct >= 100 && yPct <= 120) {
      isInside = true;
    }
  }

  if (isInside) {
    const isFreeText = dragInfo.type.startsWith('free_text');
    const newItem = createNewItem(dragInfo.type, xPct, yPct, isFreeText, incrementZIndex());
    updateState({ items: [...state.items, newItem] });
  }
}

function handleItemTap(item, itemIndex, newItems, onShowDetailModal) {
  if (currentEditMode === 'move') {
    activeItemId = item.id;
    if (onShowDetailModal) onShowDetailModal(item);
  } else if (currentEditMode === 'rotate') {
    if (item.isLocked) {
      if (_showToast) _showToast('基本セット（Pfなど）は回転できません');
      return;
    }
    item.rotation = calculateNextRotation(item.rotation);
    newItems[itemIndex] = item;
    updateState({ items: newItems });
  }
}

function handleItemMove(item, itemIndex, newItems, pointer) {
  if (currentEditMode === 'rotate') return;
  if (item.isLocked) return; // 固定アイテムは移動・削除不可

  const offset = pointer.pointerType === 'mouse' ? 0 : FAT_FINGER_OFFSET;
  const targetY = pointer.clientY - offset;
  
  // スマホ等での削除判定を甘くするためヒットボックスを拡大
  const trashRect = _trashZone.getBoundingClientRect();
  const TRASH_INFLATE = 40;
  const lenientTrashRect = {
    left: trashRect.left - TRASH_INFLATE,
    right: trashRect.right + TRASH_INFLATE,
    top: trashRect.top - TRASH_INFLATE,
    bottom: trashRect.bottom + TRASH_INFLATE
  };

  // 削除判定
  if (checkDropLocation(pointer.clientX, targetY, lenientTrashRect)) {
    newItems.splice(itemIndex, 1);
    updateState({ items: newItems });
    return;
  }

  // 移動判定
  if (currentEditMode === 'move') {
    const { xPct, yPct } = getStageRelativeCoords(pointer.clientX, targetY);
    
    let maxY = 100;
    if (state.hasPillars && xPct <= 25) {
      maxY = 120; // せり出し部分への配置を許可
    }

    const BUFFER = 15; // 15% の猶予範囲
    const isWithinBuffer = (xPct >= -BUFFER && xPct <= 100 + BUFFER && yPct >= -BUFFER && yPct <= maxY + BUFFER);
    if (isWithinBuffer) {
      item.x = Math.max(0, Math.min(100, xPct));
      item.y = Math.max(0, Math.min(maxY, yPct));
    } else {
      item.x = dragInfo.originalX;
      item.y = dragInfo.originalY;
      if (_showToast) _showToast('ステージ外のため元の位置に戻しました');
    }
    item.zIndex = incrementZIndex();
    newItems[itemIndex] = item;
    updateState({ items: newItems });
  }
}

function handleMoveDrop(pointer, stageRect, onShowDetailModal) {
  if (dragInfo.targetEl) dragInfo.targetEl.classList.remove('dragging');
  
  const action = determineTouchAction(
    dragInfo.startX, dragInfo.startY, pointer.clientX, pointer.clientY, TAP_THRESHOLD
  );

  const newItems = [...state.items];
  const itemIndex = newItems.findIndex(i => i.id === dragInfo.id);
  if (itemIndex === -1) return;
  const item = { ...newItems[itemIndex] };

  if (action === 'tap') {
    handleItemTap(item, itemIndex, newItems, onShowDetailModal);
  } else {
    handleItemMove(item, itemIndex, newItems, pointer);
  }
}

export function setupDragDrop(config) {
  const { paletteEl, stageEl, trashZone, onShowDetailModal, onChange, showToast } = config;
  
  _stageEl = stageEl;
  _trashZone = trashZone;
  _onChange = onChange;
  _showToast = showToast;

  paletteEl.addEventListener('pointerdown', (e) => {
    if (dragInfo) return;
    const pointer = e;
    const target = e.target.closest('.palette-item');
    if (!target) return;
    e.preventDefault();

    const type = target.dataset.type;
    const ghost = document.createElement('div');
    ghost.className = 'stage-item dragging';
    
    const img = document.createElement('img');
    let svgType = type;
    if (type === 'free_text_s') svgType = 'free_text_circle';
    else if (type.startsWith('free_text')) svgType = 'free_text';
    img.src = `assets/${svgType}.svg?v=8`;
    img.style.position = 'absolute';
    img.style.top = '0';
    img.style.left = '0';
    img.style.width = '100%';
    img.style.height = '100%';
    ghost.appendChild(img);
    document.body.appendChild(ghost);

    const size = ITEM_SIZES[type] || ITEM_SIZES.default;
    const stageRect = _stageEl.getBoundingClientRect();
    ghost.style.width = `${stageRect.width * (size.w / 100)}px`;
    ghost.style.height = `${stageRect.height * (size.h / 100)}px`;
    ghost.style.zIndex = 9999;
    ghost.style.position = 'fixed';
    ghost.style.transform = `translate(-50%, -50%)`;

    dragInfo = {
      mode: 'clone',
      type: type,
      ghostEl: ghost,
      bringIn: false,
      startX: pointer.clientX,
      startY: pointer.clientY,
      pointerId: pointer.pointerId,
      pointerType: pointer.pointerType
    };
    updateGhostPosition(pointer.clientX, pointer.clientY);
  }, { passive: false });

  _stageEl.addEventListener('pointerdown', (e) => {
    if (dragInfo) return;
    const pointer = e;
    const target = e.target.closest('.stage-item');
    if (!target) return;
    e.preventDefault();

    const id = target.dataset.id;
    const itemIndex = state.items.findIndex(i => i.id === id);
    if (itemIndex === -1) return;

    const newItems = [...state.items];
    newItems[itemIndex] = { ...newItems[itemIndex], zIndex: incrementZIndex() };
    updateState({ items: newItems });
    target.style.zIndex = newItems[itemIndex].zIndex;

    dragInfo = {
      mode: 'move',
      id: id,
      targetEl: target,
      startX: pointer.clientX,
      startY: pointer.clientY,
      originalX: state.items[itemIndex].x,
      originalY: state.items[itemIndex].y,
      pointerId: pointer.pointerId,
      pointerType: pointer.pointerType
    };
    target.classList.add('dragging');
  }, { passive: false });

  document.addEventListener('pointermove', (e) => {
    const pointer = getActivePointer(e);
    if (!pointer) return;
    // e.preventDefault(); // pointermoveでのpreventDefaultは環境により警告が出るため、CSS(touch-action:none)に任せる
    if (dragInfo.mode === 'move') {
        const offset = pointer.pointerType === 'mouse' ? 0 : FAT_FINGER_OFFSET;
        const targetY = pointer.clientY - offset;
        
        const trashRect = _trashZone.getBoundingClientRect();
        const TRASH_INFLATE = 40;
        const lenientTrashRect = {
          left: trashRect.left - TRASH_INFLATE,
          right: trashRect.right + TRASH_INFLATE,
          top: trashRect.top - TRASH_INFLATE,
          bottom: trashRect.bottom + TRASH_INFLATE
        };

        const isOverTrash = checkDropLocation(pointer.clientX, targetY, lenientTrashRect);
        if (isOverTrash) {
          _trashZone.classList.add('drag-over');
        } else {
          _trashZone.classList.remove('drag-over');
        }
    }
    
    if (dragInfo.mode === 'clone') {
      updateGhostPosition(pointer.clientX, pointer.clientY);
    } else if (dragInfo.mode === 'move') {
      const item = state.items.find(i => i.id === dragInfo.id);
      if (item && item.isLocked) {
        const moveDistance = Math.hypot(pointer.clientX - dragInfo.startX, pointer.clientY - dragInfo.startY);
        if (moveDistance > TAP_THRESHOLD && !dragInfo.hasWarnedLocked) {
          dragInfo.hasWarnedLocked = true;
          showToast('基本セット（Pfなど）は移動できません');
        }
        return; // 固定アイテムは視覚的にも動かさない
      }

      if (currentEditMode === 'move') {
        const offset = pointer.pointerType === 'mouse' ? 0 : FAT_FINGER_OFFSET;
        const targetY = pointer.clientY - offset;
        const { xPct, yPct } = getStageRelativeCoords(pointer.clientX, targetY);
        dragInfo.targetEl.style.left = `${xPct}%`;
        dragInfo.targetEl.style.top = `${yPct}%`;
      } else if (currentEditMode === 'rotate') {
        const moveDistance = Math.hypot(pointer.clientX - dragInfo.startX, pointer.clientY - dragInfo.startY);
        if (moveDistance > TAP_THRESHOLD && !dragInfo.hasWarnedRotate) {
          dragInfo.hasWarnedRotate = true;
          _showToast('移動させる場合は「✋ 移動」に切り替えてください');
        }
      }
    }
  }, { passive: false });

  document.addEventListener('pointerup', (e) => {
    const pointer = getActivePointer(e);
    if (!pointer) return;

    if (dragInfo) {
      _trashZone.classList.remove('drag-over');
      const stageRect = _stageEl.getBoundingClientRect();
      
      if (dragInfo.mode === 'clone') {
        handleCloneDrop(pointer, stageRect);
      } else if (dragInfo.mode === 'move') {
        handleMoveDrop(pointer, stageRect, onShowDetailModal);
      }
      dragInfo = null;
      if (_onChange) _onChange();
    }
  });

  document.addEventListener('pointercancel', (e) => {
    const pointer = getActivePointer(e);
    if (!pointer) return;

    if (dragInfo.mode === 'clone' && dragInfo.ghostEl) {
      if (document.body.contains(dragInfo.ghostEl)) {
        document.body.removeChild(dragInfo.ghostEl);
      }
    } else if (dragInfo.mode === 'move' && dragInfo.targetEl) {
      dragInfo.targetEl.classList.remove('dragging');
    }
    
    dragInfo = null;
    if (_onChange) _onChange();
  });
}
