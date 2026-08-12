import http from 'http';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function testE2E() {
  console.log('--- Running E2E tests with Puppeteer ---');

  // ローカルサーバーを起動
  const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    let extname = path.extname(filePath);
    let contentType = 'text/html';
    switch (extname) {
      case '.js': contentType = 'text/javascript'; break;
      case '.css': contentType = 'text/css'; break;
      case '.json': contentType = 'application/json'; break;
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

  await new Promise(resolve => server.listen(8080, resolve));

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  let hasErrors = false;
  let errorMessages = [];

  // ブラウザのコンソールエラーをキャッチ
  page.on('pageerror', error => {
    hasErrors = true;
    errorMessages.push(`PAGE ERROR: ${error.message}`);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      hasErrors = true;
      errorMessages.push(`CONSOLE ERROR: ${msg.text()}`);
    }
  });

  try {
    // ページへ遷移し、モジュールの読み込みを待機
    await page.goto('http://127.0.0.1:8080/', { waitUntil: 'networkidle0' });

    if (hasErrors) {
      throw new Error('ブラウザの読み込み時にエラーが検出されました:\n' + errorMessages.join('\n'));
    }

    // 重要なボタンがDOMに存在するか検証
    const btnExportExists = await page.$eval('#btn-export', el => !!el);
    if (!btnExportExists) throw new Error('#btn-export が見つかりません。');
    
    const btnPresetExists = await page.$eval('#btn-preset', el => !!el);
    if (!btnPresetExists) throw new Error('#btn-preset が見つかりません。');

    // ボタンがクリック可能（表示されていてイベントが発火しそう）か簡単にチェック
    await page.click('#btn-export');
    
    // エクスポートモーダルが表示されるかをチェック
    const formatModalVisible = await page.$eval('#format-modal', el => !el.classList.contains('hidden'));
    if (!formatModalVisible) throw new Error('#btn-export をクリックしましたが、モーダルが表示されませんでした。');

    // フォーマットモーダルを閉じる（次のテストのため）
    await page.click('#btn-close-format');

    // プリセットモーダルの動作検証
    await page.click('#btn-preset');
    const presetModalVisible = await page.$eval('#preset-modal', el => !el.classList.contains('hidden'));
    if (!presetModalVisible) throw new Error('#btn-preset をクリックしましたが、プリセットモーダルが表示されませんでした。');

    // プリセットモーダルを閉じる
    await page.click('#btn-close-preset');
    const presetModalHidden = await page.$eval('#preset-modal', el => el.classList.contains('hidden'));
    if (!presetModalHidden) throw new Error('プリセットモーダルが閉じませんでした。');

    // クリアモーダルの動作検証
    await page.click('#btn-clear');
    const clearModalVisible = await page.$eval('#clear-modal', el => !el.classList.contains('hidden'));
    if (!clearModalVisible) throw new Error('#btn-clear をクリックしましたが、クリアモーダルが表示されませんでした。');

    // クリアモーダルを閉じる
    await page.click('#btn-close-clear');
    const clearModalHidden = await page.$eval('#clear-modal', el => el.classList.contains('hidden'));
    if (!clearModalHidden) throw new Error('クリアモーダルが閉じませんでした。');

    // 機材詳細モーダルの存在確認
    const detailModalExists = await page.$('#item-detail-modal');
    if (!detailModalExists) throw new Error('#item-detail-modal が見つかりません。');

    // 全4プリセットボタンの存在確認
    const presetButtonCount = await page.$$eval('.btn-preset-option', els => els.length);
    if (presetButtonCount !== 4) throw new Error(`プリセットボタンは4つであるべきですが、${presetButtonCount}つ見つかりました。`);

    console.log('E2E test passed! ✅');

  } finally {
    await browser.close();
    server.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  testE2E().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
