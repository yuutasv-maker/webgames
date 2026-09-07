/**
 * イベント用・曲リスト検索システム — UI層
 * Logic層（SongSearchLogic）の結果を受け取りDOM描画・イベント管理のみ担当
 */

var SongSearchUI = (function (Logic) {
  'use strict';

  // =========================================================
  // 状態管理
  // =========================================================
  var state = {
    allSongs: [],        // 全楽曲データ
    keyword: '',         // 検索キーワード
    filters: {           // フィルター条件
      titleKanaRow: null,
      artistKanaRow: null,
      era: null,
      vocal: null
    },
    currentPage: 1,      // 現在のページ番号
    itemsPerPage: 30,    // 1ページあたりの表示件数
    isError: false       // CSV取得エラー
  };

  // =========================================================
  // DOM参照キャッシュ
  // =========================================================
  var dom = {};

  function cacheDom() {
    var app = document.getElementById('song-search-app');
    dom.app = app;
    dom.searchInput = app.querySelector('#ssa-search-input');
    dom.titleKanaButtons = app.querySelector('#ssa-title-kana-buttons');
    dom.artistKanaButtons = app.querySelector('#ssa-artist-kana-buttons');
    dom.eraButtons = app.querySelector('#ssa-era-buttons');
    dom.vocalButtons = app.querySelector('#ssa-vocal-buttons');
    dom.resetBtn = app.querySelector('#ssa-reset-btn');
    dom.resultsHeader = app.querySelector('#ssa-results-header');
    dom.resultsCount = app.querySelector('#ssa-results-count');
    dom.songList = app.querySelector('#ssa-song-list');
    dom.pagination = app.querySelector('#ssa-pagination');
    dom.statusArea = app.querySelector('#ssa-status-area');
  }

  // =========================================================
  // フィルターボタン生成
  // =========================================================

  /**
   * ボタン群を生成してコンテナに挿入
   * @param {HTMLElement} container
   * @param {string[]} items - 表示ラベル配列
   * @param {string} filterKey - state.filtersのキー名
   */
  function renderFilterButtons(container, items, filterKey) {
    container.innerHTML = '';
    items.forEach(function (item) {
      var btn = document.createElement('button');
      btn.className = 'ssa-filter-btn';
      btn.type = 'button';
      btn.textContent = item;
      btn.setAttribute('data-filter-key', filterKey);

      btn.setAttribute('data-filter-value', item);
      btn.addEventListener('click', function () {
        handleFilterClick(filterKey, item, btn);
      });
      container.appendChild(btn);
    });
  }

  // =========================================================
  // イベントハンドラー
  // =========================================================

  /** 検索入力のデバウンス用タイマー */
  var searchTimer = null;

  function handleSearchInput(e) {
    var value = e.target.value;
    // デバウンス: 200ms待ってから検索実行（タイプ中の負荷を軽減）
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.keyword = value;
      state.currentPage = 1;
      renderResults();
    }, 200);
  }

  function handleFilterClick(filterKey, value, btn) {
    // 同じボタンを再タップ→解除（トグル動作）
    if (state.filters[filterKey] === value) {
      state.filters[filterKey] = null;
    } else {
      state.filters[filterKey] = value;
    }
    state.currentPage = 1;
    updateFilterButtonStates();
    renderResults();
  }

  function handleReset() {
    state.keyword = '';
    state.filters.titleKanaRow = null;
    state.filters.artistKanaRow = null;
    state.filters.era = null;
    state.filters.vocal = null;
    state.currentPage = 1;
    dom.searchInput.value = '';
    updateFilterButtonStates();
    renderResults();
  }

  // =========================================================
  // フィルターボタンのactive状態更新
  // =========================================================
  function updateFilterButtonStates() {
    var allBtns = dom.app.querySelectorAll('.ssa-filter-btn');
    for (var i = 0; i < allBtns.length; i++) {
      var btn = allBtns[i];
      var key = btn.getAttribute('data-filter-key');
      var val = btn.getAttribute('data-filter-value');
      if (state.filters[key] === val) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  }

  // =========================================================
  // 描画
  // =========================================================

  function renderResults() {
    var results = Logic.applySearchAndFilter(
      state.allSongs,
      state.keyword,
      state.filters
    );

    // 件数表示
    dom.resultsCount.textContent = results.length;

    // リスト・ページネーションクリア
    dom.songList.innerHTML = '';
    if (dom.pagination) dom.pagination.innerHTML = '';

    if (results.length === 0) {
      dom.songList.innerHTML =
        '<li class="ssa-empty-message">該当する楽曲が見つかりませんでした</li>';
      return;
    }

    // ページング処理
    var totalPages = Math.ceil(results.length / state.itemsPerPage);
    if (state.currentPage > totalPages) {
      state.currentPage = totalPages;
    }
    var startIndex = (state.currentPage - 1) * state.itemsPerPage;
    var pagedResults = results.slice(startIndex, startIndex + state.itemsPerPage);

    // 楽曲リスト描画
    var fragment = document.createDocumentFragment();
    pagedResults.forEach(function (song) {
      var youtubeQuery = encodeURIComponent(song.title + ' ' + song.artist);
      var youtubeUrl = 'https://www.youtube.com/results?search_query=' + youtubeQuery;

      var lyricsQuery = encodeURIComponent(song.title + ' ' + song.artist + ' 歌詞');
      var lyricsUrl = 'https://www.google.com/search?q=' + lyricsQuery;

      var li = document.createElement('li');
      li.className = 'ssa-song-item';
      li.innerHTML =
        '<div class="ssa-song-no">' + escapeHtml(String(song.no)) + '</div>' +
        '<div class="ssa-song-info">' +
          '<div class="ssa-song-title">' + 
            escapeHtml(song.title) + 
            ' <a href="' + escapeHtml(youtubeUrl) + '" target="_blank" rel="noopener noreferrer" class="ssa-youtube-link" title="YouTubeで検索">▶ YouTube</a>' +
            ' <a href="' + escapeHtml(lyricsUrl) + '" target="_blank" rel="noopener noreferrer" class="ssa-lyrics-link" title="Googleで歌詞を検索">🔍 歌詞</a>' +
          '</div>' +
          '<div class="ssa-song-meta">' +
            '<span>' + escapeHtml(song.artist) + '</span>' +
            '<span class="ssa-song-meta-sep">│</span>' +
            '<span>' + escapeHtml(song.era) + '</span>' +
            '<span class="ssa-song-meta-sep">│</span>' +
            '<span>' + escapeHtml(song.vocal) + '</span>' +
          '</div>' +
        '</div>';
      fragment.appendChild(li);
    });
    dom.songList.appendChild(fragment);

    // ページネーション描画
    if (totalPages > 1) {
      renderPagination(totalPages);
    }
  }

  function renderPagination(totalPages) {
    if (!dom.pagination) return;
    
    var fragment = document.createDocumentFragment();
    
    // 前へボタン
    var prevBtn = document.createElement('button');
    prevBtn.className = 'ssa-page-btn';
    prevBtn.textContent = '◀ 前へ';
    prevBtn.disabled = state.currentPage === 1;
    prevBtn.addEventListener('click', function() {
      if (state.currentPage > 1) changePage(state.currentPage - 1);
    });
    fragment.appendChild(prevBtn);

    // ページ番号ボタン
    for (var i = 1; i <= totalPages; i++) {
      var pageBtn = document.createElement('button');
      pageBtn.className = 'ssa-page-btn';
      pageBtn.textContent = i;
      if (i === state.currentPage) {
        pageBtn.classList.add('active');
      } else {
        (function(pageNum) {
          pageBtn.addEventListener('click', function() {
            changePage(pageNum);
          });
        })(i);
      }
      fragment.appendChild(pageBtn);
    }

    // 次へボタン
    var nextBtn = document.createElement('button');
    nextBtn.className = 'ssa-page-btn';
    nextBtn.textContent = '次へ ▶';
    nextBtn.disabled = state.currentPage === totalPages;
    nextBtn.addEventListener('click', function() {
      if (state.currentPage < totalPages) changePage(state.currentPage + 1);
    });
    fragment.appendChild(nextBtn);

    dom.pagination.appendChild(fragment);
  }

  function changePage(newPage) {
    state.currentPage = newPage;
    renderResults();
    // リストの先頭（検索結果ヘッダー付近）にスムーススクロール
    var target = dom.resultsHeader || dom.app;
    var yOffset = target.getBoundingClientRect().top + window.pageYOffset - 20;
    window.scrollTo({ top: yOffset, behavior: 'smooth' });
  }

  /**
   * HTMLエスケープ（XSS防止）
   */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // =========================================================
  // エラー表示
  // =========================================================
  function showError(message, retryCallback) {
    state.isError = true;
    dom.app.classList.add('ssa-disabled');
    dom.statusArea.innerHTML = '';
    
    var html = '<li class="ssa-error-message">' + escapeHtml(message) + '</li>';
    
    // リトライボタンの追加
    if (typeof retryCallback === 'function') {
      html += '<li class="ssa-error-retry"><button type="button" id="ssa-retry-btn" class="ssa-reset-btn">🔄 再読み込み</button></li>';
    }
    
    dom.songList.innerHTML = html;
    dom.resultsCount.textContent = '0';

    if (typeof retryCallback === 'function') {
      var retryBtn = dom.songList.querySelector('#ssa-retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', function() {
          state.isError = false;
          dom.app.classList.remove('ssa-disabled');
          retryCallback();
        });
      }
    }
  }

  function showLoading() {
    dom.statusArea.innerHTML = '<div class="ssa-loading">楽曲データを読み込み中</div>';
    dom.songList.innerHTML = '';
  }

  function hideLoading() {
    dom.statusArea.innerHTML = '';
  }

  // =========================================================
  // データ取得 (I/O)
  // =========================================================

  /**
   * fetch APIでCSVデータを取得する
   * [ADR] フロントエンド完結（全件ロード）の理由:
   * 検索のたびにWordPress側へAPIリクエストを飛ばす設計（サーバーサイド検索）にすると、
   * スプレッドシートのAPIクォータ（制限）に抵触しやすくなり、サーバー負荷も高まります。
   * 数千件程度のデータであれば、初回ロード時に全件ブラウザのメモリに乗せてしまい、
   * 以降はJavaScriptでフィルタリングする方が圧倒的に高速で、サクサクとしたUXを実現できます。
   * @param {string} url - CSVのURL
   * @returns {Promise<string>} CSV文字列
   */
  function fetchCsvData(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) {
        throw new Error('データソースの読み込みに失敗しました（HTTP ' + response.status + '）');
      }
      return response.text();
    });
  }

  // =========================================================
  // 初期化
  // =========================================================

  /**
   * アプリケーション初期化
   * @param {string|string[]} csvUrls - CSVデータのURL（単一文字列または配列）
   * @param {number} itemsPerPage - ページあたりの表示件数
   */
  function init(csvUrls, itemsPerPage) {
    if (itemsPerPage && itemsPerPage > 0) {
      state.itemsPerPage = itemsPerPage;
    }
    cacheDom();

    // イベントリスナー登録
    dom.searchInput.addEventListener('input', handleSearchInput);
    dom.resetBtn.addEventListener('click', handleReset);

    // あかさたなボタン生成
    renderFilterButtons(dom.titleKanaButtons, Logic.KANA_ROWS, 'titleKanaRow');
    renderFilterButtons(dom.artistKanaButtons, Logic.KANA_ROWS, 'artistKanaRow');

    // 互換性維持：単一の文字列が渡された場合は配列に変換
    var urls = Array.isArray(csvUrls) ? csvUrls : [csvUrls];
    // 空文字のURLを除外
    urls = urls.filter(function(u) { return u && u.trim() !== ''; });

    if (urls.length === 0) {
      showError('エラー：ショートコードにスプレッドシートのURL (csv_url) が設定されていません。');
      return;
    }

    loadData(urls);
  }

  /**
   * データ取得と描画のメインフロー
   * @param {string[]} urls 
   */
  function loadData(urls) {
    showLoading();

    // 複数のURLを並列でフェッチ
    var fetchPromises = urls.map(function(url) {
      return fetchCsvData(url);
    });

    Promise.all(fetchPromises)
      .then(function (csvTexts) {
        var allParsedSongs = [];
        var hasError = false;

        // 各CSVテキストをパースして結合
        csvTexts.forEach(function(csvText) {
          var parsed = Logic.parseCsv(csvText);
          if (parsed.length === 0) {
            hasError = true;
          }
          allParsedSongs = allParsedSongs.concat(parsed);
        });

        if (hasError || allParsedSongs.length === 0) {
          showError('スプレッドシートのデータが正しく読み込めませんでした（データ0件、または形式エラー）。URLの設定をご確認ください。');
          return;
        }

        // 重複排除等は行わずそのままリストとする（No列もそのまま）
        state.allSongs = allParsedSongs;
        hideLoading();

        // 年代・ボーカルボタンをデータから動的生成
        var eras = Logic.extractEras(state.allSongs);
        var vocals = Logic.extractVocals(state.allSongs);
        renderFilterButtons(dom.eraButtons, eras, 'era');
        renderFilterButtons(dom.vocalButtons, vocals, 'vocal');

        // 初期表示: 全件
        renderResults();
      })
      .catch(function (err) {
        hideLoading();
        showError('通信エラーが発生しました。インターネット接続状況をご確認ください。', function() {
          loadData(urls);
        });
        console.error('[SongSearchApp] CSV取得エラー:', err);
      });
  }

  return {
    init: init
  };
})(SongSearchLogic);

// WordPressプラグインからの自動初期化処理
document.addEventListener('DOMContentLoaded', function() {
  if (typeof OwlSongSearchConfig !== 'undefined' && typeof SongSearchUI !== 'undefined') {
    // csvUrls 配列が存在する場合はそれを使用、旧バージョンの場合は csvUrl 文字列を使用
    var urls = OwlSongSearchConfig.csvUrls || OwlSongSearchConfig.csvUrl;
    SongSearchUI.init(urls, parseInt(OwlSongSearchConfig.itemsPerPage, 10));
  }
});
