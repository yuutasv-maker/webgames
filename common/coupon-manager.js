/**
 * 海の家 ミニゲーム クーポン共通管理モジュール
 */
const CouponManager = {
    /** ゲーム定義（タイトル、特典、説明、コード接頭辞、アイコン、画像、戻り先等） */
    GAME_CONFIGS: {
        'acai': {
            id: 'acai',
            name: '映えアサイー職人',
            title: '映えアサイー職人 チャレンジ成功',
            benefit: 'バニラアイストッピング追加 または 100円引き',
            description: '店頭注文時にこちらの画面をご提示いただくと、バニラアイストッピングを追加、または合計金額から100円引きいたします！',
            codePrefix: 'ACAI',
            icon: '🫐',
            theme: 'acai',
            image: 'images/acai_ice.png',
            backUrl: '../apps/acai-game/index.html'
        },
        'acai-tower': {
            id: 'acai-tower',
            name: '30秒アサイータワー・スタック',
            title: '30秒アサイータワー・スタック チャレンジ成功',
            benefit: 'バニラアイストッピング追加 または 100円引き',
            description: '店頭注文時にこちらの画面をご提示いただくと、バニラアイストッピングを追加、または合計金額から100円引きいたします！',
            codePrefix: 'TOWER',
            icon: '🥣',
            theme: 'acai',
            image: 'images/acai_ice.png',
            backUrl: '../apps/acai-tower/index.html'
        },
        'watermelon': {
            id: 'watermelon',
            name: 'スイカ割りタイミングゲーム',
            title: 'スイカ割り チャレンジ成功',
            benefit: 'バニラアイストッピング追加 または 100円引き',
            description: '店頭注文時にこちらの画面をご提示いただくと、バニラアイストッピングを追加、または合計金額から100円引きいたします！',
            codePrefix: 'SUIKA',
            icon: '🍉',
            theme: 'watermelon',
            image: 'images/watermelon_coupon.jpg',
            backUrl: '../apps/watermelon-game/index.html'
        },
        'bbq': {
            id: 'bbq',
            name: '爆速BBQ串メーカー',
            title: '爆速BBQ串メーカー チャレンジ成功',
            // 全ゲーム統一の特典仕様（アイストッピング追加または100円引き）に設定
            benefit: 'バニラアイストッピング追加 または 100円引き',
            description: '店頭注文時にこちらの画面をご提示いただくと、バニラアイストッピングを追加、または合計金額から100円引きいたします！',
            codePrefix: 'BBQ',
            icon: '🍖',
            theme: 'bbq',
            // BBQクーポン引換用イメージ画像を設定
            image: 'images/bbq_coupon.jpg',
            backUrl: '../apps/bbq-game/index.html'
        },
        'frankfurt': {
            id: 'frankfurt',
            name: '最後の一本フランクフルト',
            title: '最後の一本フランクフルト チャレンジ成功',
            benefit: 'バニラアイストッピング追加 または 100円引き',
            description: '店頭注文時にこちらの画面をご提示いただくと、バニラアイストッピングを追加、または合計金額から100円引きいたします！',
            codePrefix: 'FRANK',
            icon: '🌭',
            theme: 'frankfurt',
            image: 'images/frankfurt_coupon.jpg',
            backUrl: '../apps/frankfurt-game/index.html'
        },
        'janken': {
            id: 'janken',
            name: '脳バグ！後出しじゃんけん',
            title: '脳バグ！後出しじゃんけん チャレンジ成功',
            benefit: 'バニラアイストッピング追加 または 100円引き',
            description: '店頭注文時にこちらの画面をご提示いただくと、バニラアイストッピングを追加、または合計金額から100円引きいたします！',
            codePrefix: 'JANKEN',
            icon: '✌️',
            theme: 'janken',
            image: 'images/watermelon_coupon.jpg',
            backUrl: '../apps/janken-game/index.html'
        }
    },

    STORAGE_KEY_PREFIX: 'uminoie_coupon_',

    getStorageKey: function(gameId) {
        return `${this.STORAGE_KEY_PREFIX}${gameId}_claimed_date`;
    },

    getTodayDateString: function(date = new Date()) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    getClaimedDate: function(gameId, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
        if (!storage) return null;
        try {
            const key = this.getStorageKey(gameId);
            let val = storage.getItem(key);
            // 後方互換性（acai-gameの旧キーからのフォールバック）
            if (!val && gameId === 'acai') {
                val = storage.getItem('acai_game_coupon_claimed_date');
            }
            return val;
        } catch (e) {
            console.warn('CouponManager storage read error:', e);
            return null;
        }
    },

    canClaimToday: function(gameId, date = new Date(), storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
        const lastClaimed = this.getClaimedDate(gameId, storage);
        const today = this.getTodayDateString(date);
        return lastClaimed !== today;
    },

    claimCoupon: function(gameId, date = new Date(), storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
        if (!storage) return false;
        try {
            const key = this.getStorageKey(gameId);
            const today = this.getTodayDateString(date);
            storage.setItem(key, today);
            return true;
        } catch (e) {
            console.warn('CouponManager storage write error:', e);
            return false;
        }
    },

    getStatus: function(gameId, date = new Date(), storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
        const today = this.getTodayDateString(date);
        const lastClaimed = this.getClaimedDate(gameId, storage);
        return {
            today,
            lastClaimed,
            isClaimedToday: lastClaimed === today
        };
    },

    getCouponUrl: function(gameId, extraParams = {}, baseUrl = '../../common/coupon.html') {
        const params = new URLSearchParams();
        params.set('game', gameId);
        if (typeof extraParams === 'object' && extraParams !== null) {
            Object.entries(extraParams).forEach(([k, v]) => {
                if (v !== undefined && v !== null && v !== '') {
                    params.set(k, v);
                }
            });
        }
        return `${baseUrl}?${params.toString()}`;
    },

    getGameConfig: function(gameId) {
        return this.GAME_CONFIGS[gameId] || {
            id: gameId,
            name: 'ミニゲーム',
            title: 'チャレンジ成功',
            benefit: '海の家 特別特典',
            description: '店頭注文時にこちらの画面をご提示ください。',
            codePrefix: 'GIFT',
            icon: '🏖️',
            backUrl: '../portal.html'
        };
    }
};

/**
 * クーポン表示用 UI ヘルパー
 */
const CouponUI = {
    /**
     * リザルトモーダル内のクーポンセクションを描画・更新
     * @param {Object} options
     * @param {HTMLElement|string} options.containerId セクション要素またはそのID
     * @param {string} options.gameId ゲーム識別ID ('acai', 'watermelon', 'bbq' 等)
     * @param {boolean} options.isEligible クーポン獲得条件を満たしているか
     * @param {string|number} [options.time] クリアタイム秒数（例: "5.42"）
     * @param {string} [options.record] 達成記録文字列（例: "12本"）
     * @param {Object} [options.extraParams] 追加のURLパラメータ
     * @param {string} [options.conditionHint] 条件未達時のヒントメッセージ
     * @param {string} [options.successMsg] 初回獲得時のメッセージ
     * @param {string} [options.claimedMsg] 獲得済み時のメッセージ
     * @param {string} [options.couponUrl] クーポン画面のURL（省略時はデフォルト）
     * @returns {Object} 判定結果ステータス
     */
    renderResult: function(options) {
        const {
            containerId,
            gameId,
            isEligible,
            time,
            record,
            extraParams = {},
            conditionHint = '💡 条件を達成すると限定クーポンGET！',
            successMsg = '🎉 <strong>条件クリア達成！</strong><br>1日1回限定クーポンを獲得しました！',
            claimedMsg = '🎉 <strong>お見事！クリア達成！</strong><br><span style="font-size: 12px; color: #777;">※ 本日のクーポンは獲得済みです（1日1回限定）</span>',
            couponUrl
        } = options;

        const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        if (!container) return null;

        const mergedParams = { ...extraParams };
        if (time !== undefined && time !== null) mergedParams.time = time;
        if (record !== undefined && record !== null) mergedParams.record = record;

        const targetUrl = couponUrl || CouponManager.getCouponUrl(gameId, mergedParams);

        let msgEl = container.querySelector('.coupon-msg');
        let btnEl = container.querySelector('.coupon-btn');

        // 要素が存在しない場合は動的生成
        if (!msgEl) {
            msgEl = document.createElement('p');
            msgEl.className = 'coupon-msg';
            container.appendChild(msgEl);
        }
        if (!btnEl) {
            btnEl = document.createElement('a');
            btnEl.className = 'coupon-btn';
            btnEl.setAttribute('href', targetUrl);
            container.appendChild(btnEl);
        }

        btnEl.setAttribute('href', targetUrl);

        if (isEligible) {
            container.classList.remove('hidden');
            btnEl.classList.remove('hidden');

            const canClaim = CouponManager.canClaimToday(gameId);
            if (canClaim) {
                CouponManager.claimCoupon(gameId);
                msgEl.innerHTML = successMsg;
                btnEl.textContent = '🎫 クーポンを受け取る';
                btnEl.classList.remove('secondary');
                return { status: 'CLAIMED_NEW', canClaim: true };
            } else {
                msgEl.innerHTML = claimedMsg;
                btnEl.textContent = '🎫 獲得済みクーポンを見る';
                btnEl.classList.add('secondary');
                return { status: 'ALREADY_CLAIMED', canClaim: false };
            }
        } else {
            if (conditionHint) {
                container.classList.remove('hidden');
                msgEl.innerHTML = `<span style="color: #666; font-size: 13px;">${conditionHint}</span>`;
                btnEl.classList.add('hidden');
                return { status: 'NOT_ELIGIBLE_WITH_HINT', canClaim: false };
            } else {
                container.classList.add('hidden');
                return { status: 'NOT_ELIGIBLE', canClaim: false };
            }
        }
    },

    /**
     * クーポンセクションを非表示リセット
     */
    hide: function(containerId) {
        const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        if (container) {
            container.classList.add('hidden');
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CouponManager, CouponUI };
}
