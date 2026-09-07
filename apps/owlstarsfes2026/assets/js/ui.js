/**
 * FesUI: 井上ヤスオバーガーALL(OWL)-STARS FESTIVAL LP用 UI層
 * Logic層（FesLogic）と連携してDOMを描画します。
 */

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

const CONSTANTS = {
  NO_IMAGE: './assets/images/no-image.jpg'
};

async function initApp() {
  try {
    // スピナー表示（各セクション）
    ['info', 'performers', 'timetable', 'foods'].forEach(id => showLoading(id));

    // 並列でデータFetch
    const [info, performers, timetable, foods] = await Promise.all([
      fetchAndValidate('./data/info.json', { required: ['festivalName', 'date'] }, 'info'),
      fetchAndValidate('./data/performers.json', { required: ['id', 'name'] }, 'performers'),
      fetchAndValidate('./data/timetable.json', { required: ['time', 'performerId'] }, 'timetable'),
      fetchAndValidate('./data/foods.json', { required: ['id', 'name'] }, 'foods')
    ]);

    // UI描画
    if (info) {
      renderInfo(info);
      renderForm(info);
      hideLoading('info');
    }

    if (performers) {
      renderPerformers(performers);
      hideLoading('performers');
    }

    if (timetable && performers) {
      const formatted = FesLogic.formatTimetable(timetable, performers);
      renderTimetable(formatted);
      hideLoading('timetable');
    } else if (timetable) {
      hideLoading('timetable');
      showError('timetable');
    }

    if (foods) {
      renderFoods(foods);
      hideLoading('foods');
    }

  } catch (error) {
    console.error('App initialization failed:', error);
  }
}

async function fetchAndValidate(url, schema, sectionId) {
  try {
    const data = await FesLogic.fetchEventData(url);
    FesLogic.validateData(data, schema);
    return data;
  } catch (error) {
    console.error(`Error loading ${url}:`, error);
    hideLoading(sectionId);
    showError(sectionId);
    return null;
  }
}

function showLoading(sectionId) {
  const el = document.getElementById(`${sectionId}-content`);
  if (el) {
    el.innerHTML = '<div class="flex justify-center py-8"><div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div></div>';
  }
}

function hideLoading(sectionId) {
  // 描画時に上書きされるため、特段の処理は不要ですがプレースホルダーとして残します
}

function showError(sectionId) {
  const el = document.getElementById(`${sectionId}-content`);
  if (el) {
    el.innerHTML = '<div class="text-center py-8 text-gray-500">現在情報を更新中です</div>';
  }
}

function renderInfo(data) {
  const el = document.getElementById('info-content');
  if (!el) return;

  const html = `
    <div class="bg-white p-6 rounded-xl shadow-md mb-8">
      <dl class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="col-span-1 md:col-span-2 pb-2 border-b">
          <dt class="font-semibold text-gray-600">イベント名</dt>
          <dd class="text-xl font-bold">${escapeHtml(data.festivalName)}</dd>
        </div>
        <div class="pb-2 md:pb-0 border-b md:border-b-0 md:border-r pr-0 md:pr-4 pt-2">
          <dt class="font-semibold text-gray-600 flex items-center justify-between">
            <span>日時</span>
            <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=%E4%BA%95%E4%B8%8A%E3%83%A4%E3%82%B9%E3%82%AA%E3%83%90%E3%83%BC%E3%82%AC%E3%83%BC%20OWL-STARS%20FESTIVAL%202026&dates=20261101T030000Z/20261101T103000Z&details=%E4%BC%9A%E5%A0%B4%EF%BC%9A%E3%82%B9%E3%82%BF%E3%82%B8%E3%82%AAOWL%0A%E8%A9%B3%E7%B4%B0%E3%83%BB%E3%82%BF%E3%82%A4%E3%83%A0%E3%83%86%E3%83%BC%E3%83%96%E3%83%AB%EF%BC%9Ahttps%3A%2F%2Fowl21.info%2Fowlstarsfes2026%2F&location=%E3%82%B9%E3%82%BF%E3%82%B8%E3%82%AAOWL%EF%BC%88%E6%84%9B%E5%AA%9B%E7%9C%8C%E6%9D%BE%E5%B1%B1%E5%B8%82%E4%B8%89%E7%95%AA%E7%94%BA%E4%B8%89%E4%B8%81%E7%9B%AE6-2%20ab%E2%80%99s%20square%EF%BC%92%EF%BC%A6%EF%BC%89" 
               target="_blank" rel="noopener noreferrer" 
               class="text-xs font-normal text-gray-500 hover:text-blue-600 inline-flex items-center space-x-1 border border-gray-200 hover:border-blue-300 rounded px-2 py-0.5 transition bg-gray-50 hover:bg-white" 
               title="Googleカレンダーに予定を登録">
              <svg class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              <span>カレンダーに追加</span>
            </a>
          </dt>
          <dd class="text-lg mt-1">${escapeHtml(data.date).replace(/\n/g, '<br>')}</dd>
        </div>
        <div class="pt-2 pl-0 md:pl-4">
          <dt class="font-semibold text-gray-600">会場</dt>
          <dd class="text-lg">
            ${escapeHtml(data.venue.name)}<br>
            <span class="text-sm text-gray-500">${escapeHtml(data.venue.address)}</span>
            ${data.venue.mapUrl ? `<br><a href="${escapeHtml(data.venue.mapUrl)}" target="_blank" class="text-blue-500 text-sm hover:underline">Google Maps</a>` : ''}
          </dd>
        </div>
        <div class="col-span-1 md:col-span-2 pt-4 border-t border-gray-100">
          <dt class="font-semibold text-gray-600">チケット</dt>
          <dd class="text-lg">
            ${data.tickets.price ? escapeHtml(data.tickets.price) : [data.tickets.advance, data.tickets.door].filter(Boolean).map(escapeHtml).join(' / ')}<br>
            ${data.tickets.notes && data.tickets.notes.length > 0 ? `
              <ul class="text-sm text-gray-500 mt-1 space-y-1">
                ${data.tickets.notes.map(n => {
                  const isNote = n.startsWith('※');
                  return isNote 
                    ? `<li class="list-none text-xs text-gray-400 mt-1">${escapeHtml(n)}</li>` 
                    : `<li class="list-disc ml-5">${escapeHtml(n)}</li>`;
                }).join('')}
              </ul>` : ''}
          </dd>
        </div>
      </dl>
    </div>
  `;
  el.innerHTML = html;
}

// SNS等のアイコンを返すヘルパー
const getSocialIcon = (platform) => {
  switch(platform.toLowerCase()) {
    case 'twitter':
    case 'x':
      return `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 22.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
    case 'instagram':
      return `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>`;
    case 'facebook':
      return `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"></path></svg>`;
    case 'youtube':
      return `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33 2.78 2.78 0 001.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.33 29 29 0 00-.46-5.33zM9.75 15.02V8.48l6.5 3.27-6.5 3.27z"></path></svg>`;
    default: // website etc.
      return `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
  }
};

function renderPerformers(data) {
  const el = document.getElementById('performers-content');
  if (!el) return;

  // ソート処理: メインゲスト優先、以降はkana（50音）順
  const sortedData = [...data]
    .filter(p => p.id !== 'p10')
    .sort((a, b) => {
    if (a.isMainGuest && !b.isMainGuest) return -1;
    if (!a.isMainGuest && b.isMainGuest) return 1;
    
    const kanaA = a.kana || a.name;
    const kanaB = b.kana || b.name;
    return kanaA.localeCompare(kanaB, 'ja');
  });

  const html = `
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      ${sortedData.map(p => {
        const isMain = p.isMainGuest;
        const colClass = isMain ? 'col-span-2 md:col-span-2 lg:col-span-2 row-span-2' : 'col-span-1';
        const imgHeight = isMain ? 'h-64 md:h-full' : 'h-40 md:h-48';
        const nameSize = isMain ? 'text-2xl md:text-3xl' : 'text-lg';
        const layoutClass = isMain ? 'flex flex-col h-full' : 'flex flex-col';
        
        let socialHtml = '';
        if (p.socialLinks) {
          socialHtml = '<div class="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100">';
          for (const [platform, url] of Object.entries(p.socialLinks)) {
            socialHtml += `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="text-gray-400 hover:text-blue-500 transition" title="${escapeHtml(platform)}">${getSocialIcon(platform)}</a>`;
          }
          socialHtml += '</div>';
        }
        
        const imgPosition = p.imagePosition || 'object-top';
        
        const descriptionText = p.description || 'よろしくお願いします！';
        const isLongText = !isMain && (descriptionText.length > 50 || descriptionText.includes('\n'));
        
        let descHtml = '';
        if (isLongText) {
          descHtml = `
            <div class="relative mt-2 flex-grow">
              <p class="text-sm md:text-base text-gray-600 description-clamp transition-all">${escapeHtml(descriptionText).replace(/\n/g, '<br>')}</p>
              <button type="button" onclick="toggleDescription(this)" class="mt-1 text-xs text-blue-600 hover:text-blue-800 font-semibold focus:outline-none">続きを読む ▼</button>
            </div>
          `;
        } else {
          descHtml = `
            <p class="text-sm md:text-base text-gray-600 mt-2 flex-grow">${escapeHtml(descriptionText).replace(/\n/g, '<br>')}</p>
          `;
        }

        return `
        <div class="bg-white rounded-xl shadow-md overflow-hidden transform transition hover:scale-[1.02] ${colClass} ${layoutClass}">
          <img src="${p.imageUrl || CONSTANTS.NO_IMAGE}" alt="${escapeHtml(p.name)}" class="w-full ${imgHeight} object-cover ${imgPosition}" onerror="this.onerror=null;this.src='${CONSTANTS.NO_IMAGE}';">
          <div class="p-4 flex-grow flex flex-col justify-center ${isMain ? 'bg-blue-50' : ''}">
            <h3 class="font-bold ${nameSize} text-gray-800">${escapeHtml(p.name)}</h3>
            ${descHtml}
            ${socialHtml}
          </div>
        </div>
      `}).join('')}
    </div>

    <!-- STREET STAR（飛び込み路上ライブ） 特集紹介 -->
    <div class="mt-6 md:mt-8 bg-white border border-blue-100 rounded-xl p-6 md:p-8 shadow-md">
      <div class="inline-block bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full mb-2">
        LOFT STREET
      </div>
      <h3 class="text-xl md:text-2xl font-bold text-gray-800 mb-2">
        STREET STAR（飛び込み路上ライブ）
      </h3>
      <p class="text-sm text-gray-600 leading-relaxed">
        ロフトの奥のスペースにて行われる飛び込みライブ！<br class="hidden sm:inline">
        最低限の簡易アンプを使用し、熱気あふれるパフォーマンスをお届けします。<br>
        出演者以外のご入場者様も飛び入り参加可能です！
      </p>
    </div>
  `;
  el.innerHTML = html;
}

window.toggleDescription = function(btn) {
  const p = btn.previousElementSibling;
  if (!p) return;
  const isClamped = p.classList.contains('description-clamp');
  if (isClamped) {
    p.classList.remove('description-clamp');
    btn.textContent = '閉じる ▲';
  } else {
    p.classList.add('description-clamp');
    btn.textContent = '続きを読む ▼';
  }
};

function renderTimetable(formattedData) {
  const el = document.getElementById('timetable-content');
  if (!el) return;

  const { isSingleStage, stages, processedActs, baseHour, totalHours } = formattedData;
  // 1分あたりのピクセル数（スケール）を大きくして短い時間でもテキストが潰れないようにする
  const MINUTE_HEIGHT = 4.5;

  if (isSingleStage) {
    // 1ステージの場合もMVPスコープとしてリスト形式（既存まま）
    const html = `
      <div class="max-w-3xl mx-auto bg-white rounded-xl shadow-md p-6">
        <ul class="divide-y divide-gray-200">
          ${processedActs.map(item => `
            <li class="py-4 flex items-center">
              <div class="w-24 flex-shrink-0 font-bold text-blue-600 text-lg">${escapeHtml(item.time)}</div>
              <div class="flex-grow flex items-center">
                <img src="${item.performer?.imageUrl || CONSTANTS.NO_IMAGE}" alt="${escapeHtml(item.performer?.name || 'Unknown')}" class="w-12 h-12 rounded-full object-cover mr-4" onerror="this.onerror=null;this.src='${CONSTANTS.NO_IMAGE}';">
                <div>
                  <div class="font-bold text-lg text-gray-800">${escapeHtml(item.performer?.name || 'Unknown')}</div>
                </div>
              </div>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
    el.innerHTML = html;
  } else {
    // 複数ステージの場合は絶対配置（px）を用いたビジュアルタイムテーブル
    // タイムテーブル全体の高さ（時間数 * 60分 * 1分あたりの高さ）
    const totalHeightPx = totalHours * 60 * MINUTE_HEIGHT;

    // 時間軸ラベルの生成 (11:00, 12:00 ... 20:00)
    const timeAxisHtml = Array.from({ length: totalHours + 1 }).map((_, i) => {
      const h = baseHour + i;
      const topPx = i * 60 * MINUTE_HEIGHT;
      
      if (h === 13) {
        return `
          <div class="absolute w-full z-0" style="top: ${topPx}px;">
            <div class="absolute w-[300%] md:w-[200vw] border-t-2 border-red-500 border-dashed z-0"></div>
            <div class="absolute w-full flex flex-col items-center justify-center transform -translate-y-1/2">
              <div class="bg-blue-50 px-2 flex flex-col items-center">
                <span class="text-[10px] md:text-xs text-red-600 font-black italic tracking-wider leading-none">START</span>
                <span class="font-black text-sm md:text-xl text-red-600 drop-shadow-sm">${h}:00</span>
              </div>
            </div>
          </div>
        `;
      }
      
      return `
        <div class="absolute w-full z-0" style="top: ${topPx}px;">
          <div class="absolute w-[300%] md:w-[200vw] border-t border-gray-300 border-dashed z-0"></div>
          <div class="absolute w-full text-center transform -translate-y-1/2">
            <span class="bg-blue-50 px-1 md:px-2 font-black text-sm md:text-xl text-gray-600">${h}:00</span>
          </div>
        </div>
      `;
    }).join('');

    // ステージごとの列生成
    const stageColsHtml = stages.map(stage => {
      // このステージの出演者だけフィルタ
      const acts = processedActs.filter(a => a.stage === stage);

      // 色の条件分岐 (LOFT STREET / LOFTステージは青色系、STAR STAGEは赤色系)
      const isLoft = stage.includes('LOFT') || stage === 'LOFT STREET' || stage === 'STREET LOFT';
      const headerColorClasses = isLoft ? 'text-blue-800 bg-blue-100' : 'text-red-800 bg-red-100';
      const cardColorClasses = isLoft ? 'bg-gradient-to-br from-blue-400 to-blue-600 text-white' : 'bg-gradient-to-br from-red-500 to-red-700 text-white';

      const actsHtml = acts.map(act => {
        const topPx = act.startMins * MINUTE_HEIGHT;
        const heightPx = act.durationMins * MINUTE_HEIGHT;
        const isMainGuest = act.performerId === 'p01';
        
        const finalCardClasses = isMainGuest 
          ? 'bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-600 text-yellow-900 border-2 border-yellow-200 shadow-[0_0_15px_rgba(250,204,21,0.6)]' 
          : `${cardColorClasses} border border-white shadow-sm`;
          
        return `
          <div class="absolute left-0.5 right-0.5 md:left-1 md:right-1 ${finalCardClasses} rounded-md p-1 md:p-2 overflow-hidden flex flex-col justify-center z-10 transition transform hover:scale-105 hover:z-20" style="top: ${topPx}px; height: ${heightPx}px;">
            <div class="text-[10px] md:text-xs font-bold bg-white/40 inline-block px-1 rounded self-start mb-0.5 md:mb-1">${escapeHtml(act.time)}</div>
            <div class="font-bold text-xs md:text-base leading-tight md:leading-normal">${escapeHtml(act.performer?.name || 'Unknown')}</div>
          </div>
        `;
      }).join('');

      return `
        <div class="flex-1 relative border-l border-gray-200">
          <div class="text-center font-bold ${headerColorClasses} py-2 md:py-3 rounded-t-lg mb-2 leading-tight">
            <span class="text-[10px] md:text-xs opacity-80">ステージ</span><br>
            <span class="text-sm md:text-lg">${escapeHtml(stage)}</span>
          </div>
          <!-- アクツのコンテナ (relative) -->
          <div class="relative w-full" style="height: ${totalHeightPx}px;">
            ${actsHtml}
          </div>
        </div>
      `;
    }).join('');

    const html = `
      <div class="bg-white rounded-xl shadow-md p-2 md:p-4 overflow-hidden">
        <div class="w-full flex">
          <!-- 時間軸 -->
          <div class="w-12 md:w-20 relative pt-[2.75rem] md:pt-[3.25rem]">
            <div class="relative w-full" style="height: ${totalHeightPx}px;">
              ${timeAxisHtml}
            </div>
          </div>
          <!-- ステージカラム -->
          <div class="flex-1 flex gap-2">
            ${stageColsHtml}
          </div>
        </div>
      </div>
    `;
    el.innerHTML = html;
  }
}

function renderFoods(data) {
  const el = document.getElementById('foods-content');
  if (!el) return;

  const html = `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      ${data.map(f => {
        let socialHtml = '';
        if (f.socialLinks) {
          socialHtml = '<div class="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100">';
          for (const [platform, url] of Object.entries(f.socialLinks)) {
            socialHtml += `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="text-gray-400 hover:text-blue-500 transition" title="${escapeHtml(platform)}">${getSocialIcon(platform)}</a>`;
          }
          socialHtml += '</div>';
        }
        
        return `
        <div class="bg-white rounded-xl shadow-md overflow-hidden transform transition hover:scale-105 flex flex-col">
          <!-- Logo & Name -->
          <div class="flex items-center p-4 border-b border-gray-100 bg-gray-50">
            <img src="${f.imageUrl || CONSTANTS.NO_IMAGE}" alt="${escapeHtml(f.name)} logo" class="w-12 h-12 rounded-full object-cover border border-gray-200 mr-3" onerror="this.onerror=null;this.src='${CONSTANTS.NO_IMAGE}';">
            <h3 class="font-bold text-lg text-gray-800">${escapeHtml(f.name)}</h3>
          </div>
          <!-- Menu Image -->
          <div class="relative bg-gray-200">
            <img src="${f.menuImageUrl || CONSTANTS.NO_IMAGE}" alt="Menu image" class="w-full h-48 object-cover" onerror="this.onerror=null;this.src='${CONSTANTS.NO_IMAGE}';">
            ${!f.menuImageUrl ? '<div class="absolute inset-0 flex items-center justify-center text-gray-500 font-bold bg-gray-100/80 backdrop-blur-sm">メニュー画像スペース</div>' : ''}
          </div>
          <!-- Description -->
          <div class="p-4 flex-grow flex flex-col">
            <p class="text-sm text-gray-600 flex-grow">${escapeHtml(f.description || '')}</p>
            ${socialHtml}
          </div>
        </div>
      `}).join('')}
    </div>
  `;
  el.innerHTML = html;
}

function renderForm(infoData) {
  const formTitleInput = document.querySelector('input[name="event-title"]');
  const formDateInput = document.querySelector('input[name="event-date"]');
  const form = document.getElementById('ticket-form');

  if (formTitleInput) {
    formTitleInput.value = infoData.festivalName;
  }
  if (formDateInput) {
    formDateInput.value = infoData.date;
  }

  // 予約フォームの非同期送信処理（Contact Form 7 REST API連携）
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.innerText;
      submitBtn.disabled = true;
      submitBtn.innerText = '送信中...';

      // ==========================================
      // 【要設定】本番環境のWordPress情報に書き換えてください
      // ==========================================
      const WP_DOMAIN = 'https://owl21.info'; // 例: https://example.com
      const CF7_FORM_ID = 'd9ba360';                     // 例: 1234
      const WP_API_URL = `${WP_DOMAIN}/wp-json/contact-form-7/v1/contact-forms/${CF7_FORM_ID}/feedback`;

      try {
        const formData = new FormData(form);
        // Headless構成のため非同期(fetch)でCF7エンドポイントへPOST
        const response = await fetch(WP_API_URL, {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (result.status === 'mail_sent') {
          // GA4 カスタムイベント送信 (spec.md 要件)
          if (typeof FesLogic !== 'undefined' && typeof gtag === 'function') {
            FesLogic.trackReserveTicket(gtag);
          } else if (typeof gtag === 'function') {
            gtag('event', 'reserve_ticket', {
              event_name: 'inoue_yasuo_burger_fes_2026'
            });
          }

          alert('予約申し込みを受け付けました。');
          form.reset();
        } else {
          // CF7側でのバリデーションエラー等
          alert('送信エラー: ' + (result.message || '入力内容をご確認ください'));
        }
      } catch (error) {
        console.error('Fetch error:', error);
        alert('通信エラーが発生しました。WPドメインとフォームIDの設定を確認してください。');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = originalBtnText;
      }
    });
  }
}

// XSS対策の簡易エスケープ
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.copyShareUrl = function() {
  const shareUrl = window.location.origin + window.location.pathname;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast();
    }).catch(() => {
      fallbackCopy(shareUrl);
    });
  } else {
    fallbackCopy(shareUrl);
  }
};

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    showToast();
  } catch (err) {
    prompt('以下のURLをコピーしてください:', text);
  }
  document.body.removeChild(textarea);
}

function showToast() {
  const toast = document.getElementById('share-toast');
  if (!toast) return;
  toast.classList.remove('opacity-0', 'pointer-events-none');
  toast.classList.add('opacity-100');
  setTimeout(() => {
    toast.classList.remove('opacity-100');
    toast.classList.add('opacity-0', 'pointer-events-none');
  }, 2500);
}
