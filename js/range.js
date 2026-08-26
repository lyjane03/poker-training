/* =========================================================
 * range.js — 范围训练（范围速查 + 范围测验）
 * 速查：选位置 × 行动 → 标准范围矩阵 + 组合统计 + 策略解读
 * 测验：随机出题（位置×行动），在矩阵上圈出对手范围，
 *       提交后逐格对比标准答案，按组合数计算 F1 评分并存档
 * ========================================================= */
(function () {
  'use strict';

  const PC = window.PokerCore;
  const RC = window.RangeCore;
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const POS_CN = { UTG: '枪口位 UTG', MP: '中位 MP', CO: '关煞位 CO', BTN: '按钮位 BTN', SB: '小盲位 SB', BB: '大盲位 BB' };

  /* ---------- 状态 ---------- */
  const state = {
    mode: 'lookup',          // 'lookup' | 'quiz'
    // 速查
    lookupPos: 'CO', lookupAction: 'open',
    // 测验
    quizSize: 10, quizRound: 0, quizResults: [],
    quizCurrent: null,       // { posKey, actionKey, rangeKey, targetSet }
    quizSelected: new Set(),
    quizAnswered: false
  };

  /* ---------- 矩阵渲染（通用） ---------- */
  function matrixHtml(set, opts) {
    // opts: { interactive, answerSet, graded }
    const o = opts || {};
    let html = '';
    for (let row = 0; row < 13; row++) {
      for (let col = 0; col < 13; col++) {
        const key = RC.matrixKey(row, col);
        const kind = row === col ? 'pair' : col > row ? 'suited' : 'offsuit';
        let cls = `rg-cell ${kind}`;
        if (o.graded) {
          const mine = set.has(key);
          const ans = o.answerSet.has(key);
          if (mine && ans) cls += ' hit';        // 选对
          else if (mine && !ans) cls += ' extra'; // 多选
          else if (!mine && ans) cls += ' miss';  // 漏选
        } else if (set.has(key)) {
          cls += ' on';
        }
        html += `<button type="button" class="${cls}" data-key="${key}" ${o.interactive ? '' : 'disabled'}>${key}</button>`;
      }
    }
    return html;
  }

  function legendHtml() {
    return `
      <div class="range-matrix-legend">
        <span><i class="rg-swatch pair"></i>对子</span>
        <span><i class="rg-swatch suited"></i>同花</span>
        <span><i class="rg-swatch offsuit"></i>杂色</span>
        <span class="range-stats" id="range-stats-live"></span>
      </div>`;
  }

  function statsText(set) {
    const s = RC.rangeStats(set);
    return s.combos ? `共 ${s.classes} 类手牌 · ${s.combos} 组合 · 占全部起手牌 ${s.pct.toFixed(1)}%` : '空范围';
  }

  /* ================= 速查模式 ================= */
  function renderLookup(container) {
    const actBtns = RC.ACTIONS.map(a =>
      `<button class="chip ${state.lookupAction === a.key ? 'chip-on' : ''}" data-lact="${a.key}">${a.label}</button>`).join('');
    const posBtns = RC.POSITIONS.map(p =>
      `<button class="chip ${state.lookupPos === p ? 'chip-on' : ''}" data-lpos="${p}">${p}</button>`).join('');

    const rangeKey = RC.lookupRange(state.lookupPos, state.lookupAction);
    const entry = rangeKey ? RC.RANGES[rangeKey] : null;
    const set = entry ? RC.parseRangeClasses(entry.expr) : new Set();

    container.innerHTML = `
      <div class="panel">
        <h2>范围速查</h2>
        <p class="sub">选定对手的位置与行动，立即查看标准基线范围。实战复盘时用它来校准「他应该有什么牌」。</p>
        <div class="filters" style="margin-bottom:6px">
          <div class="filter-group">
            <label>对手位置</label>
            <div class="size-chips-lookup">${posBtns}</div>
          </div>
          <div class="filter-group">
            <label>对手行动</label>
            <div class="size-chips-lookup">${actBtns}</div>
          </div>
        </div>
        ${entry ? `
          <div class="range-lookup-body">
            <div class="range-matrix-wrap">
              <div class="range-matrix">${matrixHtml(set)}</div>
              <div class="range-matrix-legend">
                <span><i class="rg-swatch pair"></i>对子</span>
                <span><i class="rg-swatch suited"></i>同花</span>
                <span><i class="rg-swatch offsuit"></i>杂色</span>
                <span class="range-stats">${statsText(set)}</span>
              </div>
            </div>
            <div class="lib-tip">
              <b>📖 解读：${esc(POS_CN[state.lookupPos])} · ${esc(RC.ACTIONS.find(a => a.key === state.lookupAction).label)}</b>
              <p>${esc(entry.note)}</p>
              <p style="margin-top:6px;font-family:ui-monospace,Menlo,monospace;font-size:12px;color:var(--text-dim)">${esc(entry.expr)}</p>
            </div>
          </div>`
        : `<div class="empty">该位置与行动组合暂无基线范围（如大盲率先开池不存在——换一组试试）</div>`}
      </div>`;

    container.querySelectorAll('[data-lpos]').forEach(b =>
      b.addEventListener('click', () => { state.lookupPos = b.dataset.lpos; renderLookup(container); }));
    container.querySelectorAll('[data-lact]').forEach(b =>
      b.addEventListener('click', () => { state.lookupAction = b.dataset.lact; renderLookup(container); }));
  }

  /* ================= 测验模式 ================= */
  function quizPool() {
    // 可出题的（位置 × 行动）组合
    const pool = [];
    for (const pos of RC.POSITIONS) {
      for (const act of RC.ACTIONS) {
        const key = RC.lookupRange(pos, act.key);
        if (key) pool.push({ posKey: pos, actionKey: act.key, rangeKey: key });
      }
    }
    return pool;
  }

  function startQuiz() {
    const pool = quizPool().sort(() => Math.random() - 0.5);
    state.quizResults = [];
    state.quizRound = 0;
    state.quizQueue = pool.slice(0, state.quizSize);
    nextQuizQuestion();
  }

  function nextQuizQuestion() {
    if (state.quizRound >= state.quizQueue.length) { finishQuiz(); return; }
    const item = state.quizQueue[state.quizRound];
    state.quizCurrent = {
      ...item,
      targetSet: RC.parseRangeClasses(RC.RANGES[item.rangeKey].expr)
    };
    state.quizSelected = new Set();
    state.quizAnswered = false;
    render();
  }

  function gradeQuiz() {
    const target = state.quizCurrent.targetSet;
    const mine = state.quizSelected;
    // 按组合数（而非类别数）计算，更贴近真实范围宽度感知
    const combosOf = set => RC.expandClasses(set).length;
    const intersection = new Set([...mine].filter(k => target.has(k)));
    const hit = combosOf(intersection), mineN = combosOf(mine), targetN = combosOf(target);
    const precision = mineN ? hit / mineN : 0;   // 你选的有多少是对的
    const recall = targetN ? hit / targetN : 0;  // 该选的你选了多少
    const f1 = (precision + recall) ? 2 * precision * recall / (precision + recall) : 0;
    const score = Math.round(f1 * 100);
    state.quizResults.push({
      posKey: state.quizCurrent.posKey,
      actionKey: state.quizCurrent.actionKey,
      rangeKey: state.quizCurrent.rangeKey,
      hit, mineN, targetN, precision, recall, score
    });
    state.quizAnswered = true;
    render();
  }

  function finishQuiz() {
    const rs = state.quizResults;
    const avg = Math.round(rs.reduce((s, r) => s + r.score, 0) / rs.length);
    const good = rs.filter(r => r.score >= 80).length;

    window.Store.add({
      type: 'range',
      title: `范围测验 ${rs.length} 题`,
      avgScore: avg,
      count: rs.length,
      good,
      details: rs.map(r => ({
        posKey: r.posKey, actionKey: r.actionKey, score: r.score,
        precision: Math.round(r.precision * 100), recall: Math.round(r.recall * 100)
      }))
    });

    const worst = rs.slice().sort((a, b) => a.score - b.score)[0];
    $('#range-panel').innerHTML = `
      <div class="panel" style="text-align:center">
        <h2>本组测验完成</h2>
        <p style="font-size:44px;font-weight:800;color:var(--green-dark);margin:14px 0 4px">${avg}</p>
        <p style="color:var(--text-dim)">平均 F1 分（满分 100） · ${good}/${rs.length} 题达成优秀（≥80）</p>
        ${worst ? `<p style="font-size:13px;color:var(--text-dim);margin-top:6px">最薄弱：<b>${esc(POS_CN[worst.posKey])} · ${esc(RC.ACTIONS.find(a => a.key === worst.actionKey).label)}</b>（${worst.score} 分）——建议切到速查模式对照记忆。</p>` : ''}
        <div style="margin-top:20px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button class="btn primary" id="rq-again">再来一组</button>
          <button class="btn" id="rq-lookup">去速查复习</button>
          <button class="btn" id="rq-history">查看历史记录</button>
        </div>
      </div>`;
    $('#rq-again').addEventListener('click', startQuiz);
    $('#rq-lookup').addEventListener('click', () => { state.mode = 'lookup'; render(); });
    $('#rq-history').addEventListener('click', () => window.App.switchView('history'));
  }

  /* ---------- 测验渲染 ---------- */
  function renderQuiz(container) {
    const cur = state.quizCurrent;
    const act = RC.ACTIONS.find(a => a.key === cur.actionKey);
    const r = state.quizAnswered ? state.quizResults[state.quizResults.length - 1] : null;

    container.innerHTML = `
      <div class="panel">
        <div class="q-head">
          <span class="badge cat">范围测验</span>
          <span style="margin-left:auto;font-size:13px;color:var(--text-dim)">第 ${state.quizRound + 1} / ${state.quizQueue.length} 题</span>
        </div>
        <div class="progress"><div style="width:${Math.round(state.quizRound / state.quizQueue.length * 100)}%"></div></div>
        <h2 style="margin:10px 0 4px">对手在 ${esc(POS_CN[cur.posKey])}，${esc(act.hint)}</h2>
        <p class="sub">请在矩阵上圈出他的基线范围${state.quizAnswered ? '（已提交）' : '，圈完点「提交答案」'}</p>

        <div class="range-matrix-wrap">
          <div class="range-matrix" id="quiz-matrix">
            ${state.quizAnswered
              ? matrixHtml(state.quizSelected, { graded: true, answerSet: cur.targetSet })
              : matrixHtml(state.quizSelected, { interactive: true })}
          </div>
          ${state.quizAnswered ? `
          <div class="range-matrix-legend">
            <span><i class="rg-swatch" style="background:var(--green)"></i>选对</span>
            <span><i class="rg-swatch" style="background:var(--red)"></i>多选（不属于范围）</span>
            <span><i class="rg-swatch" style="background:#f5c86b"></i>漏选（属于范围但没选）</span>
          </div>` : legendHtml()}
        </div>

        ${state.quizAnswered ? `
          <div class="explain">
            <div class="score-line">${r.score >= 80 ? '✅ 优秀' : r.score >= 50 ? '🟡 有偏差' : '❌ 差距较大'}　本题得分：<b>${r.score}</b> / 100</div>
            <p style="font-size:14px;margin-bottom:6px">
              精确率 ${Math.round(r.precision * 100)}%（你选的 ${r.mineN} 组合中 ${r.hit} 个正确） ·
              召回率 ${Math.round(r.recall * 100)}%（标准 ${r.targetN} 组合你覆盖 ${r.hit} 个）
            </p>
            <p style="font-size:13.5px;margin-bottom:6px"><b>标准答案：</b><code style="font-size:12px">${esc(RC.RANGES[cur.rangeKey].expr)}</code></p>
            <p style="font-size:13.5px">📖 ${esc(RC.RANGES[cur.rangeKey].note)}</p>
            <div style="margin-top:12px;text-align:right">
              <button class="btn primary" id="rq-next">${state.quizRound + 1 >= state.quizQueue.length ? '查看本组成绩' : '下一题'}</button>
            </div>
          </div>`
        : `
          <div style="margin-top:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <button class="btn primary" id="rq-submit" ${state.quizSelected.size ? '' : 'disabled'}>提交答案</button>
            <button class="btn" id="rq-clear">清空重选</button>
            <button class="btn" id="rq-quit">退出测验</button>
          </div>`}
      </div>`;

    if (!state.quizAnswered) {
      $('#quiz-matrix').addEventListener('click', e => {
        const cell = e.target.closest('.rg-cell');
        if (!cell || cell.disabled) return;
        const key = cell.dataset.key;
        if (state.quizSelected.has(key)) state.quizSelected.delete(key);
        else state.quizSelected.add(key);
        cell.classList.toggle('on', state.quizSelected.has(key));
        const stats = $('#range-stats-live');
        if (stats) stats.textContent = statsText(state.quizSelected);
        $('#rq-submit').disabled = !state.quizSelected.size;
      });
      $('#rq-submit').addEventListener('click', gradeQuiz);
      $('#rq-clear').addEventListener('click', () => { state.quizSelected = new Set(); render(); });
      $('#rq-quit').addEventListener('click', () => { state.quizCurrent = null; render(); });
    } else {
      $('#rq-next').addEventListener('click', () => { state.quizRound++; nextQuizQuestion(); });
    }
  }

  /* ================= 首页 / 主渲染 ================= */
  function render() {
    const panel = $('#range-panel');
    const s = window.Store.stats();
    const rangeStatsChip = (() => {
      const all = window.Store.query({ type: 'range' });
      if (!all.length) return '';
      const avg = Math.round(all.reduce((sum, r) => sum + (r.avgScore || 0), 0) / all.length);
      return `<span class="stat-chip">已测 ${all.length} 组 · 平均 ${avg} 分</span>`;
    })();

    // 测验进行中
    if (state.mode === 'quiz' && state.quizCurrent) {
      renderQuiz(panel);
      return;
    }

    panel.innerHTML = `
      <div class="panel">
        <h2>范围训练</h2>
        <p class="sub">读范围是翻牌后一切决策的起点。速查模式帮你随时校准「对手该有什么牌」；测验模式随机抽位置与行动，检验你能不能把范围圈准。</p>
        <div class="quiz-stats">
          <span class="stat-chip">速查条目 ${Object.keys(RC.RANGES).length} 个</span>
          <span class="stat-chip">测验题库 ${quizPool().length} 种情境</span>
          ${rangeStatsChip}
        </div>
        <div class="mode-tabs" style="max-width:420px">
          <button class="btn mode-tab ${state.mode === 'lookup' ? 'primary' : ''}" data-rmode="lookup">📊 范围速查</button>
          <button class="btn mode-tab ${state.mode === 'quiz' ? 'primary' : ''}" data-rmode="quiz">🎯 范围测验</button>
        </div>
        <div id="range-body"></div>
      </div>`;

    panel.querySelectorAll('[data-rmode]').forEach(b =>
      b.addEventListener('click', () => { state.mode = b.dataset.rmode; state.quizCurrent = null; render(); }));

    const body = $('#range-body');
    if (state.mode === 'lookup') {
      renderLookup(body);
    } else {
      body.innerHTML = `
        <div class="panel" style="margin-top:16px">
          <h2>开始范围测验</h2>
          <p class="sub">每题给出一个位置与行动，在矩阵上圈出标准基线范围。评分按组合数计算 F1：既惩罚多选（精确率），也惩罚漏选（召回率）。</p>
          <div class="filters">
            <div class="filter-group">
              <label>本组题数</label>
              <select id="rq-size">
                <option value="5">5 题（快速）</option>
                <option value="10" selected>10 题（标准）</option>
                <option value="${quizPool().length}">全部情境（${quizPool().length} 题）</option>
              </select>
            </div>
            <button class="btn primary" id="rq-start">开始测验</button>
          </div>
        </div>`;
      $('#rq-size').addEventListener('change', e => { state.quizSize = Number(e.target.value); });
      $('#rq-start').addEventListener('click', startQuiz);
    }
  }

  window.RangeTrainer = { render };
})();
