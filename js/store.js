/* =========================================================
 * store.js — 数据持久化（localStorage）
 * 记录结构：
 * { id, ts, type:'quiz'|'game', ...payload }
 * ========================================================= */
(function () {
  'use strict';

  // ⚠️ 迭代红线：KEY 永远不许改，禁止调用 localStorage.clear()，
  // 否则用户历史记录会丢。新增功能一律走新 key。
  const KEY = 'poker_trainer_records_v1';
  const BACKUP_KEY = KEY + '_backup';
  const MAX_RECORDS = 500;

  function readKey(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return null; // 不存在
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : null;
    } catch (e) {
      return null; // 损坏
    }
  }

  function loadAll() {
    const main = readKey(KEY);
    if (main) return main;
    // 主数据缺失或损坏时，从备份自愈
    const backup = readKey(BACKUP_KEY);
    if (backup && backup.length) {
      console.warn('主记录缺失/损坏，已从备份恢复 ' + backup.length + ' 条');
      try { localStorage.setItem(KEY, JSON.stringify(backup)); } catch (e) {}
      return backup;
    }
    return main || [];
  }

  function saveAll(records) {
    try {
      const json = JSON.stringify(records);
      localStorage.setItem(KEY, json);
      try { localStorage.setItem(BACKUP_KEY, json); } catch (e) {}
      return true;
    } catch (e) {
      console.warn('写入历史记录失败', e);
      return false;
    }
  }

  /** 追加一条记录，返回该记录 */
  function add(record) {
    const records = loadAll();
    record.id = 'r' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    record.ts = Date.now();
    records.unshift(record);
    if (records.length > MAX_RECORDS) records.length = MAX_RECORDS; // 超出上限裁掉最旧
    saveAll(records);
    return record;
  }

  /**
   * 查询：{ type?: 'quiz'|'game', from?: ts, to?: ts }
   */
  function query(filter) {
    filter = filter || {};
    return loadAll().filter(r => {
      if (filter.type && r.type !== filter.type) return false;
      if (filter.from && r.ts < filter.from) return false;
      if (filter.to && r.ts > filter.to) return false;
      return true;
    });
  }

  function stats() {
    const all = loadAll();
    const quiz = all.filter(r => r.type === 'quiz');
    const game = all.filter(r => r.type === 'game');
    const draw = all.filter(r => r.type === 'draw');
    const quizAvg = quiz.length
      ? Math.round(quiz.reduce((s, r) => s + (r.avgScore || 0), 0) / quiz.length)
      : null;
    const gameAvg = game.length
      ? Math.round(game.reduce((s, r) => s + (r.score || 0), 0) / game.length)
      : null;
    const drawAvg = draw.length
      ? Math.round(draw.reduce((s, r) => s + (r.avgScore || 0), 0) / draw.length)
      : null;
    const drawBest = draw.length
      ? Math.max(...draw.map(r => r.avgScore || 0))
      : null;
    const range = all.filter(r => r.type === 'range');
    const rangeAvg = range.length
      ? Math.round(range.reduce((s, r) => s + (r.avgScore || 0), 0) / range.length)
      : null;
    const drill = all.filter(r => r.type === 'drill');
    const drillAvg = drill.length
      ? Math.round(drill.reduce((s, r) => s + (r.avgScore || 0), 0) / drill.length)
      : null;
    return { total: all.length, quizCount: quiz.length, gameCount: game.length, quizAvg, gameAvg, drawCount: draw.length, drawAvg, drawBest, rangeCount: range.length, rangeAvg, drillCount: drill.length, drillAvg };
  }

  function clear() { saveAll([]); }

  window.Store = { add, query, loadAll, stats, clear };
})();
