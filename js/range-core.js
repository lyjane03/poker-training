/* =========================================================
 * range-core.js — 范围引擎与标准范围表（公共模块）
 * 供 equity.js（胜率计算器）与 range.js（范围训练）共用
 *
 * 手牌类别 key："AA"（对子）/ "AKs"（同花）/ "AKo"（杂色）
 * 表达式语法：对子 "QQ+" / 同花 "AKs" / 杂色 "AKo" / 无后缀含两类 / 低张起步 "A2s+"
 * ========================================================= */
(function () {
  'use strict';

  const PC = window.PokerCore;

  /* ---------- 表达式 → 类别集合 ---------- */
  function parseRangeClasses(str) {
    const set = new Set();
    if (!str || !str.trim()) return set;
    const rv = r => PC.RANK_VALUE[r];
    const parts = String(str).split(/[,，\s]+/).map(x => x.trim()).filter(Boolean);
    for (const p of parts) {
      const plus = p.endsWith('+');
      const core = plus ? p.slice(0, -1) : p;
      const suited = core.endsWith('s');
      const offsuit = core.endsWith('o');
      const base = (suited || offsuit) ? core.slice(0, -1) : core;
      if (base.length !== 2) continue;
      if (base[0] === base[1]) {
        if (!rv(base[0])) continue;
        const v = rv(base[0]);
        const maxV = plus ? 14 : v;
        for (let x = v; x <= maxV; x++) set.add(PC.RANKS[x - 2] + PC.RANKS[x - 2]);
      } else {
        const hi = rv(base[0]), lo = rv(base[1]);
        if (!hi || !lo || hi <= lo) continue;
        const loMax = plus ? hi - 1 : lo;
        for (let x = lo; x <= loMax; x++) {
          const key = PC.RANKS[hi - 2] + PC.RANKS[x - 2];
          if (suited) set.add(key + 's');
          else if (offsuit) set.add(key + 'o');
          else { set.add(key + 's'); set.add(key + 'o'); }
        }
      }
    }
    return set;
  }

  /* ---------- 类别集合 → 具体组合（对子 6 / 同花 4 / 杂色 12） ---------- */
  function expandClasses(set) {
    const res = [];
    for (const key of set) {
      const r1 = key[0], r2 = key[1];
      if (key.length === 2) {
        for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++)
          res.push([r1 + PC.SUITS[i], r2 + PC.SUITS[j]]);
      } else if (key[2] === 's') {
        for (const s of PC.SUITS) res.push([r1 + s, r2 + s]);
      } else {
        for (const s1 of PC.SUITS) for (const s2 of PC.SUITS)
          if (s1 !== s2) res.push([r1 + s1, r2 + s2]);
      }
    }
    return res;
  }

  /* ---------- 表达式 → 组合列表 ---------- */
  function parseRange(str) {
    const set = parseRangeClasses(str);
    return set.size ? expandClasses(set) : null;
  }

  /* ---------- 类别集合 → 压缩表达式（只压缩贴顶连续段） ---------- */
  function compressRange(set) {
    const R = PC.RANKS; // '2'..'A'
    const parts = [];
    let p = 12;
    while (p >= 0 && set.has(R[p] + R[p])) p--;
    if (p < 12) parts.push(p === 11 ? 'AA' : R[p + 1] + R[p + 1] + '+');
    for (let i = p; i >= 0; i--) if (set.has(R[i] + R[i])) parts.push(R[i] + R[i]);
    for (const suffix of ['s', 'o']) {
      for (let hi = 12; hi >= 1; hi--) {
        const H = R[hi];
        let lo = hi - 1;
        while (lo >= 0 && set.has(H + R[lo] + suffix)) lo--;
        if (lo < hi - 1) {
          const minKey = H + R[lo + 1] + suffix;
          parts.push(lo + 1 === hi - 1 ? minKey : minKey + '+');
        }
        for (let l = lo; l >= 0; l--) {
          if (set.has(H + R[l] + suffix)) parts.push(H + R[l] + suffix);
        }
      }
    }
    return parts.join(',');
  }

  /* ---------- 13×13 矩阵坐标 → 类别 key ---------- */
  // row/col 0 = A，12 = 2。对角线=对子，右上=同花，左下=杂色。
  function matrixKey(row, col) {
    const R = PC.RANKS;
    const a = R[12 - row], b = R[12 - col];
    if (row === col) return a + a;
    if (col > row) return a + b + 's';
    return b + a + 'o';
  }

  /* ---------- 类别集合统计 ---------- */
  function rangeStats(set) {
    const combos = expandClasses(set).length;
    return { classes: set.size, combos, pct: combos / 1326 * 100 };
  }

  /* =========================================================
   * 标准范围表（6-max 现金桌 100BB 参考基线）
   * 每个条目：{ expr, pct, note }
   * ========================================================= */
  const RANGES = {
    // —— 率先开池（Raise First In）——
    'open-UTG': {
      expr: '77+,A9s+,KTs+,QTs+,JTs,T9s,AQo+,KQo',
      note: '枪口位身后 5 人未行动，只玩结构最好的牌：对子、同花高牌、强 Broadway。约 10%。'
    },
    'open-MP': {
      expr: '55+,A8s+,KTs+,QTs+,J9s+,T9s,98s,AJo+,KQo',
      note: '中位可以加入更多同花连张（98s、J9s）和 A8s，约 13%。'
    },
    'open-CO': {
      expr: '22+,A2s+,K9s+,Q9s+,J9s+,T8s+,98s,87s,ATo+,KJo+,QJo',
      note: '关煞位全部对子 + 全部同花 A + 强杂色 Broadway 都可以开池，约 20%。'
    },
    'open-BTN': {
      expr: '22+,A2s+,K2s+,Q2s+,J4s+,T6s+,96s+,86s+,75s+,65s,54s,A2o+,K8o+,Q9o+,J9o+,T9o,98o',
      note: '按钮位只需打赢两个盲注，范围放到最宽：全部同花 A/K、大部分同花连张、任意 A，约 44%。'
    },
    'open-SB': {
      expr: '22+,A2s+,K2s+,Q4s+,J7s+,T7s+,97s+,87s,76s,65s,A2o+,K9o+,Q9o+,J9o+,T9o,98o',
      note: '小盲只有大盲一个对手但翻牌后无位置，采用「加注或弃牌」策略，约 40%。'
    },
    // —— 面对开池的跟注（Call vs open，盲注位为主）——
    'call-BB': {
      expr: '22+,A2s+,K8s+,Q8s+,J8s+,T8s+,98s,87s,76s,A2o+,KTo+,QTo+,JTo,T9o',
      note: '大盲已投入 1BB，跟注价格折扣 + 关闭行动轮，防守范围可以很宽，约 32%。'
    },
    'call-IP': {
      expr: '22,33,44,55,66,77,88,99,A2s+,K9s+,Q9s+,J9s+,T9s,98s,87s,76s,65s,AJo,KQo',
      note: '有位置跟注（如 BTN vs CO 开池）：以对子、同花连张、同花 A 为主的投机范围（TT+/AK 通常 3Bet 而非平跟），约 15%。'
    },
    // —— 3Bet ——
    '3bet-IP': {
      expr: 'TT+,AJs+,KQs,AQo+,A5s,A4s',
      note: '有位置 3Bet 是线性范围：最强牌打价值（TT+/AQ+），混入少量同花 A 诈唬（A5s/A4s 有阻断牌），约 6%。'
    },
    '3bet-BB': {
      expr: '88+,A9s+,KTs+,QTs+,JTs,AQo+,A2s,A3s,A4s,A5s',
      note: '大盲 3Bet 稍宽：无位置需要更强主动性，价值范围下移到 88，诈唬选用带阻断牌的小同花 A，约 9%。'
    },
    // —— 面对 3Bet 的继续范围 ——
    'call3bet': {
      expr: '22,33,44,55,66,77,88,99,TT,JJ,A2s+,KTs+,QTs+,JTs,T9s,98s,AQo',
      note: '跟注 3Bet：中小对子博三条、同花连张博隐含赔率、AQ 看翻牌。QQ+ 和 AK 通常 4Bet 而非跟注，约 10%。'
    }
  };

  /* ---------- 范围表面板用的元数据 ---------- */
  const POSITIONS = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'];
  const ACTIONS = [
    { key: 'open', label: '率先开池', hint: '前面无人入池，你第一个加注' },
    { key: 'call', label: '跟注开池', hint: '面对前位开池选择平跟' },
    { key: '3bet', label: '3Bet 反击', hint: '面对开池再加注' },
    { key: 'call3bet', label: '跟注 3Bet', hint: '开池后被 3Bet，选择平跟' }
  ];

  // 速查：位置 × 行动 → 范围表条目 key（无对应条目返回 null）
  function lookupRange(position, action) {
    const key1 = `${action}-${position}`;
    if (RANGES[key1]) return key1;
    // 行动不区分位置时的兜底
    if (action === 'call') return position === 'BB' ? 'call-BB' : 'call-IP';
    if (action === '3bet') return (position === 'SB' || position === 'BB') ? '3bet-BB' : '3bet-IP';
    if (action === 'call3bet') return 'call3bet';
    return null;
  }

  window.RangeCore = {
    parseRangeClasses, expandClasses, parseRange, compressRange,
    matrixKey, rangeStats,
    RANGES, POSITIONS, ACTIONS, lookupRange
  };
})();
