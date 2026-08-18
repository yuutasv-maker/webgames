// テスト時にも利用できるようロジックを分離
const GameLogic = {
    /**
     * クーポン獲得対象か判定する（CRITICALのみ対象）
     * @param {string} rank 判定ランク
     * @returns {boolean}
     */
    isEligibleForCoupon: function(rank) {
        return rank === 'CRITICAL';
    },

    /**
     * カーソルの位置からスコアを算出する
     * @param {number} cursorPos カーソルのピクセル座標 (左端からの距離)
     * @param {number} centerPos ターゲット中心のピクセル座標
     * @param {number} gaugeWidth ゲージ全体のピクセル幅
     * @returns {Object} ランクとメッセージ
     */
    calculateScore: function(cursorPos, centerPos, gaugeWidth) {
        const distance = Math.abs(cursorPos - centerPos);
        // 中心からのズレを全体の半分に対する割合(0.0〜1.0)として計算
        const normalized = distance / (gaugeWidth / 2);
        
        // 中心に近いほど高得点 (0〜1000点)
        let score = 0;
        if (normalized <= 1.0) {
            score = Math.max(0, Math.floor(1000 * (1 - normalized)));
        }
        
        // CRITICAL: 芯を直撃（normalized <= 0.04）のみクーポン獲得対象
        if (normalized <= 0.04) return { rank: 'CRITICAL', score: 1000, message: '神業！芯を直撃！✨\nアイストッピング or 100円引きGET！🍨' };
        if (normalized <= 0.15) return { rank: 'PERFECT', score: score, message: '見事命中！🍉\nナイススマッシュ！' };
        if (normalized <= 0.30) return { rank: 'GREAT', score: score, message: 'いい感じ！🍉\nナイスヒット！' };
        if (normalized <= 0.40) return { rank: 'GOOD', score: score, message: '見事割れました！🍉' };
        return { rank: 'MISS', score: 0, message: '残念、空振り...💦\nもう一度挑戦しよう！' };
    }
};

// Node.js環境（Jest等のテストランナー）向けのエクスポート処理
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameLogic };
} else {
    // ブラウザ環境向け処理
    document.addEventListener('DOMContentLoaded', () => {
        const cursor = document.getElementById('cursor');
        const smashBtn = document.getElementById('smash-btn');
        const retryBtn = document.getElementById('retry-btn');
        const modal = document.getElementById('result-modal');
        const resultTitle = document.getElementById('result-title');
        const resultDesc = document.getElementById('result-desc');
        const earnedScoreVal = document.getElementById('earned-score-val');
        const totalScoreDisplay = document.getElementById('total-score');
        const watermelon = document.getElementById('watermelon');
        const gaugeContainer = document.querySelector('.gauge-container');
        
        let isMoving = false;
        let position = 0;
        let direction = 1;
        let animationFrame;
        let totalScore = 0;
        
        // スマホやPCなど画面幅に応じて難易度が変わらないよう、速度を動的に設定
        let gaugeWidth = gaugeContainer.clientWidth;
        let speed = gaugeWidth * 0.015; // 1フレームあたりの移動ピクセル

        window.addEventListener('resize', () => {
            gaugeWidth = gaugeContainer.clientWidth;
            speed = gaugeWidth * 0.015; 
        });

        function updateGauge() {
            if (!isMoving) return;

            position += direction * speed;
            if (position >= gaugeWidth) {
                position = gaugeWidth;
                direction = -1;
            } else if (position <= 0) {
                position = 0;
                direction = 1;
            }

            // CSS側で `left: 0` としているため、絶対ピクセル座標(position)分だけ translateX で動かす
            // (パフォーマンス向上のため translateY は使わず translateX のみ)
            cursor.style.transform = `translateX(${position}px) translateX(-50%)`;
            animationFrame = requestAnimationFrame(updateGauge);
        }

        function startGame() {
            isMoving = true;
            modal.classList.add('hidden');
            watermelon.className = 'watermelon';
            smashBtn.disabled = false;
            
            // クーポン枠のリセット
            if (typeof CouponUI !== 'undefined') {
                CouponUI.hide('coupon-section');
            }

            // ランダムな位置と方向から開始
            position = Math.random() * gaugeWidth;
            direction = Math.random() > 0.5 ? 1 : -1;
            cursor.style.transform = `translateX(${position}px) translateX(-50%)`;
            
            updateGauge();
        }

        function smash() {
            if (!isMoving) return;
            isMoving = false;
            cancelAnimationFrame(animationFrame);
            smashBtn.disabled = true;

            const centerPos = gaugeWidth / 2;
            const result = GameLogic.calculateScore(position, centerPos, gaugeWidth);

            // スイカのアニメーション
            if (result.rank === 'MISS') {
                watermelon.classList.add('missed');
            } else {
                watermelon.classList.add('smashed');
            }

            // 少しタメを作ってから結果モーダルを表示
            setTimeout(() => {
                totalScore += result.score;
                totalScoreDisplay.textContent = totalScore;
                
                resultTitle.textContent = result.rank;
                resultTitle.className = result.rank;
                earnedScoreVal.textContent = result.score;
                resultDesc.innerHTML = result.message.replace(/\n/g, '<br>');

                // クーポン獲得セクションの制御（CRITICAL達成時のみクーポン券受取ボタンを表示）
                if (typeof CouponUI !== 'undefined') {
                    CouponUI.renderResult({
                        containerId: 'coupon-section',
                        gameId: 'watermelon',
                        isEligible: GameLogic.isEligibleForCoupon(result.rank),
                        conditionHint: '', // CRITICAL以外ではボタン非表示
                        successMsg: '🎉 <strong>神業！芯を直撃達成！</strong><br>アイストッピング or 100円引きクーポンを獲得しました！',
                        claimedMsg: '🎉 <strong>神業クリア！お見事！</strong><br><span style="font-size: 12px; color: #777;">※ 本日のクーポンは獲得済みです（1日1回限定）</span>'
                    });
                }

                modal.classList.remove('hidden');
            }, 800);
        }

        smashBtn.addEventListener('click', smash);
        retryBtn.addEventListener('click', startGame);

        // ゲーム初期化
        startGame();
    });
}
