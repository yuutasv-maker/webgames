/**
 * イベント用・曲リスト検索システム — Logic層
 * DOM依存なし。純粋関数のみ。
 *
 * @typedef {Object} Song
 * @property {string|number} no - リクエスト番号
 * @property {string} title - 曲名
 * @property {string} artist - アーティスト名
 * @property {string} titleYomi - 曲名ヨミ（ひらがな）
 * @property {string} artistYomi - アーティスト名ヨミ（ひらがな）
 * @property {string} era - 年代
 * @property {string} vocal - ボーカル（男性/女性/混声）
 */

/**
 * @typedef {Object} SearchFilters
 * @property {string} [titleKanaRow] - 曲名あかさたな行（例: "か"）
 * @property {string} [artistKanaRow] - アーティスト名あかさたな行（例: "か"）
 * @property {string} [era] - 年代（例: "1970年代"）
 * @property {string} [vocal] - ボーカル（例: "男性"）
 */

var SongSearchLogic = (function () {
  'use strict';

  var CONSTANTS = {
    CHAR_CODE_KATAKANA_HIRAGANA_OFFSET: 0x60,
    CHAR_CODE_FULLWIDTH_HALFWIDTH_OFFSET: 0xFEE0,
    MIN_CSV_COLUMNS: 7,
    CSV_COL: { NO: 0, TITLE: 1, ARTIST: 2, TITLE_YOMI: 3, ARTIST_YOMI: 4, ERA: 5, VOCAL: 6 }
  };

  // =========================================================
  // カタカナ→ひらがな変換テーブル
  // =========================================================

  /**
   * カタカナをひらがなに変換する
   * @param {string} str
   * @returns {string}
   */
  function katakanaToHiragana(str) {
    return str.replace(/[\u30A1-\u30F6]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - CONSTANTS.CHAR_CODE_KATAKANA_HIRAGANA_OFFSET);
    });
  }

  /**
   * 全角英数字・記号を半角に変換する
   * @param {string} str
   * @returns {string}
   */
  function fullwidthToHalfwidth(str) {
    return str.replace(/[\uFF01-\uFF5E]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - CONSTANTS.CHAR_CODE_FULLWIDTH_HALFWIDTH_OFFSET);
    });
  }

  // 半角カタカナ→全角カタカナマッピング
  var HANKAKU_KANA_MAP = {
    'ｶﾞ': 'ガ', 'ｷﾞ': 'ギ', 'ｸﾞ': 'グ', 'ｹﾞ': 'ゲ', 'ｺﾞ': 'ゴ',
    'ｻﾞ': 'ザ', 'ｼﾞ': 'ジ', 'ｽﾞ': 'ズ', 'ｾﾞ': 'ゼ', 'ｿﾞ': 'ゾ',
    'ﾀﾞ': 'ダ', 'ﾁﾞ': 'ヂ', 'ﾂﾞ': 'ヅ', 'ﾃﾞ': 'デ', 'ﾄﾞ': 'ド',
    'ﾊﾞ': 'バ', 'ﾋﾞ': 'ビ', 'ﾌﾞ': 'ブ', 'ﾍﾞ': 'ベ', 'ﾎﾞ': 'ボ',
    'ﾊﾟ': 'パ', 'ﾋﾟ': 'ピ', 'ﾌﾟ': 'プ', 'ﾍﾟ': 'ペ', 'ﾎﾟ': 'ポ',
    'ｳﾞ': 'ヴ', 'ﾜﾞ': 'ヷ', 'ｦﾞ': 'ヺ',
    'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
    'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
    'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
    'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
    'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
    'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
    'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
    'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
    'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
    'ﾜ': 'ワ', 'ｦ': 'ヲ', 'ﾝ': 'ン',
    'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
    'ｯ': 'ッ', 'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ',
    'ｰ': 'ー', '･': '・', '｢': '「', '｣': '」', '､': '、', 'ﾟ': '゜', 'ﾞ': '゛'
  };

  /**
   * 半角カタカナを全角カタカナに変換する
   * @param {string} str
   * @returns {string}
   */
  function hankakuToZenkakuKana(str) {
    // 濁点付き2文字を先に置換
    var reg = new RegExp('(' + Object.keys(HANKAKU_KANA_MAP).join('|') + ')', 'g');
    return str.replace(reg, function (match) {
      return HANKAKU_KANA_MAP[match];
    });
  }

  /**
   * テキスト正規化（検索用）
   * - 全角→半角（英数字）
   * - 半角カタカナ→全角カタカナ
   * - カタカナ→ひらがな
   * - 大文字→小文字
   * @param {string} text
   * @returns {string}
   */
  function normalizeText(text) {
    if (typeof text !== 'string') return '';
    var result = text;
    result = fullwidthToHalfwidth(result);
    result = hankakuToZenkakuKana(result);
    result = katakanaToHiragana(result);
    result = result.toLowerCase();
    return result;
  }

  // =========================================================
  // あかさたな行判定（濁音・半濁音→清音丸め）
  // =========================================================

  /**
   * 濁音・半濁音のひらがなを清音に丸めるマッピング
   */
  var DAKUTEN_MAP = {
    'が': 'か', 'ぎ': 'き', 'ぐ': 'く', 'げ': 'け', 'ご': 'こ',
    'ざ': 'さ', 'じ': 'し', 'ず': 'す', 'ぜ': 'せ', 'ぞ': 'そ',
    'だ': 'た', 'ぢ': 'ち', 'づ': 'つ', 'で': 'て', 'ど': 'と',
    'ば': 'は', 'び': 'ひ', 'ぶ': 'ふ', 'べ': 'へ', 'ぼ': 'ほ',
    'ぱ': 'は', 'ぴ': 'ひ', 'ぷ': 'ふ', 'ぺ': 'へ', 'ぽ': 'ほ'
  };

  /**
   * あかさたな行の定義（先頭文字→行ラベル）
   * [ADR] 「ヴ」の扱いについて:
   * 一般的な文字コード上の分類ではなく、カラオケユーザーの直感的な検索体験に合わせるため、
   * 「ヴ（ゔ）」は特例として「あ行（う）」にマッピングしています。
   */
  var KANA_ROW_MAP = {
    'あ': 'あ', 'い': 'あ', 'う': 'あ', 'え': 'あ', 'お': 'あ', 'ゔ': 'あ',
    'か': 'か', 'き': 'か', 'く': 'か', 'け': 'か', 'こ': 'か',
    'さ': 'さ', 'し': 'さ', 'す': 'さ', 'せ': 'さ', 'そ': 'さ',
    'た': 'た', 'ち': 'た', 'つ': 'た', 'て': 'た', 'と': 'た',
    'な': 'な', 'に': 'な', 'ぬ': 'な', 'ね': 'な', 'の': 'な',
    'は': 'は', 'ひ': 'は', 'ふ': 'は', 'へ': 'は', 'ほ': 'は',
    'ま': 'ま', 'み': 'ま', 'む': 'ま', 'め': 'ま', 'も': 'ま',
    'や': 'や', 'ゆ': 'や', 'よ': 'や',
    'ら': 'ら', 'り': 'ら', 'る': 'ら', 'れ': 'ら', 'ろ': 'ら',
    'わ': 'わ', 'を': 'わ', 'ん': 'わ'
  };

  /** あかさたな行ラベルの一覧（UIフィルター用） */
  var KANA_ROWS = ['あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ'];

  /**
   * ひらがな1文字からあかさたな行ラベルを返す
   * 濁音・半濁音は清音に丸めてから判定
   * @param {string} char - ひらがな1文字
   * @returns {string|null} 行ラベル（"あ"〜"わ"）。該当なしはnull
   */
  function getKanaRow(char) {
    if (typeof char !== 'string' || char.length === 0) return null;
    var ch = char.charAt(0);
    // 濁音・半濁音→清音
    var cleaned = DAKUTEN_MAP[ch] || ch;
    return KANA_ROW_MAP[cleaned] || null;
  }

  // =========================================================
  // パース処理
  // =========================================================

  /**
   * CSV文字列をパースする（改行コードを考慮した文字単位のパース）
   * [ADR] 外部ライブラリ非依存の理由:
   * WordPressプラグインとして配布するにあたり、PapaParse等の外部ライブラリを
   * 同梱すると他のプラグインとの競合リスクやペイロード増加を招くため、ゼロ依存を維持。
   * [ADR] 文字単位パースの理由:
   * 単純な `split('\n')` では、スプレッドシートのセル内に改行（Alt+Enter）が
   * 含まれていた場合にデータが壊れてしまうため、ダブルクォート内の改行を安全に処理する
   * ステートマシン型のパーサーを実装しています。
   * @param {string} csvText
   * @returns {string[][]} パースされた全行の配列
   */
  function parseCsvRaw(csvText) {
    if (typeof csvText !== 'string' || csvText.trim() === '') return [];
    
    var rows = [];
    var currentRow = [];
    var currentField = '';
    var inQuotes = false;
    
    for (var i = 0, len = csvText.length; i < len; i++) {
      var ch = csvText[i];
      var nextCh = i + 1 < len ? csvText[i + 1] : '';

      if (inQuotes) {
        if (ch === '"') {
          if (nextCh === '"') {
            currentField += '"';
            i++; // エスケープされたクォートをスキップ
          } else {
            inQuotes = false;
          }
        } else {
          currentField += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          currentRow.push(currentField);
          currentField = '';
        } else if (ch === '\r' && nextCh === '\n') {
          // CRLF
          currentRow.push(currentField);
          rows.push(currentRow);
          currentRow = [];
          currentField = '';
          i++; // \nをスキップ
        } else if (ch === '\n' || ch === '\r') {
          // LF or CR
          currentRow.push(currentField);
          rows.push(currentRow);
          currentRow = [];
          currentField = '';
        } else {
          currentField += ch;
        }
      }
    }
    // 最後の行の処理
    if (currentField !== '' || currentRow.length > 0) {
      currentRow.push(currentField);
      rows.push(currentRow);
    }
    return rows;
  }

  /**
   * 1行分のCSVフィールドをパースする（後方互換性維持のため残す。テストで利用されている）
   * @param {string} line - CSV1行
   * @returns {string[]} フィールド配列
   */
  function parseCsvLine(line) {
    var parsed = parseCsvRaw(line);
    return parsed.length > 0 ? parsed[0] : [''];
  }

  /**
   * CSV文字列をSong配列にパースする
   * ヘッダー行（1行目）はスキップ。空行・不完全行も安全にスキップ。
   * @param {string} csvText - CSV全文
   * @returns {Song[]}
   */
  function parseCsv(csvText) {
    var rawRows = parseCsvRaw(csvText);
    var songs = [];

    // 1行目はヘッダーなのでスキップ（i=1から）
    for (var i = 1; i < rawRows.length; i++) {
      var fields = rawRows[i];
      
      // 空行スキップ（1フィールドのみで空の場合）
      if (fields.length === 1 && fields[0].trim() === '') continue;

      // 最低限の列数チェック
      if (fields.length < CONSTANTS.MIN_CSV_COLUMNS) continue;

      var no = fields[CONSTANTS.CSV_COL.NO].trim();
      var title = fields[CONSTANTS.CSV_COL.TITLE].trim();

      // 曲名が空の場合は不正な行としてスキップ
      if (title === '') continue;

      var song = {
        no: no, // 空欄も許容
        title: title,
        artist: fields[CONSTANTS.CSV_COL.ARTIST].trim(),
        titleYomi: fields[CONSTANTS.CSV_COL.TITLE_YOMI].trim(),
        artistYomi: fields[CONSTANTS.CSV_COL.ARTIST_YOMI].trim(),
        era: fields[CONSTANTS.CSV_COL.ERA].trim(),
        vocal: fields[CONSTANTS.CSV_COL.VOCAL].trim()
      };

      song._searchTargets = [
        normalizeText(song.title),
        normalizeText(song.artist),
        normalizeText(song.titleYomi),
        normalizeText(song.artistYomi)
      ];

      songs.push(song);
    }
    return songs;
  }

  // =========================================================
  // 検索・フィルター
  // =========================================================

  /**
   * フリーワード検索
   * スペース（全半角）区切りで複数キーワードが指定された場合は AND検索 とする
   * @param {Song[]} songs
   * @param {string} keyword
   * @returns {Song[]}
   */
  function searchSongs(songs, keyword) {
    if (!keyword || keyword.trim() === '') return songs;

    // 全角スペースも半角スペースに正規化されているはずなので、スペースで分割
    var normalizedKeywordStr = normalizeText(keyword.trim());
    var keywords = normalizedKeywordStr.split(/\s+/).filter(function(k) { return k !== ''; });

    if (keywords.length === 0) return songs;

    return songs.filter(function (song) {
      var targets = song._searchTargets || [
        normalizeText(song.title),
        normalizeText(song.artist),
        normalizeText(song.titleYomi),
        normalizeText(song.artistYomi)
      ];
      
      // 全てのキーワードが、いずれかのターゲットに含まれていれば true
      return keywords.every(function (kw) {
        for (var i = 0, len = targets.length; i < len; i++) {
          if (targets[i].indexOf(kw) !== -1) return true;
        }
        return false;
      });
    });
  }

  /**
   * フィルター絞り込み（AND条件）
   * @param {Song[]} songs
   * @param {SearchFilters} filters
   * @returns {Song[]}
   */
  function filterSongs(songs, filters) {
    if (!filters) return songs;

    return songs.filter(function (song) {
      if (filters.titleKanaRow && getKanaRow(song.titleYomi.charAt(0)) !== filters.titleKanaRow) return false;
      if (filters.artistKanaRow && getKanaRow(song.artistYomi.charAt(0)) !== filters.artistKanaRow) return false;
      if (filters.era && song.era !== filters.era) return false;
      if (filters.vocal && song.vocal !== filters.vocal) return false;
      return true;
    });
  }

  /**
   * 検索 + フィルターの統合
   * キーワード検索で絞り込んだ後、フィルター条件を適用
   * @param {Song[]} songs
   * @param {string} keyword
   * @param {SearchFilters} filters
   * @returns {Song[]}
   */
  function applySearchAndFilter(songs, keyword, filters) {
    var results = searchSongs(songs, keyword);
    results = filterSongs(results, filters);
    return results;
  }

  /**
   * 共通のプロパティ抽出関数（DRY）
   * @param {Song[]} songs
   * @param {string} prop
   * @returns {string[]}
   */
  function extractUniqueProp(songs, prop) {
    var set = {};
    for (var i = 0, len = songs.length; i < len; i++) {
      var val = songs[i][prop];
      if (val) set[val] = true;
    }
    return Object.keys(set).sort();
  }

  /**
   * CSVデータの年代一覧を抽出（動的フィルター生成用）
   * @param {Song[]} songs
   * @returns {string[]} ソート済み年代配列
   */
  function extractEras(songs) {
    return extractUniqueProp(songs, 'era');
  }

  /**
   * CSVデータのボーカル一覧を抽出
   * @param {Song[]} songs
   * @returns {string[]}
   */
  function extractVocals(songs) {
    return extractUniqueProp(songs, 'vocal');
  }

  // =========================================================
  // 公開API
  // =========================================================
  return {
    normalizeText: normalizeText,
    getKanaRow: getKanaRow,
    parseCsv: parseCsv,
    parseCsvLine: parseCsvLine,
    searchSongs: searchSongs,
    filterSongs: filterSongs,
    applySearchAndFilter: applySearchAndFilter,
    extractEras: extractEras,
    extractVocals: extractVocals,
    KANA_ROWS: KANA_ROWS
  };
})();

// Node.js環境でのexport（テスト用）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SongSearchLogic;
}
