const DrinkType = {
    INCLUDED: 'x',
    NONE: '-',
    ORDER_REQUIRED: ''
};

// ==========================================
// 共通変数
// ==========================================
let recurringEvents = {};
let titleAliases = {};
let uploadedImageId = null;

// ==========================================
// 定期イベントのクイック選択
// ==========================================
function selectRecurringEvent(name, btnElement) {
    const template = recurringEvents[name];
    if (!template) return;

    // ボタンのアクティブ状態を切り替え
    document.querySelectorAll('.quick-select__btn').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');

    // タイトルをセット
    document.getElementById('title').value = name;

    // テンプレートの値でフォームを自動入力
    if (template['開始時間']) document.getElementById('start_time').value = template['開始時間'];
    if (template['終了時間']) document.getElementById('end_time').value = template['終了時間'];
    if (template['イベントカテゴリー']) document.getElementById('category').value = template['イベントカテゴリー'];
    if (template['前売り料金']) document.getElementById('advance_price').value = template['前売り料金'];
    if (template['当日料金']) document.getElementById('door_price').value = template['当日料金'];
    if (template['出演者・詳細']) document.getElementById('description').value = template['出演者・詳細'].replace(/\\n/g, '\n');
    if (template['その他']) document.getElementById('other').value = template['その他'];

    // ドリンク
    document.getElementById('drink').checked = (template['ドリンク'] === DrinkType.INCLUDED);
    document.getElementById('no_drink').checked = (template['ドリンク'] === DrinkType.NONE);

    // チケット予約URL
    if (template['チケット予約URL']) document.getElementById('ticket_url').value = template['チケット予約URL'];

    // カテゴリに連動した表示切り替えを適用
    document.getElementById('category').dispatchEvent(new Event('change'));

    // 自動補完ヒントを表示
    const hint = document.getElementById('autofill-hint');
    hint.classList.add('show');
    setTimeout(() => hint.classList.remove('show'), 3000);
}

// ==========================================
// 画像アップロード
// ==========================================
async function handleImageFile(file) {
    if (!file.type.startsWith('image/')) {
        showResult('error', '画像ファイルを選択してください。');
        return;
    }

    // プレビュー表示
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('preview-img').src = e.target.result;
        document.getElementById('image-preview').classList.add('show');
    };
    reader.readAsDataURL(file);

    // WordPressへアップロード
    updateUploadStatus('pending', 'アップロード中...');

    const formData = new FormData();
    formData.append('image', file);

    try {
        const res = await fetch('/api/upload-image', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.status === 'success') {
            uploadedImageId = data.media_id;
            updateUploadStatus('success', `アップロード完了 (ID: ${data.media_id})`);
        } else {
            uploadedImageId = null;
            updateUploadStatus('error', data.message);
        }
    } catch (err) {
        uploadedImageId = null;
        updateUploadStatus('error', '通信エラー');
    }
}

function updateUploadStatus(status, text) {
    const statusEl = document.getElementById('upload-status');
    const dotClasses = { pending: 'dot--pending', success: 'dot--success', error: 'dot--error' };
    statusEl.innerHTML = `<span class="dot ${dotClasses[status] || ''}"></span><span>${text}</span>`;
}

function removeImage() {
    uploadedImageId = null;
    document.getElementById('image-preview').classList.remove('show');
    document.getElementById('preview-img').src = '';
    const imageFileInput = document.getElementById('image_file');
    if (imageFileInput) imageFileInput.value = '';
    updateUploadStatus('pending', 'アップロード待ち');
}

// ==========================================
// 結果表示
// ==========================================
function showResult(status, message) {
    const el = document.getElementById('result');
    el.className = 'result show';

    const icons = { success: '✅', skip: '⚠️', error: '❌' };
    const classes = { success: 'result--success', skip: 'result--skip', error: 'result--error' };

    el.classList.add(classes[status] || 'result--error');
    el.textContent = `${icons[status] || '❌'} ${message}`;

    // 画面下部にスクロール
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ==========================================
// 共通のイベントリスナー設定
// ==========================================
function setupCommonListeners() {
    // 画像アップロードエリア
    const uploadArea = document.getElementById('upload-area');
    const imageFileInput = document.getElementById('image_file');

    if (imageFileInput && uploadArea) {
        // ファイル選択時
        imageFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleImageFile(e.target.files[0]);
            }
        });

        // ドラッグ＆ドロップ
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                handleImageFile(e.dataTransfer.files[0]);
            }
        });
    }

    // AI解析 (正規表現) 自動入力
    const btnAnalyzeDetails = document.getElementById('btn-analyze-details');
    if (btnAnalyzeDetails) {
        btnAnalyzeDetails.addEventListener('click', async () => {
            const descText = document.getElementById('description').value;
            if (!descText || descText.trim().length < 5) {
                showResult('error', '詳細テキストが短すぎます');
                return;
            }

            const originalBtnText = btnAnalyzeDetails.innerText;
            btnAnalyzeDetails.innerText = '⏳ 解析中...';
            btnAnalyzeDetails.disabled = true;

            try {
                const res = await fetch('/api/analyze-event-details', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ description: descText })
                });

                const data = await res.json();
                if (data.status === 'success' && data.results) {
                    const r = data.results;
                    let updated = false;

                    const setIfEmpty = (id, val) => {
                        if (!val) return;
                        const el = document.getElementById(id);
                        if (el && !el.value) {
                            el.value = val;
                            updated = true;
                        }
                    };

                    setIfEmpty('start_date', r.start_date);
                    setIfEmpty('open_time', r.open_time);
                    setIfEmpty('start_time', r.start_time);
                    setIfEmpty('end_time', r.end_time);
                    setIfEmpty('advance_price', r.advance_price);
                    setIfEmpty('door_price', r.door_price);

                    if (updated) {
                        showResult('success', '空の項目に日時・料金を自動入力しました');
                    } else {
                        showResult('skip', '自動入力できる空の項目がありませんでした');
                    }
                } else {
                    showResult('error', '解析に失敗しました');
                }
            } catch (e) {
                showResult('error', '通信エラーが発生しました');
            } finally {
                btnAnalyzeDetails.innerText = originalBtnText;
                btnAnalyzeDetails.disabled = false;
            }
        });
    }

    // ドリンク設定の排他制御
    const noDrinkEl = document.getElementById('no_drink');
    const drinkEl = document.getElementById('drink');
    if (noDrinkEl && drinkEl) {
        noDrinkEl.addEventListener('change', function() {
            if (this.checked) drinkEl.checked = false;
        });
        drinkEl.addEventListener('change', function() {
            if (this.checked) noDrinkEl.checked = false;
        });
    }
}
