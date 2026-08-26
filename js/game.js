/* =========================================================
 * game.js — 自由练习模式（多人桌版）
 * 6-max 实战桌：玩家 + 5 个 AI，庄家逐手轮换，翻牌前/翻牌/转牌/河牌完整下注轮
 * - 位置环：BTN / SB / BB / UTG / MP / CO
 * - 多人底池与边池计算（多人全下时按投入分层）
 * - 每手结束后逐条点评玩家决策，并公开所有摊牌手牌
 * ========================================================= */
(function () {
  'use strict';

  const PC = window.PokerCore;
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const STREETS = ['preflop', 'flop', 'turn', 'river'];
  const STREET_CN = { preflop: '翻牌前', flop: '翻牌圈', turn: '转牌圈', river: '河牌圈' };
  const STYLE_NAME = { standard: '标准均衡', tight: '紧弱', loose: '松凶' };
  const AI_STYLES = ['standard', 'tight', 'loose'];
  const AI_NAMES = ['AI·北', 'AI·东', 'AI·南', 'AI·西', 'AI·中'];

  const SEAT_COUNT = 6;              // 6-max
  const START_STACK = 100;           // 每手重置 100BB
  const SB_AMOUNT = 0.5;
  const BB_AMOUNT = 1;

  let state = null;

  function newState(handsTarget) {
    return {
      handsTarget, handsPlayed: 0,
      results: [],            // 每手结算
      log: [],                // 跨手滚动日志（HTML）
      handOver: true, busy: false
    };
  }

  /* ================= 首页 ================= */
  function renderHome() {
    const s = window.Store.stats();
    $('#game-home').innerHTML = `
      <div class="panel">
        <h2>自由练习模式</h2>
        <p class="sub">6-max 多人实战桌：你与 5 个风格各异的 AI 对战。每手结束后，系统逐条点评你的每个决策并引用对应策略理论；所有摊牌手牌都会公开供复盘学习。筹码以 BB 计，每手重置为 100BB，庄家（按钮）逐手轮换。</p>
        <div class="quiz-stats">
          <span class="stat-chip">已完成对局 ${s.gameCount} 场</span>
          ${s.gameAvg !== null ? `<span class="stat-chip">平均操作评分 ${s.gameAvg}</span>` : ''}
        </div>
        <div class="filters">
          <div class="filter-group">
            <label>本场手数</label>
            <select id="game-hands">
              <option value="3">3 手（快速）</option>
              <option value="5" selected>5 手（标准）</option>
              <option value="10">10 手（深度）</option>
            </select>
          </div>
          <button class="btn primary" id="game-start">开始对局</button>
        </div>
        <div class="lib-tip" style="margin-top:14px">
          <b>💡 多人桌要点</b>
          <p>位置越靠后开池范围越宽；多人底池里边缘牌价值下降，强牌价值上升。留意左侧日志里每个 AI 的风格标签（紧弱/标准/松凶），用剥削打法针对性调整。</p>
        </div>
      </div>`;
    $('#game-start').addEventListener('click', () => {
      startMatch(Number($('#game-hands').value));
    });
  }

  /* ================= 对局控制 ================= */
  function startMatch(hands) {
    state = newState(hands);
    $('#game-home').classList.add('hidden');
    $('#game-table').classList.remove('hidden');
    startHand();
  }

  function startHand() {
    state.handsPlayed++;
    Object.assign(state, {
      deck: PC.shuffle(PC.newDeck()),
      board: [],
      street: 'preflop',
      handLog: [],
      handOver: false, busy: false,
      dealtIdx: null
    });

    // —— 构建 6 人座位 ——
    // seats[0] 恒为玩家（hero），其余为 AI
    const styles = AI_STYLES.slice().sort(() => Math.random() - 0.5);
    state.seats = [];
    for (let i = 0; i < SEAT_COUNT; i++) {
      const isHero = i === 0;
      state.seats.push({
        idx: i,
        name: isHero ? '你' : AI_NAMES[(i - 1) % AI_NAMES.length],
        isHero,
        style: isHero ? null : styles[(i - 1) % styles.length],
        stack: START_STACK,
        invested: 0,        // 本手总投入（用于盈亏与边池）
        bet: 0,             // 本街已下注额
        folded: false,
        allIn: false,
        hole: null,
        lastAction: ''      // 本街上一次动作（展示用）
      });
    }

    // 庄家位置逐手轮换（第 1 手按钮在玩家身上）
    state.dealerIdx = (state.handsPlayed - 1) % SEAT_COUNT;

    // 发牌：从按钮下家开始顺时针发两张
    const order = [];
    for (let k = 1; k <= SEAT_COUNT; k++) order.push((state.dealerIdx + k) % SEAT_COUNT);
    for (let r = 0; r < 2; r++) {
      for (const si of order) state.seats[si].hole = state.seats[si].hole || [];
      for (const si of order) state.seats[si].hole.push(state.deck.pop());
    }

    // —— 盲注 ——
    const sbIdx = nextActiveSeat(state.dealerIdx, true); // 庄家下家（含庄家自己如果只剩2人？6-max不会）
    const bbIdx = nextActiveSeat(sbIdx, true);
    state.sbIdx = sbIdx;
    state.bbIdx = bbIdx;
    postBet(sbIdx, SB_AMOUNT, '小盲');
    postBet(bbIdx, BB_AMOUNT, '大盲');

    // 翻牌前 UTG 先行动（大盲下家）
    state.toAct = nextActiveSeat(bbIdx, true);
    state.optionUsed = false;
    state.lastRaiser = -1;   // 本街最后加注者座位号，用于行动轮闭合判定
    state.lastBetSize = BB_AMOUNT; // 本街当前注额级别

    const heroPos = positionName(0);
    log(`—— 第 ${state.handsPlayed} 手 —— 你在 ${heroPos}，手牌 ${state.seats[0].hole.join(' ')}（${PC.handNotation(state.seats[0].hole)}）`, true);
    render();
    maybeAiAct();
  }

  /* ---------- 座位/位置工具 ---------- */
  function nextActiveSeat(fromIdx, includeFrom) {
    // 从 fromIdx（可选含自身）开始顺时针找第一个未弃牌且未全下的座位
    let i = fromIdx;
    if (!includeFrom) i = (i + 1) % SEAT_COUNT;
    for (let k = 0; k < SEAT_COUNT; k++) {
      const idx = (i + k) % SEAT_COUNT;
      const s = state.seats[idx];
      if (!s.folded && !s.allIn && s.stack > 0) return idx;
    }
    return -1;
  }

  function nextActiveSeatIncludingAllIn(fromIdx, includeFrom) {
    let i = fromIdx;
    if (!includeFrom) i = (i + 1) % SEAT_COUNT;
    for (let k = 0; k < SEAT_COUNT; k++) {
      const idx = (i + k) % SEAT_COUNT;
      const s = state.seats[idx];
      if (!s.folded) return idx;
    }
    return -1;
  }

  function activePlayers() {
    return state.seats.filter(s => !s.folded);
  }

  function actionablePlayers() {
    return state.seats.filter(s => !s.folded && !s.allIn && s.stack > 0);
  }

  // 位置名称（相对按钮）
  function positionName(seatIdx) {
    const rel = (seatIdx - state.dealerIdx + SEAT_COUNT) % SEAT_COUNT;
    const names = ['BTN（按钮）', 'SB（小盲）', 'BB（大盲）', 'UTG（枪口）', 'MP（中位）', 'CO（关煞）'];
    return names[rel] || `座位${rel}`;
  }

  function shortPos(seatIdx) {
    const rel = (seatIdx - state.dealerIdx + SEAT_COUNT) % SEAT_COUNT;
    return ['BTN', 'SB', 'BB', 'UTG', 'MP', 'CO'][rel] || `S${rel}`;
  }

  /* ---------- 下注/记分 ---------- */
  function postBet(idx, amount, label) {
    const s = state.seats[idx];
    const pay = Math.min(amount, s.stack);
    s.stack -= pay;
    s.invested += pay;
    s.bet += pay;
    if (pay > 0 && s.stack === 0) s.allIn = true;
    if (label) s.lastAction = label;
    return pay;
  }

  function currentMaxBet() {
    return Math.max(...state.seats.map(s => s.bet));
  }

  function toCallOf(idx) {
    return Math.max(0, currentMaxBet() - state.seats[idx].bet);
  }

  function log(msg, hl) {
    state.log.push(hl ? `<div class="hl">${esc(msg)}</div>` : `<div>${esc(msg)}</div>`);
    state.handLog.push(msg);
  }

  function logMeta(msg, hl) {
    state.log.push(hl ? `<div class="hl">${esc(msg)}</div>` : `<div>${esc(msg)}</div>`);
  }

  /* ================= 行动 ================= */
  function doAction(idx, type, amount) {
    const s = state.seats[idx];
    const toCall = toCallOf(idx);
    const name = s.isHero ? '你' : s.name;
    const pos = shortPos(idx);

    if (type === 'fold') {
      s.folded = true;
      s.lastAction = '弃牌';
      log(`${name}（${pos}）弃牌`);
    } else if (type === 'check') {
      s.lastAction = '过牌';
      log(`${name}（${pos}）过牌`);
    } else if (type === 'call') {
      const pay = postBet(idx, toCall);
      s.lastAction = `跟注 ${fmt(pay)}`;
      log(`${name}（${pos}）跟注 ${fmt(pay)}BB${s.allIn ? '（全下）' : ''}`);
    } else if (type === 'raise') {
      // amount = 本街追加投入总额（含跟注部分）
      const pay = postBet(idx, amount);
      state.lastRaiser = idx;
      state.lastBetSize = s.bet;
      s.lastAction = `${state.street === 'preflop' ? '加注到' : '下注'} ${fmt(s.bet)}`;
      log(`${name}（${pos}）${state.street === 'preflop' ? '加注到' : '下注'} ${fmt(s.bet)}BB${s.allIn ? '（全下）' : ''}`);
    }

    if (s.isHero) recordHeroAction(type, amount);

    // —— 行动轮闭合判定 ——
    if (activePlayers().length === 1) { settle(); return; }
    if (actionablePlayers().length <= 1) { advanceStreet(); return; } // 只剩 0~1 个可行动者，直接发牌/结算

    let advance = false;
    if (type === 'fold') {
      // 若全场只剩 1 个未弃牌者，settle 已处理；否则继续
      advance = false;
    } else if (type === 'call') {
      // 多人池里跟注不一定闭合行动轮：只有「跟平最后加注」且行动权回到最后加注者时才闭合
      advance = (state.lastRaiser === -1 || idx === state.lastRaiser);
      if (!advance) {
        // 检查是否除最后加注者外其他人都已行动
        const next = nextActiveSeat(idx, false);
        if (next === state.lastRaiser) advance = true;
      }
    } else if (type === 'check') {
      // 翻牌前大盲 option
      if (state.street === 'preflop' && !state.optionUsed && idx === state.bbIdx && currentMaxBet() === BB_AMOUNT) {
        state.optionUsed = true;
        advance = true;
      } else if (state.street !== 'preflop' && state.lastRaiser === -1) {
        // 翻牌后无人下注，连续过牌一圈即闭合
        const prevRaiser = state.lastRaiser;
        state.lastRaiser = idx; // 借用 lastRaiser 记录本轮起始者
        if (prevRaiser !== -1) advance = true;
      } else if (state.street !== 'preflop' && state.lastRaiser === idx) {
        advance = true;
      }
    }
    // raise：advance 保持 false，行动权交给下家

    state.toAct = nextActiveSeat(idx, false);

    if (advance) { advanceStreet(); return; }
    render();
    maybeAiAct();
  }

  function advanceStreet() {
    // 重置本街状态
    state.seats.forEach(s => { s.bet = 0; s.lastAction = ''; });
    state.lastRaiser = -1;
    state.optionUsed = true; // 翻牌后无 option 概念

    const i = STREETS.indexOf(state.street);
    if (i >= 3) { settle(); return; }
    state.street = STREETS[i + 1];

    // 发公共牌
    const n = state.street === 'flop' ? 3 : 1;
    state.dealtIdx = [];
    for (let k = 0; k < n; k++) {
      state.board.push(state.deck.pop());
      state.dealtIdx.push(state.board.length - 1);
    }
    log(`【${STREET_CN[state.street]}】公共牌：${state.board.join(' ')}`);

    // 翻牌后从庄家下家（小盲位）开始第一个未弃牌者行动
    state.toAct = nextActiveSeat(state.dealerIdx, false);

    // 若无可行动者（所有人都全下），直接连续发牌到河牌
    if (actionablePlayers().length === 0) { advanceStreet(); return; }

    render();
    maybeAiAct();
  }

  /* ================= AI 决策 ================= */
  function maybeAiAct() {
    if (!state || state.handOver) return;
    const seat = state.seats[state.toAct];
    if (!seat || seat.isHero || seat.folded || seat.allIn) return;
    state.busy = true;
    render();
    setTimeout(() => {
      if (!state || state.handOver) return;
      state.busy = false;
      const [type, amount] = aiDecide(state.toAct);
      doAction(state.toAct, type, amount);
    }, 550);
  }

  function aiDecide(idx) {
    const s = state.seats[idx];
    const toCall = toCallOf(idx);
    const style = s.style;
    const tier = PC.holeTier(s.hole);
    const made = state.board.length >= 3
      ? PC.evaluate7(s.hole.concat(state.board)).category : -1;
    const aggro = style === 'loose' ? 1.5 : style === 'tight' ? 0.7 : 1;
    const sticky = style === 'tight' ? 0.7 : style === 'loose' ? 1.4 : 1;
    const pot = state.seats.reduce((sum, x) => sum + x.invested, 0);

    // 位置松紧调整：后位可放宽，盲位更紧
    const rel = (idx - state.dealerIdx + SEAT_COUNT) % SEAT_COUNT;
    const posFactor = rel === 0 ? 1.2 : rel <= 2 ? 0.8 : rel >= 4 ? 1.05 : 1; // BTN 宽 / 盲位紧 / CO-MP 稍宽

    if (state.street === 'preflop') {
      if (toCall <= 0) { // 大盲 option 或翻牌后
        if (tier === 'premium' && Math.random() < 0.85 * aggro) return ['raise', 2.5];
        if (tier === 'strong' && Math.random() < 0.45 * aggro) return ['raise', 2.5];
        return ['check'];
      }
      if (tier === 'premium') return ['raise', Math.min(toCall * 3 + 2, s.stack)];
      if (tier === 'strong') return Math.random() < 0.6 ? ['call'] : ['raise', Math.min(toCall * 3, s.stack)];
      if (tier === 'playable') {
        if (toCall <= 4 * sticky * posFactor) return ['call'];
        return Math.random() < 0.25 * sticky * posFactor ? ['call'] : ['fold'];
      }
      // weak
      if (toCall <= 1.5 * sticky && Math.random() < 0.3 * sticky * posFactor) return ['call'];
      if (Math.random() < 0.06 * aggro * posFactor) return ['raise', Math.min(toCall * 3, s.stack)];
      return ['fold'];
    }

    // —— 翻牌后 ——
    if (toCall <= 0) {
      if (made >= 2 || (made === 1 && Math.random() < 0.6 * aggro)) {
        return ['raise', Math.min(Math.max(2, Math.round(pot * 0.55)), s.stack)];
      }
      if (made === 0 && Math.random() < 0.2 * aggro) {
        return ['raise', Math.min(Math.max(2, Math.round(pot * 0.45)), s.stack)];
      }
      return ['check'];
    }
    const potOdds = toCall / (pot + toCall);
    if (made >= 3) {
      return Math.random() < 0.6 * aggro
        ? ['raise', Math.min(toCall + Math.max(2, Math.round(pot * 0.7)), s.stack)]
        : ['call'];
    }
    if (made === 2) return ['call'];
    if (made === 1) {
      if (potOdds < 0.35 * sticky) return ['call'];
      return Math.random() < 0.5 * sticky ? ['call'] : ['fold'];
    }
    return Math.random() < 0.2 * sticky && potOdds < 0.25 ? ['call'] : ['fold'];
  }

  /* ================= 结算（含边池） ================= */
  function settle() {
    state.handOver = true;

    // —— 构建边池 ——
    // sidePots: [{ amount, eligible: Set<seatIdx> }]
    const contenders = state.seats.filter(s => !s.folded);
    const sidePots = [];
    let remaining = state.seats.map(s => s.invested);
    while (true) {
      const active = state.seats.filter((s, i) => !s.folded && remaining[i] > 0);
      if (!active.length) break;
      const minInvest = Math.min(...active.map((s, i) => remaining[state.seats.indexOf(s)]));
      const layer = { amount: 0, eligible: new Set() };
      state.seats.forEach((s, i) => {
        if (!s.folded && remaining[i] > 0) {
          const take = Math.min(minInvest, remaining[i]);
          layer.amount += take;
          remaining[i] -= take;
          layer.eligible.add(i);
        }
      });
      sidePots.push(layer);
    }

    // —— 分配底池 ——
    const awards = new Map(); // seatIdx -> 赢得金额
    const handRanks = new Map(); // seatIdx -> evaluate7 结果（用于展示）
    contenders.forEach(s => {
      if (state.board.length >= 3) {
        handRanks.set(s.idx, PC.evaluate7(s.hole.concat(state.board)));
      }
    });

    let resultParts = [];
    for (const pot of sidePots) {
      const eligible = [...pot.eligible].map(i => state.seats[i]);
      if (eligible.length === 1) {
        // 只有一人 eligible（其他人都弃牌或投入更少），直接赢得
        awards.set(eligible[0].idx, (awards.get(eligible[0].idx) || 0) + pot.amount);
        continue;
      }
      // 比大小
      let bestScore = null, winners = [];
      for (const s of eligible) {
        const ev = PC.evaluate7(s.hole.concat(state.board));
        handRanks.set(s.idx, ev);
        const score = [ev.category, ...ev.tiebreak];
        if (!bestScore || compareScoreArr(score, bestScore) > 0) {
          bestScore = score; winners = [s.idx];
        } else if (compareScoreArr(score, bestScore) === 0) {
          winners.push(s.idx);
        }
      }
      const share = pot.amount / winners.length;
      winners.forEach(i => awards.set(i, (awards.get(i) || 0) + share));
      const names = winners.map(i => state.seats[i].isHero ? '你' : state.seats[i].name).join('、');
      const hr = handRanks.get(winners[0]);
      resultParts.push(`${names} 以 ${hr ? hr.categoryName : '—'} 赢得 ${fmt(pot.amount)}BB`);
    }

    // 发还筹码
    state.seats.forEach((s, i) => {
      const win = awards.get(i) || 0;
      s.stack += win;
    });

    const hero = state.seats[0];
    const heroDelta = (awards.get(0) || 0) - hero.invested;
    const heroWon = (awards.get(0) || 0) > 0;
    const showdown = activePlayers().length >= 2;

    let resultText;
    if (hero.folded) {
      const winner = [...awards.entries()].sort((a, b) => b[1] - a[1])[0];
      const wName = winner ? (state.seats[winner[0]].isHero ? '你' : state.seats[winner[0]].name) : '—';
      resultText = `你弃牌，${wName} 赢得底池`;
    } else if (heroWon) {
      resultText = resultParts.join('；');
    } else {
      resultText = resultParts.join('；');
    }

    const settleMsg = `🏁 ${resultText}（本手盈亏 ${heroDelta >= 0 ? '+' : ''}${fmt(heroDelta)}BB）`;
    logMeta(settleMsg, true);
    state.handLog.push(settleMsg);

    // 公开所有未弃牌手牌
    state.reveal = {};
    state.seats.forEach((s, i) => {
      if (!s.folded && s.hole) {
        state.reveal[i] = {
          hole: s.hole.slice(),
          notation: PC.handNotation(s.hole),
          categoryName: handRanks.get(i) ? handRanks.get(i).categoryName : null
        };
      }
    });

    finishHand(resultText, heroDelta);
  }

  function compareScoreArr(a, b) {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const x = a[i] || 0, y = b[i] || 0;
      if (x !== y) return x - y;
    }
    return 0;
  }

  /* ================= 玩家决策点评 ================= */
  function recordHeroAction(type, amount) {
    state.heroActions = state.heroActions || [];
    state.heroActions.push({
      street: state.street,
      board: state.board.slice(),
      type, amount,
      toCall: toCallOf(0),
      pot: state.seats.reduce((sum, s) => sum + s.invested, 0)
    });
  }

  function reviewAction(a) {
    const hero = state.seats[0];
    const tier = PC.holeTier(hero.hole);
    const heroPos = positionName(0);
    const notation = PC.handNotation(hero.hole);
    const inPosition = (0 - state.dealerIdx + SEAT_COUNT) % SEAT_COUNT === 0; // 按钮

    if (a.street === 'preflop') {
      if (a.type === 'fold') {
        if (tier === 'weak') return { grade: 'good', title: '翻牌前弃掉弱牌', body: `${notation} 属于低质量起手牌，纪律性弃牌正确。`, theory: { name: '起手牌选择：翻牌前纪律是新手盈利的第一来源', cat: 'starting' } };
        if (tier === 'playable') return { grade: 'mixed', title: '弃掉可玩牌', body: `${notation} 有一定可玩性，合适价格下可以游戏；弃牌偏保守但不算大错。`, theory: { name: '起手牌选择：可玩牌需结合位置与价格决策', cat: 'starting' } };
        return { grade: 'bad', title: '弃掉强起手牌', body: `${notation} 是强牌，翻牌前弃牌放弃了大量正期望。`, theory: { name: '起手牌选择：强牌必须主动游戏', cat: 'starting' } };
      }
      if (a.type === 'call') {
        if (tier === 'premium' || tier === 'strong') return { grade: 'mixed', title: '强牌仅跟注', body: `${notation} 通常应该加注建立底池并掌握主动权，平跟会稀释权益、被动挨打。`, theory: { name: '翻牌前策略：强牌加注，慎防慢打陷阱', cat: 'starting' } };
        if (tier === 'playable') return { grade: 'good', title: '合理价格跟注可玩牌', body: `${notation} 以可接受成本看翻牌，隐含赔率合适（${heroPos}）。`, theory: { name: '隐含赔率与 Set Mining / 投机牌原理', cat: 'gto' } };
        return { grade: 'bad', title: '弱牌跟注', body: `${notation} 质量过低，跟注等于长期送筹码——这是典型的「跟注站」漏洞。`, theory: { name: '起手牌选择：弱牌跟注长期必亏', cat: 'starting' } };
      }
      if (a.type === 'raise') {
        if (tier === 'premium') return { grade: 'good', title: '强牌加注', body: `${notation} 加注是标准打法：建立底池、收窄范围、获取主动权。`, theory: { name: '翻牌前策略：价值加注', cat: 'starting' } };
        if (tier === 'strong' || tier === 'playable') return { grade: 'good', title: '合理加注', body: `${notation} 在${heroPos}加注可接受，兼具价值与偷盲权益。`, theory: { name: '位置策略：后位可加宽加注范围', cat: 'position' } };
        return { grade: 'mixed', title: '弱牌加注（诈唬线）', body: `${notation} 加注属于诈唬，多人桌中频率应更低，遭遇反击应果断放弃。`, theory: { name: 'GTO 基础：诈唬需要频率控制与阻断牌意识', cat: 'gto' } };
      }
      if (a.type === 'check') {
        return { grade: 'good', title: '免费过牌', body: '已投入盲注，零成本看翻牌总是正确。', theory: { name: '权益实现：免费牌原则', cat: 'gto' } };
      }
    }

    // —— 翻牌后 ——
    const made = PC.evaluate7(hero.hole.concat(a.board));
    const cat = made.category;
    const strongMade = cat >= 2, onePair = cat === 1, air = cat === 0;

    if (a.type === 'fold') {
      if (strongMade) return { grade: 'bad', title: '弃掉强成牌', body: `${made.categoryName} 在该牌面很强，面对下注弃牌放弃了大量权益。`, theory: { name: 'MDF（最小防守频率）：强牌面对任何尺度都应继续', cat: 'gto' } };
      if (onePair) return { grade: 'mixed', title: '弃掉对子', body: '一对面对大尺度可以弃牌；但对中小尺度弃牌频率过高，会被持续下注系统性剥削。', theory: { name: 'MDF：不能让对手用任意两张牌获利', cat: 'gto' } };
      return { grade: 'good', title: '放弃空气牌', body: '无成牌无听牌，弃牌节省筹码。', theory: { name: '权益实现：无权益不投入', cat: 'gto' } };
    }
    if (a.type === 'call') {
      if (strongMade) return { grade: 'good', title: '强牌跟注', body: `${made.categoryName} 跟注合理；若对手是跟注站风格，也可考虑加注榨取更大价值。`, theory: { name: '价值最大化：对跟注站用强牌加大尺度', cat: 'exploit' } };
      if (onePair) return { grade: 'good', title: '对子防守跟注', body: '在合理尺度下用对子防守，符合最小防守频率要求。', theory: { name: 'MDF 与底池赔率', cat: 'gto' } };
      return { grade: 'mixed', title: '无牌跟注', body: '无对无听跟注需要明确的隐含赔率或后续诈唬计划支撑，否则长期亏损。', theory: { name: '底池赔率：跟注所需胜率 = 跟注额 ÷（底池 + 跟注额）', cat: 'gto' } };
    }
    if (a.type === 'raise') {
      if (strongMade) return { grade: 'good', title: '强牌主动下注/加注', body: `${made.categoryName} 主动施压正确：拿价值 + 保护权益 + 让听牌付出错误价格。`, theory: { name: '价值下注：用强牌建立底池', cat: 'sizing' } };
      if (onePair) return { grade: 'mixed', title: '中等牌力下注', body: '下注前先自问：有更差的牌会跟吗？打不走更好的牌时，下注只是烧钱——过牌控制底池往往更好。', theory: { name: '底池控制（Pot Control）：中等牌力保持小底池', cat: 'position' } };
      return { grade: 'mixed', title: '诈唬下注', body: '纯诈唬需评估：对手弃牌率是否高于盈亏平衡线？自己有没有阻断牌？偶发可行，切勿养成习惯。', theory: { name: '诈唬盈亏平衡：半池注需对手 33% 弃牌率', cat: 'sizing' } };
    }
    if (a.type === 'check') {
      if (strongMade) return { grade: 'mixed', title: '强牌过牌', body: `${made.categoryName} 过牌可作为诱捕（对激进对手有效），但对被动对手会损失一条街的价值。`, theory: { name: '剥削打法：诱捕仅对会主动下注的对手有效', cat: 'exploit' } };
      if (onePair) return { grade: 'good', title: '中等牌过牌控池', body: '中等牌力过牌控制底池、保留摊牌价值，是稳健选择。', theory: { name: '底池控制', cat: 'position' } };
      return { grade: 'good', title: '弱牌过牌', body: '无成牌时过牌看免费牌，合理。', theory: { name: '免费牌原则', cat: 'gto' } };
    }
    return { grade: 'mixed', title: '行动记录', body: '', theory: null };
  }

  /* ================= 手/场 结束 ================= */
  function finishHand(resultText, heroDelta) {
    const reviews = (state.heroActions || []).map(a => ({ ...reviewAction(a), action: a }));
    const scoreMap = { good: 100, mixed: 60, bad: 20 };
    const score = reviews.length
      ? Math.round(reviews.reduce((s, r) => s + scoreMap[r.grade], 0) / reviews.length)
      : 100;

    const hero = state.seats[0];
    state.results.push({
      handNo: state.handsPlayed,
      result: resultText,
      heroDelta: Math.round(heroDelta * 10) / 10,
      heroHand: PC.handNotation(hero.hole),
      board: state.board.join(' '),
      heroPos: positionName(0),
      players: state.seats.map(s => ({
        name: s.isHero ? '你' : s.name,
        style: s.style ? STYLE_NAME[s.style] : null,
        folded: s.folded,
        notation: state.reveal[s.idx] ? state.reveal[s.idx].notation : null,
        categoryName: state.reveal[s.idx] ? state.reveal[s.idx].categoryName : null
      })),
      reviews, score,
      handLog: state.handLog.slice()
    });
    renderShowdown(resultText, heroDelta, reviews, score);
  }

  function finishMatch() {
    const avgScore = Math.round(state.results.reduce((s, r) => s + r.score, 0) / state.results.length);
    const totalDelta = Math.round(state.results.reduce((s, r) => s + r.heroDelta, 0) * 10) / 10;
    const all = state.results.flatMap(r => r.reviews);
    const goodN = all.filter(r => r.grade === 'good').length;
    const badN = all.filter(r => r.grade === 'bad').length;

    window.Store.add({
      type: 'game',
      title: `6-max 实战 ${state.handsTarget} 手`,
      score: avgScore,
      hands: state.results.length,
      totalDelta, goodActions: goodN, badActions: badN,
      details: state.results
    });

    $('#game-table').innerHTML = `
      <div class="panel" style="text-align:center">
        <h2>本场对局结束</h2>
        <p style="font-size:44px;font-weight:800;color:var(--green-dark);margin:14px 0 4px">${avgScore}</p>
        <p style="color:var(--text-dim)">操作平均评分 · 总盈亏 ${totalDelta >= 0 ? '+' : ''}${fmt(totalDelta)}BB · 优秀操作 ${goodN} 次 / 明显失误 ${badN} 次</p>
        <p style="font-size:13px;color:var(--text-dim);margin-top:6px">${badN > goodN ? '提示：失误偏多，建议先去题库训练巩固对应主题。' : '决策质量不错，可尝试增加手数挑战更长 session。'}</p>
        <div style="margin-top:20px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button class="btn primary" id="gm-again">再来一场</button>
          <button class="btn" id="gm-home">返回设置</button>
          <button class="btn" id="gm-history">查看复盘记录</button>
        </div>
      </div>`;
    $('#gm-again').addEventListener('click', () => startMatch(state.handsTarget));
    $('#gm-home').addEventListener('click', exitMatch);
    $('#gm-history').addEventListener('click', () => { exitMatch(); window.App.switchView('history'); });
  }

  function exitMatch() {
    $('#game-table').classList.add('hidden');
    $('#game-home').classList.remove('hidden');
    renderHome();
  }

  /* ================= 渲染 ================= */
  function cardHtml(c, dealt) {
    const d = PC.cardDisplay(c);
    return `<span class="pcard ${d.color}${dealt ? ' dealt' : ''}"><span class="rank">${d.text[0]}</span><span class="suit">${d.text.slice(1)}</span></span>`;
  }
  function backCard() {
    return `<span class="pcard back"><span class="rank">?</span></span>`;
  }
  function fmt(n) { return Number.isInteger(n) ? String(n) : n.toFixed(1); }

  function potTotal() {
    return state.seats.reduce((sum, s) => sum + s.invested, 0);
  }

  // 翻牌后给玩家的决策辅助
  function oddsHint() {
    if (state.board.length < 3) return '';
    const toCall = toCallOf(0);
    if (toCall <= 0) return '';
    const pot = potTotal();
    const need = toCall / (pot + toCall);
    const outs = PC.countOuts(state.seats[0].hole, state.board);
    const outsTxt = outs && outs.outs > 0
      ? ` · 你的听牌补牌约 ${outs.outs} 张（${outs.parts.join('，')}）`
      : '';
    return `<div class="odds-hint">💡 底池赔率：跟注 ${fmt(toCall)}BB 赢 ${fmt(pot + toCall)}BB，所需胜率约 ${Math.round(need * 100)}%${outsTxt}</div>`;
  }

  function seatCardHtml(s) {
    if (!s.hole) return '';
    if (s.folded) return `<span style="opacity:.5;font-size:12px">已弃牌</span>`;
    if (s.isHero || state.handOver) {
      const made = state.board.length >= 3 ? PC.evaluate7(s.hole.concat(state.board)).categoryName : '';
      return `${s.hole.map(c => cardHtml(c)).join('')}
        <span style="font-size:12px;opacity:.9;margin-left:6px">${PC.handNotation(s.hole)}${made && state.handOver ? ' · ' + made : ''}</span>`;
    }
    return backCard() + backCard();
  }

  function render() {
    if (!state || state.handOver) return;
    const hero = state.seats[0];
    const toCall = toCallOf(0);
    const myTurn = state.toAct === 0 && !state.busy && !hero.folded && !hero.allIn;
    const pot = potTotal();
    const dealt = state.dealtIdx || [];
    state.dealtIdx = null;

    // 座位排序：从按钮开始顺时针展示
    const seatOrder = [];
    for (let k = 0; k < SEAT_COUNT; k++) seatOrder.push((state.dealerIdx + k) % SEAT_COUNT);

    $('#game-table').innerHTML = `
      <div class="table-wrap">
        <div class="table-info">
          <span>第 ${state.handsPlayed}/${state.handsTarget} 手 · ${STREET_CN[state.street]}</span>
          <span class="pot">底池 ${fmt(pot)} BB</span>
          <span>你在 ${positionName(0)}</span>
        </div>
        <div class="board-area">
          <div class="street-label">公共牌${state.street !== 'preflop' ? ' · ' + STREET_CN[state.street] : ''}</div>
          <div class="pcards">${state.board.length
            ? state.board.map((c, i) => cardHtml(c, dealt.includes(i))).join('')
            : '<span style="opacity:.6;font-size:13px">尚未发出</span>'}</div>
        </div>
        <div class="seats-grid">
          ${seatOrder.map(idx => {
            const s = state.seats[idx];
            const isToAct = idx === state.toAct && !state.handOver;
            return `
            <div class="seat ${s.isHero ? 'hero' : ''} ${s.folded ? 'folded' : ''} ${isToAct ? 'to-act' : ''}">
              <div class="who">
                <span class="name">${s.isHero ? '🧑 ' : '🤖 '}${esc(s.name)}${s.style ? ` · ${STYLE_NAME[s.style]}` : ''}</span>
                <span class="chips">${fmt(s.stack)} BB${s.allIn ? ' · 全下' : ''}</span>
              </div>
              <div class="seat-pos">${shortPos(idx)}${s.bet > 0 ? ` · 注 ${fmt(s.bet)}` : ''}${s.lastAction ? ` · ${esc(s.lastAction)}` : ''}</div>
              <div class="pcards" style="margin-top:6px">${seatCardHtml(s)}</div>
            </div>`;
          }).join('')}
        </div>
        ${myTurn ? oddsHint() : ''}
        <div class="action-bar">
          ${myTurn ? `
            ${toCall > 0
              ? `<button class="btn primary" data-act="call">跟注 ${fmt(toCall)}BB</button>
                 <button class="btn" data-act="raise">加注</button>
                 <button class="btn danger" data-act="fold">弃牌</button>`
              : `<button class="btn primary" data-act="check">过牌</button>
                 <button class="btn" data-act="raise">下注</button>`}
            <div class="raise-panel">
              <div class="size-chips">
                <button class="chip" data-size="0.5">½ 池</button>
                <button class="chip" data-size="0.66">⅔ 池</button>
                <button class="chip" data-size="1">满池</button>
                <button class="chip" data-size="1.5">1.5 倍池</button>
              </div>
              <span class="raise-box">
                追加投入 <input type="number" id="raise-amt" step="0.5" min="1"
                  value="${suggestRaise()}"> BB
              </span>
            </div>`
          : `<span style="font-size:13px;opacity:.85">${state.busy ? `${esc(state.seats[state.toAct]?.name || '')} 思考中…` : hero.folded ? '你已弃牌，等待本手结束…' : '等待行动…'}</span>`}
        </div>
      </div>
      <div class="log-box">${state.log.slice(-40).join('')}</div>`;

    if (myTurn) {
      document.querySelectorAll('.size-chips .chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const pot = potTotal();
          const need = toCallOf(0);
          const amt = Math.max(need + Math.round(pot * Number(btn.dataset.size)), need + 1);
          $('#raise-amt').value = fmt(amt);
        });
      });
      document.querySelectorAll('.action-bar [data-act]').forEach(btn => {
        btn.addEventListener('click', () => {
          const act = btn.dataset.act;
          if (act === 'raise') {
            const amt = Number($('#raise-amt').value);
            if (!amt || amt <= 0) { alert('请输入有效的下注/加注额度。'); return; }
            if (toCallOf(0) > 0 && amt <= toCallOf(0)) { alert('加注的追加投入必须大于当前跟注额。'); return; }
            if (amt > hero.stack) { alert('追加投入不能超过你的后手筹码。'); return; }
            doAction(0, 'raise', amt);
          } else {
            doAction(0, act);
          }
        });
      });
    }
  }

  function suggestRaise() {
    const toCall = toCallOf(0);
    const pot = potTotal();
    if (state.street === 'preflop') return toCall > 0 ? Math.max(toCall * 3, toCall + 2) : 2.5;
    return Math.max(toCall + Math.round(pot * 0.6), Math.round(pot * 0.6) || 2);
  }

  function renderShowdown(resultText, heroDelta, reviews, score) {
    const gradeCls = { good: 'good', mixed: 'mixed', bad: 'bad' };
    const gradeTxt = { good: '✅ 好', mixed: '🟡 一般', bad: '❌ 失误' };
    const lastHand = state.handsPlayed >= state.handsTarget;
    const hero = state.seats[0];

    // 座位排序：从按钮开始
    const seatOrder = [];
    for (let k = 0; k < SEAT_COUNT; k++) seatOrder.push((state.dealerIdx + k) % SEAT_COUNT);

    $('#game-table').innerHTML = `
      <div class="table-wrap">
        <div class="table-info">
          <span>第 ${state.handsPlayed}/${state.handsTarget} 手 · 已结束</span>
          <span class="pot">${esc(resultText)}</span>
          <span>本手盈亏 ${heroDelta >= 0 ? '+' : ''}${fmt(heroDelta)} BB</span>
        </div>
        <div class="board-area">
          <div class="street-label">公共牌</div>
          <div class="pcards">${state.board.length ? state.board.map(c => cardHtml(c)).join('') : '—（未发出）'}</div>
        </div>
        <div class="seats-grid">
          ${seatOrder.map(idx => {
            const s = state.seats[idx];
            const reveal = state.reveal[idx];
            return `
            <div class="seat ${s.isHero ? 'hero' : ''} ${s.folded ? 'folded' : ''}">
              <div class="who">
                <span class="name">${s.isHero ? '🧑 ' : '🤖 '}${esc(s.name)}${s.style ? ` · ${STYLE_NAME[s.style]}` : ''}</span>
                <span class="chips">${shortPos(idx)}</span>
              </div>
              <div class="pcards" style="margin-top:6px">
                ${s.folded
                  ? `<span style="opacity:.5;font-size:12px">已弃牌</span>`
                  : reveal
                    ? `${reveal.hole.map(c => cardHtml(c)).join('')}
                       <span style="font-size:12px;opacity:.9;margin-left:6px">${reveal.notation}${reveal.categoryName ? ' · ' + reveal.categoryName : ''}</span>`
                    : ''}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="panel">
        <h2>本手操作点评（得分 ${score}/100）</h2>
        <p class="sub">逐条回顾你在本手的每个决策 · 你在 ${positionName(0)}</p>
        ${reviews.length ? reviews.map(r => `
          <div class="review-item ${gradeCls[r.grade]}">
            <div class="r-head">${gradeTxt[r.grade]} · ${STREET_CN[r.action.street]} · ${esc(r.title)}</div>
            <div class="r-body">你的操作：<b>${actLabel(r.action)}</b>　${esc(r.body)}</div>
            ${r.theory ? `<div class="r-theory">📖 理论：${esc(r.theory.name)}
              <button class="btn lib-link" data-lib="${r.theory.cat}">去读章节</button></div>` : ''}
          </div>`).join('')
        : '<div class="empty">本手你没有做出主动决策（提前弃牌或全下）。</div>'}
        <div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end">
          <button class="btn" id="hand-log-toggle">查看完整行动日志</button>
          <button class="btn primary" id="hand-next">${lastHand ? '查看本场总结' : '下一手'}</button>
        </div>
        <div class="log-box hidden" id="hand-log" style="margin-top:12px">${state.handLog.map(l => `<div>${esc(l)}</div>`).join('')}</div>
      </div>`;

    document.querySelectorAll('#game-table .lib-link').forEach(btn =>
      btn.addEventListener('click', () => window.Library.open(btn.dataset.lib)));
    $('#hand-log-toggle').addEventListener('click', () => $('#hand-log').classList.toggle('hidden'));
    $('#hand-next').addEventListener('click', () => { lastHand ? finishMatch() : startHand(); });
  }

  function actLabel(a) {
    return {
      fold: '弃牌', check: '过牌',
      call: `跟注 ${fmt(a.toCall)}BB`,
      raise: `下注/加注（追加 ${fmt(a.amount)}BB）`
    }[a.type] || a.type;
  }

  window.Game = { renderHome };
})();
