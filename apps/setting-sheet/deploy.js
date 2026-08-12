import fs from 'fs';
import path from 'path';
import { NodeSSH } from 'node-ssh';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ssh = new NodeSSH();

// デプロイ対象のファイル/フォルダ
export const deployFiles = [
  'index.html',
  'style.css',
  'main.js',
  'logic.js',
  'ui.js',
  'store.js',
  'dragdrop.js',
  'html-to-image.min.js',
  'jspdf.umd.min.js',
  'assets' // ディレクトリも転送
];

async function deploy() {
  const { SSH_HOST, SSH_PORT, SSH_USER, SSH_PASSWORD, DEPLOY_PATH } = process.env;

  if (!SSH_HOST || !SSH_USER || !SSH_PASSWORD || !DEPLOY_PATH) {
    console.error('❌ エラー: .env ファイルに必要な設定が不足しています。');
    process.exit(1);
  }

  console.log(`🚀 デプロイを開始します: ${SSH_HOST}:${SSH_PORT || 22}`);
  console.log(`📦 アップロード先: ${DEPLOY_PATH}`);

  try {
    await ssh.connect({
      host: SSH_HOST,
      port: parseInt(SSH_PORT, 10) || 22,
      username: SSH_USER,
      password: SSH_PASSWORD
    });

    console.log('✅ SSH接続に成功しました！ファイルの転送を開始します...');

    for (const item of deployFiles) {
      const localPath = path.resolve(process.cwd(), item);
      const remotePath = `${DEPLOY_PATH}/${item}`;

      if (!fs.existsSync(localPath)) {
        console.warn(`⚠️ スキップ: ${item} が見つかりません`);
        continue;
      }

      const stat = fs.statSync(localPath);
      if (stat.isDirectory()) {
        console.log(`📁 フォルダ転送中: ${item} -> ${remotePath}`);
        await ssh.putDirectory(localPath, remotePath, {
          recursive: true,
          concurrency: 10
        });
      } else {
        console.log(`📄 ファイル転送中: ${item} -> ${remotePath}`);
        await ssh.putFile(localPath, remotePath);
      }
    }

    console.log('🎉 デプロイが完全に完了しました！');

  } catch (error) {
    console.error('❌ デプロイ中にエラーが発生しました:', error.message);
  } finally {
    ssh.dispose();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  deploy();
}
