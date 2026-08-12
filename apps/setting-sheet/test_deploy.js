import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { deployFiles } from './deploy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function testDeployIntegrity() {
  console.log('--- Running deploy integrity tests ---');
  const indexContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
  
  // scriptタグのsrc属性を抽出
  const scriptRegex = /<script\s+[^>]*src=["']([^"']+)["'][^>]*>/g;
  let match;
  const scriptSrcs = [];
  while ((match = scriptRegex.exec(indexContent)) !== null) {
    let src = match[1];
    // クエリパラメータを削除 (例: main.js?v=56 -> main.js)
    src = src.split('?')[0];
    scriptSrcs.push(src);
  }

  const missingFiles = [];
  for (const src of scriptSrcs) {
    // 外部URLは無視
    if (src.startsWith('http://') || src.startsWith('https://')) {
      continue;
    }
    if (!deployFiles.includes(src)) {
      missingFiles.push(src);
    }
  }

  if (missingFiles.length > 0) {
    throw new Error(`デプロイ漏れエラー: 以下のファイルが index.html で読み込まれていますが、deploy.js の deployFiles に含まれていません。\n - ${missingFiles.join('\n - ')}`);
  }

  console.log('Deploy integrity test passed! ✅');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  testDeployIntegrity();
}
