/**
 * 脳バグ！後出しじゃんけん (Brain Janken Rush)
 * ゲームロジック & コントローラー
 */

const GameLogic = {
    HANDS: ['rock', 'scissors', 'paper'],
    INSTRUCTIONS: ['win', 'lose', 'draw'],

    EMOJIS: {
        'rock': '✊',
        'scissors': '✌️',
        'paper': '🖐️'
    },

    INSTRUCTION_LABELS: {
        'win': { text: '勝て！', color: '#ef4444', bg: '#fee2e2' },
        'lose': { text: '負けろ！', color: '#3b82f6', bg: '#dbeafe' },
        'draw': { text: 'あいこ！', color: '#10b981', bg: '#d1fae5' }
    },

    /**
     * 相手の手と指示に対する「期待される正解の手」を算出
     * @param {string} opponentHand 'rock' | 'scissors' | 'paper'
     * @param {string} instruction 'win' | 'lose' | 'draw'
     * @returns {string} 正解の手
     */
    getExpectedHand: function(opponentHand, instruction) {
        if (instruction === 'draw') return opponentHand;

        if (opponentHand === 'rock') {
            return instruction === 'win' ? 'paper' : 'scissors';
        }
        if (opponentHand === 'scissors') {
            return instruction === 'win' ? 'rock' : 'paper';
        }
        if (opponentHand === 'paper') {
            return instruction === 'win' ? 'scissors' : 'rock';
        }
        return null;
    },

    /**
     * プレイヤーの手を評価する
     * @param {string} opponentHand
     * @param {string} instruction
     * @param {string} playerHand
     * @returns {boolean} 正解なら true
     */
    evaluateHand: function(opponentHand, instruction, playerHand) {
        const expected = this.getExpectedHand(opponentHand, instruction);
        return playerHand === expected;
    },

    /**
     * 新しい問題（相手の手＋指示）をランダム生成
     * @param {string|null} prevOpponent 直前の相手の手（連続同じを少し緩和するため）
     * @param {function} randomFn ランダム関数
     * @returns {{ opponentHand: string, instruction: string }}
     */
    generateQuestion: function(prevOpponent = null, randomFn = Math.random) {
        const hands = this.HANDS;
        const instructions = this.INSTRUCTIONS;

        const opponentHand = hands[Math.floor(randomFn() * hands.length)];
        const instruction = instructions[Math.floor(randomFn() * instructions.length)];

        return { opponentHand, instruction };
    },

    /**
     * クーポン獲得条件（10問全問クリア かつ 所要時間12.0秒以内）
     * @param {number} clearedRounds 正解数
     * @param {number} totalTime かかった合計秒数
     * @param {number} maxRounds 目標クリア数（デフォルト10）
     * @param {number} targetTime 基準タイム（デフォルト12.0秒）
     * @returns {boolean}
     */
    isEligibleForCoupon: function(clearedRounds, totalTime, maxRounds = 10, targetTime = 12.0) {
        return clearedRounds >= maxRounds && typeof totalTime === 'number' && totalTime > 0 && totalTime <= targetTime;
    },

    /**
     * ランク判定
     */
    getRank: function(clearedRounds, totalTime, maxRounds = 10) {
        if (clearedRounds < maxRounds) {
            return { rank: 'C', title: '😅 脳がバグった見習い', eligible: false };
        }
        if (totalTime <= 7.5) {
            return { rank: 'S', title: '👑 神速のじゃんけんマスター', eligible: true };
        }
        if (totalTime <= 12.0) {
            return { rank: 'A', title: '🌟 脳バグ克服！合格！', eligible: true };
        }
        return { rank: 'B', title: '👏 一人前じゃんけん師', eligible: false };
    }
};

// Node.js テスト環境用エクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameLogic };
} else {
    // ブラウザ環境
    document.addEventListener('DOMContentLoaded', () => {
        const TOTAL_ROUNDS = 10;
        const ROUND_TIME_SEC = 1.5; // 1問あたりの制限時間（秒）
        const MAX_LIVES = 3;

        // DOM要素
        const currentRoundEl = document.getElementById('current-round');
        const livesDisplayEl = document.getElementById('lives-display');
        const timeDisplayEl = document.getElementById('time-display');
        const timerProgressEl = document.getElementById('timer-progress');
        
        const opponentHandEl = document.getElementById('opponent-hand');
        const instructionTextEl = document.getElementById('instruction-text');
        const instructionBadgeEl = document.getElementById('instruction-badge');
        const handButtons = document.querySelectorAll('.hand-btn');
        const feedbackOverlayEl = document.getElementById('feedback-overlay');
        
        const countdownOverlay = document.getElementById('countdown-overlay');
        const countdownText = document.getElementById('countdown-text');
        
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalDesc = document.getElementById('modal-desc');
        const finalScore = document.getElementById('final-score');
        const resultCleared = document.getElementById('result-cleared');
        const resultTime = document.getElementById('result-time');
        const startBtn = document.getElementById('start-btn');

        // Web Audio APIによるSE合成
        const Sound = {
            ctx: null,
            init() {
                if (!this.ctx) {
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    if (AudioContext) this.ctx = new AudioContext();
                }
                if (this.ctx && this.ctx.state === 'suspended') {
                    this.ctx.resume();
                }
            },
            playSuccess() {
                if (!this.ctx) return;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.type = 'triangle';
                const now = this.ctx.currentTime;
                osc.frequency.setValueAtTime(587.33, now); // D5
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.1); // A5
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                osc.start(now);
                osc.stop(now + 0.15);
            },
            playMiss() {
                if (!this.ctx) return;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.type = 'sawtooth';
                const now = this.ctx.currentTime;
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.setValueAtTime(140, now + 0.1);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
                osc.start(now);
                osc.stop(now + 0.25);
            }
        };

        // ゲーム状態変数
        let currentRound = 0;
        let clearedCount = 0;
        let lives = MAX_LIVES;
        let isPlaying = false;
        let currentQuestion = null;
        let gameStartTime = 0;
        let questionStartTime = 0;
        let questionTimer = null;
        let questionInterval = null;

        function updateLivesDisplay() {
            let hearts = '';
            for (let i = 0; i < MAX_LIVES; i++) {
                hearts += i < lives ? '❤️' : '🖤';
            }
            livesDisplayEl.textContent = hearts;
        }

        function setButtonsEnabled(enabled) {
            handButtons.forEach(btn => {
                btn.disabled = !enabled;
            });
        }

        function renderQuestion(q) {
            opponentHandEl.textContent = GameLogic.EMOJIS[q.opponentHand];
            opponentHandEl.classList.remove('pop-anim');
            void opponentHandEl.offsetWidth;
            opponentHandEl.classList.add('pop-anim');

            const info = GameLogic.INSTRUCTION_LABELS[q.instruction];
            instructionTextEl.textContent = info.text;
            instructionBadgeEl.style.backgroundColor = info.bg;
            instructionBadgeEl.style.color = info.color;
            instructionBadgeEl.style.borderColor = info.color;
        }

        function nextQuestion() {
            if (lives <= 0 || currentRound >= TOTAL_ROUNDS) {
                endGame(lives > 0 && currentRound >= TOTAL_ROUNDS);
                return;
            }

            currentRound++;
            currentRoundEl.textContent = `${currentRound}/${TOTAL_ROUNDS}`;
            currentQuestion = GameLogic.generateQuestion(currentQuestion ? currentQuestion.opponentHand : null);
            renderQuestion(currentQuestion);

            setButtonsEnabled(true);
            questionStartTime = Date.now();

            // 1問のタイマー進行バー制御
            if (questionInterval) clearInterval(questionInterval);
            if (questionTimer) clearTimeout(questionTimer);

            timerProgressEl.style.width = '100%';

            questionInterval = setInterval(() => {
                const elapsed = (Date.now() - questionStartTime) / 1000;
                const ratio = Math.max(0, 1 - (elapsed / ROUND_TIME_SEC));
                timerProgressEl.style.width = `${(ratio * 100).toFixed(1)}%`;
            }, 30);

            questionTimer = setTimeout(() => {
                handleTimeout();
            }, ROUND_TIME_SEC * 1000);
        }

        function showFeedback(text, isSuccess) {
            feedbackOverlayEl.textContent = text;
            feedbackOverlayEl.className = `feedback-overlay ${isSuccess ? 'success' : 'miss'}`;
            feedbackOverlayEl.classList.remove('hidden');
            setTimeout(() => {
                feedbackOverlayEl.classList.add('hidden');
            }, 350);
        }

        function handleInput(playerHand) {
            if (!isPlaying) return;
            setButtonsEnabled(false);

            clearInterval(questionInterval);
            clearTimeout(questionTimer);

            const isCorrect = GameLogic.evaluateHand(currentQuestion.opponentHand, currentQuestion.instruction, playerHand);

            if (isCorrect) {
                clearedCount++;
                Sound.playSuccess();
                showFeedback('NICE! ✨', true);
                setTimeout(nextQuestion, 200);
            } else {
                lives--;
                updateLivesDisplay();
                Sound.playMiss();
                showFeedback('MISS! ❌', false);
                document.querySelector('.game-stage').classList.add('shake');
                setTimeout(() => {
                    document.querySelector('.game-stage').classList.remove('shake');
                    nextQuestion();
                }, 400);
            }
        }

        function handleTimeout() {
            if (!isPlaying) return;
            setButtonsEnabled(false);
            clearInterval(questionInterval);

            lives--;
            updateLivesDisplay();
            Sound.playMiss();
            showFeedback('TIME OUT! ⏰', false);
            document.querySelector('.game-stage').classList.add('shake');
            setTimeout(() => {
                document.querySelector('.game-stage').classList.remove('shake');
                nextQuestion();
            }, 400);
        }

        function startGame() {
            Sound.init();
            startBtn.disabled = true;
            modal.classList.add('hidden');
            countdownOverlay.classList.remove('time-up');
            countdownOverlay.classList.remove('hidden');

            let count = 3;
            countdownText.textContent = count;
            countdownText.style.animation = 'none';
            void countdownText.offsetWidth;
            countdownText.style.animation = 'pulse 1s infinite';

            const countInterval = setInterval(() => {
                count--;
                if (count > 0) {
                    countdownText.textContent = count;
                } else if (count === 0) {
                    countdownText.textContent = "START!";
                } else {
                    clearInterval(countInterval);
                    countdownOverlay.classList.add('hidden');
                    startActualGame();
                }
            }, 1000);
        }

        function startActualGame() {
            currentRound = 0;
            clearedCount = 0;
            lives = MAX_LIVES;
            isPlaying = true;
            updateLivesDisplay();
            timeDisplayEl.textContent = '0.0s';
            gameStartTime = Date.now();

            if (typeof CouponUI !== 'undefined') {
                CouponUI.hide('coupon-section');
            }

            // タイマー表示更新
            const mainTimer = setInterval(() => {
                if (!isPlaying) {
                    clearInterval(mainTimer);
                    return;
                }
                const totalElapsed = (Date.now() - gameStartTime) / 1000;
                timeDisplayEl.textContent = `${totalElapsed.toFixed(1)}s`;
            }, 100);

            nextQuestion();
        }

        function endGame(isClear) {
            isPlaying = false;
            clearInterval(questionInterval);
            clearTimeout(questionTimer);
            setButtonsEnabled(false);

            const totalTime = parseFloat(((Date.now() - gameStartTime) / 1000).toFixed(2));
            const rank = GameLogic.getRank(clearedCount, totalTime, TOTAL_ROUNDS);

            // 1. TIME UP / FINISH 全画面演出で連打抜け・誤タップを即時遮断
            countdownOverlay.classList.add('time-up');
            countdownText.textContent = isClear ? "CLEAR! 🎉" : "GAME OVER 💦";
            countdownText.style.animation = 'none';
            void countdownText.offsetWidth;
            countdownOverlay.classList.remove('hidden');

            // 2. 800ms の演出インターバル後にモーダルオープン
            setTimeout(() => {
                countdownOverlay.classList.add('hidden');
                countdownOverlay.classList.remove('time-up');

                modalTitle.textContent = isClear ? rank.title : "GAME OVER 💦";
                modalDesc.textContent = isClear
                    ? `10問全問クリア達成！クリアタイム: ${totalTime}秒`
                    : `正解数: ${clearedCount}/${TOTAL_ROUNDS}問（タイム: ${totalTime}秒）`;

                finalScore.classList.remove('hidden');
                resultCleared.textContent = `${clearedCount}/${TOTAL_ROUNDS}`;
                resultTime.textContent = `${totalTime}s`;

                // クーポン判定 & 表示
                if (typeof CouponUI !== 'undefined') {
                    CouponUI.renderResult({
                        containerId: 'coupon-section',
                        gameId: 'janken',
                        isEligible: GameLogic.isEligibleForCoupon(clearedCount, totalTime, TOTAL_ROUNDS, 12.0),
                        time: `${totalTime}秒`,
                        record: `${clearedCount}問正解`,
                        conditionHint: '💡 <strong>10問全問正解 & 12秒以内</strong>で限定クーポンGET！',
                        successMsg: `🎉 <strong>12秒以内全問クリア達成！（${totalTime}秒）</strong><br>限定クーポンを獲得しました！`,
                        claimedMsg: `🎉 <strong>見事クリア！（${totalTime}秒）</strong><br><span style="font-size: 12px; color: #777;">※ 本日のクーポンは獲得済みです（1日1回限定）</span>`
                    });
                }

                startBtn.textContent = "もう一度プレイ";
                startBtn.disabled = true; // 出現直後のタップ誤発火を防止
                modal.classList.remove('hidden');

                // 3. モーダル出現から0.5秒後にボタン活性化（BBQゲーム標準の安全ガード）
                setTimeout(() => {
                    startBtn.disabled = false;
                }, 500);
            }, 800);
        }

        // イベントバインド
        handButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const hand = e.currentTarget.dataset.hand;
                handleInput(hand);
            });
        });

        startBtn.addEventListener('click', startGame);
    });
}
