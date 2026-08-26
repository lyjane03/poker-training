/* =========================================================
 * cards.js — 扑克核心引擎：牌组、洗牌、发牌、牌型评估
 * 无依赖，纯原生 JS，通过 window.PokerCore 暴露
 * ========================================================= */
(function () {
  'use strict';

  const SUITS = ['s', 'h', 'd', 'c'];               // 黑桃 红桃 方块 梅花
  const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const SUIT_COLOR = { s: 'black', h: 'red', d: 'red', c: 'black' };
  const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  const RANK_VALUE = {}; // 2..14
  RANKS.forEach((r, i) => { RANK_VALUE[r] = i + 2; });

  const HAND_NAMES = [
    '高牌', '一对', '两对', '三条', '顺子',
    '同花', '葫芦', '四条', '同花顺', '皇家同花顺'
  ];

  /** 生成 52 张牌，牌用 "As"、"Td" 这类字符串表示 */
  function newDeck() {
    const deck = [];
    for (const s of SUITS) for (const r of RANKS) deck.push(r + s);
    return deck;
  }

  /** Fisher-Yates 洗牌（返回新数组） */
  function shuffle(deck) {
    const d = deck.slice();
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  function cardRank(c) { return c[0]; }
  function cardSuit(c) { return c[1]; }
  function cardValue(c) { return RANK_VALUE[c[0]]; }

  /** 把 7 张以内的一组 5 张牌评估为可比较的得分数组 */
  function scoreFive(cards) {
    const vals = cards.map(cardValue).sort((a, b) => b - a);
    const suits = cards.map(cardSuit);
    const flush = suits.every(s => s === suits[0]);

    // 统计点数出现次数
    const count = {};
    vals.forEach(v => { count[v] = (count[v] || 0) + 1; });
    // groups: [[点数, 次数]] 先按次数降序，再按点数降序
    const groups = Object.entries(count)
      .map(([v, n]) => [Number(v), n])
      .sort((a, b) => b[1] - a[1] || b[0] - a[0]);

    // 顺子判定（含 A-2-3-4-5 轮子）
    const uniq = [...new Set(vals)].sort((a, b) => b - a);
    let straightHigh = 0;
    if (uniq.length === 5) {
      if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
      else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) straightHigh = 5; // 轮子
    }

    let category, tiebreak;
    if (flush && straightHigh) {
      category = straightHigh === 14 ? 9 : 8;
      tiebreak = [straightHigh];
    } else if (groups[0][1] === 4) {            // 四条
      category = 7;
      tiebreak = [groups[0][0], groups[1][0]];
    } else if (groups[0][1] === 3 && groups[1][1] === 2) { // 葫芦
      category = 6;
      tiebreak = [groups[0][0], groups[1][0]];
    } else if (flush) {
      category = 5;
      tiebreak = vals;
    } else if (straightHigh) {
      category = 4;
      tiebreak = [straightHigh];
    } else if (groups[0][1] === 3) {            // 三条
      category = 3;
      tiebreak = [groups[0][0], groups[1][0], groups[2][0]];
    } else if (groups[0][1] === 2 && groups[1][1] === 2) { // 两对
      category = 2;
      tiebreak = [groups[0][0], groups[1][0], groups[2][0]];
    } else if (groups[0][1] === 2) {            // 一对
      category = 1;
      tiebreak = [groups[0][0], groups[1][0], groups[2][0], groups[3][0]];
    } else {                                     // 高牌
      category = 0;
      tiebreak = vals;
    }
    return { category, tiebreak };
  }

  /** 比较两个 scoreFive 结果：>0 a 胜，<0 b 胜，0 平局 */
  function compareScore(a, b) {
    if (a.category !== b.category) return a.category - b.category;
    const n = Math.max(a.tiebreak.length, b.tiebreak.length);
    for (let i = 0; i < n; i++) {
      const x = a.tiebreak[i] || 0, y = b.tiebreak[i] || 0;
      if (x !== y) return x - y;
    }
    return 0;
  }

  function combinations(arr, k) {
    const res = [];
    (function rec(start, combo) {
      if (combo.length === k) { res.push(combo.slice()); return; }
      for (let i = start; i <= arr.length - (k - combo.length); i++) {
        combo.push(arr[i]); rec(i + 1, combo); combo.pop();
      }
    })(0, []);
    return res;
  }

  /**
   * 评估最多 7 张牌（2 手牌 + 0~5 公共牌），返回
   * { category, categoryName, tiebreak, bestCards }
   * 公共牌不足 5 张时用已有的牌评估（用于中盘提示）
   */
  function evaluate7(cards) {
    if (cards.length < 5) {
      // 不足 5 张：用全部牌评估（类别可能偏低，仅供提示）
      const s = scoreFive(cards);
      return { ...s, categoryName: HAND_NAMES[s.category], bestCards: cards.slice() };
    }
    let best = null, bestCombo = null;
    for (const combo of combinations(cards, 5)) {
      const s = scoreFive(combo);
      if (!best || compareScore(s, best) > 0) { best = s; bestCombo = combo; }
    }
    return { ...best, categoryName: HAND_NAMES[best.category], bestCards: bestCombo };
  }

  /** 比较两手牌在相同公共牌下的强弱：>0 手牌a胜，<0 b胜，0 平分 */
  function compareHands(holeA, holeB, board) {
    const a = evaluate7(holeA.concat(board));
    const b = evaluate7(holeB.concat(board));
    return compareScore(a, b);
  }

  /** 生成手牌的简写表示，如 "AKs"、"QJo"、"77" */
  function handNotation(hole) {
    const [a, b] = hole.slice().sort((x, y) => cardValue(y) - cardValue(x));
    const r1 = a[0], r2 = b[0];
    if (r1 === r2) return r1 + r2;
    return r1 + r2 + (a[1] === b[1] ? 's' : 'o');
  }

  /** 展示用：{ text:'A♠', color:'black' } */
  function cardDisplay(c) {
    return { text: c[0] + SUIT_SYMBOL[c[1]], color: SUIT_COLOR[c[1]] };
  }

  /** 手牌强度启发式分级：premium / strong / playable / weak（供 AI 与点评使用） */
  function holeTier(hole) {
    const v1 = cardValue(hole[0]), v2 = cardValue(hole[1]);
    const hi = Math.max(v1, v2), lo = Math.min(v1, v2);
    const pair = v1 === v2;
    const suited = hole[0][1] === hole[1][1];
    const gap = hi - lo;
    if (pair && hi >= 12) return 'premium';                    // QQ+
    if (pair && hi >= 9) return 'strong';                      // 99-JJ
    if (hi === 14 && lo >= 12) return 'premium';               // AK
    if (hi === 14 && lo >= 10) return 'strong';                // AQ/AJ/AT
    if (hi >= 13 && lo >= 11) return 'strong';                 // KQ/KJ
    if (pair) return 'playable';                               // 小对子
    if (suited && hi >= 12 && lo >= 9) return 'playable';
    if (suited && hi === 14) return 'playable';                // 同花 A x
    if (suited && gap <= 2 && hi >= 7) return 'playable';      // 同花连张
    if (!suited && gap <= 1 && hi >= 10) return 'playable';    // 连张 JT 之类
    return 'weak';
  }

  /**
   * 计算听牌补牌数（outs）。hole=2 张手牌，board=3~4 张公共牌。
   * 只统计能把当前牌力提升一个档次的补牌（听花/听顺/对子补强），不含两高张抽对这类模糊权益。
   * 返回 { outs, flushOuts, straightOuts, improveOuts, parts }，parts 为各来源的中文说明。
   */
  function countOuts(hole, board) {
    if (!hole || hole.length !== 2 || !board || board.length < 3 || board.length > 4) return null;
    const seen = new Set(hole.concat(board));
    const cur = evaluate7(hole.concat(board)).category;
    const flushSet = new Set(), straightSet = new Set(), improveSet = new Set();

    // 听花：手牌+牌面某花色恰好 4 张
    for (const s of SUITS) {
      if (hole.concat(board).filter(c => cardSuit(c) === s).length === 4) {
        for (const r of RANKS) {
          const c = r + s;
          if (!seen.has(c)) flushSet.add(c);
        }
      }
    }
    // 听顺：任意一张牌加入后牌型变成顺子
    for (const r of RANKS) for (const s of SUITS) {
      const c = r + s;
      if (seen.has(c)) continue;
      if (evaluate7(hole.concat(board, [c])).category === 4 && cur < 4) straightSet.add(c);
    }
    // 对子补强：中三条/两对/葫芦等（须保留手里至少一个对子，避免「牌面成对」虚增补牌）
    const holeRanks = new Set(hole.map(c => c[0]));
    for (const r of RANKS) for (const s of SUITS) {
      const c = r + s;
      if (seen.has(c) || flushSet.has(c) || straightSet.has(c)) continue;
      if (!holeRanks.has(r)) continue;
      if (evaluate7(hole.concat(board, [c])).category > cur) improveSet.add(c);
    }
    // 听牌源集合（教学口径）：纯听花 + 纯听顺。补强补牌作为参考价值返回，不计入 outs。
    const drawSet = new Set([...flushSet, ...straightSet]);

    const parts = [];
    if (flushSet.size) parts.push(`同花听牌 ${flushSet.size} 张`);
    if (straightSet.size) parts.push(`顺子听牌 ${straightSet.size} 张`);
    return {
      outs: drawSet.size,
      flushOuts: flushSet.size,
      straightOuts: straightSet.size,
      improveOuts: improveSet.size,
      parts
    };
  }

  /**
   * 估计当前手牌对随机手牌的胜率（洗牌后蒙特卡洛模拟）。
   * hole=2 张，board=0/3/4/5 张，iterations 越大越准（默认 300 足够训练用途）。
   * 返回 0~1 的胜率（平分按 0.5 计）。
   */
  function realizeEquity(hole, board, iterations) {
    if (!hole || hole.length !== 2) return null;
    board = board || [];
    const iters = iterations || 300;
    const used = new Set(hole.concat(board));
    const rest = newDeck().filter(c => !used.has(c));
    const need = 5 - board.length;
    let win = 0, tie = 0;
    for (let i = 0; i < iters; i++) {
      // 部分洗牌：抽出 villain 2 张 + 补足公共牌
      const pool = rest.slice();
      const pick = () => {
        const j = Math.floor(Math.random() * pool.length);
        return pool.splice(j, 1)[0];
      };
      const vHole = [pick(), pick()];
      const runout = board.slice();
      for (let k = 0; k < need; k++) runout.push(pick());
      const cmp = compareHands(hole, vHole, runout);
      if (cmp > 0) win++;
      else if (cmp === 0) tie++;
    }
    return (win + tie / 2) / iters;
  }

  window.PokerCore = {
    SUITS, SUIT_SYMBOL, RANKS, RANK_VALUE, HAND_NAMES,
    newDeck, shuffle, cardRank, cardSuit, cardValue,
    evaluate7, compareHands, handNotation, cardDisplay, holeTier,
    countOuts, realizeEquity
  };
})();
