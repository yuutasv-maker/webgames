/**
 * 30秒アサイータワー・スタック（バランス・キャッチ）
 * ゲームロジック & エンジン
 */

const GameLogic = {
    // 1品完成となる段数
    COMPLETE_THRESHOLD: 5,

    // アイテム定義
    ITEMS: {
        strawberry: { type: 'strawberry', name: 'イチゴ', emoji: '🍓', score: 100, weight: 30, width: 36, height: 36, speed: 3.0 },
        banana:     { type: 'banana',     name: 'バナナ', emoji: '🍌', score: 100, weight: 25, width: 44, height: 28, speed: 2.8 },
        blueberry:  { type: 'blueberry',  name: 'ブルーベリー', emoji: '🫐', score: 50, weight: 20, width: 26, height: 26, speed: 3.8 },
        mango:      { type: 'mango',      name: 'マンゴー', emoji: '🥭', score: 200, weight: 10, width: 38, height: 38, speed: 3.2 },
        coconut:    { type: 'coconut',    name: 'グラノーラ', emoji: '🥥', score: 150, weight: 10, width: 32, height: 32, speed: 2.6 },
        honey:      { type: 'honey',      name: 'ゴールドハニー', emoji: '🍯', score: 150, weight: 3, width: 36, height: 36, speed: 3.0, isFever: true },
        crab:       { type: 'crab',       name: 'お邪魔カニ', emoji: '🦀', score: -200, weight: 2, width: 36, height: 30, speed: 3.5, isHazard: true }
    },

    // 確率に基づくアイテム抽選
    getRandomItem: function(randomFn = Math.random) {
        const items = Object.values(this.ITEMS);
        const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
        let rand = randomFn() * totalWeight;
        for (const item of items) {
            if (rand < item.weight) {
                return { ...item };
            }
            rand -= item.weight;
        }
        return { ...items[0] };
    },

    // キャッチ精度判定
    evaluateCatch: function(itemX, targetX, targetWidth) {
        const halfWidth = targetWidth / 2;
        const diff = Math.abs(itemX - targetX);
        const diffRatio = diff / halfWidth;

        if (diffRatio <= 0.25) {
            return { accuracy: 'PERFECT', accuracyMultiplier: 1.5, diffRatio, diff };
        } else if (diffRatio <= 0.60) {
            return { accuracy: 'GREAT', accuracyMultiplier: 1.0, diffRatio, diff };
        } else if (diffRatio <= 1.00) {
            return { accuracy: 'GOOD', accuracyMultiplier: 0.8, diffRatio, diff };
        } else {
            return { accuracy: 'MISS', accuracyMultiplier: 0, diffRatio, diff };
        }
    },

    // コンボ倍率計算
    calculateComboMultiplier: function(comboCount) {
        if (comboCount >= 15) return 2.0;
        if (comboCount >= 10) return 1.5;
        if (comboCount >= 5) return 1.2;
        return 1.0;
    },

    // スコア計算
    calculateItemScore: function(item, accuracyMultiplier, comboMultiplier, isFever = false) {
        if (item.isHazard) {
            return item.score; // ペナルティ -200
        }
        const feverMultiplier = isFever ? 1.5 : 1.0;
        return Math.round(item.score * accuracyMultiplier * comboMultiplier * feverMultiplier);
    },

    // スタック更新
    updateStack: function(currentStack, caughtItem, offsetX = 0) {
        const nextStack = [...currentStack];
        if (caughtItem.isHazard) {
            if (nextStack.length > 0) {
                nextStack.pop(); // 最上段が崩れる
            }
            return nextStack;
        }
        if (caughtItem.isFever) {
            // ハニーはスタックに乗らずフィーバー発動のみ
            return nextStack;
        }
        nextStack.push({
            type: caughtItem.type,
            name: caughtItem.name,
            emoji: caughtItem.emoji,
            width: caughtItem.width,
            height: caughtItem.height,
            offsetX: offsetX
        });
        return nextStack;
    },

    // 一品完成判定
    isBowlComplete: function(stackLength, threshold = this.COMPLETE_THRESHOLD) {
        return stackLength >= threshold;
    },

    // 一品完成ボーナススコア計算 (1杯目: 500, 2杯目: 600, 3杯目: 700...)
    calculateCompletionBonus: function(completedCount) {
        return 400 + (completedCount * 100);
    },

    // 通常フルーツ種別
    STANDARD_FRUIT_TYPES: ['strawberry', 'banana', 'blueberry', 'mango', 'coconut'],

    // 推奨レシピオーダーの生成 (5個の組み合わせ)
    generateTargetOrder: function(length = this.COMPLETE_THRESHOLD, randomFn = Math.random) {
        const order = [];
        for (let i = 0; i < length; i++) {
            const randIndex = Math.floor(randomFn() * this.STANDARD_FRUIT_TYPES.length);
            order.push(this.STANDARD_FRUIT_TYPES[randIndex]);
        }
        return order;
    },

    // オーダーとスタックの一致判定（順不同の個数一致）
    checkOrderMatch: function(stack, targetOrder) {
        if (!stack || !targetOrder || stack.length !== targetOrder.length) return false;
        const stackTypes = stack.map(item => item.type).sort();
        const targetTypes = [...targetOrder].sort();
        for (let i = 0; i < stackTypes.length; i++) {
            if (stackTypes[i] !== targetTypes[i]) return false;
        }
        return true;
    },

    // 役判定（推奨オーダー / 全部同じフルーツ / 全部別のフルーツ / 通常完成）
    evaluateBowlBonus: function(stack, completedCount = 1, targetOrder = null) {
        const baseBonus = this.calculateCompletionBonus(completedCount);
        if (!stack || stack.length < this.COMPLETE_THRESHOLD) {
            return {
                type: 'INCOMPLETE',
                bonusName: '未完成',
                extraScore: 0,
                totalScore: 0
            };
        }

        // 1. スペシャル推奨レシピ一致 (SPECIAL_ORDER) -> +1,200pt
        if (targetOrder && this.checkOrderMatch(stack, targetOrder)) {
            return {
                type: 'SPECIAL_ORDER',
                bonusName: '✨ シェフの推奨レシピ達成！',
                extraScore: 1200,
                totalScore: baseBonus + 1200
            };
        }

        const types = stack.map(item => item.type);
        const uniqueTypes = new Set(types);

        // 2. 全部一緒のフルーツ (ALL_SAME: ユニーク数 1) -> +800pt
        if (uniqueTypes.size === 1) {
            const firstItem = stack[0];
            const name = firstItem.name || 'フルーツ';
            const emoji = firstItem.emoji || '✨';
            return {
                type: 'ALL_SAME',
                bonusName: `${emoji} ${name}一色盛り！`,
                extraScore: 800,
                totalScore: baseBonus + 800
            };
        }

        // 3. 全部別のフルーツ (ALL_DIFFERENT: ユニーク数 5) -> +800pt
        if (uniqueTypes.size === this.COMPLETE_THRESHOLD) {
            return {
                type: 'ALL_DIFFERENT',
                bonusName: '🌈 トロピカルレインボー！',
                extraScore: 800,
                totalScore: baseBonus + 800
            };
        }

        // 4. 通常完成
        return {
            type: 'NORMAL',
            bonusName: 'アサイーボウル完成！',
            extraScore: 0,
            totalScore: baseBonus
        };
    },

    // ランク評価 (Aランク10,000点をクーポン付与基準として設定)
    getRank: function(score) {
        if (score >= 15000) return { rank: 'S', title: '👑 伝説のアサイーマスター' };
        if (score >= 10000) return { rank: 'A', title: '🌟 プロアサイー職人' };
        if (score >= 5000) return { rank: 'B', title: '🍓 一人前スタッフ' };
        return { rank: 'C', title: '🫐 見習いスタッフ' };
    },

    // クーポン付与資格判定 (Aランク以上 / 10,000点以上で付与)
    isEligibleForCoupon: function(score) {
        return score >= 10000;
    }
};

// Node.js テスト環境用のエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameLogic };
} else {
    // ブラウザ環境での実行
    document.addEventListener('DOMContentLoaded', () => {
        const GAME_DURATION = 30.0; // 30秒
        const CANVAS_WIDTH = 360;
        const CANVAS_HEIGHT = 580;
        const BOWL_WIDTH = 84;
        const BOWL_HEIGHT = 38;
        const ITEM_LAYER_HEIGHT = 16; // 1段あたりの積み上げ高さ

        // DOM要素
        const canvas = document.getElementById('game-canvas');
        const ctx = canvas.getContext('2d');
        const timeBar = document.getElementById('time-bar-fill');
        const timeText = document.getElementById('time-text');
        const scoreText = document.getElementById('score-text');
        const comboText = document.getElementById('combo-badge');
        const feverBadge = document.getElementById('fever-badge');
        const bowlsCountBadge = document.getElementById('bowls-count-badge');
        const orderItemsList = document.getElementById('order-items-list');
        const startScreen = document.getElementById('start-screen');
        const countdownOverlay = document.getElementById('countdown-overlay');
        const countdownNumber = document.getElementById('countdown-number');
        const resultModal = document.getElementById('result-modal');
        const startBtn = document.getElementById('start-btn');
        const retryBtn = document.getElementById('retry-btn');
        const shareBtn = document.getElementById('share-btn');
        const couponSection = document.getElementById('coupon-section');
        const couponBtn = document.getElementById('coupon-btn');
        const couponMsg = document.getElementById('coupon-msg');

        // 音声シンセサイザー (Web Audio API)
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
            playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.15) {
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
            playCatch(accuracy) {
                this.init();
                if (accuracy === 'PERFECT') {
                    this.playTone(880, 'sine', 0.12, 0.2); // A5
                    setTimeout(() => this.playTone(1320, 'triangle', 0.15, 0.2), 60); // E6
                } else if (accuracy === 'GREAT') {
                    this.playTone(660, 'sine', 0.1, 0.15); // E5
                    setTimeout(() => this.playTone(880, 'sine', 0.12, 0.15), 50); // A5
                } else {
                    this.playTone(523, 'sine', 0.08, 0.1); // C5
                }
            },
            playServe() {
                this.init();
                // 1品完成時のチャイム音 (C5 -> E5 -> G5 -> C6)
                const chords = [523, 659, 784, 1046];
                chords.forEach((freq, i) => {
                    setTimeout(() => this.playTone(freq, 'triangle', 0.18, 0.22), i * 50);
                });
            },
            playFever() {
                this.init();
                const notes = [523, 659, 784, 1046];
                notes.forEach((freq, i) => {
                    setTimeout(() => this.playTone(freq, 'triangle', 0.15, 0.2), i * 70);
                });
            },
            playHazard() {
                this.init();
                this.playTone(150, 'sawtooth', 0.25, 0.3);
                setTimeout(() => this.playTone(110, 'sawtooth', 0.25, 0.3), 100);
            },
            playWhistle() {
                this.init();
                this.playTone(987, 'square', 0.15, 0.15);
                setTimeout(() => this.playTone(1318, 'square', 0.4, 0.2), 150);
            },
            playFanfare() {
                this.init();
                const melody = [
                    { f: 523, d: 0.12 }, { f: 659, d: 0.12 }, { f: 784, d: 0.12 },
                    { f: 1046, d: 0.35 }
                ];
                melody.forEach((note, i) => {
                    setTimeout(() => this.playTone(note.f, 'triangle', note.d, 0.25), i * 110);
                });
            }
        };

        // ゲーム状態
        let gameState = 'START'; // START, COUNTDOWN, PLAYING, TIMEUP, RESULT
        let score = 0;
        let combo = 0;
        let maxCombo = 0;
        let completedBowlsCount = 0;
        let remainingTime = GAME_DURATION;
        let lastTime = 0;
        let feverTimer = 0;
        let stunTimer = 0;

        // プレイヤー（ボウル）
        const player = {
            x: CANVAS_WIDTH / 2,
            y: CANVAS_HEIGHT - 65,
            width: BOWL_WIDTH,
            height: BOWL_HEIGHT,
            speed: 380, // px/s
            movingLeft: false,
            movingRight: false,
            targetX: CANVAS_WIDTH / 2
        };

        // 落下アイテム・スタック・エフェクト・完成出荷アニメーション
        let fallingItems = [];
        let stack = [];
        let currentTargetOrder = []; // 現在の推奨レシピ（5個）
        let servingBowls = []; // 完成して脇（トレイ）へ飛んでいくボウルアニメーション
        let placedBowls = [];  // 脇のトレイに置かれた完成ミニボウル
        let particles = [];
        let popups = [];
        let spawnTimer = 0;
        let spawnInterval = 0.55; // 0.55秒に1回出現

        // 推奨レシピオーダーのUI描画
        function updateOrderUI() {
            if (!orderItemsList) return;
            orderItemsList.innerHTML = '';
            
            // 現在のスタックで集めたフルーツのプール（コピー）
            const collectedTypes = stack.map(item => item.type);

            currentTargetOrder.forEach((type) => {
                const itemDef = GameLogic.ITEMS[type];
                const slot = document.createElement('span');
                slot.className = 'order-item-slot';
                slot.textContent = itemDef ? itemDef.emoji : '❓';

                // スタック内に該当フルーツがあればマッチ表示
                const foundIndex = collectedTypes.indexOf(type);
                if (foundIndex !== -1) {
                    slot.classList.add('matched');
                    collectedTypes.splice(foundIndex, 1); // 1個消費
                }
                orderItemsList.appendChild(slot);
            });
        }

        // Canvasスケーリング（高DPI対応）
        function setupCanvas() {
            const dpr = window.devicePixelRatio || 1;
            canvas.width = CANVAS_WIDTH * dpr;
            canvas.height = CANVAS_HEIGHT * dpr;
            ctx.scale(dpr, dpr);
        }
        setupCanvas();

        // -------------------------------------------------------------
        // 入力処理（スマホ・PC両対応）
        // -------------------------------------------------------------
        // -------------------------------------------------------------
        // 入力処理（カップの直接タッチ＆スライド操作・PC両対応）
        // -------------------------------------------------------------
        const canvasContainer = document.querySelector('.canvas-container');

        function updatePlayerPositionFromClientX(clientX) {
            if (gameState !== 'PLAYING' || stunTimer > 0) return;
            const rect = canvas.getBoundingClientRect();
            const relativeX = clientX - rect.left;
            player.x = (relativeX / rect.width) * CANVAS_WIDTH;
            clampPlayer();
        }

        // タッチ操作（タップした位置・指のスライドに1:1でボウルがダイレクト追従）
        canvas.addEventListener('touchstart', (e) => {
            if (gameState !== 'PLAYING') return;
            e.preventDefault();
            if (e.touches.length > 0) {
                updatePlayerPositionFromClientX(e.touches[0].clientX);
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            if (gameState !== 'PLAYING') return;
            e.preventDefault();
            if (e.touches.length > 0) {
                updatePlayerPositionFromClientX(e.touches[0].clientX);
            }
        }, { passive: false });

        canvas.addEventListener('touchend', (e) => {
            if (gameState === 'PLAYING') e.preventDefault();
        }, { passive: false });

        canvas.addEventListener('touchcancel', (e) => {
            if (gameState === 'PLAYING') e.preventDefault();
        }, { passive: false });

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // PCマウス操作
        let isMouseDown = false;
        canvas.addEventListener('mousedown', (e) => {
            if (gameState !== 'PLAYING') return;
            isMouseDown = true;
            updatePlayerPositionFromClientX(e.clientX);
        });

        window.addEventListener('mouseup', () => {
            isMouseDown = false;
        });

        canvas.addEventListener('mousemove', (e) => {
            if (gameState !== 'PLAYING') return;
            updatePlayerPositionFromClientX(e.clientX);
        });

        // iOSのピンチズーム・ダブルタップズーム抑止
        document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
        document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

        // キーボード操作（← / →, A / D）
        window.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                player.movingLeft = true;
            }
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                player.movingRight = true;
            }
        });
        window.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                player.movingLeft = false;
            }
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                player.movingRight = false;
            }
        });

        function clampPlayer() {
            const half = player.width / 2;
            if (player.x < half + 10) player.x = half + 10;
            if (player.x > CANVAS_WIDTH - half - 10) player.x = CANVAS_WIDTH - half - 10;
        }

        // -------------------------------------------------------------
        // パーティクル & ポップアップテキスト
        // -------------------------------------------------------------
        function addPopup(text, x, y, color = '#ff007f', scale = 1.0) {
            popups.push({ text, x, y, color, scale, alpha: 1.0, vy: -1.8 });
        }

        function addParticles(x, y, color, count = 8) {
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 1.5 + Math.random() * 3.5;
                particles.push({
                    x, y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 1.0,
                    size: 3 + Math.random() * 4,
                    color,
                    alpha: 1.0,
                    life: 0.5 + Math.random() * 0.3
                });
            }
        }

        // -------------------------------------------------------------
        // ゲームループ & 更新処理
        // -------------------------------------------------------------
        function startGameSequence() {
            Sound.init();
            startScreen.classList.add('hidden');
            resultModal.classList.add('hidden');
            
            // カウントダウン開始前に最初の推奨レシピオーダーを生成・表示
            currentTargetOrder = GameLogic.generateTargetOrder();
            updateOrderUI();

            countdownOverlay.classList.remove('hidden');

            let count = 3;
            countdownNumber.textContent = count;
            Sound.playTone(440, 'sine', 0.15, 0.2);

            const interval = setInterval(() => {
                count--;
                if (count > 0) {
                    countdownNumber.textContent = count;
                    Sound.playTone(440, 'sine', 0.15, 0.2);
                } else if (count === 0) {
                    countdownNumber.textContent = 'GO!';
                    Sound.playTone(880, 'sine', 0.3, 0.25);
                } else {
                    clearInterval(interval);
                    countdownOverlay.classList.add('hidden');
                    initGame();
                }
            }, 800);
        }

        function initGame() {
            gameState = 'PLAYING';
            score = 0;
            combo = 0;
            maxCombo = 0;
            completedBowlsCount = 0;
            remainingTime = GAME_DURATION;
            feverTimer = 0;
            stunTimer = 0;
            fallingItems = [];
            stack = [];
            servingBowls = [];
            placedBowls = [];
            particles = [];
            popups = [];
            spawnTimer = 0;
            player.x = CANVAS_WIDTH / 2;
            player.movingLeft = false;
            player.movingRight = false;
            lastTime = performance.now();
            
            // カウントダウン時に生成済みのオーダーがなければ生成
            if (!currentTargetOrder || currentTargetOrder.length === 0) {
                currentTargetOrder = GameLogic.generateTargetOrder();
            }
            updateOrderUI();
            updateUI();
            requestAnimationFrame(gameLoop);
        }

        function updateUI() {
            scoreText.textContent = score.toLocaleString();
            const timeRatio = Math.max(0, remainingTime / GAME_DURATION);
            timeBar.style.width = `${timeRatio * 100}%`;
            timeText.textContent = `${Math.ceil(remainingTime)}s`;

            if (bowlsCountBadge) {
                bowlsCountBadge.textContent = `🥣 完成: ${completedBowlsCount}杯`;
            }

            // オーダーの進捗（一致状態）を更新
            updateOrderUI();

            if (combo > 1) {
                const multiplier = GameLogic.calculateComboMultiplier(combo);
                comboText.textContent = `${combo} COMBO (x${multiplier})`;
                comboText.classList.remove('hidden');
            } else {
                comboText.classList.add('hidden');
            }

            if (feverTimer > 0) {
                feverBadge.classList.remove('hidden');
                feverBadge.textContent = `🍯 FEVER! ${Math.ceil(feverTimer)}s (x1.5)`;
            } else {
                feverBadge.classList.add('hidden');
            }
        }

        function gameLoop(timestamp) {
            if (gameState !== 'PLAYING' && gameState !== 'TIMEUP') return;

            const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
            lastTime = timestamp;

            update(dt);
            render();

            if (gameState === 'PLAYING' || gameState === 'TIMEUP') {
                requestAnimationFrame(gameLoop);
            }
        }

        function update(dt) {
            if (gameState === 'TIMEUP') {
                // 終了演出中のエフェクト更新のみ
                updateEffects(dt);
                return;
            }

            // タイマー減算
            remainingTime -= dt;
            if (remainingTime <= 0) {
                remainingTime = 0;
                finishGame();
                return;
            }

            // フィーバー & スタンタイマー
            if (feverTimer > 0) feverTimer -= dt;
            if (stunTimer > 0) stunTimer -= dt;

            // プレイヤー移動
            if (stunTimer <= 0) {
                if (player.movingLeft) player.x -= player.speed * dt;
                if (player.movingRight) player.x += player.speed * dt;
                clampPlayer();
            }

            // アイテム生成
            spawnTimer += dt;
            const currentInterval = feverTimer > 0 ? 0.45 : spawnInterval;
            if (spawnTimer >= currentInterval) {
                spawnTimer = 0;
                const item = GameLogic.getRandomItem();
                const margin = 30;
                item.x = margin + Math.random() * (CANVAS_WIDTH - margin * 2);
                item.y = -30;
                item.vy = item.speed * 60; // px/s
                item.rotation = (Math.random() - 0.5) * 0.5;
                fallingItems.push(item);
            }

            // アイテム更新 & 当たり判定
            const isFever = feverTimer > 0;
            const targetY = player.y - stack.length * ITEM_LAYER_HEIGHT;
            const catchWidth = isFever ? player.width * 1.15 : player.width;

            for (let i = fallingItems.length - 1; i >= 0; i--) {
                const item = fallingItems[i];
                item.y += item.vy * dt;

                // キャッチ判定
                if (item.y >= targetY - 15 && item.y <= targetY + 20) {
                    const evalResult = GameLogic.evaluateCatch(item.x, player.x, catchWidth);

                    if (evalResult.accuracy !== 'MISS') {
                        // キャッチ成功
                        fallingItems.splice(i, 1);

                        if (item.isHazard) {
                            // カニ接触
                            stunTimer = 0.6;
                            combo = 0;
                            const pts = GameLogic.calculateItemScore(item, 1, 1, false);
                            score = Math.max(0, score + pts);
                            stack = GameLogic.updateStack(stack, item, 0);
                            addPopup(`OUCH! ${pts}`, player.x, targetY - 20, '#e53e3e', 1.2);
                            addParticles(item.x, targetY, '#e53e3e', 12);
                            Sound.playHazard();
                        } else if (item.isFever) {
                            // ゴールドハニー
                            feverTimer = 2.5; // 2.5秒間持続
                            combo++;
                            if (combo > maxCombo) maxCombo = combo;
                            const pts = GameLogic.calculateItemScore(item, evalResult.accuracyMultiplier, 1, false);
                            score += pts;
                            addPopup(`🍯 FEVER! +${pts}`, player.x, targetY - 20, '#d69e2e', 1.3);
                            addParticles(item.x, targetY, '#ecc94b', 14);
                            Sound.playFever();
                        } else {
                            // 通常フルーツ
                            combo++;
                            if (combo > maxCombo) maxCombo = combo;
                            const comboMultiplier = GameLogic.calculateComboMultiplier(combo);
                            const pts = GameLogic.calculateItemScore(item, evalResult.accuracyMultiplier, comboMultiplier, isFever);
                            score += pts;

                            const offsetX = (item.x - player.x) * 0.4;
                            stack = GameLogic.updateStack(stack, item, offsetX);

                            const color = evalResult.accuracy === 'PERFECT' ? '#ff007f' : '#3182ce';
                            const label = evalResult.accuracy === 'PERFECT' ? `PERFECT! +${pts}` : `+${pts}`;
                            addPopup(label, player.x + offsetX, targetY - 15, color, evalResult.accuracy === 'PERFECT' ? 1.2 : 1.0);
                            addParticles(item.x, targetY, color, 8);
                            Sound.playCatch(evalResult.accuracy);

                            // ★ 一品完成チェック（5段積み上がった場合）
                            if (GameLogic.isBowlComplete(stack.length)) {
                                completedBowlsCount++;
                                const bonusResult = GameLogic.evaluateBowlBonus(stack, completedBowlsCount, currentTargetOrder);
                                score += bonusResult.totalScore;

                                // 完成ボウルの出荷アニメーション開始
                                triggerServeAnimation(player.x, player.y, [...stack]);

                                if (bonusResult.type === 'SPECIAL_ORDER') {
                                    // スペシャル推奨レシピ達成！
                                    addPopup(`✨ ${bonusResult.bonusName} +${bonusResult.totalScore}`, player.x, player.y - 60, '#f59e0b', 1.7);
                                    addParticles(player.x, player.y - 30, '#ecc94b', 36);
                                    Sound.playFanfare();

                                    // 次の新しいオーダーを生成！
                                    currentTargetOrder = GameLogic.generateTargetOrder();
                                } else if (bonusResult.type === 'ALL_SAME') {
                                    addPopup(`🌟 ${bonusResult.bonusName} +${bonusResult.totalScore}`, player.x, player.y - 60, '#ff007f', 1.6);
                                    addParticles(player.x, player.y - 30, '#ff007f', 32);
                                    Sound.playServe();
                                } else if (bonusResult.type === 'ALL_DIFFERENT') {
                                    addPopup(`🌈 ${bonusResult.bonusName} +${bonusResult.totalScore}`, player.x, player.y - 60, '#7928ca', 1.6);
                                    addParticles(player.x, player.y - 30, '#00c6ff', 32);
                                    Sound.playServe();
                                } else {
                                    addPopup(`🎉 1品完成!! +${bonusResult.totalScore}`, player.x, player.y - 60, '#ff007f', 1.4);
                                    addParticles(player.x, player.y - 30, '#ff007f', 24);
                                    Sound.playServe();
                                }

                                // 手元のタワーをリセット！
                                stack = [];
                            }
                        }
                        updateUI();
                        continue;
                    }
                }

                // 画面外へ落下
                if (item.y > CANVAS_HEIGHT + 40) {
                    fallingItems.splice(i, 1);
                    if (!item.isHazard && !item.isFever) {
                        combo = 0; // コンボ途切れ
                        updateUI();
                    }
                }
            }

            updateEffects(dt);
        }

        // 1品完成時のスライドアニメーション
        function triggerServeAnimation(startX, startY, bowlStack) {
            // 脇のトレイ位置（画面右上/左上のトレイ領域）
            const targetIndex = placedBowls.length;
            const targetX = 35 + (targetIndex % 5) * 32;
            const targetY = 70 + Math.floor(targetIndex / 5) * 28;

            servingBowls.push({
                x: startX,
                y: startY,
                startX: startX,
                startY: startY,
                targetX: targetX,
                targetY: targetY,
                stack: bowlStack,
                progress: 0,
                scale: 1.0,
                alpha: 1.0
            });
        }

        function updateEffects(dt) {
            // 出荷アニメーション更新
            for (let i = servingBowls.length - 1; i >= 0; i--) {
                const sb = servingBowls[i];
                sb.progress += dt * 2.2; // 約0.45秒で移動

                if (sb.progress >= 1.0) {
                    // 到着 → 脇のトレイに固定
                    placedBowls.push({
                        x: sb.targetX,
                        y: sb.targetY,
                        stack: sb.stack
                    });
                    servingBowls.splice(i, 1);
                } else {
                    const ease = 1 - Math.pow(1 - sb.progress, 3); // easeOutCubic
                    sb.x = sb.startX + (sb.targetX - sb.startX) * ease;
                    sb.y = sb.startY + (sb.targetY - sb.startY) * ease;
                    sb.scale = 1.0 - 0.55 * ease; // ミニサイズ化
                }
            }

            // パーティクル更新
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.alpha -= dt / p.life;
                if (p.alpha <= 0) particles.splice(i, 1);
            }

            // ポップアップ更新
            for (let i = popups.length - 1; i >= 0; i--) {
                const pop = popups[i];
                pop.y += pop.vy;
                pop.alpha -= dt * 1.5;
                if (pop.alpha <= 0) popups.splice(i, 1);
            }
        }

        // -------------------------------------------------------------
        // 描画処理 (Render)
        // -------------------------------------------------------------
        function render() {
            ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

            // 背景描画（青い海と砂浜のグラデーション）
            drawBackground();

            // 脇の完成ボウルトレイ描画
            drawPlacedBowls();

            // 出荷中のアニメーションボウル
            servingBowls.forEach(sb => {
                drawCustomBowl(sb.x, sb.y, sb.stack, sb.scale, sb.alpha);
            });

            // 落下中のアイテム
            fallingItems.forEach(item => {
                drawEmojiItem(item.emoji, item.x, item.y, item.width, item.rotation);
            });

            // プレイヤー（ボウル ＆ スタックタワー）
            drawPlayerAndStack();

            // パーティクル
            particles.forEach(p => {
                ctx.save();
                ctx.globalAlpha = Math.max(0, p.alpha);
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });

            // ポップアップテキスト
            popups.forEach(pop => {
                ctx.save();
                ctx.globalAlpha = Math.max(0, pop.alpha);
                ctx.fillStyle = pop.color;
                ctx.font = `900 ${Math.round(18 * pop.scale)}px "Outfit", "Zen Maru Gothic", sans-serif`;
                ctx.textAlign = 'center';
                ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
                ctx.shadowBlur = 6;
                ctx.fillText(pop.text, pop.x, pop.y);
                ctx.restore();
            });

            // TIME UP表示
            if (gameState === 'TIMEUP') {
                ctx.save();
                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                ctx.fillStyle = '#ffffff';
                ctx.font = '900 42px "Outfit", sans-serif';
                ctx.textAlign = 'center';
                ctx.shadowColor = '#ff007f';
                ctx.shadowBlur = 12;
                ctx.fillText('TIME UP!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
                ctx.restore();
            }
        }

        function drawBackground() {
            // 空と海
            const seaGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
            seaGrad.addColorStop(0, '#74ebd5');
            seaGrad.addColorStop(0.65, '#9face6');
            seaGrad.addColorStop(1, '#f6d365');
            ctx.fillStyle = seaGrad;
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

            // 砂浜のライン
            ctx.fillStyle = '#fce38a';
            ctx.beginPath();
            ctx.ellipse(CANVAS_WIDTH / 2, CANVAS_HEIGHT, CANVAS_WIDTH * 0.7, 90, 0, 0, Math.PI * 2);
            ctx.fill();

            // キラキラ波紋
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.fillRect(20, 220, 80, 4);
            ctx.fillRect(180, 260, 110, 4);
            ctx.fillRect(70, 310, 90, 4);
        }

        // 画面上部/脇に並べられた完成ミニボウル
        function drawPlacedBowls() {
            if (placedBowls.length === 0) return;

            // トレイ背景枠
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.strokeStyle = 'rgba(255, 0, 127, 0.3)';
            ctx.lineWidth = 1.5;
            const trayW = Math.min(CANVAS_WIDTH - 20, 35 + placedBowls.length * 32);
            ctx.beginPath();
            ctx.roundRect(10, 46, trayW, 36, 8);
            ctx.fill();
            ctx.stroke();

            // トレイラベル
            ctx.fillStyle = '#4a154b';
            ctx.font = '900 10px "Zen Maru Gothic", sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('完成トレイ', 14, 58);

            placedBowls.forEach(b => {
                drawCustomBowl(b.x, b.y, b.stack, 0.45, 1.0);
            });
            ctx.restore();
        }

        // 任意の位置にボウルとスタックを描画
        function drawCustomBowl(x, y, bowlStack, scale = 1.0, alpha = 1.0) {
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(x, y);
            ctx.scale(scale, scale);

            // 影
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.beginPath();
            ctx.ellipse(0, player.height / 2 + 8, player.width / 2 + 6, 8, 0, 0, Math.PI * 2);
            ctx.fill();

            // ボウル外殻
            ctx.fillStyle = '#5c3a21';
            ctx.beginPath();
            ctx.arc(0, 0, player.width / 2, 0, Math.PI, false);
            ctx.fill();

            // ボウルふち
            ctx.fillStyle = '#7a4e2d';
            ctx.beginPath();
            ctx.ellipse(0, 0, player.width / 2, 8, 0, 0, Math.PI * 2);
            ctx.fill();

            // アサイーベース
            ctx.fillStyle = '#4a154b';
            ctx.beginPath();
            ctx.ellipse(0, 2, player.width / 2 - 4, 6, 0, 0, Math.PI * 2);
            ctx.fill();

            // スタックフルーツ
            bowlStack.forEach((item, index) => {
                const stackY = -((index + 1) * ITEM_LAYER_HEIGHT);
                const itemX = item.offsetX || 0;
                drawEmojiItem(item.emoji, itemX, stackY, item.width, (item.offsetX || 0) * 0.02);
            });

            ctx.restore();
        }

        function drawPlayerAndStack() {
            ctx.save();
            const shake = stunTimer > 0 ? (Math.random() - 0.5) * 10 : 0;
            drawCustomBowl(player.x + shake, player.y, stack, 1.0, 1.0);
            ctx.restore();
        }

        function drawEmojiItem(emoji, x, y, size, rotation = 0) {
            ctx.save();
            ctx.translate(x, y);
            if (rotation) ctx.rotate(rotation);
            ctx.font = `${Math.round(size)}px "Outfit", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(emoji, 0, 0);
            ctx.restore();
        }

        // -------------------------------------------------------------
        // ゲーム終了 & リザルト表示
        // -------------------------------------------------------------
        function finishGame() {
            gameState = 'TIMEUP';
            Sound.playWhistle();
            updateUI();

            setTimeout(() => {
                gameState = 'RESULT';
                showResultModal();
            }, 1200);
        }

        function showResultModal() {
            const rankInfo = GameLogic.getRank(score);
            const isEligible = GameLogic.isEligibleForCoupon(score);

            document.getElementById('result-rank-badge').textContent = `RANK ${rankInfo.rank}`;
            document.getElementById('result-rank-title').textContent = rankInfo.title;
            document.getElementById('result-score').textContent = score.toLocaleString();
            document.getElementById('result-bowls-count').textContent = `${completedBowlsCount} 杯`;
            document.getElementById('result-max-combo').textContent = `${maxCombo} COMBO`;

            // クーポン表示 & 保存判定
            if (isEligible && typeof CouponManager !== 'undefined') {
                const isClaimedToday = !CouponManager.canClaimToday('acai-tower');
                couponSection.classList.remove('hidden');

                if (isClaimedToday) {
                    couponMsg.innerHTML = '<span style="color:#666;">本日のクーポンは獲得済みです</span>';
                    couponBtn.classList.remove('hidden');
                    couponBtn.textContent = '🎫 獲得済みクーポンを見る';
                } else {
                    CouponManager.claimCoupon('acai-tower');
                    // 他ミニゲームと統一された特典内容（アイストッピング追加 or 100円引き）を案内
                    couponMsg.innerHTML = `🎉 <strong>${rankInfo.rank}ランク達成！アイストッピング or 100円引きクーポンGET！</strong>`;
                    couponBtn.classList.remove('hidden');
                    couponBtn.textContent = '🎫 クーポンを受け取る';
                }
                couponBtn.href = CouponManager.getCouponUrl('acai-tower', { score, rank: rankInfo.rank });
            } else {
                couponSection.classList.add('hidden');
            }

            if (isEligible) {
                Sound.playFanfare();
            }

            resultModal.classList.remove('hidden');
        }

        // -------------------------------------------------------------
        // イベントバインド
        // -------------------------------------------------------------
        startBtn.addEventListener('click', startGameSequence);
        retryBtn.addEventListener('click', startGameSequence);

        shareBtn.addEventListener('click', () => {
            const rankInfo = GameLogic.getRank(score);
            const text = `🌴 GoGoUmi paradise【30秒アサイータワー・スタック】\nスコア: ${score.toLocaleString()}点（ランク ${rankInfo.rank} : ${rankInfo.title}）\nアサイーボウルを【${completedBowlsCount}杯】完成させた！\n#GoGoUmiparadise #海の家 #興居島 #アサイーボウル`;
            const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`;
            window.open(url, '_blank', 'noopener,noreferrer');
        });

        // 初期オーダーの生成＆表示
        currentTargetOrder = GameLogic.generateTargetOrder();
        updateOrderUI();
    });
}
