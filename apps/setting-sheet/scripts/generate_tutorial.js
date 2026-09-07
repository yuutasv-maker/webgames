import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, '..');
const framesDir = path.resolve(appDir, '.tmp_frames');
const assetsDir = path.resolve(appDir, 'assets');

// キャプチャ・画面設定
const FPS = 20;
const VIEWPORT_WIDTH = 390;
const VIEWPORT_HEIGHT = 844;
const DEVICE_SCALE_FACTOR = 2;

// 一時ディレクトリ & 出力ディレクトリ初期化
if (fs.existsSync(framesDir)) {
  fs.rmSync(framesDir, { recursive: true, force: true });
}
fs.mkdirSync(framesDir, { recursive: true });
fs.mkdirSync(assetsDir, { recursive: true });

// ローカル静的サーバー起動
function startServer() {
  const server = http.createServer((req, res) => {
    let filePath = path.join(appDir, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    let extname = path.extname(filePath);
    let contentType = 'text/html';
    switch (extname) {
      case '.js': contentType = 'text/javascript'; break;
      case '.css': contentType = 'text/css'; break;
      case '.json': contentType = 'application/json'; break;
      case '.svg': contentType = 'image/svg+xml'; break;
      case '.png': contentType = 'image/png'; break;
      case '.jpg': contentType = 'image/jpeg'; break;
    }
    fs.readFile(filePath, (error, content) => {
      if (error) {
        res.writeHead(404);
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

// ページ内に仮想ポインタ・テロップオーバーレイを挿入
async function injectVisualGuide(page) {
  await page.evaluate(() => {
    // スタイル定義
    const style = document.createElement('style');
    style.innerHTML = `
      #tutorial-pointer {
        position: fixed;
        width: 32px;
        height: 32px;
        background: radial-gradient(circle, rgba(59, 130, 246, 0.9) 0%, rgba(37, 99, 235, 0.7) 60%, rgba(29, 78, 216, 0.4) 100%);
        border: 2.5px solid #ffffff;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35), inset 0 0 6px rgba(255, 255, 255, 0.8);
        border-radius: 50%;
        pointer-events: none;
        z-index: 999999;
        transform: translate(-50%, -50%);
        transition: left 0.3s cubic-bezier(0.25, 1, 0.5, 1), top 0.3s cubic-bezier(0.25, 1, 0.5, 1), transform 0.15s ease-out, background 0.15s ease-out;
        display: none;
      }
      #tutorial-pointer.touching {
        transform: translate(-50%, -50%) scale(0.85);
        background: radial-gradient(circle, rgba(239, 68, 68, 0.95) 0%, rgba(220, 38, 38, 0.8) 70%);
      }
      .tutorial-ripple {
        position: fixed;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 3px solid #3b82f6;
        background: rgba(59, 130, 246, 0.3);
        pointer-events: none;
        z-index: 999998;
        transform: translate(-50%, -50%) scale(1);
        animation: tutorial-ripple-anim 0.6s cubic-bezier(0.25, 1, 0.5, 1) forwards;
      }
      @keyframes tutorial-ripple-anim {
        0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(3.5); opacity: 0; }
      }

      #tutorial-telop-card {
        position: fixed;
        left: 50%;
        width: 90%;
        max-width: 360px;
        background: rgba(15, 23, 42, 0.94);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        color: #ffffff;
        padding: 12px 16px;
        border-radius: 14px;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.15);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", sans-serif;
        z-index: 999990;
        display: flex;
        flex-direction: column;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        pointer-events: none;
      }
      #tutorial-telop-card.pos-bottom {
        bottom: 24px;
        top: auto;
      }
      #tutorial-telop-card.pos-top {
        top: 24px;
        bottom: auto;
      }
      #tutorial-telop-card.pos-bottom.visible {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      #tutorial-telop-card.pos-bottom.hidden-card {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
      }
      #tutorial-telop-card.pos-top.visible {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      #tutorial-telop-card.pos-top.hidden-card {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
      }
      .tutorial-step-tag {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: #60a5fa;
        display: inline-block;
      }
      .tutorial-title {
        font-size: 15px;
        font-weight: 700;
        color: #ffffff;
        line-height: 1.3;
      }
      .tutorial-desc {
        font-size: 12px;
        color: #cbd5e1;
        line-height: 1.4;
      }
    `;
    document.head.appendChild(style);

    // DOM要素生成
    const pointer = document.createElement('div');
    pointer.id = 'tutorial-pointer';
    document.body.appendChild(pointer);

    const card = document.createElement('div');
    card.id = 'tutorial-telop-card';
    card.className = 'pos-bottom hidden-card';
    card.innerHTML = `
      <div class="tutorial-step-tag" id="telop-step">STEP 1</div>
      <div class="tutorial-title" id="telop-title">タイトル</div>
      <div class="tutorial-desc" id="telop-desc">説明文</div>
    `;
    document.body.appendChild(card);

    // グローバル操作関数
    window.__setPointerPos = (x, y, durationMs = 0) => {
      pointer.style.display = 'block';
      pointer.style.transition = durationMs > 0
        ? `left ${durationMs}ms cubic-bezier(0.25, 1, 0.5, 1), top ${durationMs}ms cubic-bezier(0.25, 1, 0.5, 1), transform 0.15s ease-out, background 0.15s ease-out`
        : 'none';
      pointer.style.left = `${x}px`;
      pointer.style.top = `${y}px`;
    };

    window.__setPointerTouch = (isTouching) => {
      if (isTouching) {
        pointer.classList.add('touching');
      } else {
        pointer.classList.remove('touching');
      }
    };

    window.__triggerRipple = (x, y) => {
      const ripple = document.createElement('div');
      ripple.className = 'tutorial-ripple';
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    };

    window.__showTelop = (stepText, title, desc, position = 'bottom') => {
      document.getElementById('telop-step').textContent = stepText;
      document.getElementById('telop-title').textContent = title;
      document.getElementById('telop-desc').textContent = desc;
      card.className = `pos-${position} visible`;
    };

    window.__hideTelop = () => {
      const pos = card.classList.contains('pos-top') ? 'pos-top' : 'pos-bottom';
      card.className = `${pos} hidden-card`;
    };
  });
}

// 録画レコーダークラス (Chrome DevTools Screencast API)
class FrameRecorder {
  constructor(page) {
    this.page = page;
    this.frameIndex = 0;
    this.client = null;
  }

  async start() {
    this.client = await this.page.target().createCDPSession();
    this.client.on('Page.screencastFrame', async ({ data, sessionId }) => {
      try {
        const frameNum = String(this.frameIndex++).padStart(5, '0');
        const framePath = path.join(framesDir, `frame_${frameNum}.jpg`);
        const buffer = Buffer.from(data, 'base64');
        fs.writeFileSync(framePath, buffer);
        await this.client.send('Page.screencastFrameAck', { sessionId });
      } catch (err) {}
    });

    await this.client.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 90,
      everyNthFrame: 1
    });
    console.log('🎥 CDP Screencast recording started...');
  }

  async stop() {
    if (this.client) {
      try {
        await this.client.send('Page.stopScreencast');
        await this.client.detach();
      } catch (err) {}
    }
    console.log(`⏹️ Recording stopped. Captured ${this.frameIndex} frames.`);
  }
}

// ヘルパー：待機
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// アクションヘルパー
async function movePointer(page, targetX, targetY, durationMs = 350) {
  await page.evaluate((x, y, ms) => window.__setPointerPos(x, y, ms), targetX, targetY, durationMs);
  await wait(durationMs + 50);
}

async function scrollToElement(page, selector, durationMs = 500) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, selector);
  await wait(durationMs + 200);
}

async function tapElement(page, selector, currentPos, options = {}) {
  const el = await page.$(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  
  // 要素が画面外にある場合はスクロール
  const isVisible = await page.evaluate((sel) => {
    const elem = document.querySelector(sel);
    if (!elem) return false;
    const r = elem.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth;
  }, selector);

  if (!isVisible && !options.noScroll) {
    await scrollToElement(page, selector, 400);
  }

  let box = await el.boundingBox();
  if (!box) {
    // input[type="radio"] などで非表示の場合、親要素のboundingBoxを取得
    box = await page.evaluate((sel) => {
      const elem = document.querySelector(sel);
      if (!elem) return null;
      const target = elem.closest('label') || elem.parentElement || elem;
      const r = target.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }, selector);
  }

  if (!box || box.width === 0 || box.height === 0) {
    throw new Error(`Element has no dimensions: ${selector}`);
  }

  const targetX = box.x + box.width / 2 + (options.offsetX || 0);
  const targetY = box.y + box.height / 2 + (options.offsetY || 0);

  // ポインタ移動
  await movePointer(page, targetX, targetY, options.moveTime || 350);
  currentPos.x = targetX;
  currentPos.y = targetY;

  // タッチダウン & リップル
  await page.evaluate((x, y) => {
    window.__setPointerTouch(true);
    window.__triggerRipple(x, y);
  }, targetX, targetY);
  await wait(120);

  // クリック発火
  await page.evaluate((sel) => {
    const elem = document.querySelector(sel);
    if (elem) {
      const clickTarget = elem.closest('label') || elem;
      clickTarget.click();
    }
  }, selector);

  await page.evaluate(() => window.__setPointerTouch(false));
  await wait(options.afterWait || 300);
  return currentPos;
}

async function tapStageItem(page, itemSelector, currentPos, options = {}) {
  const elements = await page.$$(itemSelector);
  if (!elements || elements.length === 0) throw new Error(`Stage item not found: ${itemSelector}`);
  const el = elements[elements.length - 1];
  const box = await el.boundingBox();
  if (!box) throw new Error(`Stage item has no bounding box: ${itemSelector}`);
  const targetX = box.x + box.width / 2;
  const targetY = box.y + box.height / 2;

  await movePointer(page, targetX, targetY, options.moveTime || 300);
  currentPos.x = targetX;
  currentPos.y = targetY;

  // pointerdown & ripple
  await page.evaluate((x, y) => {
    window.__setPointerTouch(true);
    window.__triggerRipple(x, y);
  }, targetX, targetY);
  await wait(80);

  // 対象の要素に直接 pointerdown / pointerup イベント発火
  await page.evaluate((sel, x, y) => {
    const els = document.querySelectorAll(sel);
    if (!els || els.length === 0) return;
    const elem = els[els.length - 1];
    const downEv = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'touch' });
    elem.dispatchEvent(downEv);
    const upEv = new PointerEvent('pointerup', { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'touch' });
    document.dispatchEvent(upEv);
  }, itemSelector, targetX, targetY);

  await page.evaluate(() => window.__setPointerTouch(false));
  await wait(options.afterWait || 350);
  return currentPos;
}

async function longPressElement(page, selector, currentPos, holdDurationMs = 1500) {
  const el = await page.$(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  const box = await el.boundingBox();
  if (!box) throw new Error(`Element has no bounding box: ${selector}`);
  const targetX = box.x + box.width / 2;
  const targetY = box.y + box.height / 2;

  await movePointer(page, targetX, targetY, 400);
  currentPos.x = targetX;
  currentPos.y = targetY;

  // タッチダウン開始
  await page.evaluate((x, y) => {
    window.__setPointerTouch(true);
    window.__triggerRipple(x, y);
  }, targetX, targetY);

  // 長押し中の待機（じわっと押している様子）
  await wait(holdDurationMs);

  await page.evaluate((x, y) => {
    window.__setPointerTouch(false);
    window.__triggerRipple(x, y);
  }, targetX, targetY);
  await wait(400);

  return currentPos;
}

async function dragAndDropElement(page, fromSelector, toCoords, currentPos, options = {}) {
  const fromEl = await page.$(fromSelector);
  if (!fromEl) throw new Error(`Element not found: ${fromSelector}`);
  const box = await fromEl.boundingBox();
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  // アイテムまで移動
  await movePointer(page, startX, startY, 400);
  currentPos.x = startX;
  currentPos.y = startY;

  // タッチ開始
  await page.evaluate((x, y) => {
    window.__setPointerTouch(true);
    window.__triggerRipple(x, y);
  }, startX, startY);
  await wait(150);

  // Pointerdownイベントをブラウザで発火
  await page.evaluate((sel, x, y) => {
    const target = document.querySelector(sel);
    const event = new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: 'touch'
    });
    target.dispatchEvent(event);
  }, fromSelector, startX, startY);

  // ドロップ先へポインタ＆イベント移動（ブラウザ側でスムーズに移動）
  const steps = 15;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const curX = startX + (toCoords.x - startX) * ease;
    const curY = startY + (toCoords.y - startY) * ease;

    await page.evaluate((x, y) => {
      window.__setPointerPos(x, y, 0);
      const event = new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerId: 1,
        pointerType: 'touch'
      });
      document.dispatchEvent(event);
    }, curX, curY);
    await wait(30);
  }

  // Pointerupでドロップ
  await page.evaluate((x, y) => {
    const event = new PointerEvent('pointerup', {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: 'touch'
    });
    document.dispatchEvent(event);
    window.__setPointerTouch(false);
    window.__triggerRipple(x, y);
  }, toCoords.x, toCoords.y);

  currentPos.x = toCoords.x;
  currentPos.y = toCoords.y;
  await wait(options.afterWait || 500);
  return currentPos;
}

// メインシナリオ実行
async function generateTutorial() {
  console.log('🚀 Starting Setting Sheet Tutorial Movie Generator...');
  const { server, port } = await startServer();
  console.log(`📡 Local server listening on http://127.0.0.1:${port}`);

  const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 60000,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // ブラウザダイアログ (confirm/alert) の自動承認
  page.on('dialog', async (dialog) => {
    console.log(`💬 Dialog appeared (${dialog.type()}): "${dialog.message()}" -> Auto accepting`);
    await dialog.accept();
  });

  await page.setViewport({
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    isMobile: true,
    hasTouch: true
  });

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    window.confirm = () => true;
    window.alert = () => {};
  });
  await injectVisualGuide(page);

  const recorder = new FrameRecorder(page);
  await recorder.start();

  let pos = { x: VIEWPORT_WIDTH / 2, y: VIEWPORT_HEIGHT / 2 };
  await page.evaluate((x, y) => window.__setPointerPos(x, y), pos.x, pos.y);
  await wait(800);

  // ----------------------------------------------------
  // STEP 1: バンド基本情報の入力
  // ----------------------------------------------------
  console.log('🎬 Step 1: Band Information Input');
  await page.evaluate(() => {
    window.__showTelop('STEP 1', '🎸 基本情報の入力', 'バンド名・構成・備考を入力します', 'top');
  });
  await wait(1200);

  // バンド名タップ & 入力
  pos = await tapElement(page, '#band-name', pos);
  await page.type('#band-name', 'THE OWL SOUNDS', { delay: 60 });
  await wait(400);

  // バンド構成タップ & 入力
  pos = await tapElement(page, '#band-members', pos);
  await page.type('#band-members', 'Vo/Gt, Ba, Dr, Key', { delay: 50 });
  await wait(400);

  // 備考タップ & 入力
  pos = await tapElement(page, '#band-memo', pos);
  await page.type('#band-memo', 'リハ順: 1番目 / 転換20分', { delay: 40 });
  await wait(1000);

  // ----------------------------------------------------
  // STEP 2: プリセット配置の呼び出し
  // ----------------------------------------------------
  console.log('🎬 Step 2: Preset Loading');
  await page.evaluate(() => {
    window.__showTelop('STEP 2', '📋 プリセット配置', '「プリセット」から定番セットを一発配置', 'top');
  });
  await wait(1000);

  // プリセットボタンタップ
  pos = await tapElement(page, '#btn-preset', pos);
  await wait(600);

  // 「スタジオOWL基本バンドセット」タップ
  pos = await tapElement(page, '.btn-preset-option[data-preset="owl_basic"]', pos);
  await wait(1200);

  // ----------------------------------------------------
  // STEP 3: 機材アイコンの追加（ドラッグ＆ドロップ）
  // ----------------------------------------------------
  console.log('🎬 Step 3: Drag & Drop Equipment');
  await page.evaluate(() => {
    window.__showTelop('STEP 3', '🎤 機材のドラッグ＆ドロップ', 'パレットから機材をステージへ自由に配置', 'bottom');
  });
  await wait(1000);

  // ステージの座標取得
  const stageBox = await page.$eval('#stage', (el) => {
    const rect = el.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });

  // Voマイクをドラッグしてステージ中央手前へ配置
  const targetDropCoords = {
    x: stageBox.x + stageBox.width * 0.5,
    y: stageBox.y + stageBox.height * 0.65
  };
  pos = await dragAndDropElement(page, '.palette-item[data-type="vocal_mic"]', targetDropCoords, pos);
  await wait(1000);

  // ----------------------------------------------------
  // STEP 4: 向き（回転）の変更
  // ----------------------------------------------------
  console.log('🎬 Step 4: Rotate Equipment');
  await page.evaluate(() => {
    window.__showTelop('STEP 4', '🔄 機材の向き・回転', '回転モードでタップして45度ずつ回転', 'bottom');
  });
  await wait(1000);

  // 回転モードに切り替え
  pos = await tapElement(page, 'input[value="rotate"]', pos);
  await wait(500);

  // 先ほど配置したマイク（最後のマイクアイテム）を3回タップして回転
  const micSelector = '.stage-item.vocal_mic';
  for (let r = 0; r < 3; r++) {
    pos = await tapStageItem(page, micSelector, pos, { afterWait: 300 });
  }

  // 移動モードに戻す
  pos = await tapElement(page, 'input[value="move"]', pos);
  await wait(800);

  // ----------------------------------------------------
  // STEP 5: 詳細設定・持ち込み機材
  // ----------------------------------------------------
  console.log('🎬 Step 5: Item Detail & Bring-in');
  await page.evaluate(() => {
    window.__showTelop('STEP 5', '⚙️ 機材詳細・持込設定', '機材タップで持込バッジや備考を設定', 'bottom');
  });
  await wait(1000);

  // ステージ上のVoマイクをタップして詳細モーダルを開く
  pos = await tapStageItem(page, micSelector, pos, { afterWait: 600 });

  // 「持ち込み機材とする」をチェック
  pos = await tapElement(page, '#detail-bring-in', pos);
  await wait(300);

  // 備考に入力
  pos = await tapElement(page, '#detail-memo', pos);
  await page.type('#detail-memo', 'SHURE Beta 58A', { delay: 50 });
  await wait(400);

  // 完了ボタンタップ
  pos = await tapElement(page, '#btn-save-item', pos);
  await wait(1000);

  // ----------------------------------------------------
  // STEP 6: エクスポート（保存・書き出し）
  // ----------------------------------------------------
  console.log('🎬 Step 6: Export / Save');
  await page.evaluate(() => {
    window.__showTelop('STEP 6', '💾 完成シートの保存', '「保存・書き出し」ボタンをタップ！', 'top');
  });
  await wait(800);

  // 画面下部のボタン群へスムーズスクロールしてしっかり映し出す
  await scrollToElement(page, '.action-buttons', 500);
  await wait(600);

  // 保存・書き出しボタンタップ
  pos = await tapElement(page, '#btn-export', pos, { moveTime: 400, afterWait: 1000 });

  // 画像(PNG)で保存タップ
  pos = await tapElement(page, '#btn-export-image', pos, { moveTime: 350, afterWait: 1200 });

  // 生成されたプレビュー画像の表示待機
  await page.waitForSelector('#modal-image-container img', { visible: true });
  await wait(600);

  // 長押し保存のテロップ
  await page.evaluate(() => {
    window.__showTelop('STEP 6', '📲 長押しして画像を保存', '画像を長押ししてスマホの写真に保存！', 'top');
  });
  await wait(600);

  // 画像を長押し（1.8秒間キープ）
  pos = await longPressElement(page, '#modal-image-container img', pos, 1800);
  await wait(500);

  // 終了テロップ（余韻）
  await page.evaluate(() => {
    window.__showTelop('READY!', '✨ 作成完了！', '画像を保存してPAさんやメンバーに共有！', 'top');
  });
  await wait(2200);

  // 録画停止
  await recorder.stop();
  await browser.close();
  server.close();

  // ----------------------------------------------------
  // ffmpegでMP4 & GIFにエンコード
  // ----------------------------------------------------
  console.log('🎞️ Encoding frames to MP4 & GIF with ffmpeg...');
  const mp4Output = path.join(assetsDir, 'tutorial.mp4');
  const gifOutput = path.join(assetsDir, 'tutorial.gif');

  // MP4生成
  const mp4CmdArgs = [
    '-y',
    '-framerate', String(FPS),
    '-i', path.join(framesDir, 'frame_%05d.jpg'),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-preset', 'fast',
    '-crf', '22',
    mp4Output
  ];

  console.log('⚙️ Rendering MP4:', mp4Output);
  await execFileAsync('ffmpeg', mp4CmdArgs);
  console.log('✅ MP4 created successfully!');

  // GIF生成（palettegen / paletteuse で高品質化、横幅390pxにリサイズ）
  const gifCmdArgs = [
    '-y',
    '-framerate', String(FPS),
    '-i', path.join(framesDir, 'frame_%05d.jpg'),
    '-vf', 'fps=15,scale=390:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer',
    gifOutput
  ];

  console.log('⚙️ Rendering GIF:', gifOutput);
  await execFileAsync('ffmpeg', gifCmdArgs);
  console.log('✅ GIF created successfully!');

  // 一時フレーム削除
  fs.rmSync(framesDir, { recursive: true, force: true });
  console.log('🧹 Cleaned up temporary frames.');

  console.log('\n🎉 Tutorial Movie generation completed!');
  console.log('📁 Outputs:');
  console.log('  - MP4:', mp4Output);
  console.log('  - GIF:', gifOutput);
}

generateTutorial().catch((err) => {
  console.error('❌ Error generating tutorial movie:', err);
  process.exit(1);
});
