/**
 * 最後の一本フランクフルト（Frankfurt Grab）- Versus モード (1台おすそ分け2人対戦)
 * 2人対戦ゲームロジック & エンジン
 */

const VersusLogic = {
    CONFIG: {
        maxPoints: 3,             // 3本先取で勝利
        minWaitTimeMs: 1500,       // 最小合図待機時間
        maxWaitTimeMs: 3800,       // 最大合図待機時間
        foulPenaltyMs: 9999,       // お手つきペナルティタイム
        drawThresholdMs: 5,        // 同着とみなすミリ秒閾値
        roundResultDurationMs: 1600, // ラウンド結果表示時間
        soundEnabled: true
    },

    // 待機時間のランダム算出
    calculateWaitTime: function(min = this.CONFIG.minWaitTimeMs, max = this.CONFIG.maxWaitTimeMs, randomFn = Math.random) {
        return Math.floor(min + randomFn() * (max - min));
    },

    // 反応時間の計算
    calculateReactionTime: function(signalTime, tapTime) {
        if (tapTime < signalTime) return this.CONFIG.foulPenaltyMs;
        return Math.max(0, Math.round(tapTime - signalTime));
    },

    // ラウンド勝敗判定
    evaluateRound: function({ p1Time, p2Time, p1Foul, p2Foul }) {
        // お手つき（FOUL）判定
        if (p1Foul && p2Foul) {
            return {
                winner: 'draw',
                reason: 'both_foul',
                message: 'ふたりとも火傷！ 仕切り直し！',
                p1Point: 0,
                p2Point: 0
            };
        }
        if (p1Foul) {
            return {
                winner: 'p2',
                reason: 'p1_foul',
                message: 'P1お手つき！ P2に1本！',
                p1Point: 0,
                p2Point: 1
            };
        }
        if (p2Foul) {
            return {
                winner: 'p1',
                reason: 'p2_foul',
                message: 'P2お手つき！ P1に1本！',
                p1Point: 1,
                p2Point: 0
            };
        }

        // 正常タップ判定
        const diffMs = Math.abs(p1Time - p2Time);
        if (diffMs < this.CONFIG.drawThresholdMs) {
            return {
                winner: 'draw',
                reason: 'simultaneous',
                diffMs,
                message: `鍔迫り合い！ (${diffMs}ms差)`,
                p1Point: 0,
                p2Point: 0
            };
        }

        if (p1Time < p2Time) {
            return {
                winner: 'p1',
                reason: 'speed',
                diffMs: p2Time - p1Time,
                message: `P1 GET! (+${p2Time - p1Time}ms差)`,
                p1Point: 1,
                p2Point: 0
            };
        } else {
            return {
                winner: 'p2',
                reason: 'speed',
                diffMs: p1Time - p2Time,
                message: `P2 GET! (+${p1Time - p2Time}ms差)`,
                p1Point: 0,
                p2Point: 1
            };
        }
    },

    // スコア加算
    updateScore: function(scores, roundResult) {
        return {
            p1: scores.p1 + (roundResult.p1Point || 0),
            p2: scores.p2 + (roundResult.p2Point || 0)
        };
    },

    // マッチ勝者判定 (3本先取)
    checkMatchWinner: function(scores, maxPoints = this.CONFIG.maxPoints) {
        if (scores.p1 >= maxPoints) return 'p1';
        if (scores.p2 >= maxPoints) return 'p2';
        return null;
    }
};

// Node.js テスト環境用のエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VersusLogic };
} else {
    // ブラウザ環境での実行
    document.addEventListener('DOMContentLoaded', () => {
        const CANVAS_WIDTH = 240;
        const CANVAS_HEIGHT = 380;

        // DOM要素
        const canvas = document.getElementById('game-canvas');
        const ctx = canvas.getContext('2d');
        const p1ScoreBox = document.getElementById('p1-score-icons');
        const p2ScoreBox = document.getElementById('p2-score-icons');
        const startScreen = document.getElementById('start-screen');
        const startBtn = document.getElementById('start-btn');
        const resultModal = document.getElementById('result-modal');
        const retryBtn = document.getElementById('retry-btn');
        const resultWinnerTitle = document.getElementById('result-winner-title');
        const resultWinnerDesc = document.getElementById('result-winner-desc');
        const resultFinalScore = document.getElementById('result-final-score');
        const shareBtn = document.getElementById('share-btn');

        // Web Audio API サウンドシステム
        const Sound = {
            ctx: null,
            sizzleSource: null,
            sizzleGain: null,

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

            // 鉄板ジュージュー音（ホワイトノイズ）
            startSizzle() {
                if (!this.ctx || this.sizzleSource) return;
                try {
                    const bufferSize = this.ctx.sampleRate * 2;
                    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                    const data = buffer.getChannelData(0);
                    for (let i = 0; i < bufferSize; i++) {
                        data[i] = Math.random() * 2 - 1;
                    }

                    this.sizzleSource = this.ctx.createBufferSource();
                    this.sizzleSource.buffer = buffer;
                    this.sizzleSource.loop = true;

                    const filter = this.ctx.createBiquadFilter();
                    filter.type = 'bandpass';
                    filter.frequency.setValueAtTime(2600, this.ctx.currentTime);
                    filter.Q.setValueAtTime(1.5, this.ctx.currentTime);

                    this.sizzleGain = this.ctx.createGain();
                    this.sizzleGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

                    this.sizzleSource.connect(filter);
                    filter.connect(this.sizzleGain);
                    this.sizzleGain.connect(this.ctx.destination);

                    this.sizzleSource.start();
                } catch (e) {
                    console.warn(e);
                }
            },

            stopSizzle() {
                if (this.sizzleGain && this.ctx) {
                    try {
                        this.sizzleGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
                        setTimeout(() => {
                            if (this.sizzleSource) {
                                this.sizzleSource.stop();
                                this.sizzleSource.disconnect();
                                this.sizzleSource = null;
                            }
                        }, 120);
                    } catch (e) {
                        this.sizzleSource = null;
                    }
                }
            },

            playTone(freq, type = 'square', duration = 0.1, gainVal = 0.18) {
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

            // 合図SE（高音ピキーン！）
            playSignal() {
                this.init();
                if (!this.ctx) return;
                try {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(2200, this.ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(3400, this.ctx.currentTime + 0.1);
                    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start();
                    osc.stop(this.ctx.currentTime + 0.15);
                } catch (e) {
                    console.warn(e);
                }
            },

            // 奪取成功SE（8bit上昇アルペジオ）
            playGrabSuccess() {
                this.init();
                const notes = [1046, 1318, 1568, 2093];
                notes.forEach((freq, idx) => {
                    setTimeout(() => this.playTone(freq, 'square', 0.08, 0.2), idx * 45);
                });
            },

            // 火傷・お手つきSE（低音下降）
            playFoul() {
                this.init();
                if (!this.ctx) return;
                try {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(160, this.ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.3);
                    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start();
                    osc.stop(this.ctx.currentTime + 0.3);
                } catch (e) {
                    console.warn(e);
                }
            },

            // 勝利ファンファーレ
            playVictory() {
                this.init();
                const melody = [
                    { f: 523, d: 0.12 }, // C5
                    { f: 659, d: 0.12 }, // E5
                    { f: 784, d: 0.12 }, // G5
                    { f: 1046, d: 0.35 } // C6
                ];
                let time = 0;
                melody.forEach(item => {
                    setTimeout(() => this.playTone(item.f, 'square', item.d, 0.22), time * 1000);
                    time += item.d + 0.03;
                });
            }
        };

        // ゲーム状態変数
        let gameState = 'IDLE'; // IDLE, READY, WAITING, SIGNAL, ROUND_RESULT, GAME_OVER
        let currentRoundNumber = 1;
        let scores = { p1: 0, p2: 0 };
        let signalTimestamp = 0;
        let waitingTimerId = null;
        let roundTimeoutTimerId = null;

        // 各プレイヤーのラウンド内タップ状態
        let p1Tapped = false;
        let p2Tapped = false;
        let p1TapTime = 0;
        let p2TapTime = 0;
        let p1Foul = false;
        let p2Foul = false;

        // アニメーション用状態
        let currentFrankfurtY = 190; // 中央Y
        let targetFrankfurtY = 190;
        let p1HandY = 40;            // 上側 (P1)
        let p2HandY = 340;           // 下側 (P2)
        let p1Burned = false;
        let p2Burned = false;
        let sparks = [];
        let sizzleSmoke = [];
        let roundResultMessage = '';
        let roundResultColor = '#facc15';

        // スモークパーティクル初期化
        for (let i = 0; i < 8; i++) {
            sizzleSmoke.push({
                x: 80 + Math.random() * 80,
                y: 170 + Math.random() * 40,
                size: 2 + Math.random() * 3,
                vy: -0.4 - Math.random() * 0.4,
                alpha: 0.2 + Math.random() * 0.5
            });
        }

        // 火花エフェクト追加
        function addSparks(x, y, color = '#ef4444', count = 12) {
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 1 + Math.random() * 4;
                sparks.push({
                    x: x,
                    y: y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    color: color,
                    life: 25 + Math.random() * 15,
                    maxLife: 40,
                    size: 2 + Math.random() * 2
                });
            }
        }

        // UIのスコア更新
        function updateScoreUI() {
            const createFrankSvg = (active, isP1) => {
                const opacity = active ? '1.0' : '0.2';
                const filter = active ? '' : 'filter: grayscale(1);';
                return `<span class="score-frank ${active ? 'active' : ''}" style="opacity:${opacity}; ${filter}">
                    <svg class="pixel-frank-icon" viewBox="0 0 16 16" width="1.2em" height="1.2em" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="1" y="13" width="2" height="2" fill="#b45309"/>
                        <rect x="2" y="12" width="2" height="2" fill="#d97706"/>
                        <rect x="3" y="11" width="2" height="2" fill="#f59e0b"/>
                        <rect x="3" y="6" width="8" height="6" rx="2" fill="#991b1b"/>
                        <rect x="5" y="4" width="8" height="6" rx="2" fill="#991b1b"/>
                        <rect x="4" y="6" width="7" height="5" fill="#dc2626"/>
                        <rect x="5" y="5" width="7" height="5" fill="#ef4444"/>
                        <rect x="5" y="8" width="1" height="2" fill="#7f1d1d"/>
                        <rect x="8" y="6" width="1" height="2" fill="#7f1d1d"/>
                        <rect x="10" y="5" width="1" height="2" fill="#7f1d1d"/>
                        <rect x="6" y="7" width="2" height="1" fill="#facc15"/>
                        <rect x="7" y="8" width="2" height="1" fill="#facc15"/>
                        <rect x="9" y="6" width="2" height="1" fill="#fde047"/>
                        <rect x="12" y="3" width="2" height="2" fill="#d97706"/>
                        <rect x="13" y="2" width="1" height="1" fill="#f59e0b"/>
                    </svg>
                </span>`;
            };

            let p1Html = '';
            for (let i = 0; i < VersusLogic.CONFIG.maxPoints; i++) {
                p1Html += createFrankSvg(i < scores.p1, true);
            }
            p1ScoreBox.innerHTML = p1Html;

            let p2Html = '';
            for (let i = 0; i < VersusLogic.CONFIG.maxPoints; i++) {
                p2Html += createFrankSvg(i < scores.p2, false);
            }
            p2ScoreBox.innerHTML = p2Html;
        }

        // ゲーム初期化 & 開始
        function startMatch() {
            Sound.init();
            scores = { p1: 0, p2: 0 };
            currentRoundNumber = 1;
            startScreen.classList.add('hidden');
            resultModal.classList.add('hidden');
            updateScoreUI();
            startRound();
        }

        // ラウンド開始
        function startRound() {
            gameState = 'READY';
            p1Tapped = false;
            p2Tapped = false;
            p1TapTime = 0;
            p2TapTime = 0;
            p1Foul = false;
            p2Foul = false;
            p1Burned = false;
            p2Burned = false;
            currentFrankfurtY = 190;
            targetFrankfurtY = 190;
            p1HandY = 65;
            p2HandY = 315;
            roundResultMessage = '';

            // 0.8秒待機後に WAITING（合図待ち）へ移行
            setTimeout(() => {
                if (gameState !== 'READY') return;
                gameState = 'WAITING';
                Sound.startSizzle();

                const waitDuration = VersusLogic.calculateWaitTime();
                waitingTimerId = setTimeout(() => {
                    if (gameState !== 'WAITING') return;
                    triggerSignal();
                }, waitDuration);
            }, 800);
        }

        // 合図発生（「！」）
        function triggerSignal() {
            gameState = 'SIGNAL';
            signalTimestamp = performance.now();
            Sound.stopSizzle();
            Sound.playSignal();

            // どちらもタップしなかった場合の安全タイムアウト（2秒後）
            roundTimeoutTimerId = setTimeout(() => {
                if (gameState === 'SIGNAL') {
                    finishRound({
                        winner: 'draw',
                        reason: 'timeout',
                        message: '時間切れ！ 引き分け！',
                        p1Point: 0,
                        p2Point: 0
                    });
                }
            }, 2000);
        }

        // タップ処理 (player: 'p1' | 'p2')
        function handlePlayerAction(player) {
            const now = performance.now();

            if (player === 'p1') {
                if (p1Tapped) return;
                p1Tapped = true;
            } else {
                if (p2Tapped) return;
                p2Tapped = true;
            }

            // 1. WAITING中（フライングお手つき！）
            if (gameState === 'WAITING') {
                if (waitingTimerId) clearTimeout(waitingTimerId);
                Sound.stopSizzle();
                Sound.playFoul();

                if (player === 'p1') {
                    p1Foul = true;
                    p1Burned = true;
                    addSparks(120, 100, '#38bdf8', 20);
                } else {
                    p2Foul = true;
                    p2Burned = true;
                    addSparks(120, 280, '#f87171', 20);
                }

                const evalResult = VersusLogic.evaluateRound({
                    p1Time: 9999,
                    p2Time: 9999,
                    p1Foul: p1Foul,
                    p2Foul: p2Foul
                });
                finishRound(evalResult);
                return;
            }

            // 2. SIGNAL中（合図後の最速タップ）
            if (gameState === 'SIGNAL') {
                if (player === 'p1') {
                    p1TapTime = now;
                } else {
                    p2TapTime = now;
                }

                // 最初のタップから極小時間（6ms）待って、ほぼ同時のタップ判定を行う
                if (!window._roundResolveTimer) {
                    window._roundResolveTimer = setTimeout(() => {
                        window._roundResolveTimer = null;
                        if (gameState !== 'SIGNAL') return;
                        if (roundTimeoutTimerId) clearTimeout(roundTimeoutTimerId);

                        const p1Reaction = p1TapTime > 0 ? VersusLogic.calculateReactionTime(signalTimestamp, p1TapTime) : 9999;
                        const p2Reaction = p2TapTime > 0 ? VersusLogic.calculateReactionTime(signalTimestamp, p2TapTime) : 9999;

                        const evalResult = VersusLogic.evaluateRound({
                            p1Time: p1Reaction,
                            p2Time: p2Reaction,
                            p1Foul: false,
                            p2Foul: false
                        });

                        finishRound(evalResult);
                    }, 6);
                }
            }
        }

        // ラウンド決着処理
        function finishRound(evalResult) {
            gameState = 'ROUND_RESULT';
            roundResultMessage = evalResult.message;

            if (evalResult.winner === 'p1') {
                roundResultColor = '#38bdf8';
                targetFrankfurtY = 135; // P1側に引き寄せ
                p1HandY = 145;
                Sound.playGrabSuccess();
                addSparks(120, 135, '#38bdf8', 16);
            } else if (evalResult.winner === 'p2') {
                roundResultColor = '#f87171';
                targetFrankfurtY = 245; // P2側に引き寄せ
                p2HandY = 235;
                Sound.playGrabSuccess();
                addSparks(120, 245, '#f87171', 16);
            } else {
                roundResultColor = '#facc15';
            }

            scores = VersusLogic.updateScore(scores, evalResult);
            updateScoreUI();

            const matchWinner = VersusLogic.checkMatchWinner(scores);

            setTimeout(() => {
                if (matchWinner) {
                    showGameOver(matchWinner);
                } else {
                    currentRoundNumber++;
                    startRound();
                }
            }, VersusLogic.CONFIG.roundResultDurationMs);
        }

        // マッチ決着モーダル
        function showGameOver(winner) {
            gameState = 'GAME_OVER';
            Sound.playVictory();

            const isP1 = winner === 'p1';
            resultWinnerTitle.textContent = isP1 ? '🏆 PLAYER 1 の勝利！' : '🏆 PLAYER 2 の勝利！';
            resultWinnerTitle.style.color = isP1 ? '#38bdf8' : '#f87171';
            resultWinnerDesc.textContent = isP1
                ? 'P1の神速タッチ！ P2はフランクフルトを奢ろう！🌭'
                : 'P2の鮮やかな奪取！ P1はフランクフルトを奢ろう！🌭';
            resultFinalScore.textContent = `P1: ${scores.p1} 本  -  P2: ${scores.p2} 本`;

            resultModal.classList.remove('hidden');
        }

        // -------------------------------------------------------------
        // 入力イベント（マルチタッチ & キーボード）
        // -------------------------------------------------------------
        function onPointerAction(clientY) {
            const rect = canvas.getBoundingClientRect();
            const relY = clientY - rect.top;
            const canvasY = relY * (CANVAS_HEIGHT / rect.height);

            if (canvasY < CANVAS_HEIGHT / 2) {
                handlePlayerAction('p1');
            } else {
                handlePlayerAction('p2');
            }
        }

        // Canvasのクリック/タップ位置判定（Y座標でP1/P2を分ける）
        canvas.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            onPointerAction(e.clientY);
        });

        // タッチイベントの個別処理（マルチタッチ対応）
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                onPointerAction(e.changedTouches[i].clientY);
            }
        }, { passive: false });

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
        document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

        // キーボード操作（PC対応・e.code と e.key の両対応）
        window.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            const code = e.code || '';
            const key = (e.key || '').toLowerCase();

            // P1: A または W
            if (code === 'KeyA' || code === 'KeyW' || key === 'a' || key === 'w') {
                handlePlayerAction('p1');
            }
            // P2: L または Enter または ArrowDown
            if (code === 'KeyL' || code === 'Enter' || code === 'ArrowDown' || key === 'l' || key === 'enter' || key === 'arrowdown') {
                handlePlayerAction('p2');
            }
        });

        // 外部連携・テスト用ヘルパー
        window.__frankfurtVersus = {
            handlePlayerAction,
            getState: () => ({ gameState, scores, currentRoundNumber })
        };

        startBtn.addEventListener('click', startMatch);
        retryBtn.addEventListener('click', startMatch);

        shareBtn.addEventListener('click', () => {
            const text = `🌭 GoGoUmi paradise【最後の一本フランクフルト - 2人対戦】\n対戦結果: P1 (${scores.p1}本) VS P2 (${scores.p2}本)！\n1台のスマホで真剣勝負！\n#GoGoUmiparadise #海の家 #興居島 #フランクフルト対戦`;
            const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`;
            window.open(url, '_blank', 'noopener,noreferrer');
        });

        // -------------------------------------------------------------
        // Canvas レンダリングループ
        // -------------------------------------------------------------
        function render() {
            // 背景クリア（海の家・鉄板風の深い木目＆鉄板グラデーション）
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

            // 中央鉄板
            drawGrill();

            // スモーク描画
            drawSmoke();

            // 火花描画
            drawSparks();

            // 手の描画（上からP1、下からP2）
            drawHands();

            // フランクフルト描画
            drawFrankfurt();

            // 各種UIオーバーレイ（READY, WAITING, 「！」, ラウンド結果）
            drawOverlay();

            requestAnimationFrame(render);
        }

        // 鉄板の描画
        function drawGrill() {
            // 鉄板枠
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(16, 120, 208, 140);

            // 鉄板本体（黒鉄色）
            ctx.fillStyle = '#334155';
            ctx.fillRect(20, 124, 200, 132);

            // 鉄板スリット溝（縦ストライプ）
            ctx.fillStyle = '#1e293b';
            for (let x = 32; x < 210; x += 18) {
                ctx.fillRect(x, 128, 6, 124);
            }

            // 境界ライン（P1とP2の陣地ボーダー）
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(10, CANVAS_HEIGHT / 2);
            ctx.lineTo(CANVAS_WIDTH - 10, CANVAS_HEIGHT / 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // スモーク描画
        function drawSmoke() {
            sizzleSmoke.forEach(s => {
                s.y += s.vy;
                if (s.y < 110) {
                    s.y = 190 + Math.random() * 20;
                    s.x = 70 + Math.random() * 100;
                }
                ctx.fillStyle = `rgba(241, 245, 249, ${s.alpha})`;
                ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.size, s.size);
            });
        }

        // 火花描画
        function drawSparks() {
            for (let i = sparks.length - 1; i >= 0; i--) {
                const sp = sparks[i];
                sp.x += sp.vx;
                sp.y += sp.vy;
                sp.life--;
                if (sp.life <= 0) {
                    sparks.splice(i, 1);
                    continue;
                }
                ctx.fillStyle = sp.color;
                ctx.fillRect(Math.floor(sp.x), Math.floor(sp.y), sp.size, sp.size);
            }
        }

        // 手の描画（上からP1、下からP2）
        function drawHands() {
            // P1の手（上から下へ伸びる・青袖）
            let p1Y = p1HandY;
            let p1X = 120;
            if (p1Burned) {
                p1X += (Math.random() - 0.5) * 6;
                p1Y += (Math.random() - 0.5) * 6;
            }
            ctx.save();
            ctx.translate(p1X, p1Y);
            // 腕・袖
            ctx.fillStyle = '#0284c7'; // 青袖
            ctx.fillRect(-14, -40, 28, 30);
            // 手首・手のひら
            ctx.fillStyle = p1Burned ? '#ef4444' : '#fed7aa';
            ctx.fillRect(-12, -10, 24, 16);
            // 指（下向き）
            ctx.fillRect(-10, 6, 6, 12);
            ctx.fillRect(-2, 6, 6, 14);
            ctx.fillRect(6, 6, 6, 10);
            ctx.restore();

            // P2の手（下から上へ伸びる・赤橙袖）
            let p2Y = p2HandY;
            let p2X = 120;
            if (p2Burned) {
                p2X += (Math.random() - 0.5) * 6;
                p2Y += (Math.random() - 0.5) * 6;
            }
            ctx.save();
            ctx.translate(p2X, p2Y);
            // 腕・袖
            ctx.fillStyle = '#f97316'; // 橙赤袖
            ctx.fillRect(-14, 10, 28, 30);
            // 手首・手のひら
            ctx.fillStyle = p2Burned ? '#ef4444' : '#fed7aa';
            ctx.fillRect(-12, -6, 24, 16);
            // 指（上向き）
            ctx.fillRect(-10, -18, 6, 12);
            ctx.fillRect(-2, -20, 6, 14);
            ctx.fillRect(6, -16, 6, 10);
            ctx.restore();
        }

        // フランクフルト描画（Y座標アニメーション追従）
        function drawFrankfurt() {
            currentFrankfurtY += (targetFrankfurtY - currentFrankfurtY) * 0.2;
            const sx = 120;
            const sy = Math.floor(currentFrankfurtY);

            // 串（木製の棒）
            ctx.fillStyle = '#d97706';
            ctx.fillRect(sx - 55, sy - 2, 110, 4);

            // フランクフルト本体
            ctx.fillStyle = '#991b1b';
            ctx.fillRect(sx - 40, sy - 11, 80, 22);
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(sx - 38, sy - 9, 76, 18);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(sx - 36, sy - 6, 72, 12);

            // 焼き目
            ctx.fillStyle = '#7f1d1d';
            ctx.fillRect(sx - 24, sy - 8, 3, 16);
            ctx.fillRect(sx - 8,  sy - 8, 3, 16);
            ctx.fillRect(sx + 8,  sy - 8, 3, 16);
            ctx.fillRect(sx + 24, sy - 8, 3, 16);

            // ケチャップ＆マスタード
            ctx.fillStyle = '#facc15';
            ctx.fillRect(sx - 30, sy - 3, 12, 3);
            ctx.fillRect(sx - 10, sy + 1, 12, 3);
            ctx.fillRect(sx + 10, sy - 3, 12, 3);
        }

        // UIオーバーレイ描画
        function drawOverlay() {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // READY中（フランクフルトの上部余白に黒帯プレートで鮮明に表示）
            if (gameState === 'READY') {
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(24, 134, 192, 26);
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2;
                ctx.strokeRect(24, 134, 192, 26);

                ctx.fillStyle = '#ffffff';
                ctx.font = '900 13px "DotGothic16", monospace';
                ctx.fillText(`ROUND ${currentRoundNumber} READY...`, 120, 147);
            }

            // WAITING中（フランクフルトの上部余白に黒帯プレートで鮮明に表示）
            if (gameState === 'WAITING') {
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(16, 134, 208, 26);
                ctx.strokeStyle = '#fcd34d';
                ctx.lineWidth = 2;
                ctx.strokeRect(16, 134, 208, 26);

                ctx.fillStyle = '#fcd34d';
                ctx.font = '900 12px "DotGothic16", monospace';
                ctx.fillText('…ジュージュー… (合図を待て！)', 120, 147);
            }

            // SIGNAL中（巨大な「！」）
            if (gameState === 'SIGNAL') {
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(108, 145, 24, 60);
                ctx.fillRect(108, 215, 24, 20);

                ctx.fillStyle = '#facc15';
                ctx.fillRect(112, 149, 16, 52);
                ctx.fillRect(112, 219, 16, 12);

                ctx.fillStyle = '#ffffff';
                ctx.font = '900 15px "DotGothic16", sans-serif';
                ctx.shadowColor = '#000';
                ctx.shadowBlur = 4;
                ctx.fillText('今だ！奪え！', 120, 130);
                ctx.shadowBlur = 0;
            }

            // ROUND_RESULT中
            if (gameState === 'ROUND_RESULT') {
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(8, 168, 224, 44);
                ctx.strokeStyle = roundResultColor;
                ctx.lineWidth = 2;
                ctx.strokeRect(10, 168, 220, 44);

                ctx.fillStyle = roundResultColor;
                ctx.font = '900 13px "DotGothic16", monospace';
                ctx.fillText(roundResultMessage, 120, 190);
            }
        }

        // 初期UIセットアップ & ループ起動
        updateScoreUI();
        requestAnimationFrame(render);
    });
}
