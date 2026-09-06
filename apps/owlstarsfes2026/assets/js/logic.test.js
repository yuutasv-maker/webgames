const FesLogic = require('./logic');

describe('FesLogic', () => {

  describe('validateData', () => {
    it('必須項目が空文字の場合は例外をスローする', () => {
      const data = [{ id: 'p1', name: '' }];
      const schema = { required: ['id', 'name'] };
      expect(() => FesLogic.validateData(data, schema)).toThrow('Validation failed: Missing required field "name"');
    });

    it('必須項目が欠損している場合は例外をスローする', () => {
      const data = { id: 'info1', date: '2026-11-01' };
      const schema = { required: ['festivalName'] };
      expect(() => FesLogic.validateData(data, schema)).toThrow('Validation failed: Missing required field "festivalName"');
    });

    it('正常なデータの場合はエラーをスローしない', () => {
      const data = [{ id: 'p1', name: 'Artist A' }];
      const schema = { required: ['id', 'name'] };
      expect(() => FesLogic.validateData(data, schema)).not.toThrow();
    });
  });

  describe('formatTimetable', () => {
    const performersData = [
      { id: 'p1', name: 'Artist A' },
      { id: 'p2', name: 'Artist B' }
    ];

    it('時間を昇順にソートし、出演者情報を結合する', () => {
      const timetableData = [
        { time: '13:30', stage: 'Stage B', performerId: 'p2' },
        { time: '13:00', stage: 'Stage A', performerId: 'p1' }
      ];

      const result = FesLogic.formatTimetable(timetableData, performersData);
      
      // formatTimetable の返り値スキーマ拡張（processedActs）に対応
      expect(result.processedActs[0].time).toBe('13:00');
      expect(result.processedActs[0].performer.name).toBe('Artist A');
      
      expect(result.processedActs[1].time).toBe('13:30');
      expect(result.processedActs[1].performer.name).toBe('Artist B');
    });

    it('すべてのステージがnullの場合、1ステージ制と判定する', () => {
      const timetableData = [
        { time: '13:00', stage: null, performerId: 'p1' },
        { time: '14:00', stage: '', performerId: 'p2' }
      ];

      const result = FesLogic.formatTimetable(timetableData, performersData);
      expect(result.isSingleStage).toBe(true);
    });

    it('1つでもステージ名がある場合、複数ステージ制と判定する', () => {
      const timetableData = [
        { time: '13:00', stage: null, performerId: 'p1' },
        { time: '14:00', stage: 'Stage B', performerId: 'p2' }
      ];

      const result = FesLogic.formatTimetable(timetableData, performersData);
      expect(result.isSingleStage).toBe(false);
    });

    it('ステージ順序はOWL STAGEが先頭（左）、LOFT STREETが次（右）になる', () => {
      const timetableData = [
        { time: '12:00', stage: 'LOFT STREET', performerId: 'p2' },
        { time: '13:00', stage: 'OWL STAGE', performerId: 'p1' }
      ];

      const result = FesLogic.formatTimetable(timetableData, performersData);
      expect(result.stages[0]).toBe('OWL STAGE');
      expect(result.stages[1]).toBe('LOFT STREET');
    });
  });

  describe('fetchEventData', () => {
    let globalFetch;

    beforeEach(() => {
      // fetchをモックする
      globalFetch = global.fetch;
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: 'test' }),
        })
      );
    });

    afterEach(() => {
      // モックを元に戻す
      global.fetch = globalFetch;
    });

    it('リクエストURLにキャッシュバスター（?v=...）を付与してfetchする', async () => {
      const url = './data/info.json';
      await FesLogic.fetchEventData(url);
      
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const requestedUrl = global.fetch.mock.calls[0][0];
      
      // URLが元のURLで始まり、?v= とタイムスタンプが含まれていることを確認
      expect(requestedUrl.startsWith(url)).toBe(true);
      expect(requestedUrl).toMatch(/\?v=\d+/);
    });

    it('HTTPエラーの場合に例外をスローする', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404
        })
      );

      await expect(FesLogic.fetchEventData('./data/404.json')).rejects.toThrow('HTTP error! status: 404');
    });
  });
});
