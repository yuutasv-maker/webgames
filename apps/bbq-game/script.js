const GameLogic = {
    /**
     * 新しいオーダーを生成する
     * @param {number} length 串に刺す具材の数
     * @param {Array<string>} availableTypes 利用可能な具材の種類
     * @returns {Array<string>} 生成されたオーダー配列
     */
    generateOrder: function(length, availableTypes) {
        const order = [];
        for (let i = 0; i < length; i++) {
            order.push(availableTypes[Math.floor(Math.random() * availableTypes.length)]);
        }
        return order;
    },

    /**
     * クーポン獲得条件（10本以上完成）を満たしているか判定
     * @param {number} score 完成した串の本数
     * @returns {boolean}
     */
    isEligibleForCoupon: function(score) {
        return score >= 10;
    },

    /**
     * 入力された具材が正しいか判定する
     * @param {Array<string>} currentOrder 現在のオーダー配列
     * @param {Array<string>} currentSkewer 現在刺さっている具材の配列
     * @param {string} clickedItem クリックされた具材
     * @returns {string} 'COMPLETE', 'ADDED', 'MISTAKE' のいずれか
     */
    checkInput: function(currentOrder, currentSkewer, clickedItem) {
        const expectedItem = currentOrder[currentSkewer.length];
        
        if (clickedItem === expectedItem) {
            currentSkewer.push(clickedItem);
            if (currentSkewer.length === currentOrder.length) {
                return 'COMPLETE';
            }
            return 'ADDED';
        }
        return 'MISTAKE';
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameLogic };
} else {
    document.addEventListener('DOMContentLoaded', () => {
        const modal = document.getElementById('modal');
        const startBtn = document.getElementById('start-btn');
        const modalTitle = document.getElementById('modal-title');
        const modalDesc = document.getElementById('modal-desc');
        const finalScore = document.getElementById('final-score');
        const resultCount = document.getElementById('result-count');
        
        const countdownOverlay = document.getElementById('countdown-overlay');
        const countdownText = document.getElementById('countdown-text');
        const successEffect = document.getElementById('success-effect');
        
        const timeDisplay = document.getElementById('time-display');
        const scoreDisplay = document.getElementById('score-display');
        const orderContainer = document.getElementById('order-items');
        const skewerContainer = document.getElementById('skewer-items');
        const skewerStage = document.querySelector('.skewer-stage');
        const ingredientBtns = document.querySelectorAll('.ingredient-btn');

        const emojis = {
            'meat': '🍖',
            'onion': '🧅',
            'pepper': '🫑'
        };
        const availableTypes = Object.keys(emojis);
        const GAME_DURATION = 20.0; // 制限時間（秒）
        const orderLength = 4; // 1本あたりの具材数

        let currentOrder = [];
        let currentSkewer = [];
        let completedSkewers = [];
        let score = 0;
        let timeLeft = GAME_DURATION;
        let timerInterval;
        let isPlaying = false;
        let orderStartTime = 0;

        function renderOrder() {
            orderContainer.innerHTML = '';
            currentOrder.forEach((type, index) => {
                const el = document.createElement('div');
                el.className = 'order-item-icon';
                if (index < currentSkewer.length) {
                    el.classList.add('done');
                }
                el.textContent = emojis[type];
                orderContainer.appendChild(el);
            });
        }

        function renderSkewer() {
            skewerContainer.innerHTML = '';
            currentSkewer.forEach(type => {
                const el = document.createElement('div');
                el.className = 'skewer-item';
                el.textContent = emojis[type];
                skewerContainer.appendChild(el);
            });
        }

        function setupNewOrder() {
            currentOrder = GameLogic.generateOrder(orderLength, availableTypes);
            currentSkewer = [];
            orderStartTime = Date.now();
            
            // クラスのリセット
            skewerStage.style.transition = 'none';
            skewerStage.classList.remove('complete');
            // リフローを強制してトランジションを再有効化
            void skewerStage.offsetWidth;
            skewerStage.style.transition = '';

            renderOrder();
            renderSkewer();
        }

        function handleMistake() {
            // ミスしたら串をリセット（少し厳しいルールで緊迫感を出す）
            skewerStage.classList.remove('mistake');
            void skewerStage.offsetWidth;
            skewerStage.classList.add('mistake');
            
            currentSkewer = [];
            renderOrder();
            renderSkewer();
        }

        function handleComplete() {
            score++;
            scoreDisplay.textContent = score;
            
            // 履歴に現在の串を保存 (コピーを保存)
            completedSkewers.push([...currentSkewer]);
            
            // 完了アニメーション
            skewerStage.classList.add('complete');
            renderOrder(); // done状態にするため
            
            // スピードに応じた演出の分岐
            const timeTaken = (Date.now() - orderStartTime) / 1000;
            let msg = '';
            let tierClass = '';

            if (timeTaken <= 3.0) {
                msg = 'PERFECT!🍖';
                tierClass = 'tier-top';
            } else if (timeTaken <= 5.0) {
                msg = 'GREAT!✨';
                tierClass = 'tier-high';
            } else {
                msg = 'GOOD!😊';
                tierClass = 'tier-normal';
            }

            // 成功演出テキストを表示
            successEffect.textContent = msg;
            successEffect.className = `success-effect ${tierClass}`;
            successEffect.style.animation = 'none';
            void successEffect.offsetWidth; // リフロー強制
            successEffect.style.animation = 'successPop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';

            setTimeout(() => {
                successEffect.classList.add('hidden');
            }, 600);
            
            // アニメーション完了後に新しい串をセット
            setTimeout(setupNewOrder, 300);
        }

        function onIngredientClick(e) {
            if (!isPlaying) return;
            const type = e.currentTarget.dataset.type;
            
            const result = GameLogic.checkInput(currentOrder, currentSkewer, type);
            
            if (result === 'COMPLETE') {
                handleComplete();
            } else if (result === 'ADDED') {
                renderOrder();
                renderSkewer();
            } else if (result === 'MISTAKE') {
                handleMistake();
            }
        }

        function updateTimer() {
            timeLeft -= 0.1;
            if (timeLeft <= 0) {
                timeLeft = 0;
                endGame();
            }
            timeDisplay.textContent = timeLeft.toFixed(1);
        }

        function startActualGame() {
            score = 0;
            timeLeft = GAME_DURATION;
            completedSkewers = [];
            scoreDisplay.textContent = score;
            timeDisplay.textContent = timeLeft.toFixed(1);
            isPlaying = true;
            
            if (typeof CouponUI !== 'undefined') {
                CouponUI.hide('coupon-section');
            }

            document.getElementById('completed-skewers-container').classList.add('hidden');
            setupNewOrder();

            if (timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(updateTimer, 100);
        }

        function startGame() {
            modal.classList.add('hidden');
            countdownOverlay.classList.remove('hidden');
            
            let count = 3;
            countdownText.textContent = count;
            // アニメーションをリセットするため
            countdownText.style.animation = 'none';
            void countdownText.offsetWidth;
            countdownText.style.animation = 'pulse 1s infinite';

            const countInterval = setInterval(() => {
                count--;
                if (count > 0) {
                    countdownText.textContent = count;
                } else if (count === 0) {
                    countdownText.textContent = "GO!";
                } else {
                    clearInterval(countInterval);
                    countdownOverlay.classList.add('hidden');
                    startActualGame();
                }
            }, 1000);
        }

        function endGame() {
            isPlaying = false;
            clearInterval(timerInterval);
            
            modalTitle.textContent = "TIME UP!";
            modalDesc.style.display = "none";
            finalScore.classList.remove('hidden');
            resultCount.textContent = score;
            
            // クーポン獲得セクションの制御（10本以上完成でクーポン表示）
            if (typeof CouponUI !== 'undefined') {
                CouponUI.renderResult({
                    containerId: 'coupon-section',
                    gameId: 'bbq',
                    isEligible: GameLogic.isEligibleForCoupon(score),
                    record: `${score}本`,
                    conditionHint: '💡 <strong>10本以上</strong>完成させると限定クーポンGET！',
                    successMsg: '🎉 <strong>10本以上達成！</strong><br>限定クーポンを獲得しました！',
                    claimedMsg: '🎉 <strong>10本以上達成！お見事！</strong><br><span style="font-size: 12px; color: #777;">※ 本日のクーポンは獲得済みです（1日1回限定）</span>'
                });
            }

            // 履歴を描画
            const container = document.getElementById('completed-skewers-container');
            const list = document.getElementById('completed-skewers-list');
            list.innerHTML = '';
            
            if (completedSkewers.length > 0) {
                completedSkewers.forEach((skewer, index) => {
                    const miniSkewer = document.createElement('div');
                    miniSkewer.className = 'mini-skewer';
                    
                    skewer.forEach(item => {
                        const icon = document.createElement('div');
                        icon.className = 'mini-skewer-item';
                        icon.textContent = emojis[item];
                        miniSkewer.appendChild(icon);
                    });
                    
                    // 作った順番の番号を一番上に追加 (flex-direction: column-reverse のため最後にappendする)
                    const numBadge = document.createElement('div');
                    numBadge.className = 'skewer-number';
                    numBadge.textContent = (index + 1);
                    miniSkewer.appendChild(numBadge);
                    
                    list.appendChild(miniSkewer);
                });
                container.classList.remove('hidden');
            }
            
            startBtn.textContent = "もう一度プレイ";
            
            modal.classList.remove('hidden');
        }

        ingredientBtns.forEach(btn => {
            btn.addEventListener('click', onIngredientClick);
        });

        startBtn.addEventListener('click', startGame);
    });
}
