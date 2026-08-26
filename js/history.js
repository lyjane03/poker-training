/* =========================================================
 * history.js — 历史记录与复盘
 * 统计面板（趋势图 + 主题/街失误分布）+ 筛选列表 + 展开详情
 * ========================================================= */
(function () {
  'use strict';

  const $ = sel => document.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const RANGE = {
    all: { label: '全部时间', days: null },
    today: { label: '今天', days: 0 },
    '7d': { label: '近 7 天', days: 7 },
    '30d': { label: '近 30 天', days: 30 }
  };
  const STREET_CN = { preflop: '翻牌前', flop: '翻牌圈', turn: '转牌圈', river: '河牌圈' };
  const ACT_CN = { fold: '弃牌', check: '过牌', call: '跟注', raise: '加注' };
  const TYPE_CN = { quiz: '题库训练', game: '自由对局', draw: '听牌特训', range: '范围测验', drill: '场景特训' };
  const TYPE_CLS = { quiz: 'quiz', game: 'game', draw: 'draw', range: 'range', drill: 'drill' };
  const DRILL_CAT_CN = { preflop: '翻牌前', cbet: '持续下注', defense: '防守反击', river: '河牌决断', odds: '赔率全下' };
  // 题库 catKey -> 知识库章节 id 一致
  const LIB_LABEL = { starting: '起手牌', position: '位置', sizing: '下注尺度', gto: 'GTO', exploit: '剥削' };
  const POS_CN = { UTG: 'UTG', MP: 'MP', CO: 'CO', BTN: 'BTN', SB: 'SB', BB: 'BB' };
  const RANGE_ACT_CN = { open: '率先开池', call: '跟注开池', '3bet': '3Bet 反击', call3bet: '跟注 3Bet' };

  let openId = null; // 当前展开的记录

  function fmtTime(ts) {
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function scoreCls(v) { return v == null ? 'na' : v >= 80 ? 'good' : v >= 55 ? 'mid' : 'low'; }
  function recordScore(r) { return r.type === 'game' ? r.score : r.avgScore; }

  /* ---------- 统计面板 ---------- */
  function renderStats() {
    const all = window.Store.loadAll();
    if (!all.length) return '';

    // 1) 趋势折线：按时间正序的成绩序列
    const seq = all.slice().sort((a, b) => a.ts - b.ts);
    const trend = renderTrend(seq);

    // 2) 题库：按主题失误（得分<80 记一次）
    const catStat = {};
    all.filter(r => r.type === 'quiz').forEach(r =>
      (r.details || []).forEach(d => {
        const k = d.catKey || d.category || '?';
        catStat[k] = catStat[k] || { n: 0, bad: 0 };
        catStat[k].n++;
        if (d.score < 80) catStat[k].bad++;
      }));
    const catRows = Object.entries(catStat)
      .map(([k, v]) => ({ label: LIB_LABEL[k] || k, ...v, rate: v.n ? v.bad / v.n : 0 }))
      .sort((a, b) => b.rate - a.rate);

    // 3) 对局：按街失误
    const streetStat = {};
    all.filter(r => r.type === 'game').forEach(r =>
      (r.details || []).forEach(h =>
        (h.reviews || []).forEach(rv => {
          const k = rv.action ? rv.action.street : null;
          if (!k) return;
          streetStat[k] = streetStat[k] || { n: 0, bad: 0 };
          streetStat[k].n++;
          if (rv.grade === 'bad') streetStat[k].bad++;
          else if (rv.grade === 'mixed') streetStat[k].bad += 0.5;
        })));
    const streetRows = ['preflop', 'flop', 'turn', 'river']
      .filter(k => streetStat[k])
      .map(k => ({ label: STREET_CN[k], ...streetStat[k], rate: streetStat[k].n ? streetStat[k].bad / streetStat[k].n : 0 }));

    // 4) 听牌特训：按题型正确率
    const drawStat = {};
    all.filter(r => r.type === 'draw').forEach(r =>
      (r.details || []).forEach(d => {
        const k = { outs: '数补牌', rule: '算胜率', odds: '赔率决策' }[d.type] || d.type;
        drawStat[k] = drawStat[k] || { n: 0, bad: 0 };
        drawStat[k].n++;
        if (!d.ok) drawStat[k].bad++;
      }));
    const drawRows = Object.entries(drawStat)
      .map(([k, v]) => ({ label: k, ...v, rate: v.n ? v.bad / v.n : 0 }))
      .sort((a, b) => b.rate - a.rate);

    // 5) 范围测验：按情境错误率（得分 <80 记一次）
    const rangeStat = {};
    all.filter(r => r.type === 'range').forEach(r =>
      (r.details || []).forEach(d => {
        const k = `${POS_CN[d.posKey] || d.posKey} · ${RANGE_ACT_CN[d.actionKey] || d.actionKey}`;
        rangeStat[k] = rangeStat[k] || { n: 0, bad: 0 };
        rangeStat[k].n++;
        if (d.score < 80) rangeStat[k].bad++;
      }));
    const rangeRows = Object.entries(rangeStat)
      .map(([k, v]) => ({ label: k, ...v, rate: v.n ? v.bad / v.n : 0 }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 6);

    // 6) 场景特训：按类别错误率
    const drillStat = {};
    all.filter(r => r.type === 'drill').forEach(r =>
      (r.details || []).forEach(d => {
        const k = DRILL_CAT_CN[d.cat] || d.cat;
        drillStat[k] = drillStat[k] || { n: 0, bad: 0 };
        drillStat[k].n++;
        if (!d.ok) drillStat[k].bad++;
      }));
    const drillRows = Object.entries(drillStat)
      .map(([k, v]) => ({ label: k, ...v, rate: v.n ? v.bad / v.n : 0 }))
      .sort((a, b) => b.rate - a.rate);

    return `
      <div class="panel">
        <h2>训练诊断</h2>
        <p class="sub">定位你的薄弱环节：哪里错得多，就回哪里补课</p>
        ${trend}
        <div class="diag-grid">
          ${catRows.length ? `<div class="diag-box"><h3>📚 题库 · 按主题错误率</h3>${barRows(catRows)}</div>` : ''}
          ${streetRows.length ? `<div class="diag-box"><h3>🎮 对局 · 按街失误率</h3>${barRows(streetRows)}</div>` : ''}
          ${drawRows.length ? `<div class="diag-box"><h3>🎯 听牌 · 按题型错误率</h3>${barRows(drawRows)}</div>` : ''}
          ${drillRows.length ? `<div class="diag-box"><h3>⚡ 场景 · 按类别错误率</h3>${barRows(drillRows)}</div>` : ''}
          ${rangeRows.length ? `<div class="diag-box"><h3>📐 范围 · 按情境错误率</h3>${barRows(rangeRows)}</div>` : ''}
        </div>
        ${(catRows[0] && catRows[0].rate > 0.2) ? `<p style="font-size:13px;color:var(--text-dim);margin-top:6px">💡 建议：「${esc(catRows[0].label)}」错误率最高（${Math.round(catRows[0].rate * 100)}%），可到题库选「只练错题」定向强化。</p>` : ''}
      </div>`;
  }

  function barRows(rows) {
    const max = Math.max(...rows.map(r => r.rate), 0.01);
    return rows.map(r => `
      <div class="bar-row">
        <span class="bar-label">${esc(r.label)}</span>
        <span class="bar-track"><span class="bar-fill ${r.rate >= 0.4 ? 'high' : r.rate >= 0.2 ? 'mid' : ''}" style="width:${Math.round(r.rate / max * 100)}%"></span></span>
        <span class="bar-num">${Math.round(r.rate * 100)}%（${r.n} 次）</span>
      </div>`).join('');
  }

  function renderTrend(seq) {
    // 最近 20 条成绩折线
    const pts = seq.slice(-20).map((r, i, arr) => ({ score: recordScore(r), type: r.type, i, n: arr.length }));
    if (!pts.length) return '';
    const W = 640, H = 120, PAD = 26;
    const x = i => PAD + (pts.length === 1 ? (W - PAD * 2) / 2 : i * (W - PAD * 2) / (pts.length - 1));
    const yy = v => PAD + (100 - v) / 100 * (H - PAD * 2);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yy(p.score).toFixed(1)}`).join(' ');
    const colorOf = t => t === 'quiz' ? '#175cd3' : t === 'game' ? '#0e7a46' : t === 'range' ? '#7c3aed' : t === 'drill' ? '#d97706' : '#b54708';
    return `
      <div class="trend-wrap">
        <h3 style="font-size:14px;margin-bottom:6px">📈 最近 ${pts.length} 次训练成绩走势</h3>
        <svg viewBox="0 0 ${W} ${H}" class="trend-svg" preserveAspectRatio="none">
          <line x1="${PAD}" y1="${yy(80)}" x2="${W - PAD}" y2="${yy(80)}" stroke="#e2e8f0" stroke-dasharray="4 4"/>
          <line x1="${PAD}" y1="${yy(55)}" x2="${W - PAD}" y2="${yy(55)}" stroke="#e2e8f0" stroke-dasharray="4 4"/>
          <text x="2" y="${yy(80) + 4}" font-size="10" fill="#9ca3af">80</text>
          <text x="2" y="${yy(55) + 4}" font-size="10" fill="#9ca3af">55</text>
          <path d="${line}" fill="none" stroke="#94a3b8" stroke-width="2"/>
          ${pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${yy(p.score).toFixed(1)}" r="4" fill="${colorOf(p.type)}"><title>${TYPE_CN[p.type]} ${p.score} 分</title></circle>`).join('')}
        </svg>
        <div class="trend-legend">
          <span><i style="background:#175cd3"></i>题库</span>
          <span><i style="background:#0e7a46"></i>对局</span>
          <span><i style="background:#b54708"></i>听牌</span>
          <span><i style="background:#d97706"></i>场景</span>
          <span><i style="background:#7c3aed"></i>范围</span>
        </div>
      </div>`;
  }

  /* ---------- 列表 ---------- */
  function render() {
    const s = window.Store.stats();
    $('#history-panel').innerHTML = `
      ${renderStats()}
      <div class="panel">
        <h2>历史记录</h2>
        <p class="sub">所有训练自动存档（保存在浏览器本地），点击任意记录展开详情，定位你的打法漏洞。</p>
        <div class="quiz-stats">
          <span class="stat-chip">共 ${s.total} 条记录</span>
          <span class="stat-chip">题库 ${s.quizCount} 场${s.quizAvg !== null ? ` · 均分 ${s.quizAvg}` : ''}</span>
          <span class="stat-chip">对局 ${s.gameCount} 场${s.gameAvg !== null ? ` · 均分 ${s.gameAvg}` : ''}</span>
          <span class="stat-chip">听牌 ${s.drawCount} 组${s.drawAvg !== null ? ` · 均分 ${s.drawAvg}` : ''}</span>
          <span class="stat-chip">场景 ${s.drillCount} 组${s.drillAvg !== null ? ` · 均分 ${s.drillAvg}` : ''}</span>
          <span class="stat-chip">范围 ${s.rangeCount} 组${s.rangeAvg !== null ? ` · 均分 ${s.rangeAvg}` : ''}</span>
        </div>
        <div class="filters">
          <div class="filter-group">
            <label>类型</label>
            <select id="h-type">
              <option value="all">全部类型</option>
              <option value="quiz">题库训练</option>
              <option value="draw">听牌特训</option>
              <option value="drill">场景特训</option>
              <option value="range">范围测验</option>
              <option value="game">自由对局</option>
            </select>
          </div>
          <div class="filter-group">
            <label>时间范围</label>
            <select id="h-range">
              ${Object.entries(RANGE).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
            </select>
          </div>
          <button class="btn danger" id="h-clear">清空全部记录</button>
        </div>
        <div id="h-list"></div>
      </div>`;

    $('#h-type').addEventListener('change', renderList);
    $('#h-range').addEventListener('change', renderList);
    $('#h-clear').addEventListener('click', () => {
      if (confirm('确定清空全部训练记录？此操作不可恢复。')) { window.Store.clear(); openId = null; render(); }
    });
    renderList();
  }

  function renderList() {
    const type = $('#h-type').value;
    const range = RANGE[$('#h-range').value] || RANGE.all;
    const filter = {};
    if (type !== 'all') filter.type = type;
    if (range.days !== null) {
      const now = new Date();
      const from = range.days === 0
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
        : Date.now() - range.days * 864e5;
      filter.from = from;
    }
    const records = window.Store.query(filter);

    if (!records.length) {
      $('#h-list').innerHTML = '<div class="empty">暂无符合条件的记录。去「题库训练」「听牌特训」或「自由练习」完成一次训练后会自动存档。</div>';
      return;
    }

    $('#h-list').innerHTML = records.map(r => {
      const score = recordScore(r);
      const summary = r.type === 'quiz'
        ? `${r.count} 题 · ${r.good}/${r.count} 题优秀`
        : r.type === 'draw'
          ? `${r.count} 题 · 答对 ${r.good}/${r.count}`
        : r.type === 'range'
          ? `${r.count} 题 · ${r.good}/${r.count} 题优秀（≥80）`
          : r.type === 'drill'
            ? `${r.count} 题 · ${r.good}/${r.count} 题优秀`
            : `${r.hands} 手 · 总盈亏 ${r.totalDelta >= 0 ? '+' : ''}${r.totalDelta}BB · 优秀 ${r.goodActions} / 失误 ${r.badActions}`;
      return `
        <div class="record" data-id="${r.id}">
          <div class="r-top">
            <span class="tag ${TYPE_CLS[r.type] || 'quiz'}">${TYPE_CN[r.type] || r.type}</span>
            <b>${esc(r.title)}</b>
            <span class="score-pill ${scoreCls(score)}">${score == null ? '—' : score + ' 分'}</span>
            <span class="r-time">${fmtTime(r.ts)}</span>
          </div>
          <div class="r-summary">${esc(summary)}</div>
          ${openId === r.id ? renderDetail(r) : ''}
        </div>`;
    }).join('');

    document.querySelectorAll('.record').forEach(el => {
      el.addEventListener('click', ev => {
        if (ev.target.closest('.lib-link')) return; // 链接点击不折叠
        openId = openId === el.dataset.id ? null : el.dataset.id;
        renderList();
        if (openId) {
          const node = document.querySelector(`.record[data-id="${openId}"]`);
          if (node) node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    });
    document.querySelectorAll('#h-list .lib-link').forEach(btn =>
      btn.addEventListener('click', ev => {
        ev.stopPropagation();
        window.Library.open(btn.dataset.lib);
      }));
  }

  function renderDetail(r) {
    if (r.type === 'quiz') {
      return `
        <div class="detail-body">
          ${(r.details || []).map((d, i) => `
            <div class="review-item ${d.score >= 80 ? 'good' : d.score >= 45 ? 'mixed' : 'bad'}">
              <div class="r-head">第 ${i + 1} 题 · ${esc(d.title)}（${esc(d.category)} · ${'★'.repeat(d.difficulty)}）— ${d.score} 分</div>
              <div class="r-body">你的选择：<b>${ACT_CN[d.chosen] || d.chosen}</b>　最优选择：<b>${ACT_CN[d.best] || d.best}</b></div>
              <div class="r-theory">📖 理论：${esc(d.theory)}
                ${d.catKey ? `<button class="btn lib-link" data-lib="${d.catKey}">去读章节</button>` : ''}
              </div>
            </div>`).join('')}
        </div>`;
    }
    if (r.type === 'draw') {
      const typeName = { outs: '数补牌', rule: '算胜率', odds: '赔率决策' };
      return `
        <div class="detail-body">
          ${(r.details || []).map((d, i) => `
            <div class="review-item ${d.ok ? 'good' : 'bad'}">
              <div class="r-head">第 ${i + 1} 题 · ${typeName[d.type] || d.type}（${d.street === 'turn' ? '转牌圈' : '翻牌圈'}）— ${d.ok ? '✅ 正确' : d.timedOut ? '⏰ 超时' : '❌ 错误'} · ${d.score} 分</div>
            </div>`).join('')}
        </div>`;
    }
    if (r.type === 'range') {
      return `
        <div class="detail-body">
          ${(r.details || []).map((d, i) => `
            <div class="review-item ${d.score >= 80 ? 'good' : d.score >= 50 ? 'mixed' : 'bad'}">
              <div class="r-head">第 ${i + 1} 题 · ${esc(POS_CN[d.posKey] || d.posKey)} · ${esc(RANGE_ACT_CN[d.actionKey] || d.actionKey)} — ${d.score} 分</div>
              <div class="r-body">精确率 ${d.precision}% · 召回率 ${d.recall}%${d.precision < 70 ? '（选多了：范围里混入了不该有的牌）' : d.recall < 70 ? '（漏选了：范围圈得太紧）' : ''}</div>
            </div>`).join('')}
        </div>`;
    }
    if (r.type === 'drill') {
      return `
        <div class="detail-body">
          ${(r.details || []).map((d, i) => `
            <div class="review-item ${d.ok ? 'good' : 'bad'}">
              <div class="r-head">第 ${i + 1} 题 · ${esc(DRILL_CAT_CN[d.cat] || d.cat)} · ${esc(d.title)} — ${d.ok ? '✅ 优秀' : d.timedOut ? '⏰ 超时' : '❌ 错误'} · ${d.score} 分</div>
            </div>`).join('')}
        </div>`;
    }
    // game 记录
    return `
      <div class="detail-body">
        ${(r.details || []).map(h => `
          <div class="q-card">
            <div class="q-head">
              <span class="badge cat">第 ${h.handNo} 手 · ${esc(h.heroHand)}</span>
              ${h.aiHand ? `<span class="badge d2">AI：${esc(h.aiHand)}${h.aiMade ? ' · ' + esc(h.aiMade) : ''}</span>` : ''}
              <span style="font-size:13px;color:var(--text-dim)">${esc(h.result)}（${h.heroDelta >= 0 ? '+' : ''}${h.heroDelta}BB）</span>
              <span class="q-status" style="font-weight:700;color:${h.score >= 80 ? 'var(--green-dark)' : h.score >= 55 ? 'var(--amber)' : 'var(--red)'}">${h.score} 分</span>
            </div>
            ${(h.reviews || []).map(rv => `
              <div class="review-item ${rv.grade}" style="margin-top:8px">
                <div class="r-head">${{ good: '✅', mixed: '🟡', bad: '❌' }[rv.grade]} ${STREET_CN[rv.action.street] || rv.action.street} · ${esc(rv.title)}</div>
                <div class="r-body">${esc(rv.body)}</div>
                ${rv.theory ? `<div class="r-theory">📖 理论：${esc(rv.theory.name || rv.theory)}
                  ${rv.theory && rv.theory.cat ? `<button class="btn lib-link" data-lib="${rv.theory.cat}">去读章节</button>` : ''}
                </div>` : ''}
              </div>`).join('')}
            <details style="margin-top:8px">
              <summary style="font-size:12px;color:var(--text-dim);cursor:pointer">完整行动日志</summary>
              <div class="log-box" style="margin-top:6px">${(h.handLog || []).map(l => `<div>${esc(l)}</div>`).join('')}</div>
            </details>
          </div>`).join('')}
      </div>`;
  }

  window.History = { render };
})();
