        // ==========================================
        // 初期化: 定期イベント・カテゴリ情報の読み込み
        // ==========================================
        let recurringEvents = {};
        let titleAliases = {};
        let uploadedImageId = null;  // アップロード済み画像のメディアID

        document.addEventListener('DOMContentLoaded', async () => {
            try {
                const res = await fetch('/api/recurring-events');
                const data = await res.json();
                recurringEvents = data.recurring_events || {};
                titleAliases = data.title_aliases || {};
                const categories = data.categories || [];

                // カテゴリドロップダウンの生成
                const catSelect = document.getElementById('category');
                categories.forEach(cat => {
                    const opt = document.createElement('option');
                    opt.value = cat;
                    opt.textContent = cat;
                    catSelect.appendChild(opt);
                });

                // クイック選択ボタンの生成
                const quickSelect = document.getElementById('quick-select');
                Object.keys(recurringEvents).forEach(name => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'quick-select__btn';
                    btn.textContent = name;
                    btn.onclick = () => selectRecurringEvent(name, btn);
                    quickSelect.appendChild(btn);
                });

                // アーティストイベント選択時の自動入力 (空欄時のみ)
                catSelect.addEventListener('change', (e) => {
                    if (e.target.value === 'アーティストイベント') {
                        const openTime = document.getElementById('open_time');
                        const startTime = document.getElementById('start_time');
                        const endTime = document.getElementById('end_time');
                        const featured = document.getElementById('featured');
                        
                        if (!openTime.value) openTime.value = '19:00';
                        if (!startTime.value) startTime.value = '19:30';
                        if (!endTime.value) endTime.value = '22:00';
                        featured.checked = true;
                    } else if (e.target.value === '貸切イベント') {
                        const titleField = document.getElementById('title');
                        const allDayCheck = document.getElementById('all_day');
                        const openTime = document.getElementById('open_time');
                        const startTime = document.getElementById('start_time');
                        const endTime = document.getElementById('end_time');
                        
                        if (!titleField.value) titleField.value = '貸し切りイベント';
                        allDayCheck.checked = true;
                        openTime.value = '';
                        startTime.value = '';
                        endTime.value = '';
                    }
                    
                    const ticketUrlGroup = document.getElementById('ticket_url_group');
                    if (e.target.value === 'アーティストイベント') {
                        ticketUrlGroup.style.display = 'block';
                    } else {
                        ticketUrlGroup.style.display = 'none';
                        document.getElementById('ticket_url').value = '';
                    }
                });

            } catch (err) {
                console.error('初期データの読み込みに失敗:', err);
            }
        });

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
        const uploadArea = document.getElementById('upload-area');
        const imageFileInput = document.getElementById('image_file');

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
            imageFileInput.value = '';
            updateUploadStatus('pending', 'アップロード待ち');
        }

        // ==========================================
        // フォーム送信
        // ==========================================
        async function submitEvent() {
            const btn = document.getElementById('submit-btn');
            const resultEl = document.getElementById('result');

            // バリデーション
            const title = document.getElementById('title').value.trim();
            const startDate = document.getElementById('start_date').value;

            if (!title) {
                showResult('error', 'イベントタイトルを入力してください。');
                return;
            }
            if (!startDate) {
                showResult('error', '開始日付を入力してください。');
                return;
            }

            // 送信中の状態
            btn.disabled = true;
            btn.classList.add('loading');
            resultEl.classList.remove('show');

            const payload = {
                title: title,
                start_date: startDate,
                open_time: document.getElementById('open_time').value,
                start_time: document.getElementById('start_time').value,
                end_date: document.getElementById('end_date').value,
                end_time: document.getElementById('end_time').value,
                all_day: document.getElementById('all_day').checked,
                category: document.getElementById('category').value,
                description: document.getElementById('description').value,
                advance_price: document.getElementById('advance_price').value,
                door_price: document.getElementById('door_price').value,
                drink: document.getElementById('drink').checked,
                no_drink: document.getElementById('no_drink').checked,
                ticket_url: document.getElementById('ticket_url').value,
                other: document.getElementById('other').value,
                featured: document.getElementById('featured').checked,
                status: document.querySelector('input[name="status"]:checked').value,
                image_id: uploadedImageId
            };

            try {
                const res = await fetch('/api/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                showResult(data.status, data.message);
            } catch (err) {
                showResult('error', `通信エラーが発生しました: ${err.message}`);
            } finally {
                btn.disabled = false;
                btn.classList.remove('loading');
            }
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
        // AI解析 (正規表現) 自動入力
        // ==========================================
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
        document.getElementById('no_drink').addEventListener('change', function() {
            if (this.checked) document.getElementById('drink').checked = false;
        });
        document.getElementById('drink').addEventListener('change', function() {
            if (this.checked) document.getElementById('no_drink').checked = false;
        });
