const GameLogic = {
    /**
     * ランダムなお手本を生成する
     * @param {number} length スロット数
     * @param {Array<string>} availableTypes 具材の種類
     * @returns {Array<string>} お手本の配列
     */
    generateReference: function(length, availableTypes) {
        const ref = [];
        for (let i = 0; i < length; i++) {
            ref.push(availableTypes[Math.floor(Math.random() * availableTypes.length)]);
        }
        return ref;
    },

    /**
     * プレイヤーの配置とお手本を比較しスコアを算出する
     * @param {Array<string>} reference お手本
     * @param {Array<string>} player プレイヤーの配置
     * @returns {number} 一致した数 (0〜length)
     */
    calculateScore: function(reference, player) {
        let score = 0;
        for (let i = 0; i < reference.length; i++) {
            if (reference[i] === player[i]) {
                score++;
            }
        }
        return score;
    },

    /**
     * 7秒以内かつ全問正解でクーポン獲得対象かを判定
     * @param {number} score プレイヤーのスコア
     * @param {number} timeTaken クリアにかかった秒数
     * @returns {boolean}
     */
    isEligibleForCoupon: function(score, timeTaken) {
        return score === 4 && typeof timeTaken === 'number' && timeTaken > 0 && timeTaken <= 7.0;
    },

    /**
     * YYYY-MM-DD形式の日付文字列を生成（日本時間基準で安全に比較）
     * @param {Date} [date=new Date()]
     * @returns {string}
     */
    getTodayDateString: function(date = new Date()) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    /**
     * 当日クーポンを獲得可能かどうか（未獲得ならtrue）
     * @param {string|null} lastClaimedDate 最後に獲得した日付 (YYYY-MM-DD)
     * @param {string} todayDate 今日の日付 (YYYY-MM-DD)
     * @returns {boolean}
     */
    canClaimCouponToday: function(lastClaimedDate, todayDate) {
        return lastClaimedDate !== todayDate;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameLogic };
} else {
    document.addEventListener('DOMContentLoaded', () => {
        const emojis = {
            'strawberry': '🍓',
            'banana': '🍌',
            'blueberry': '🫐',
            'mango': '🥭',
            'coconut': '🥥',
            'kiwi': '🥝'
        };
        const availableTypes = Object.keys(emojis);
        const SLOTS_COUNT = 4;

        let referencePattern = [];
        let playerPattern = new Array(SLOTS_COUNT).fill(null);
        let activeSlotIndex = 0;
        let gameState = 'START'; // START, MEMORIZE, PLAY, RESULT
        let playStartTime = null;

        const refView = document.getElementById('reference-view');
        const playerView = document.getElementById('player-view');
        const paletteContainer = document.getElementById('palette-container');
        const palette = document.getElementById('palette');
        const mainBtn = document.getElementById('main-btn');
        const bigCountdown = document.getElementById('big-countdown');
        const modal = document.getElementById('modal');
        const modalDesc = document.getElementById('modal-desc');
        const retryBtn = document.getElementById('retry-btn');
        const refQuestion = document.getElementById('ref-question');
        
        const playerSlots = document.querySelectorAll('.player-slot');
        const ingBtns = document.querySelectorAll('.ing-btn');

        function updateSlotVisuals() {
            // お手本の描画
            for (let i = 0; i < SLOTS_COUNT; i++) {
                const el = document.getElementById(`ref-${i}`);
                el.textContent = referencePattern[i] ? emojis[referencePattern[i]] : '';
            }
            // プレイヤーの描画
            for (let i = 0; i < SLOTS_COUNT; i++) {
                const el = document.getElementById(`player-${i}`);
                el.textContent = playerPattern[i] ? emojis[playerPattern[i]] : '';
                
                // アクティブ状態の更新
                if (i === activeSlotIndex) {
                    el.classList.add('active');
                } else {
                    el.classList.remove('active');
                }
            }
            
            // 全て埋まったかチェック
            if (gameState === 'PLAY') {
                const isComplete = playerPattern.every(item => item !== null);
                if (isComplete) {
                    mainBtn.textContent = '完成！ (判定する)';
                    mainBtn.disabled = false;
                } else {
                    mainBtn.textContent = 'トッピング中...';
                    mainBtn.disabled = true;
                }
            }
        }

        function startMemorizePhase() {
            gameState = 'MEMORIZE';
            referencePattern = GameLogic.generateReference(SLOTS_COUNT, availableTypes);
            playerPattern = new Array(SLOTS_COUNT).fill(null);
            activeSlotIndex = 0;
            
            refView.classList.remove('hidden');
            refQuestion.classList.add('hidden');
            playerView.classList.add('hidden');
            paletteContainer.classList.add('hidden');
            palette.classList.add('disabled');
            
            updateSlotVisuals();

            let count = 3;
            mainBtn.disabled = true;
            
            bigCountdown.textContent = count;
            bigCountdown.classList.remove('hidden');
            bigCountdown.classList.remove('animate-pop');
            void bigCountdown.offsetWidth; // 強制リフロー
            bigCountdown.classList.add('animate-pop');
            
            const timer = setInterval(() => {
                count--;
                if (count > 0) {
                    mainBtn.textContent = `お手本を覚えて！ ${count}秒`;
                    bigCountdown.textContent = count;
                    bigCountdown.classList.remove('animate-pop');
                    void bigCountdown.offsetWidth;
                    bigCountdown.classList.add('animate-pop');
                } else if (count === 0) {
                    mainBtn.textContent = `スタート！`;
                    bigCountdown.textContent = 'START!';
                    bigCountdown.classList.remove('animate-pop');
                    void bigCountdown.offsetWidth;
                    bigCountdown.classList.add('animate-pop');
                } else {
                    clearInterval(timer);
                    bigCountdown.classList.add('hidden');
                    startPlayPhase();
                }
            }, 1000);
            mainBtn.textContent = `お手本を覚えて！ ${count}秒`;
        }

        function startPlayPhase() {
            gameState = 'PLAY';
            refView.classList.add('hidden');
            playerView.classList.remove('hidden');
            paletteContainer.classList.remove('hidden');
            palette.classList.remove('disabled');
            playStartTime = Date.now();
            
            // パレットのボタンをシャッフルする
            const btnsArray = Array.from(palette.children);
            for (let i = btnsArray.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [btnsArray[i], btnsArray[j]] = [btnsArray[j], btnsArray[i]];
            }
            btnsArray.forEach(btn => palette.appendChild(btn));
            
            updateSlotVisuals();
        }

        function showResult() {
            gameState = 'RESULT';
            const score = GameLogic.calculateScore(referencePattern, playerPattern);

            const correctAnswerContainer = document.getElementById('correct-answer');
            const clearTimeContainer = document.getElementById('clear-time');
            const correctLabel = document.getElementById('correct-label');
            
            if (score === 4) {
                const timeTakenNum = (Date.now() - playStartTime) / 1000;
                const timeTaken = timeTakenNum.toFixed(2);
                modalDesc.textContent = '完璧な仕上がり！本物の映え職人です✨';
                clearTimeContainer.textContent = `クリアタイム: ${timeTaken}秒`;
                clearTimeContainer.classList.remove('hidden');
                correctLabel.classList.add('hidden');

                // 共通CouponUIを利用したクーポン獲得判定 & 描画
                CouponUI.renderResult({
                    containerId: 'coupon-section',
                    gameId: 'acai',
                    isEligible: GameLogic.isEligibleForCoupon(score, timeTakenNum),
                    time: timeTaken,
                    conditionHint: '💡 <strong>7秒以内</strong>に完成させると限定クーポンGET！',
                    successMsg: '🎉 <strong>7秒以内クリア達成！</strong><br>1日1回限定クーポンを獲得しました！',
                    claimedMsg: '🎉 <strong>7秒以内クリア！お見事！</strong><br><span style="font-size: 12px; color: #777;">※ 本日のクーポンは獲得済みです（1日1回限定）</span>'
                });
            } else {
                clearTimeContainer.classList.add('hidden');
                correctLabel.classList.remove('hidden');
                CouponUI.hide('coupon-section');
                if (score >= 2) {
                    modalDesc.textContent = 'おしい！あともう少しで完璧！😋';
                } else {
                    modalDesc.textContent = 'うーん、ちょっと違うかも...💦';
                }
            }

            const correctPatternEl = document.getElementById('correct-pattern');
            correctPatternEl.innerHTML = '';
            referencePattern.forEach((item, index) => {
                const iconDiv = document.createElement('div');
                iconDiv.className = 'result-slot';
                // プレイヤーの配置と一致していない場合はエラークラスを付与してハイライト
                if (playerPattern[index] !== item) {
                    iconDiv.classList.add('error');
                }
                iconDiv.textContent = item ? emojis[item] : '？';
                correctPatternEl.appendChild(iconDiv);
            });
            correctAnswerContainer.classList.remove('hidden');

            modal.classList.remove('hidden');
        }

        // イベントリスナー設定
        mainBtn.addEventListener('click', () => {
            if (gameState === 'START') {
                startMemorizePhase();
            } else if (gameState === 'PLAY') {
                showResult();
            }
        });

        retryBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            CouponUI.hide('coupon-section');
            gameState = 'START';
            mainBtn.textContent = 'スタート';
            mainBtn.disabled = false;
            refView.classList.remove('hidden');
            refQuestion.classList.remove('hidden');
            playerView.classList.add('hidden');
            paletteContainer.classList.add('hidden');
            palette.classList.add('disabled');
            // 表示を空にリセット
            referencePattern = new Array(SLOTS_COUNT).fill(null);
            updateSlotVisuals();
        });

        playerSlots.forEach(slot => {
            slot.addEventListener('click', (e) => {
                if (gameState !== 'PLAY') return;
                activeSlotIndex = parseInt(e.currentTarget.dataset.index);
                updateSlotVisuals();
            });
        });

        ingBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (gameState !== 'PLAY') return;
                const type = e.currentTarget.dataset.type;
                playerPattern[activeSlotIndex] = type;
                
                // 次の空きスロットを自動選択
                let nextSlot = activeSlotIndex;
                for (let i = 1; i < SLOTS_COUNT; i++) {
                    const idx = (activeSlotIndex + i) % SLOTS_COUNT;
                    if (playerPattern[idx] === null) {
                        nextSlot = idx;
                        break;
                    }
                }
                activeSlotIndex = nextSlot;
                updateSlotVisuals();
            });
        });
    });
}
