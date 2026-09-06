const fs = require('fs');
const path = require('path');
const { NodeSSH } = require('../setting-sheet/node_modules/node-ssh');
require('../setting-sheet/node_modules/dotenv').config({ path: path.resolve(__dirname, '../setting-sheet/.env') });

const ssh = new NodeSSH();

const deployFiles = [
  'index.html',
  'assets',
  'data'
];

async function deploy() {
  const { SSH_HOST, SSH_PORT, SSH_USER, SSH_PASSWORD } = process.env;
  const DEPLOY_PATH = 'web/owlstarsfes2026';

  if (!SSH_HOST || !SSH_USER || !SSH_PASSWORD) {
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
      const localPath = path.resolve(__dirname, item);
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

    console.log('🎉 デプロイが完了しました！');

  } catch (error) {
    console.error('❌ デプロイ中にエラーが発生しました:', error.message);
    process.exitCode = 1;
  } finally {
    ssh.dispose();
  }
}

deploy();
