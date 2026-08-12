/**
 * Pure functions for Logic Layer (No DOM dependency)
 */

export function checkDropLocation(x, y, stageRect) {
  return (
    x >= stageRect.left &&
    x <= stageRect.right &&
    y >= stageRect.top &&
    y <= stageRect.bottom
  );
}

export function calculateNextRotation(currentRotation) {
  return ((currentRotation + 45) % 360 + 360) % 360;
}


export function determineTouchAction(startX, startY, endX, endY, threshold) {
  // 【設計判断：クリック/タップとドラッグの判定分離】
  // スマホ実機で「タップ」しようとした際、指の腹が潰れて数px座標が動いてしまうと、
  // ブラウザは「ドラッグされた（pointermove）」と誤認する。
  // そのため、ピタゴラスの定理（直線距離）を用いて「移動距離が閾値（threshold）未満ならタップ」と判定している。
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < threshold ? 'tap' : 'drag';
}

export function safeParseLocalStorage(savedStr) {
  const defaultState = { bandName: '', bandMembers: '', bandMemo: '', items: [], hasPillars: false, presetNote: '' };
  if (!savedStr) return defaultState;
  
  try {
    const parsed = JSON.parse(savedStr);
    if (!parsed || typeof parsed !== 'object') return defaultState;

    let items = Array.isArray(parsed.items) ? parsed.items : [];
    const migratedItems = [];
    
    items.forEach(item => {
      if (!item || typeof item !== 'object') return; // 不正なアイテムを除外

      // 1. type互換性担保
      let type = typeof item.type === 'string' ? item.type : 'free_text_m';
      if (type === 'free_text') type = 'free_text_m';
      
      // 2. プロパティの型安全な初期化と旧互換性
      let bringInStatus = item.bringIn === true || item.isBringIn === true;
      const safeItem = {
        id: typeof item.id === 'string' ? item.id : generateUUID(),
        type: type,
        x: typeof item.x === 'number' ? item.x : 50,
        y: typeof item.y === 'number' ? item.y : 50,
        rotation: typeof item.rotation === 'number' ? item.rotation : 0,
        bringIn: bringInStatus,
        zIndex: typeof item.zIndex === 'number' ? item.zIndex : 1,
        customName: typeof item.customName === 'string' ? item.customName : '',
        memo: typeof item.memo === 'string' ? item.memo : '',
        phantom: typeof item.phantom === 'boolean' ? item.phantom : false
      };

      if (typeof item.isLocked === 'boolean') {
        safeItem.isLocked = item.isLocked;
      }

      // 3. 古いcount仕様の分解
      const count = typeof item.count !== 'undefined' ? parseInt(item.count, 10) : 1;
      
      if (count > 1) {
        for (let i = 0; i < count; i++) {
          migratedItems.push({
            ...safeItem,
            id: safeItem.id + '_migrated_' + i,
            x: Math.min(95, safeItem.x + (i * 2)),
            y: Math.min(95, safeItem.y + (i * 2))
          });
        }
      } else {
        migratedItems.push(safeItem);
      }
    });

    return {
      bandName: typeof parsed.bandName === 'string' ? parsed.bandName : defaultState.bandName,
      bandMembers: typeof parsed.bandMembers === 'string' ? parsed.bandMembers : defaultState.bandMembers,
      bandMemo: typeof parsed.bandMemo === 'string' ? parsed.bandMemo : defaultState.bandMemo,
      items: migratedItems,
      hasPillars: typeof parsed.hasPillars === 'boolean' ? parsed.hasPillars : defaultState.hasPillars,
      presetNote: typeof parsed.presetNote === 'string' ? parsed.presetNote : defaultState.presetNote
    };
  } catch (e) {
    console.error('LocalStorage parsing failed:', e);
    return defaultState;
  }
}

export function generateUUID() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function createNewItem(type, x, y, bringIn = false, zIndex = 1) {
  return {
    id: generateUUID(),
    type,
    x,
    y,
    rotation: 0,
    bringIn,
    phantom: (!bringIn && type === 'di'),
    memo: '',
    customName: '',
    zIndex
  };
}


