/**
 * 脳バグ！後出しじゃんけん (Brain Janken Rush) - Versus モード
 * 1台おすそ分け2人対戦 ゲームロジック & エンジン
 */

const JankenVersusLogic = {
    CONFIG: {
        maxPoints: 3,          // 3問先取で勝利
        roundTimeSec: 5.0,     // 1問あたりの制限時間（秒）
        resultDelayMs: 1200,   // 結果表示時間（ミリ秒）
    },

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
     * 親の手と指示から期待される正解の手を算出
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
     * 正誤判定
     */
    evaluatePlayerAnswer: function(opponentHand, instruction, playerHand) {
        return playerHand === this.getExpectedHand(opponentHand, instruction);
    },

    /**
     * 早押しアクション判定（正解なら本人に1点、誤答なら相手に1点・仕切り直しなし）
     */
    evaluateAction: function(player, opponentHand, instruction, playerHand) {
        const isCorrect = this.evaluatePlayerAnswer(opponentHand, instruction, playerHand);
        const otherPlayer = player === 'p1' ? 'p2' : 'p1';

        if (isCorrect) {
            return {
                winner: player,
                isCorrect: true,
                p1Point: player === 'p1' ? 1 : 0,
                p2Point: player === 'p2' ? 1 : 0,
                message: `${player.toUpperCase()} 正解！ +1pt ✨`
            };
        } else {
            return {
                winner: otherPlayer,
                isCorrect: false,
                p1Point: otherPlayer === 'p1' ? 1 : 0,
                p2Point: otherPlayer === 'p2' ? 1 : 0,
                message: `${player.toUpperCase()} ミス！ ${otherPlayer.toUpperCase()}に1点！ 💥`
            };
        }
    },

    /**
     * 問題のランダム生成
     */
    generateQuestion: function(prevOpponent = null, randomFn = Math.random) {
        const hands = this.HANDS;
        const instructions = this.INSTRUCTIONS;

        const opponentHand = hands[Math.floor(randomFn() * hands.length)];
        const instruction = instructions[Math.floor(randomFn() * instructions.length)];

        return { opponentHand, instruction };
    },

    /**
     * スコア更新
     */
    updateScore: function(scores, roundResult) {
        return {
            p1: scores.p1 + (roundResult.p1Point || 0),
            p2: scores.p2 + (roundResult.p2Point || 0)
        };
    },

    /**
     * マッチ勝者判定
     */
    checkMatchWinner: function(scores, maxPoints = this.CONFIG.maxPoints) {
        if (scores.p1 >= maxPoints) return 'p1';
        if (scores.p2 >= maxPoints) return 'p2';
        return null;
    }
};

// Node.js テスト環境用エクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { JankenVersusLogic };
} else {
    // ブラウザ環境での実行
    document.addEventListener('DOMContentLoaded', () => {
        // DOM要素
        const p1ScoreBox = document.getElementById('p1-score');
        const p2ScoreBox = document.getElementById('p2-score');
        const roundTitle = document.getElementById('round-title');
        const timerProgress = document.getElementById('timer-progress');
        const opponentHandEl = document.getElementById('opponent-hand');
        const instructionBadge = document.getElementById('instruction-badge');
        const instructionText = document.getElementById('instruction-text');
        const feedbackOverlay = document.getElementById('feedback-overlay');
        const startScreen = document.getElementById('start-screen');
        const startBtn = document.getElementById('start-btn');
        const resultModal = document.getElementById('result-modal');
        const retryBtn = document.getElementById('retry-btn');
        const resultWinnerTitle = document.getElementById('result-winner-title');
        const resultWinnerDesc = document.getElementById('result-winner-desc');
        const resultFinalScore = document.getElementById('result-final-score');
        const shareBtn = document.getElementById('share-btn');

        const p1Buttons = document.querySelectorAll('.p1-controls .hand-btn');
        const p2Buttons = document.querySelectorAll('.p2-controls .hand-btn');

        // Web Audio API サウンド
        const Sound = {
            ctx: null,

            init() {
                if (!this.ctx) {
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    if (AudioContext) {
                        this.ctx = new AudioContext();
                    }
                }
                if (this.ctx && this.ctx.state === 'suspended') {
                    this.ctx.resume();
                }
            },

            playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.2) {
                if (!this.ctx) return;
                try {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = type;
                    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                    gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start();
                    osc.stop(this.ctx.currentTime + duration);
                } catch (e) {
                    console.warn(e);
                }
            },

            // 出題音
            playPop() {
                this.init();
                this.playTone(600, 'sine', 0.08, 0.2);
            },

            // 正解チャイム
            playSuccess() {
                this.init();
                this.playTone(523, 'sine', 0.1, 0.2);
                setTimeout(() => this.playTone(659, 'sine', 0.1, 0.2), 70);
                setTimeout(() => this.playTone(784, 'sine', 0.2, 0.25), 140);
            },

            // 誤答・ミス音
            playWrong() {
                this.init();
                this.playTone(180, 'sawtooth', 0.2, 0.25);
                setTimeout(() => this.playTone(130, 'sawtooth', 0.25, 0.25), 100);
            },

            // 勝利ファンファーレ
            playVictory() {
                this.init();
                const notes = [
                    { f: 523, d: 0.12 },
                    { f: 659, d: 0.12 },
                    { f: 784, d: 0.12 },
                    { f: 1046, d: 0.35 }
                ];
                let time = 0;
                notes.forEach(n => {
                    setTimeout(() => this.playTone(n.f, 'triangle', n.d, 0.25), time * 1000);
                    time += n.d + 0.04;
                });
            }
        };

        // ゲーム状態
        let gameState = 'IDLE'; // IDLE, READY, PLAYING, RESULT, GAME_OVER
        let currentRound = 1;
        let scores = { p1: 0, p2: 0 };
        let currentQuestion = null;
        let timerIntervalId = null;
        let roundStartTime = 0;
        let answeredThisRound = false;

        // スコアUI更新
        function updateScoreUI() {
            const createStarSvg = (active) => {
                const color = active ? '#facc15' : 'rgba(255,255,255,0.2)';
                const stroke = active ? '#ca8a04' : '#475569';
                return `<span class="score-star ${active ? 'active' : ''}" style="color:${color}; font-size:1.3rem;">★</span>`;
            };

            let p1Stars = '';
            for (let i = 0; i < JankenVersusLogic.CONFIG.maxPoints; i++) {
                p1Stars += createStarSvg(i < scores.p1);
            }
            p1ScoreBox.innerHTML = p1Stars;

            let p2Stars = '';
            for (let i = 0; i < JankenVersusLogic.CONFIG.maxPoints; i++) {
                p2Stars += createStarSvg(i < scores.p2);
            }
            p2ScoreBox.innerHTML = p2Stars;
        }

        // 手札ボタンの有効/無効
        function setButtonsEnabled(enabled) {
            [...p1Buttons, ...p2Buttons].forEach(btn => {
                btn.disabled = !enabled;
                if (!enabled) {
                    btn.classList.remove('active-tap');
                }
            });
        }

        // マッチ開始
        function startMatch() {
            Sound.init();
            scores = { p1: 0, p2: 0 };
            currentRound = 1;
            startScreen.classList.add('hidden');
            resultModal.classList.add('hidden');
            updateScoreUI();
            startRound();
        }

        // ラウンド開始
        function startRound() {
            gameState = 'READY';
            answeredThisRound = false;
            setButtonsEnabled(false);
            feedbackOverlay.classList.add('hidden');
            roundTitle.textContent = `ROUND ${currentRound}`;

            opponentHandEl.textContent = '❓';
            opponentHandEl.className = 'opponent-hand waiting';
            instructionBadge.style.backgroundColor = '#475569';
            instructionBadge.style.color = '#fff';
            instructionText.textContent = 'READY...';
            timerProgress.style.width = '100%';

            setTimeout(() => {
                if (gameState !== 'READY') return;
                launchQuestion();
            }, 800);
        }

        // 問題出題
        function launchQuestion() {
            gameState = 'PLAYING';
            currentQuestion = JankenVersusLogic.generateQuestion();
            Sound.playPop();

            // 親の手
            opponentHandEl.textContent = JankenVersusLogic.EMOJIS[currentQuestion.opponentHand];
            opponentHandEl.className = 'opponent-hand pop-in';

            // 指示バッジ
            const info = JankenVersusLogic.INSTRUCTION_LABELS[currentQuestion.instruction];
            instructionBadge.style.backgroundColor = info.bg;
            instructionBadge.style.color = info.color;
            instructionText.textContent = info.text;

            setButtonsEnabled(true);
            roundStartTime = performance.now();

            // タイマー開始 (5.0秒カウントダウン)
            if (timerIntervalId) clearInterval(timerIntervalId);
            const totalDurationMs = JankenVersusLogic.CONFIG.roundTimeSec * 1000;

            timerIntervalId = setInterval(() => {
                const elapsed = performance.now() - roundStartTime;
                const remainingRatio = Math.max(0, (totalDurationMs - elapsed) / totalDurationMs);
                timerProgress.style.width = `${(remainingRatio * 100).toFixed(1)}%`;

                if (remainingRatio <= 0.25) {
                    timerProgress.style.backgroundColor = '#ef4444';
                } else if (remainingRatio <= 0.5) {
                    timerProgress.style.backgroundColor = '#facc15';
                } else {
                    timerProgress.style.backgroundColor = '#38bdf8';
                }

                if (elapsed >= totalDurationMs) {
                    // 時間切れ
                    clearInterval(timerIntervalId);
                    timerIntervalId = null;
                    if (gameState === 'PLAYING') {
                        handleTimeout();
                    }
                }
            }, 30);
        }

        // プレイヤー回答ハンドリング (player: 'p1' | 'p2', hand: 'rock' | 'scissors' | 'paper')
        function handlePlayerAnswer(player, hand) {
            if (gameState !== 'PLAYING' || answeredThisRound) return;
            answeredThisRound = true;
            if (timerIntervalId) {
                clearInterval(timerIntervalId);
                timerIntervalId = null;
            }

            setButtonsEnabled(false);
            const evalResult = JankenVersusLogic.evaluateAction(player, currentQuestion.opponentHand, currentQuestion.instruction, hand);

            if (evalResult.isCorrect) {
                Sound.playSuccess();
            } else {
                Sound.playWrong();
            }

            finishRound(evalResult);
        }

        // 時間切れハンドリング
        function handleTimeout() {
            answeredThisRound = true;
            setButtonsEnabled(false);
            Sound.playWrong();

            finishRound({
                winner: 'none',
                isCorrect: false,
                p1Point: 0,
                p2Point: 0,
                message: '時間切れ！ 引き分け！'
            });
        }

        // ラウンド決着
        function finishRound(evalResult) {
            gameState = 'RESULT';
            feedbackOverlay.textContent = evalResult.message;
            feedbackOverlay.className = `feedback-overlay ${evalResult.winner === 'p1' ? 'p1-win' : evalResult.winner === 'p2' ? 'p2-win' : 'draw'}`;
            feedbackOverlay.classList.remove('hidden');

            scores = JankenVersusLogic.updateScore(scores, evalResult);
            updateScoreUI();

            const matchWinner = JankenVersusLogic.checkMatchWinner(scores);

            setTimeout(() => {
                if (matchWinner) {
                    showGameOver(matchWinner);
                } else {
                    currentRound++;
                    startRound();
                }
            }, JankenVersusLogic.CONFIG.resultDelayMs);
        }

        // 試合終了モーダル
        function showGameOver(winner) {
            gameState = 'GAME_OVER';
            Sound.playVictory();

            const isP1 = winner === 'p1';
            resultWinnerTitle.textContent = isP1 ? '🏆 PLAYER 1 の勝利！' : '🏆 PLAYER 2 の勝利！';
            resultWinnerTitle.style.color = isP1 ? '#38bdf8' : '#f87171';
            resultWinnerDesc.textContent = isP1
                ? 'P1の神速判断！ 脳バグを制した！ P2はジュースを奢ろう！🍹'
                : 'P2の鮮やか勝利！ 脳バグを制した！ P1はジュースを奢ろう！🍹';
            resultFinalScore.textContent = `P1: ${scores.p1} 勝  -  P2: ${scores.p2} 勝`;

            resultModal.classList.remove('hidden');
        }

        // ボタンクリックイベント (P1 & P2)
        p1Buttons.forEach(btn => {
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                handlePlayerAnswer('p1', btn.dataset.hand);
            });
        });

        p2Buttons.forEach(btn => {
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                handlePlayerAnswer('p2', btn.dataset.hand);
            });
        });

        // PCキーボード操作 (P1: A/S/D, P2: J/K/L)
        window.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            const code = e.code || '';
            const key = (e.key || '').toLowerCase();

            // P1
            if (code === 'KeyA' || key === 'a') handlePlayerAnswer('p1', 'rock');
            if (code === 'KeyS' || key === 's') handlePlayerAnswer('p1', 'scissors');
            if (code === 'KeyD' || key === 'd') handlePlayerAnswer('p1', 'paper');

            // P2
            if (code === 'KeyJ' || key === 'j') handlePlayerAnswer('p2', 'rock');
            if (code === 'KeyK' || key === 'k') handlePlayerAnswer('p2', 'scissors');
            if (code === 'KeyL' || key === 'l') handlePlayerAnswer('p2', 'paper');
        });

        startBtn.addEventListener('click', startMatch);
        retryBtn.addEventListener('click', startMatch);

        shareBtn.addEventListener('click', () => {
            const text = `✌️ GoGoUmi paradise【脳バグ！後出しじゃんけん - 2人対戦】\nP1 (${scores.p1}勝) VS P2 (${scores.p2}勝)！\n1台のスマホで脳トレ早押し対決！\n#GoGoUmiparadise #海の家 #興居島 #じゃんけん対戦`;
            const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`;
            window.open(url, '_blank', 'noopener,noreferrer');
        });

        // 外部テスト用ヘルパー
        window.__jankenVersus = {
            handlePlayerAnswer,
            getState: () => ({ gameState, scores, currentRound, currentQuestion })
        };
    });
}
