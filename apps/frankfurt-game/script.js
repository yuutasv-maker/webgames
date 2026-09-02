/**
 * 最後の一本フランクフルト（Frankfurt Grab）
 * 8bitレトロ瞬間反射神経ゲーム - ゲームロジック & エンジン
 */

const GameLogic = {
    // ゲーム設定
    GAME_CONFIG: {
        maxAttempts: 3,
        minWaitTimeMs: 1500,
        maxWaitTimeMs: 3500,
        // クーポン獲得判定基準（ミリ秒：いずれかのライバルに1勝、または480ms以下で合格）
        targetThresholdMs: 480,
        foulPenaltyMs: 9999,     // お手つきペナルティタイム
        roundResultDurationMs: 1400,
        soundEnabled: true,

        // ラウンド別ライバル客定義（ラウンドが進むにつれて難易度が下がり勝ちやすくなる）
        rivals: [
            { round: 1, name: '腹ペコ店長', icon: '👨‍🍳', reactionTimeMs: 300, sleeveColor: '#f1f5f9' }, // 神速チャレンジ（激ムズ）
            { round: 2, name: '海の男',   icon: '🏄‍♂️', reactionTimeMs: 380, sleeveColor: '#0284c7' }, // 中級レベル
            { round: 3, name: 'のんびり客', icon: '👒', reactionTimeMs: 480, sleeveColor: '#facc15' }  // チャンスラウンド（易しい）
        ]
    },

    // 待機時間のランダム計算 (minWaitTimeMs 〜 maxWaitTimeMs)
    calculateWaitTime: function(min = this.GAME_CONFIG.minWaitTimeMs, max = this.GAME_CONFIG.maxWaitTimeMs, randomFn = Math.random) {
        return Math.floor(min + randomFn() * (max - min));
    },

    // 反応時間の計算 (ミリ秒整数)
    calculateReactionTime: function(signalTime, tapTime) {
        if (tapTime < signalTime) return this.GAME_CONFIG.foulPenaltyMs;
        return Math.max(0, Math.round(tapTime - signalTime));
    },

    // ラウンド勝敗判定
    evaluateRound: function(playerTime, rivalReactionTime, isFoul = false) {
        if (isFoul || playerTime >= this.GAME_CONFIG.foulPenaltyMs) {
            return {
                result: 'FOUL',
                timeMs: this.GAME_CONFIG.foulPenaltyMs,
                winner: 'rival',
                message: 'FOUL! 火傷した！'
            };
        }

        if (playerTime <= rivalReactionTime) {
            return {
                result: 'WIN',
                timeMs: playerTime,
                winner: 'player',
                message: `GET! ${playerTime}ms`
            };
        } else {
            return {
                result: 'LOSE',
                timeMs: playerTime,
                winner: 'rival',
                message: `奪われた… ${playerTime}ms`
            };
        }
    },

    // ベストタイムの算出（ファウルのみの場合は 9999）
    calculateBestTime: function(attempts = []) {
        if (!attempts || attempts.length === 0) return this.GAME_CONFIG.foulPenaltyMs;
        const validTimes = attempts.filter(t => typeof t === 'number' && !isNaN(t));
        if (validTimes.length === 0) return this.GAME_CONFIG.foulPenaltyMs;
        return Math.min(...validTimes);
    },

    // ランク判定 (S: <250ms, A: 250-350ms, B: 351-480ms, C: 481ms+)
    getRank: function(bestTimeMs) {
        if (bestTimeMs < 250) {
            return { rank: 'S', title: '👑 神速のフランクマスター', eligible: true };
        }
        if (bestTimeMs <= 350) {
            return { rank: 'A', title: '🌟 プロの早業！合格！', eligible: true };
        }
        if (bestTimeMs <= 480) {
            return { rank: 'B', title: '🍖 一人前！ナイス奪取！', eligible: true };
        }
        return { rank: 'C', title: '😅 見習いフランク客', eligible: false };
    },

    // クーポン受給資格判定 (480ms以下でいずれかのライバルに勝利)
    isEligibleForCoupon: function(bestTimeMs) {
        return bestTimeMs <= this.GAME_CONFIG.targetThresholdMs;
    }
};

// Node.js テスト環境用のエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameLogic };
} else {
    // ブラウザ環境での実行
    document.addEventListener('DOMContentLoaded', () => {
        const CANVAS_WIDTH = 240;
        const CANVAS_HEIGHT = 360;

        // DOM要素
        const canvas = document.getElementById('game-canvas');
        const ctx = canvas.getContext('2d');
        const roundText = document.getElementById('round-text');
        const rivalName = document.getElementById('rival-name');
        const bestTimeText = document.getElementById('best-time-text');
        const attemptsIcons = document.getElementById('attempts-icons');
        const startScreen = document.getElementById('start-screen');
        const startBtn = document.getElementById('start-btn');
        const resultModal = document.getElementById('result-modal');
        const retryBtn = document.getElementById('retry-btn');
        const shareBtn = document.getElementById('share-btn');
        const resultRankBadge = document.getElementById('result-rank-badge');
        const resultRankTitle = document.getElementById('result-rank-title');
        const resultBestTime = document.getElementById('result-best-time');
        const roundsHistoryList = document.getElementById('rounds-history-list');
        const couponSection = document.getElementById('coupon-section');
        const couponMsg = document.getElementById('coupon-msg');
        const couponBtn = document.getElementById('coupon-btn');
        const failedMsg = document.getElementById('failed-msg');

        // 音声シンセサイザー (Web Audio API - 完全プログラム生成)
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

            // 鉄板ジュージュー音（ホワイトノイズ ＋ バンドパスフィルター）
            startSizzle() {
                if (!this.ctx || this.sizzleSource) return;
                try {
                    const bufferSize = this.ctx.sampleRate * 2; // 2秒バッファ
                    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                    const data = buffer.getChannelData(0);
                    for (let i = 0; i < bufferSize; i++) {
                        data[i] = Math.random() * 2 - 1; // ホワイトノイズ
                    }

                    this.sizzleSource = this.ctx.createBufferSource();
                    this.sizzleSource.buffer = buffer;
                    this.sizzleSource.loop = true;

                    // 高域を強調するバンドパスフィルター
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
                    console.warn('Sizzle sound error:', e);
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

            // 単音オシレーター再生
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

            // 合図SE（高音のピキーン！）
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
                const notes = [1046, 1318, 1568, 2093]; // C6, E6, G6, C7
                notes.forEach((freq, idx) => {
                    setTimeout(() => this.playTone(freq, 'square', 0.08, 0.2), idx * 45);
                });
            },

            // お手つき・火傷・奪われSE（ノコギリ波の低音下降）
            playFoul() {
                this.init();
                if (!this.ctx) return;
                try {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(160, this.ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.3);
                    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
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
            playFanfare() {
                this.init();
                const melody = [
                    { f: 1046, d: 0.1 }, { f: 1318, d: 0.1 }, { f: 1568, d: 0.1 },
                    { f: 2093, d: 0.4 }
                ];
                melody.forEach((note, i) => {
                    setTimeout(() => this.playTone(note.f, 'triangle', note.d, 0.25), i * 110);
                });
            }
        };

        // ゲーム状態変数
        let gameState = 'TITLE'; // TITLE, READY, WAITING, SIGNAL, ROUND_RESULT, GAME_OVER
        let currentRound = 1;
        let attempts = [];
        let roundHistories = [];
        let signalTimestamp = 0;
        let waitingTimerId = null;
        let roundTransitionTimerId = null;
        let hasTappedThisRound = false;

        // アニメーション用変数
        let flashAlpha = 0;
        let playerHandX = 20;   // 待機位置
        let rivalHandX = 220;   // 待機位置
        let sausageOffset = 0;  // 奪われた/取った時の移動量
        let sausageTaker = null; // 'player' | 'rival' | null
        let isBurned = false;   // 火傷アニメ
        let animParticles = [];
        let steamParticles = [];

        // 煙パーティクルの生成
        function addSteamParticle() {
            if (steamParticles.length < 18) {
                steamParticles.push({
                    x: 105 + Math.random() * 30,
                    y: 195 + Math.random() * 10,
                    vx: (Math.random() - 0.5) * 0.3,
                    vy: -0.8 - Math.random() * 0.8,
                    size: 2 + Math.random() * 3,
                    alpha: 0.6 + Math.random() * 0.3,
                    life: 0.8 + Math.random() * 0.4
                });
            }
        }

        // 飛び散る油ハネパーティクル
        function addSparks(x, y, color = '#fcd34d', count = 8) {
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 1.0 + Math.random() * 2.5;
                animParticles.push({
                    x, y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 0.5,
                    size: 2,
                    color,
                    alpha: 1.0,
                    life: 0.4 + Math.random() * 0.3
                });
            }
        }

        // -------------------------------------------------------------
        // ゲーム進行・ステート管理
        // -------------------------------------------------------------
        function clearAllTimers() {
            if (waitingTimerId) {
                clearTimeout(waitingTimerId);
                waitingTimerId = null;
            }
            if (roundTransitionTimerId) {
                clearTimeout(roundTransitionTimerId);
                roundTransitionTimerId = null;
            }
        }

        function startGame() {
            Sound.init();
            clearAllTimers();
            Sound.stopSizzle();
            startScreen.classList.add('hidden');
            resultModal.classList.add('hidden');

            currentRound = 1;
            attempts = [];
            roundHistories = [];
            updateAttemptsUI();
            bestTimeText.textContent = '--- ms';

            startRound(1);
        }

        function startRound(roundNum) {
            clearAllTimers();
            gameState = 'READY';
            currentRound = roundNum;
            hasTappedThisRound = false;
            signalTimestamp = 0;
            sausageOffset = 0;
            sausageTaker = null;
            isBurned = false;
            playerHandX = 20;
            rivalHandX = 220;

            const rival = GameLogic.GAME_CONFIG.rivals[roundNum - 1];
            roundText.textContent = `${roundNum}/${GameLogic.GAME_CONFIG.maxAttempts}`;
            rivalName.textContent = `${rival.name} ${rival.icon}`;

            // 0.8秒の準備時間ののち、WAITING（待機）へ
            roundTransitionTimerId = setTimeout(() => {
                if (gameState === 'READY') {
                    beginWaiting();
                }
            }, 800);
        }

        function beginWaiting() {
            gameState = 'WAITING';
            Sound.startSizzle();

            const waitDuration = GameLogic.calculateWaitTime();
            waitingTimerId = setTimeout(() => {
                if (gameState === 'WAITING') {
                    triggerSignal();
                }
            }, waitDuration);
        }

        // 合図発生（！）
        function triggerSignal() {
            gameState = 'SIGNAL';
            Sound.stopSizzle();
            Sound.playSignal();
            signalTimestamp = performance.now();
            flashAlpha = 1.0; // 画面フラッシュ

            // ライバルのタイマーセット（ライバルの反応時間で自動奪取）
            const rival = GameLogic.GAME_CONFIG.rivals[currentRound - 1];
            waitingTimerId = setTimeout(() => {
                if (gameState === 'SIGNAL' && !hasTappedThisRound) {
                    // プレイヤーが間に合わなかった（ライバルの勝利）
                    handleRivalWins();
                }
            }, rival.reactionTimeMs);
        }

        // 画面タップ・入力検知（1ラウンド1回のみ受け付ける排他制御）
        function handleInput(e) {
            if (e) {
                e.preventDefault();
            }

            if (hasTappedThisRound) return;

            if (gameState === 'WAITING') {
                // お手つき（フライング）！
                handleFoul();
                return;
            }

            if (gameState === 'SIGNAL') {
                // 正式タップ！
                handlePlayerTap();
                return;
            }
        }

        // お手つき処理
        function handleFoul() {
            hasTappedThisRound = true;
            gameState = 'ROUND_RESULT';
            if (waitingTimerId) clearTimeout(waitingTimerId);
            Sound.stopSizzle();
            Sound.playFoul();

            isBurned = true;
            addSparks(80, 210, '#ef4444', 16);

            const evalResult = GameLogic.evaluateRound(GameLogic.GAME_CONFIG.foulPenaltyMs, 0, true);
            attempts.push(GameLogic.GAME_CONFIG.foulPenaltyMs);
            roundHistories.push({
                round: currentRound,
                rival: GameLogic.GAME_CONFIG.rivals[currentRound - 1].name,
                result: 'FOUL',
                timeMs: GameLogic.GAME_CONFIG.foulPenaltyMs,
                message: 'FOUL (お手つき火傷!)'
            });

            updateAttemptsUI();
            scheduleNextRound();
        }

        // プレイヤーのタップ成功処理
        function handlePlayerTap() {
            hasTappedThisRound = true;
            if (waitingTimerId) clearTimeout(waitingTimerId);

            const tapTimestamp = performance.now();
            const reactionTime = GameLogic.calculateReactionTime(signalTimestamp, tapTimestamp);
            const rival = GameLogic.GAME_CONFIG.rivals[currentRound - 1];
            const evalResult = GameLogic.evaluateRound(reactionTime, rival.reactionTimeMs, false);

            gameState = 'ROUND_RESULT';
            attempts.push(reactionTime);
            roundHistories.push({
                round: currentRound,
                rival: rival.name,
                result: evalResult.result,
                timeMs: reactionTime,
                message: evalResult.message
            });

            // ベストタイム更新
            const currentBest = GameLogic.calculateBestTime(attempts);
            if (currentBest < GameLogic.GAME_CONFIG.foulPenaltyMs) {
                bestTimeText.textContent = `${currentBest} ms`;
            }

            if (evalResult.result === 'WIN') {
                // プレイヤーの奪取
                sausageTaker = 'player';
                playerHandX = 100;
                Sound.playGrabSuccess();
                addSparks(120, 210, '#fcd34d', 18);
            } else {
                // 間に合わずライバルが奪取
                sausageTaker = 'rival';
                rivalHandX = 135;
                Sound.playFoul();
                addSparks(120, 210, '#38bdf8', 12);
            }

            updateAttemptsUI();
            scheduleNextRound();
        }

        // ライバルが先に取った場合
        function handleRivalWins() {
            if (hasTappedThisRound) return;
            hasTappedThisRound = true;

            const rival = GameLogic.GAME_CONFIG.rivals[currentRound - 1];
            gameState = 'ROUND_RESULT';
            sausageTaker = 'rival';
            rivalHandX = 135;
            Sound.playFoul();
            addSparks(120, 210, '#38bdf8', 14);

            attempts.push(GameLogic.GAME_CONFIG.foulPenaltyMs);
            roundHistories.push({
                round: currentRound,
                rival: rival.name,
                result: 'LOSE',
                timeMs: rival.reactionTimeMs,
                message: `奪われた… (${rival.reactionTimeMs}ms)`
            });

            updateAttemptsUI();
            scheduleNextRound();
        }

        function scheduleNextRound() {
            roundTransitionTimerId = setTimeout(() => {
                if (currentRound < GameLogic.GAME_CONFIG.maxAttempts) {
                    startRound(currentRound + 1);
                } else {
                    finishGame();
                }
            }, GameLogic.GAME_CONFIG.roundResultDurationMs);
        }

        // 残り串UI更新
        function updateAttemptsUI() {
            const icons = attemptsIcons.querySelectorAll('.attempt-icon');
            icons.forEach((icon, idx) => {
                if (idx < attempts.length) {
                    icon.classList.add('used');
                } else {
                    icon.classList.remove('used');
                }
            });
        }

        // 全ラウンド終了
        function finishGame() {
            gameState = 'GAME_OVER';
            Sound.stopSizzle();

            const bestTime = GameLogic.calculateBestTime(attempts);
            const rankInfo = GameLogic.getRank(bestTime);
            const isEligible = GameLogic.isEligibleForCoupon(bestTime);

            resultRankBadge.textContent = `RANK ${rankInfo.rank}`;
            resultRankTitle.textContent = rankInfo.title;
            resultBestTime.textContent = bestTime < GameLogic.GAME_CONFIG.foulPenaltyMs ? `${bestTime} ms` : 'FOUL';

            // 各ラウンド戦績リスト生成
            roundsHistoryList.innerHTML = '';
            roundHistories.forEach(h => {
                const row = document.createElement('div');
                row.className = 'round-record-row';
                let resultClass = 'round-record-lose';
                if (h.result === 'WIN') resultClass = 'round-record-win';
                if (h.result === 'FOUL') resultClass = 'round-record-foul';

                row.innerHTML = `
                    <span>ROUND ${h.round} (vs ${h.rival})</span>
                    <span class="${resultClass}">${h.result === 'FOUL' ? 'FOUL (火傷)' : `${h.timeMs}ms [${h.result}]`}</span>
                `;
                roundsHistoryList.appendChild(row);
            });

            // クーポン連携
            if (isEligible && typeof CouponManager !== 'undefined') {
                couponSection.classList.remove('hidden');
                failedMsg.classList.add('hidden');
                Sound.playFanfare();

                const isClaimedToday = !CouponManager.canClaimToday('frankfurt');
                if (isClaimedToday) {
                    couponMsg.innerHTML = '<span style="color:#fbbf24;">本日のクーポンは獲得済みです</span>';
                    couponBtn.classList.remove('hidden');
                    couponBtn.textContent = '🎫 獲得済みクーポンを見る';
                } else {
                    CouponManager.claimCoupon('frankfurt');
                    couponMsg.innerHTML = `🎉 <strong>${bestTime}ms達成！アイストッピング or 100円引きクーポンGET！</strong>`;
                    couponBtn.classList.remove('hidden');
                    couponBtn.textContent = '🎫 クーポンを受け取る';
                }
                couponBtn.href = CouponManager.getCouponUrl('frankfurt', { score: bestTime, rank: rankInfo.rank });
            } else {
                couponSection.classList.add('hidden');
                failedMsg.classList.remove('hidden');
            }

            resultModal.classList.remove('hidden');
        }

        // -------------------------------------------------------------
        // レンダリング (Canvas 2D: 240x360 ピクセルアート)
        // -------------------------------------------------------------
        function render() {
            // 背景クリア
            ctx.fillStyle = '#1c1512';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

            // 鉄板（ホットプレート）描画
            drawGrill();

            // 煙パーティクル更新＆描画
            updateAndDrawSteam();

            // フランクフルト描画（中央）
            drawFrankfurter();

            // プレイヤーの手（左側）＆ ライバルの手（右側）
            drawHands();

            // 飛び散る油ハネ・火花パーティクル
            updateAndDrawSparks();

            // 対戦相手のドット絵ポートレート（右上）
            drawRivalPortrait();

            // 合図（！）または各ステートのテキスト描画
            drawOverlayUI();

            // 白フラッシュエフェクト
            if (flashAlpha > 0) {
                ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
                ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                flashAlpha -= 0.15;
            }

            requestAnimationFrame(render);
        }

        // -------------------------------------------------------------
        // 対戦相手のドット絵ポートレート（右上枠）
        // -------------------------------------------------------------
        function drawRivalPortrait() {
            const rival = GameLogic.GAME_CONFIG.rivals[currentRound - 1] || GameLogic.GAME_CONFIG.rivals[0];
            const bx = 184;
            const by = 43;
            const bw = 48;
            const bh = 54;

            ctx.save();

            // 1. 外枠 & 背景（レトロアーケード調）
            ctx.fillStyle = '#0f0a08';
            ctx.fillRect(bx, by, bw, bh);

            let borderColor = '#94a3b8';
            if (sausageTaker === 'rival') borderColor = '#facc15'; // ライバル奪取成功で金色枠
            if (sausageTaker === 'player') borderColor = '#475569'; // プレイヤー勝利で控えめ
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(bx, by, bw, bh);

            // 2. 上部ヘッダー "RIVAL"
            ctx.fillStyle = '#1e1613';
            ctx.fillRect(bx + 2, by + 2, bw - 4, 10);
            ctx.fillStyle = '#facc15';
            ctx.font = '7px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('RIVAL', bx + bw / 2, by + 7);

            // 3. 各キャラクターの顔ドット絵
            const cx = bx + bw / 2;
            const cy = by + 30;

            const isWin = (sausageTaker === 'rival');
            const isLose = (sausageTaker === 'player');

            if (rival.name === '腹ペコ店長') {
                drawChefPortrait(cx, cy, isWin, isLose);
            } else if (rival.name === '海の男') {
                drawSurferPortrait(cx, cy, isWin, isLose);
            } else {
                drawTouristPortrait(cx, cy, isWin, isLose);
            }

            // 4. 勝敗リアクション演出
            if (isWin) {
                // ドヤ顔帯！
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(bx + 3, by + bh - 10, bw - 6, 8);
                ctx.fillStyle = '#fef08a';
                ctx.font = '6px "Press Start 2P", monospace';
                ctx.fillText('GET!', cx, by + bh - 6);
            } else if (isLose) {
                // 汗マーク
                ctx.fillStyle = '#38bdf8';
                ctx.font = '10px sans-serif';
                ctx.fillText('💧', bx + bw - 7, by + 18);
            }

            ctx.restore();
        }

        // R1: 腹ペコ店長のドット絵
        function drawChefPortrait(cx, cy, isWin, isLose) {
            // コック帽（白・陰影）
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(cx - 10, cy - 17, 20, 9);
            ctx.fillRect(cx - 8, cy - 19, 16, 2);
            ctx.fillStyle = '#cbd5e1'; // 帽子シャドウ
            ctx.fillRect(cx - 10, cy - 10, 20, 2);

            // 顔（肌色）
            ctx.fillStyle = '#fed7aa';
            ctx.fillRect(cx - 9, cy - 8, 18, 16);

            // 眉毛
            ctx.fillStyle = '#111827';
            ctx.fillRect(cx - 7, cy - 6, 5, 2);
            ctx.fillRect(cx + 2, cy - 6, 5, 2);

            // 目
            if (isLose) {
                // 敗北（白目・点目）
                ctx.fillStyle = '#1e1e24';
                ctx.fillRect(cx - 5, cy - 3, 2, 2);
                ctx.fillRect(cx + 3, cy - 3, 2, 2);
            } else if (isWin) {
                // 勝利（ニヤリ細目 ^^）
                ctx.fillStyle = '#1e1e24';
                ctx.fillRect(cx - 6, cy - 3, 4, 2);
                ctx.fillRect(cx + 2, cy - 3, 4, 2);
            } else {
                // 通常（キリッと獲物を狙う目）
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(cx - 6, cy - 4, 4, 3);
                ctx.fillRect(cx + 2, cy - 4, 4, 3);
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(cx - 5, cy - 3, 2, 2);
                ctx.fillRect(cx + 3, cy - 3, 2, 2);
            }

            // 立派な黒ヒゲ
            ctx.fillStyle = '#1e1e24';
            ctx.fillRect(cx - 7, cy + 2, 14, 3);
            ctx.fillRect(cx - 8, cy + 3, 3, 3);
            ctx.fillRect(cx + 5, cy + 3, 3, 3);

            // 赤スカーフ
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(cx - 8, cy + 8, 16, 3);
        }

        // R2: 海の男のドット絵（案A: 王道サーファー風）
        function drawSurferPortrait(cx, cy, isWin, isLose) {
            // 1. ツンツン茶髪（サーファーヘア）
            ctx.fillStyle = '#451a03'; // ベース茶髪
            ctx.fillRect(cx - 10, cy - 16, 20, 7);
            ctx.fillRect(cx - 8, cy - 18, 5, 3);
            ctx.fillRect(cx - 1, cy - 19, 6, 4);
            ctx.fillRect(cx + 6, cy - 17, 4, 3);
            // 髪の毛ハイライト
            ctx.fillStyle = '#78350f';
            ctx.fillRect(cx - 7, cy - 17, 3, 2);
            ctx.fillRect(cx, cy - 18, 4, 2);

            // 2. フェイスライン（小麦色・アゴの絞り）
            const skinBase = '#c27848'; // 落ち着いた自然な小麦色
            const skinShadow = '#9a532d';

            // 顔本体
            ctx.fillStyle = skinBase;
            ctx.fillRect(cx - 8, cy - 9, 16, 12);
            // アゴ（下部を細くして長方形感を排除）
            ctx.fillRect(cx - 5, cy + 3, 10, 4);
            // アゴ下シャドウ
            ctx.fillStyle = skinShadow;
            ctx.fillRect(cx - 4, cy + 6, 8, 1);

            // 耳（左右）
            ctx.fillStyle = skinBase;
            ctx.fillRect(cx - 10, cy - 4, 2, 5);
            ctx.fillRect(cx + 8, cy - 4, 2, 5);

            // 3. サングラス & 目元
            if (isLose) {
                // 敗北：サングラスがズレてギャグ顔白目
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(cx - 8, cy - 8, 8, 5);
                ctx.fillRect(cx + 1, cy - 5, 8, 5);
                // 露出した白目
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(cx - 6, cy - 2, 4, 3);
                ctx.fillRect(cx + 2, cy - 1, 4, 3);
                ctx.fillStyle = '#000000';
                ctx.fillRect(cx - 5, cy - 1, 2, 2);
                ctx.fillRect(cx + 3, cy, 2, 2);
            } else if (isWin) {
                // 勝利：サングラスがキラーンと反射
                ctx.fillStyle = '#0f172a'; // 黒フレーム
                ctx.fillRect(cx - 8, cy - 6, 7, 5);
                ctx.fillRect(cx + 1, cy - 6, 7, 5);
                ctx.fillRect(cx - 1, cy - 5, 2, 2); // ブリッジ
                // キラーン反射光
                ctx.fillStyle = '#38bdf8';
                ctx.fillRect(cx - 7, cy - 5, 3, 2);
                ctx.fillRect(cx + 2, cy - 5, 3, 2);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(cx - 6, cy - 5, 1, 1);
                ctx.fillRect(cx + 3, cy - 5, 1, 1);
            } else {
                // 通常：クールな黒サングラス（レンズ反射）
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(cx - 8, cy - 6, 7, 5);
                ctx.fillRect(cx + 1, cy - 6, 7, 5);
                ctx.fillRect(cx - 1, cy - 5, 2, 2);
                // レンズ反射
                ctx.fillStyle = '#475569';
                ctx.fillRect(cx - 7, cy - 5, 4, 2);
                ctx.fillRect(cx + 2, cy - 5, 4, 2);
                ctx.fillStyle = '#94a3b8';
                ctx.fillRect(cx - 6, cy - 5, 2, 1);
                ctx.fillRect(cx + 3, cy - 5, 2, 1);
            }

            // 4. 口元（白い歯ニッ）
            if (isWin) {
                // 大勝利のニカーッ！
                ctx.fillStyle = '#451a03';
                ctx.fillRect(cx - 4, cy + 1, 8, 4);
                ctx.fillStyle = '#ffffff'; // 白い歯
                ctx.fillRect(cx - 3, cy + 1, 6, 2);
            } else if (isLose) {
                // 悔しがり口
                ctx.fillStyle = '#451a03';
                ctx.fillRect(cx - 3, cy + 2, 6, 2);
            } else {
                // 通常：ニヤリ笑み（白い歯チラ見せ）
                ctx.fillStyle = '#451a03';
                ctx.fillRect(cx - 4, cy + 1, 8, 3);
                ctx.fillStyle = '#ffffff'; // 白い歯
                ctx.fillRect(cx - 3, cy + 1, 5, 1);
            }

            // 5. 首元・シェルネックレス & アロハシャツ襟
            // シェルネックレス（白と水色のビーズ）
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(cx - 4, cy + 7, 2, 2);
            ctx.fillRect(cx + 2, cy + 7, 2, 2);
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(cx - 1, cy + 8, 2, 2);

            // ブルーアロハシャツ襟
            ctx.fillStyle = '#0284c7';
            ctx.fillRect(cx - 9, cy + 9, 6, 3);
            ctx.fillRect(cx + 3, cy + 9, 6, 3);
        }

        // R3: のんびり客のドット絵
        function drawTouristPortrait(cx, cy, isWin, isLose) {
            // ふんわり茶髪
            ctx.fillStyle = '#78350f';
            ctx.fillRect(cx - 10, cy - 13, 20, 8);

            // 麦わら帽子（黄色＋赤リボン）
            ctx.fillStyle = '#fde047'; // つば
            ctx.fillRect(cx - 13, cy - 11, 26, 3);
            ctx.fillRect(cx - 8, cy - 17, 16, 6); // クラウン
            ctx.fillStyle = '#ef4444'; // 赤リボン
            ctx.fillRect(cx - 8, cy - 12, 16, 2);

            // 丸顔（白肌）
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(cx - 8, cy - 8, 16, 16);

            // ピンクチーク
            ctx.fillStyle = '#f472b6';
            ctx.fillRect(cx - 7, cy + 1, 3, 2);
            ctx.fillRect(cx + 4, cy + 1, 3, 2);

            // 目
            if (isLose) {
                // ぽかーん口
                ctx.fillStyle = '#1e1e24';
                ctx.fillRect(cx - 4, cy - 3, 2, 2);
                ctx.fillRect(cx + 2, cy - 3, 2, 2);
                ctx.fillRect(cx - 2, cy + 2, 4, 3); // お口 o
            } else if (isWin) {
                // にっこり笑顔
                ctx.fillStyle = '#1e1e24';
                ctx.fillRect(cx - 5, cy - 3, 3, 2);
                ctx.fillRect(cx + 2, cy - 3, 3, 2);
                ctx.fillRect(cx - 3, cy + 2, 6, 2);
            } else {
                // 通常（のほほん黒丸目）
                ctx.fillStyle = '#1e1e24';
                ctx.fillRect(cx - 5, cy - 3, 3, 3);
                ctx.fillRect(cx + 2, cy - 3, 3, 3);
                ctx.fillRect(cx - 2, cy + 2, 4, 2);
            }

            // 黄色シャツ
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(cx - 8, cy + 8, 16, 3);
        }

        // 鉄板の描画
        function drawGrill() {
            // 鉄板の外枠
            ctx.fillStyle = '#2d221e';
            ctx.fillRect(16, 120, 208, 160);

            // 鉄板の内側
            ctx.fillStyle = '#181210';
            ctx.fillRect(22, 126, 196, 148);

            // 焼き網スリット溝
            ctx.fillStyle = '#100b09';
            for (let y = 138; y < 270; y += 14) {
                ctx.fillRect(26, y, 188, 3);
            }

            // 鉄板の熱気グラデーション
            if (gameState === 'WAITING' || gameState === 'SIGNAL') {
                ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
                ctx.fillRect(80, 180, 80, 50);
            }
        }

        // 煙パーティクル
        function updateAndDrawSteam() {
            if (gameState === 'WAITING' || gameState === 'SIGNAL' || gameState === 'READY') {
                if (Math.random() < 0.3) addSteamParticle();
            }

            for (let i = steamParticles.length - 1; i >= 0; i--) {
                const p = steamParticles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.alpha -= 0.02;

                if (p.alpha <= 0 || p.y < 80) {
                    steamParticles.splice(i, 1);
                } else {
                    ctx.fillStyle = `rgba(226, 232, 240, ${p.alpha})`;
                    ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
                }
            }
        }

        // 火花・油ハネパーティクル
        function updateAndDrawSparks() {
            for (let i = animParticles.length - 1; i >= 0; i--) {
                const p = animParticles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.15; // 重力
                p.alpha -= 0.03;

                if (p.alpha <= 0) {
                    animParticles.splice(i, 1);
                } else {
                    ctx.fillStyle = p.color;
                    ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
                }
            }
        }

        // フランクフルト本体の描画
        function drawFrankfurter() {
            let sx = 120;
            let sy = 205;

            // 奪取アニメーション時の移動
            if (sausageTaker === 'player') {
                sx = 80;
                sy = 195;
            } else if (sausageTaker === 'rival') {
                sx = 160;
                sy = 195;
            }

            // 串（竹串）
            ctx.fillStyle = '#d97706';
            ctx.fillRect(sx - 48, sy - 2, 96, 4);

            // フランクフルト肉本体
            ctx.fillStyle = '#b91c1c';
            ctx.fillRect(sx - 34, sy - 8, 68, 16);
            ctx.fillStyle = '#991b1b';
            ctx.fillRect(sx - 32, sy + 4, 64, 4); // 下部シャドウ

            // 焦げ目スリット（切れ込み）
            ctx.fillStyle = '#451a03';
            ctx.fillRect(sx - 24, sy - 8, 3, 14);
            ctx.fillRect(sx - 12, sy - 8, 3, 14);
            ctx.fillRect(sx + 2,  sy - 8, 3, 14);
            ctx.fillRect(sx + 16, sy - 8, 3, 14);

            // ケチャップ＆マスタード（ジグザグ波線）
            ctx.fillStyle = '#ef4444'; // 赤ケチャップ
            ctx.fillRect(sx - 28, sy - 5, 8, 3);
            ctx.fillRect(sx - 14, sy - 2, 8, 3);
            ctx.fillRect(sx,      sy - 5, 8, 3);
            ctx.fillRect(sx + 14, sy - 2, 8, 3);

            ctx.fillStyle = '#facc15'; // 黄マスタード
            ctx.fillRect(sx - 22, sy - 2, 6, 2);
            ctx.fillRect(sx - 8,  sy - 4, 6, 2);
            ctx.fillRect(sx + 6,  sy - 2, 6, 2);
            ctx.fillRect(sx + 20, sy - 4, 6, 2);
        }

        // 手の描画（プレイヤー＆ライバル）
        function drawHands() {
            // 1. プレイヤーの手（左側）
            let pX = playerHandX;
            let pY = 205;
            if (isBurned) {
                // 火傷でブルブル震える
                pX += (Math.random() - 0.5) * 6;
                pY += (Math.random() - 0.5) * 6;
            }

            ctx.save();
            ctx.translate(pX, pY);
            // 袖
            ctx.fillStyle = '#f97316';
            ctx.fillRect(-28, -12, 18, 24);
            // 手首 & 手のひら
            ctx.fillStyle = isBurned ? '#ef4444' : '#fbcfe8';
            ctx.fillRect(-10, -9, 14, 18);
            // 指（前に伸びる）
            ctx.fillRect(4, -7, 12, 5);
            ctx.fillRect(4, -1, 10, 5);
            ctx.fillRect(4, 5, 8, 4);
            ctx.restore();

            // 2. ライバルの手（右側）
            const rivalDef = GameLogic.GAME_CONFIG.rivals[currentRound - 1] || GameLogic.GAME_CONFIG.rivals[0];
            let rX = rivalHandX;
            let rY = 205;

            ctx.save();
            ctx.translate(rX, rY);
            // 袖
            ctx.fillStyle = rivalDef.sleeveColor;
            ctx.fillRect(10, -12, 18, 24);
            // 手首 & 手のひら
            ctx.fillStyle = '#fed7aa';
            ctx.fillRect(-4, -9, 14, 18);
            // 指（左へ伸びる）
            ctx.fillRect(-16, -7, 12, 5);
            ctx.fillRect(-14, -1, 10, 5);
            ctx.fillRect(-12, 5, 8, 4);
            ctx.restore();
        }

        // オーバーレイUI（「！」やステータステキスト）
        function drawOverlayUI() {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (gameState === 'WAITING') {
                ctx.fillStyle = '#fcd34d';
                ctx.font = '11px "DotGothic16", monospace';
                ctx.fillText('…ジュージュー… (待て！)', 96, 100);
            } else if (gameState === 'READY') {
                ctx.fillStyle = '#38bdf8';
                ctx.font = '13px "DotGothic16", monospace';
                ctx.fillText(`ROUND ${currentRound} READY...`, 96, 100);
            } else if (gameState === 'SIGNAL') {
                // 特大の「！」マーク
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(108, 60, 24, 54);
                ctx.fillRect(108, 122, 24, 20);

                ctx.fillStyle = '#facc15';
                ctx.fillRect(112, 64, 16, 46);
                ctx.fillRect(112, 126, 16, 12);

                ctx.fillStyle = '#ffffff';
                ctx.font = '900 15px "DotGothic16", sans-serif';
                ctx.shadowColor = '#000';
                ctx.shadowBlur = 4;
                ctx.fillText('へいお待ち！今だ！', 120, 44);
                ctx.shadowBlur = 0;
            } else if (gameState === 'ROUND_RESULT') {
                const history = roundHistories[roundHistories.length - 1];
                if (history) {
                    let color = '#4ade80';
                    if (history.result === 'LOSE') color = '#f87171';
                    if (history.result === 'FOUL') color = '#fb923c';

                    ctx.fillStyle = '#000000';
                    ctx.fillRect(20, 75, 200, 36);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(20, 75, 200, 36);

                    ctx.fillStyle = color;
                    ctx.font = '900 14px "DotGothic16", monospace';
                    ctx.fillText(history.message, 120, 93);
                }
            }
        }

        // -------------------------------------------------------------
        // イベントバインド
        // -------------------------------------------------------------
        startBtn.addEventListener('click', startGame);
        retryBtn.addEventListener('click', startGame);

        // タップ遅延排除（pointerdown）
        canvas.addEventListener('pointerdown', handleInput);
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // iOSピンチズーム・ダブルタップズーム抑止
        document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
        document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

        shareBtn.addEventListener('click', () => {
            const bestTime = GameLogic.calculateBestTime(attempts);
            const rankInfo = GameLogic.getRank(bestTime);
            const timeStr = bestTime < GameLogic.GAME_CONFIG.foulPenaltyMs ? `${bestTime}ms` : 'FOUL';
            const text = `🌴 GoGoUmi paradise【最後の一本フランクフルト】\n最速タイム: ${timeStr}（ランク ${rankInfo.rank} : ${rankInfo.title}）\n鉄板の最後の一本を奪い取った！\n#GoGoUmiparadise #海の家 #興居島 #フランクフルト`;
            const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`;
            window.open(url, '_blank', 'noopener,noreferrer');
        });

        // レンダリングループ開始
        requestAnimationFrame(render);
    });
}
