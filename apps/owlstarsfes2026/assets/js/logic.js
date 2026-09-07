/**
 * FesLogic: 井上ヤスオバーガーALL(OWL)-STARS FESTIVAL LP用 ロジック層
 * DOMに依存しない純粋な関数群を提供します。
 */

const FesLogic = {
  /**
   * JSONデータを取得し、キャッシュバスター（タイムスタンプ）を付与します。
   * @param {string} url - 取得先URL
   * @returns {Promise<any>} - パースされたJSONデータ
   */
  async fetchEventData(url) {
    const cacheBusterUrl = `${url}?v=${new Date().getTime()}`;
    const response = await fetch(cacheBusterUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  },

  /**
   * データが指定されたスキーマの必須項目を満たしているかバリデーションします。
   * @param {any|any[]} data - 検証対象のデータ（オブジェクトまたは配列）
   * @param {object} schema - スキーマ定義。例: { required: ['id', 'name'] }
   * @throws {Error} - バリデーションエラー時
   */
  validateData(data, schema) {
    if (!schema || !schema.required) return;

    const validateItem = (item) => {
      for (const field of schema.required) {
        // 空文字やundefined、nullをエラーとする
        if (item[field] === undefined || item[field] === null || item[field] === '') {
          throw new Error(`Validation failed: Missing required field "${field}"`);
        }
      }
    };

    if (Array.isArray(data)) {
      data.forEach(validateItem);
    } else {
      validateItem(data);
    }
  },

  /**
   * タイムテーブルデータを描画用に整形します。
   * - 時間の昇順でソート
   * - 出演者情報を結合
   * - 1ステージ制か複数ステージ制かの判定
   * 
   * @param {Array} timetableData - timetable.jsonのデータ
   * @param {Array} performersData - performers.jsonのデータ
   * @returns {object} - { isSingleStage: boolean, sortedData: Array }
   */
  formatTimetable(timetableData, performersData) {
    const isSingleStage = timetableData.every(item => !item.stage);
    const STAGE_ORDER = ['OWL STAGE', 'STAR STAGE', 'LOFT STREET'];
    const stages = [...new Set(timetableData.map(item => item.stage).filter(Boolean))].sort((a, b) => {
      const indexA = STAGE_ORDER.indexOf(a);
      const indexB = STAGE_ORDER.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });

    const performersMap = new Map();
    if (performersData && Array.isArray(performersData)) {
      performersData.forEach(p => performersMap.set(p.id, p));
    }

    const sortedData = [...timetableData].sort((a, b) => a.time.localeCompare(b.time));

    const timeToMinutes = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };
    
    const minTimeStr = sortedData.length > 0 ? sortedData[0].time : '11:00';
    const baseHour = parseInt(minTimeStr.split(':')[0], 10);
    const baseMinutes = baseHour * 60;
    
    const processedActs = sortedData.map(item => {
      const startMins = timeToMinutes(item.time) - baseMinutes;
      const duration = item.duration || 40;
      return {
        ...item,
        performer: performersMap.get(item.performerId) || null,
        startMins,
        durationMins: duration
      };
    });

    let maxEndMins = 0;
    if (processedActs.length > 0) {
      maxEndMins = Math.max(...processedActs.map(a => a.startMins + a.durationMins));
    }
    const endHour = Math.ceil((baseMinutes + maxEndMins) / 60);
    const totalHours = endHour - baseHour;

    return {
      isSingleStage,
      stages,
      processedActs,
      baseHour,
      totalHours
    };
  },

  /**
   * GA4チケット予約完了カスタムイベントを送信します。
   * @param {Function} gtagFn - gtag関数
   * @param {string} [eventName='inoue_yasuo_burger_fes_2026'] - イベントパラメータ event_name
   * @returns {boolean} - 送信成功可否
   */
  trackReserveTicket(gtagFn, eventName = 'inoue_yasuo_burger_fes_2026') {
    if (typeof gtagFn === 'function') {
      gtagFn('event', 'reserve_ticket', {
        event_name: eventName
      });
      return true;
    }
    return false;
  }
};

// Node.js (Jest) 環境用エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FesLogic;
}

// ブラウザ環境用エクスポート
if (typeof window !== 'undefined') {
  window.FesLogic = FesLogic;
}
