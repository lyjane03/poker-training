/* =========================================================
 * quiz.js — 题库训练模块
 * 流程：选题（难度/分类/题数）→ 逐题作答 → 评分+解析 → 结算存档
 * ========================================================= */
(function () {
  'use strict';

  const { CATEGORIES, QUESTIONS } = window.QuizData;
  const DIFF_NAME = { 1: '入门', 2: '进阶', 3: '高阶' };
  // 新分类 → 知识库章节映射（multiway/postflop/range 无独立章节，映射到最相关章节）
  const CAT_TO_LIB = { multiway: 'gto', postflop: 'gto', range: 'gto', '3bet': 'sizing' };
  const catToLib = c => CAT_TO_LIB[c] || c;

  const session = {
    questions: [], idx: 0,
    results: [],       // { qid, chosen, score, best }
    answered: false
  };

  const $ = sel => document.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- 首页 ---------- */
  // 每题的历史最好成绩：{ qid: bestScore }
  function bestScores() {
    const best = {};
    window.Store.query({ type: 'quiz' }).forEach(r =>
      (r.details || []).forEach(d => {
        best[d.qid] = Math.max(best[d.qid] || 0, d.score || 0);
      }));
    return best;
  }

  function renderHome() {
    const stats = window.Store.stats();
    const best = bestScores();
    const mastered = Object.values(best).filter(s => s >= 80).length;
    const wrong = Object.values(best).filter(s => s < 80).length;

    const catOptions = ['<option value="all">全部主题</option>']
      .concat(Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}">${v}</option>`)).join('');

    $('#quiz-home').innerHTML = `
      <div class="panel">
        <h2>策略题库训练</h2>
        <p class="sub">覆盖起手牌、位置、下注尺度、GTO 基础、剥削打法、多人底池、翻牌后多街、范围阅读、3Bet/4Bet 底池九大主题，按难度循序渐进。提交后立即获得评分与理论解析。</p>
        <div class="quiz-stats">
          <span class="stat-chip">题库共 ${QUESTIONS.length} 题</span>
          <span class="stat-chip">已掌握 ${mastered} 题</span>
          ${wrong ? `<span class="stat-chip" style="background:#fff1f0;color:var(--red)">待巩固 ${wrong} 题</span>` : ''}
          ${stats.quizAvg !== null ? `<span class="stat-chip">历史平均分 ${stats.quizAvg}</span>` : ''}
        </div>
        <div class="filters">
          <div class="filter-group">
            <label>主题分类</label>
            <select id="quiz-cat">${catOptions}</select>
          </div>
          <div class="filter-group">
            <label>难度</label>
            <select id="quiz-diff">
              <option value="all">由浅入深（全部）</option>
              <option value="1">入门</option>
              <option value="2">进阶</option>
              <option value="3">高阶</option>
            </select>
          </div>
          <div class="filter-group">
            <label>题目范围</label>
            <select id="quiz-scope">
              <option value="all">全部题目</option>
              <option value="unmastered">只练未掌握（&lt;80 分或未作答）</option>
              <option value="wrong">只练错题（作答过但 &lt;80 分）</option>
            </select>
          </div>
          <div class="filter-group">
            <label>本次题数</label>
            <select id="quiz-count">
              <option value="5">5 题</option>
              <option value="10" selected>10 题</option>
              <option value="0">全部</option>
            </select>
          </div>
          <button class="btn primary" id="quiz-start">开始训练</button>
        </div>
      </div>
      <div class="panel">
        <h2>题目预览</h2>
        <p class="sub">点击「开始训练」后按序作答</p>
        <div id="quiz-preview"></div>
      </div>`;

    renderPreview();
    $('#quiz-cat').addEventListener('change', renderPreview);
    $('#quiz-diff').addEventListener('change', renderPreview);
    $('#quiz-scope').addEventListener('change', renderPreview);
    $('#quiz-start').addEventListener('click', startSession);
  }

  function poolByFilters() {
    const cat = $('#quiz-cat').value;
    const diff = $('#quiz-diff').value;
    const scope = $('#quiz-scope').value;
    const best = bestScores();
    return QUESTIONS.filter(q => {
      if (cat !== 'all' && q.category !== cat) return false;
      if (diff !== 'all' && q.difficulty !== Number(diff)) return false;
      const b = best[q.id];
      if (scope === 'unmastered' && b !== undefined && b >= 80) return false;
      if (scope === 'wrong' && (b === undefined || b >= 80)) return false;
      return true;
    });
  }

  function pickQuestions() {
    let pool = poolByFilters();
    // 由浅入深：先难度升序，同难度内随机
    pool = pool.slice().sort((a, b) => a.difficulty - b.difficulty || Math.random() - 0.5);
    const count = Number($('#quiz-count').value);
    return count > 0 ? pool.slice(0, count) : pool;
  }

  function renderPreview() {
    const pool = poolByFilters();
    const best = bestScores();

    $('#quiz-preview').innerHTML = pool.length
      ? pool.map(q => {
        const b = best[q.id];
        const status = b === undefined ? '' : b >= 80 ? '✓ 已掌握' : '✗ 待巩固';
        const cls = b === undefined ? '' : b >= 80 ? 'done' : 'wrong';
        return `
        <div class="q-card">
          <div class="q-head">
            <span class="badge cat">${CATEGORIES[q.category]}</span>
            <span class="badge d${q.difficulty}">${DIFF_NAME[q.difficulty]}</span>
            <span class="q-title">${esc(q.title)}</span>
            <span class="q-status ${cls}">${status}</span>
          </div>
          <div class="q-scenario">${esc(q.scenario.villainAction)}</div>
        </div>`;
      }).join('')
      : '<div class="empty">该筛选条件下暂无题目</div>';
  }

  /* ---------- 训练会话 ---------- */
  function startSession() {
    const qs = pickQuestions();
    if (!qs.length) { alert('该条件下没有题目，请调整筛选。'); return; }
    session.questions = qs;
    session.idx = 0;
    session.results = [];
    // 选项顺序随机（避免记住「C 总是对的」这类位置模式），order[i] = 原选项下标
    session.orders = qs.map(q => q.options.map((_, i) => i).sort(() => Math.random() - 0.5));
    $('#quiz-home').classList.add('hidden');
    $('#quiz-session').classList.remove('hidden');
    renderQuestion();
  }

  function renderQuestion() {
    const q = session.questions[session.idx];
    session.answered = false;
    const s = q.scenario;
    const pct = Math.round((session.idx / session.questions.length) * 100);
    const order = session.orders[session.idx];

    $('#quiz-session').innerHTML = `
      <div class="panel">
        <div class="q-head">
          <span class="badge cat">${CATEGORIES[q.category]}</span>
          <span class="badge d${q.difficulty}">${DIFF_NAME[q.difficulty]}</span>
          <span style="margin-left:auto;font-size:13px;color:var(--text-dim)">
            第 ${session.idx + 1} / ${session.questions.length} 题
          </span>
        </div>
        <div class="progress"><div style="width:${pct}%"></div></div>
        <h2>${esc(q.title)}</h2>
        <div class="scenario">
          <div class="row"><span class="k">你的手牌</span><span>${esc(s.heroHand)}</span></div>
          <div class="row"><span class="k">你的位置</span><span>${esc(s.position)}</span></div>
          <div class="row"><span class="k">筹码深度</span><span>${esc(s.stackDepth)}</span></div>
          <div class="row"><span class="k">公共牌</span><span>${esc(s.board)}</span></div>
          <div class="row"><span class="k">底池</span><span>${esc(s.potInfo)}</span></div>
          <div class="row"><span class="k">对手行动</span><span>${esc(s.villainAction)}</span></div>
          ${s.extra ? `<div class="row"><span class="k">补充信息</span><span>${esc(s.extra)}</span></div>` : ''}
        </div>
        <p style="font-size:14px;font-weight:600;margin-bottom:4px;">你的决策是？</p>
        <div class="opt-list" id="opt-list">
          ${order.map((oi, i) => `
            <button class="opt" data-i="${i}">
              ${'ABCDEF'[i]}. ${esc(q.options[oi].label)}
            </button>`).join('')}
        </div>
        <div id="quiz-feedback"></div>
      </div>`;

    document.querySelectorAll('#opt-list .opt').forEach(btn => {
      btn.addEventListener('click', () => answer(q, Number(btn.dataset.i)));
    });
  }

  function answer(q, shownIdx) {
    if (session.answered) return;
    session.answered = true;

    const order = session.orders[session.idx];
    const chosen = q.options[order[shownIdx]];
    const best = q.options.reduce((a, b) => (b.score > a.score ? b : a));
    session.results.push({ qid: q.id, chosen: chosen.key, score: chosen.score, best: best.key });

    // 标注选项
    document.querySelectorAll('#opt-list .opt').forEach((btn, i) => {
      btn.disabled = true;
      const o = q.options[order[i]];
      if (i === shownIdx) {
        btn.classList.add(o.score >= 80 ? 'correct' : o.score >= 45 ? 'partial' : 'wrong');
      } else if (o === best && best.key !== chosen.key) {
        btn.classList.add('correct');
      } else {
        btn.classList.add('dim');
      }
    });

    const scoreLabel = chosen.score >= 80 ? '✅ 优秀决策' : chosen.score >= 45 ? '🟡 可接受但非最优' : '❌ 明显错误';
    const lastOne = session.idx === session.questions.length - 1;

    $('#quiz-feedback').innerHTML = `
      <div class="explain">
        <div class="score-line">${scoreLabel}　本题得分：<b>${chosen.score}</b> / 100</div>
        <p style="font-size:14px;margin-bottom:8px;">${esc(chosen.feedback)}</p>
        ${best.key !== chosen.key ? `<p style="font-size:14px;margin-bottom:8px;"><b>最优选择：</b>${esc(best.label)}</p>` : ''}
        <h3>📖 理论依据：${esc(q.theory.name)}</h3>
        <ul>${q.theory.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
        <div style="margin-top:10px">
          <button class="btn lib-link" data-lib="${catToLib(q.category)}">📖 去知识库读「${esc(CATEGORIES[q.category])}」相关章节</button>
        </div>
        <div style="margin-top:12px;text-align:right">
          <button class="btn primary" id="quiz-next">${lastOne ? '查看本组成绩' : '下一题'}</button>
        </div>
      </div>`;
    document.querySelector('#quiz-feedback .lib-link').addEventListener('click', e => {
      window.Library.open(e.currentTarget.dataset.lib, { returnToQuiz: true });
    });
    $('#quiz-next').addEventListener('click', () => {
      if (lastOne) finishSession(); else { session.idx++; renderQuestion(); }
    });
  }

  function finishSession() {
    const avg = Math.round(session.results.reduce((s, r) => s + r.score, 0) / session.results.length);
    const good = session.results.filter(r => r.score >= 80).length;

    // 存档
    window.Store.add({
      type: 'quiz',
      title: `题库训练 ${session.questions.length} 题`,
      avgScore: avg,
      count: session.results.length,
      good,
      details: session.results.map(r => {
        const q = session.questions.find(x => x.id === r.qid);
        return {
          qid: r.qid, title: q.title, category: CATEGORIES[q.category], catKey: q.category,
          difficulty: q.difficulty, chosen: r.chosen, best: r.best, score: r.score,
          theory: q.theory.name
        };
      })
    });

    const wrongOnes = session.results.filter(r => r.score < 80);
    const grade = avg >= 80 ? '扎实，继续保持！' : avg >= 55 ? '方向正确，注意细节。' : '建议重读解析，巩固基础理论。';
    $('#quiz-session').innerHTML = `
      <div class="panel" style="text-align:center">
        <h2>本组训练完成</h2>
        <p style="font-size:44px;font-weight:800;color:var(--green-dark);margin:14px 0 4px">${avg}</p>
        <p style="color:var(--text-dim)">平均分（满分 100） · ${good}/${session.results.length} 题达成优秀 · ${grade}</p>
        ${wrongOnes.length ? `
        <div style="margin-top:18px;text-align:left">
          <h3 style="font-size:15px;margin-bottom:8px">📌 本组待巩固（${wrongOnes.length} 题）</h3>
          ${wrongOnes.map(r => {
            const q = session.questions.find(x => x.id === r.qid);
            return `<div class="review-item ${r.score >= 45 ? 'mixed' : 'bad'}">
              <div class="r-head">${esc(q.title)} · ${r.score} 分</div>
              <div class="r-theory">📖 理论：${esc(q.theory.name)}
                <button class="btn lib-link" data-lib="${catToLib(q.category)}" style="margin-left:8px;padding:3px 10px;font-size:12px">去读对应章节</button>
              </div>
            </div>`;
          }).join('')}
        </div>` : '<p style="margin-top:14px;color:var(--green-dark);font-weight:600">本组全部达成优秀，没有错题 🎉</p>'}
        <div style="margin-top:20px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          ${wrongOnes.length ? '<button class="btn primary" id="quiz-retry-wrong">重练本组错题</button>' : ''}
          <button class="btn ${wrongOnes.length ? '' : 'primary'}" id="quiz-again">再来一组</button>
          <button class="btn" id="quiz-back">返回选题</button>
          <button class="btn" id="quiz-history">查看历史记录</button>
        </div>
      </div>`;
    document.querySelectorAll('#quiz-session .lib-link').forEach(btn =>
      btn.addEventListener('click', () => window.Library.open(btn.dataset.lib, { returnToQuiz: true })));
    if (wrongOnes.length) {
      $('#quiz-retry-wrong').addEventListener('click', () => {
        session.questions = wrongOnes.map(r => session.questions.find(x => x.id === r.qid));
        session.idx = 0;
        session.results = [];
        session.orders = session.questions.map(q => q.options.map((_, i) => i).sort(() => Math.random() - 0.5));
        renderQuestion();
      });
    }
    $('#quiz-again').addEventListener('click', () => { startSession(); });
    $('#quiz-back').addEventListener('click', exitSession);
    $('#quiz-history').addEventListener('click', () => {
      exitSession();
      window.App.switchView('history');
    });
  }

  function exitSession() {
    $('#quiz-session').classList.add('hidden');
    $('#quiz-home').classList.remove('hidden');
    renderHome();
  }

  window.Quiz = { renderHome };
})();
