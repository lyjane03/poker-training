/* =========================================================
 * draws.js — 听牌特训（outs 专项训练）
 * 程序随机生成手牌+公共牌场景，训练数补牌 → 算胜率 → 对比赔率三步心算
 * 题型：A 数补牌 / B 二四法则算胜率 / C 底池赔率决策
 * 计时：翻牌 30s、转牌 15s，超时按 0 分；剩余时间奖励少量分数
 * ========================================================= */
(function () {
  'use strict';

  const PC = window.PokerCore;
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const session = {
    questions: [], idx: 0, results: [],
    answered: false, deadline: 0, timer: null, qTotal: 0
  };

  /* ---------- 题目生成 ---------- */
  const FLUSH_SUITS = ['s', 'h', 'd', 'c'];
  const r2c = (v, s) => PC.RANKS[v - 2] + s;

  // 目标 outs -> 构造一个翻牌场景
  function makeFlushScenario(outsWanted) {
    const s = FLUSH_SUITS[Math.floor(Math.random() * 4)];
    const ranks = PC.RANKS.slice().sort(() => Math.random() - 0.5);
    // 手里 2 张同花
    const hole = [r2c(PC.RANK_VALUE[ranks[0]], s), r2c(PC.RANK_VALUE[ranks[1]], s)];
    // 牌面 2 张同花 + 1 张杂色
    const board = [r2c(PC.RANK_VALUE[ranks[2]], s), r2c(PC.RANK_VALUE[ranks[3]], s)];
    const oSuit = FLUSH_SUITS.find(x => x !== s);
    let k = 4;
    board.push(r2c(PC.RANK_VALUE[ranks[k]], oSuit));
    // 校准 outs（应=9，配合顺子面可能更多）
    const info = PC.countOuts(hole, board);
    return info && info.outs >= 4 ? { hole, board, turn: false, outs: info.outs, info } : null;
  }

  function makeStraightScenario(kind) {
    // kind: 'oesd'(8) | 'gutshot'(4)
    const s1 = 'sd'[Math.floor(Math.random() * 2)];
    const s2 = 'hc'[Math.floor(Math.random() * 2)];
    for (let tries = 0; tries < 40; tries++) {
      const lo = 2 + Math.floor(Math.random() * 8); // 底张 2~9
      if (kind === 'oesd') {
        // 手里 lo, lo+1；牌面 lo+2, lo+3 加一张无关牌
        const hole = [r2c(lo, s1), r2c(lo + 1, s2)];
        const b1 = r2c(lo + 2, 'hd'[Math.floor(Math.random() * 2)]);
        const b2 = r2c(lo + 3, 'cs'[Math.floor(Math.random() * 2)]);
        const junk = r2c(Math.min(14, lo + 9), 'cd'[Math.floor(Math.random() * 2)]);
        const board = [b1, b2, junk];
        if (new Set(hole.concat(board)).size !== 5) continue;
        const info = PC.countOuts(hole, board);
        if (info && info.straightOuts === 8 && info.flushOuts === 0) return { hole, board, turn: false, outs: info.outs, info };
      } else {
        // 手里 lo, lo+2；牌面 lo+1, lo+3 + junk → 卡 lo+? 中间张
        const hole = [r2c(lo, s1), r2c(lo + 2, s2)];
        const b1 = r2c(lo + 1, 'hd'[Math.floor(Math.random() * 2)]);
        const b2 = r2c(lo + 4, 'cs'[Math.floor(Math.random() * 2)]);
        const junk = r2c(Math.min(14, lo + 10), 'cd'[Math.floor(Math.random() * 2)]);
        const board = [b1, b2, junk];
        if (new Set(hole.concat(board)).size !== 5) continue;
        const info = PC.countOuts(hole, board);
        if (info && info.straightOuts === 4 && info.flushOuts === 0) return { hole, board, turn: false, outs: info.outs, info };
      }
    }
    return null;
  }

  function makeComboScenario() {
    // 花顺双抽：同花连张 + 牌面同花连牌
    const s = FLUSH_SUITS[Math.floor(Math.random() * 4)];
    for (let tries = 0; tries < 40; tries++) {
      const lo = 4 + Math.floor(Math.random() * 6); // 4~9
      const hole = [r2c(lo, s), r2c(lo + 1, s)];
      const board = [r2c(lo + 2, s), r2c(lo + 3, s), r2c(Math.min(14, lo + 9), 'cd'[Math.floor(Math.random() * 2)])];
      if (new Set(hole.concat(board)).size !== 5) continue;
      const info = PC.countOuts(hole, board);
      if (info && info.outs >= 12) return { hole, board, turn: false, outs: info.outs, info };
    }
    return null;
  }

  // 场景池：30% 听花 / 25% OESD / 20% 卡顺 / 15% 花顺双抽 / 10% 随机兜底
  function genScenario() {
    const turn = Math.random() < 0.35;
    const roll = Math.random();
    let sc = null;
    if (roll < 0.30) sc = makeFlushScenario();
    else if (roll < 0.55) sc = makeStraightScenario('oesd');
    else if (roll < 0.75) sc = makeStraightScenario('gutshot');
    else if (roll < 0.90) sc = makeComboScenario();
    if (!sc) {
      // 兜底：随机发到有听牌为止
      let guard = 0;
      do {
        const deck = PC.shuffle(PC.newDeck());
        const hole = [deck.pop(), deck.pop()];
        const board = [deck.pop(), deck.pop(), deck.pop()];
        const info = PC.countOuts(hole, board);
        if (info && info.outs >= 4 && info.outs <= 15) sc = { hole, board, turn: false, outs: info.outs, info };
      } while (!sc && guard++ < 60);
    }
    if (!sc) sc = makeFlushScenario(); // 最后兜底
    // 转成转牌圈：加一张无害牌（不改变 outs 结构则接受）
    if (turn && sc) {
      const used = new Set(sc.hole.concat(sc.board));
      const rest = PC.newDeck().filter(c => !used.has(c));
      for (const c of PC.shuffle(rest)) {
        const nb = sc.board.concat([c]);
        const info = PC.countOuts(sc.hole, nb);
        if (info && info.outs >= 4 && info.outs <= 15) {
          sc = { hole: sc.hole, board: nb, turn: true, outs: info.outs, info };
          break;
        }
      }
    }
    return sc;
  }

  function shuffleArr(a) {
    return a.slice().sort(() => Math.random() - 0.5);
  }

  function buildQuestion() {
    // 题型按 4:3:3 比例抽：数补牌 / 算胜率 / 赔率决策
    const roll = Math.random();
    let sc = genScenario(), guard = 0;
    while ((!sc || !sc.outs || sc.outs < 2) && guard++ < 40) sc = genScenario();

    if (roll < 0.4) {
      // A. 数补牌
      const correct = sc.outs;
      const cand = new Set([correct, correct + 2, Math.max(2, correct - 2), correct + 4, correct + 6, Math.max(2, correct - 4)]);
      let opts = shuffleArr([...cand].filter(v => v >= 2 && v <= 20)).slice(0, 4);
      if (!opts.includes(correct)) opts[0] = correct;
      return {
        type: 'outs', ...sc,
        prompt: '你的听牌有多少张补牌（outs）？只算听花/听顺，不算抽对补强。',
        options: shuffleArr(opts).map(v => ({ label: `${v} 张`, value: v })),
        answer: correct,
        explain: q => `正确答案：${correct} 张。${q.info.parts.join('；') || ''}${q.info.improveOuts ? `（另有补强补牌 ${q.info.improveOuts} 张，但抽对不足以反超成牌，不计入。）` : ''}`
      };
    }

    if (roll < 0.7) {
      // B. 二四法则算胜率
      const per = sc.turn ? 2 : 4;
      const correct = Math.min(50, sc.outs * per);
      const cand = new Set([correct, correct + per * 2, Math.max(4, correct - per * 2), correct + per * 4]);
      let opts = shuffleArr([...cand].filter(v => v > 0 && v <= 60)).slice(0, 4);
      if (!opts.includes(correct)) opts[0] = correct;
      return {
        type: 'rule', ...sc,
        prompt: `${sc.turn ? '转牌圈（还剩 1 张牌）' : '翻牌圈（还剩 2 张牌）'}，用二四法则估算你的听牌胜率？（本牌面共 ${sc.outs} 张补牌）`,
        options: shuffleArr(opts).map(v => ({ label: `约 ${v}%`, value: v })),
        answer: correct,
        explain: () => `二四法则：${sc.turn ? `转牌后 × 2% → ${sc.outs} × 2% = ${correct}%` : `翻牌后 × 4% → ${sc.outs} × 4% = ${correct}%`}。`
      };
    }

    // C. 底池赔率决策
    const per = sc.turn ? 2 : 4;
    const equity = Math.min(50, sc.outs * per) / 100;
    // 构造 bet/pot 使答案明确（所需胜率与 equity 差 6 个百分点以上）
    let pot, bet, need, correctCall, tries = 0;
    do {
      pot = [10, 20, 30, 40][Math.floor(Math.random() * 4)];
      bet = [3, 5, 8, 10, 15, 20, 30][Math.floor(Math.random() * 7)];
      need = bet / (pot + 2 * bet);
      correctCall = equity >= need;
      tries++;
    } while (Math.abs(equity - need) < 0.06 && tries < 40);
    return {
      type: 'odds', ...sc, pot, bet,
      prompt: `底池 ${pot}BB，对手下注 ${bet}BB。跟注所需胜率 = ${bet} ÷ ${pot + 2 * bet} ≈ ${Math.round(need * 100)}%。用二四法则估算后，应该跟注吗？`,
      options: [
        { label: `跟注（我的胜率足够）`, value: true },
        { label: `弃牌（赔率不够）`, value: false }
      ],
      answer: correctCall,
      explain: q => `补牌 ${q.outs} 张 → 胜率约 ${Math.round(equity * 100)}%，跟注所需 ${Math.round(need * 100)}%。${correctCall ? '胜率 ≥ 所需胜率，跟注是正 EV。' : '胜率 < 所需胜率，直接赔率不够，应弃牌（除非隐含赔率极好）。'}`
    };
  }

  /* ---------- 流程 ---------- */
  function renderHome() {
    const stats = window.Store.stats();
    $('#draws-home').innerHTML = `
      <div class="panel">
        <h2>听牌特训</h2>
        <p class="sub">德扑最实用的基本功：数补牌 → 算胜率 → 对比底池赔率。题目由程序随机生成，无限供应。翻牌圈 30 秒、转牌圈 15 秒作答，超时按 0 分。</p>
        <div class="quiz-stats">
          <span class="stat-chip">已训练 ${stats.drawCount} 组</span>
          ${stats.drawAvg !== null ? `<span class="stat-chip">平均分 ${stats.drawAvg}</span>` : ''}
          ${stats.drawBest !== null ? `<span class="stat-chip">最佳 ${stats.drawBest}</span>` : ''}
        </div>
        <div class="filters">
          <div class="filter-group">
            <label>本组题数</label>
            <select id="draws-count">
              <option value="5">5 题（快速）</option>
              <option value="10" selected>10 题（标准）</option>
              <option value="20">20 题（强化）</option>
            </select>
          </div>
          <button class="btn primary" id="draws-start">开始特训</button>
        </div>
        <div class="lib-tip" style="margin-top:14px">
          <b>💡 二四法则</b>
          <p>翻牌圈胜率 ≈ 补牌数 × 4%（还剩两张牌）；转牌圈胜率 ≈ 补牌数 × 2%（还剩一张牌）。
          同花听牌 9 张、两端顺子 8 张、卡顺 4 张、花顺双抽 15 张——先把这几个背熟。</p>
        </div>
      </div>`;
    $('#draws-start').addEventListener('click', () => startSession(Number($('#draws-count').value)));
  }

  function startSession(count) {
    session.questions = [];
    for (let i = 0; i < count; i++) session.questions.push(buildQuestion());
    session.idx = 0;
    session.results = [];
    session.qTotal = count;
    $('#draws-home').classList.add('hidden');
    $('#draws-session').classList.remove('hidden');
    renderQuestion();
  }

  function cardHtml(c) {
    const d = PC.cardDisplay(c);
    return `<span class="pcard ${d.color}"><span class="rank">${d.text[0]}</span><span class="suit">${d.text.slice(1)}</span></span>`;
  }

  function renderQuestion() {
    const q = session.questions[session.idx];
    session.answered = false;
    const pct = Math.round((session.idx / session.qTotal) * 100);
    const limit = q.turn ? 15 : 30;
    session.deadline = Date.now() + limit * 1000;

    $('#draws-session').innerHTML = `
      <div class="panel">
        <div class="q-head">
          <span class="badge cat">${{ outs: '数补牌', rule: '算胜率', odds: '赔率决策' }[q.type]}</span>
          <span class="badge ${q.turn ? 'd2' : 'd1'}">${q.turn ? '转牌圈' : '翻牌圈'}</span>
          <span style="margin-left:auto;font-size:13px;color:var(--text-dim)">第 ${session.idx + 1} / ${session.qTotal} 题</span>
        </div>
        <div class="progress"><div style="width:${pct}%"></div></div>
        <div class="draw-timer"><div class="draw-timer-bar" id="draw-timer-bar" style="width:100%"></div></div>
        <div class="table-wrap" style="padding:18px">
          <div class="board-area">
            <div class="street-label">公共牌</div>
            <div class="pcards">${q.board.map(cardHtml).join('')}</div>
          </div>
          <div class="seat hero">
            <div class="who"><span class="name">🧑 你的手牌</span><span class="chips">${PC.handNotation(q.hole)}</span></div>
            <div class="pcards" style="margin-top:8px">${q.hole.map(cardHtml).join('')}</div>
          </div>
        </div>
        <p style="font-size:15px;font-weight:600;margin:14px 0 8px">${esc(q.prompt)}</p>
        <div class="opt-list" id="opt-list">
          ${q.options.map((o, i) => `<button class="opt" data-i="${i}">${'ABCD'[i]}. ${esc(o.label)}</button>`).join('')}
        </div>
        <div id="draws-feedback"></div>
      </div>`;

    document.querySelectorAll('#opt-list .opt').forEach(btn =>
      btn.addEventListener('click', () => answer(q, q.options[Number(btn.dataset.i)].value)));

    clearInterval(session.timer);
    session.timer = setInterval(() => {
      const remain = Math.max(0, session.deadline - Date.now());
      const bar = $('#draw-timer-bar');
      if (bar) {
        bar.style.width = (remain / (limit * 1000) * 100) + '%';
        bar.classList.toggle('low', remain < 5000);
      }
      if (remain <= 0) { clearInterval(session.timer); answer(q, undefined); }
    }, 100);
  }

  function answer(q, value) {
    if (session.answered) return;
    session.answered = true;
    clearInterval(session.timer);

    const timedOut = value === undefined;
    const ok = !timedOut && value === q.answer;
    // 剩余时间奖励：答对时最多 +15
    const remainBonus = ok ? Math.round(Math.max(0, session.deadline - Date.now()) / 1000 / (q.turn ? 15 : 30) * 15) : 0;
    const score = ok ? Math.min(100, 85 + remainBonus) : 0;
    session.results.push({ type: q.type, ok, timedOut, score, street: q.turn ? 'turn' : 'flop' });

    document.querySelectorAll('#opt-list .opt').forEach((btn, i) => {
      btn.disabled = true;
      const v = q.options[i].value;
      if (v === q.answer) btn.classList.add('correct');
      else if (v === value) btn.classList.add('wrong');
      else btn.classList.add('dim');
    });

    const lastOne = session.idx === session.qTotal - 1;
    $('#draws-feedback').innerHTML = `
      <div class="explain">
        <div class="score-line">${timedOut ? '⏰ 超时未作答' : ok ? '✅ 回答正确' : '❌ 回答错误'}　本题得分：<b>${score}</b> / 100${ok && remainBonus ? `（含速度奖励 +${remainBonus}）` : ''}</div>
        <p style="font-size:14px;margin-bottom:8px;">${esc(q.explain(q))}</p>
        <div style="margin-top:10px">
          <button class="btn lib-link" id="draws-lib">📖 复习「GTO 基础 · 数补牌」章节</button>
        </div>
        <div style="margin-top:12px;text-align:right">
          <button class="btn primary" id="draws-next">${lastOne ? '查看本组成绩' : '下一题'}</button>
        </div>
      </div>`;
    $('#draws-lib').addEventListener('click', () => {
      clearInterval(session.timer);
      window.Library.open('gto', { returnView: 'draws', returnLabel: '听牌特训' });
    });
    $('#draws-next').addEventListener('click', () => {
      if (lastOne) finishSession(); else { session.idx++; renderQuestion(); }
    });
  }

  function finishSession() {
    const avg = Math.round(session.results.reduce((s, r) => s + r.score, 0) / session.results.length);
    const good = session.results.filter(r => r.ok).length;
    window.Store.add({
      type: 'draw',
      title: `听牌特训 ${session.qTotal} 题`,
      avgScore: avg,
      count: session.qTotal,
      good,
      details: session.results
    });
    $('#draws-session').innerHTML = `
      <div class="panel" style="text-align:center">
        <h2>本组特训完成</h2>
        <p style="font-size:44px;font-weight:800;color:var(--green-dark);margin:14px 0 4px">${avg}</p>
        <p style="color:var(--text-dim)">平均分（满分 100） · 答对 ${good}/${session.qTotal} 题</p>
        <div style="margin-top:20px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button class="btn primary" id="draws-again">再来一组</button>
          <button class="btn" id="draws-back">返回</button>
          <button class="btn" id="draws-history">查看历史记录</button>
        </div>
      </div>`;
    $('#draws-again').addEventListener('click', () => startSession(session.qTotal));
    $('#draws-back').addEventListener('click', exitSession);
    $('#draws-history').addEventListener('click', () => { exitSession(); window.App.switchView('history'); });
  }

  function exitSession() {
    clearInterval(session.timer);
    $('#draws-session').classList.add('hidden');
    $('#draws-home').classList.remove('hidden');
    renderHome();
  }

  window.Draws = { renderHome };
})();
