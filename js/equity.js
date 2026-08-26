/* =========================================================
 * equity.js — 胜率计算器（独立小工具）
 * 交互式输入手牌 vs 手牌/范围 + 公共牌，蒙特卡洛模拟胜率
 * 支持：翻牌前（无公共牌）、翻牌圈、转牌圈
 * ========================================================= */
(function () {
  'use strict';

  const PC = window.PokerCore;
  const RC = window.RangeCore;
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // 范围引擎已由 range-core.js 提供（RangeCore），此处做别名
  const parseRangeClasses = RC.parseRangeClasses;
  const expandClasses = RC.expandClasses;
  const parseRange = RC.parseRange;
  const compressRange = RC.compressRange;
  const matrixKey = RC.matrixKey;

  // 蒙特卡洛：heroHole vs 具体 villainHole 或范围
  function calcEquity(heroHole, villainSpec, board, iterations) {
    const used = new Set(heroHole.concat(board));
    let win = 0, tie = 0, total = 0;

    if (Array.isArray(villainSpec[0])) {
      // 范围模式：从范围中随机抽一手（排除与已用牌冲突的）
      const valid = villainSpec.filter(h => !used.has(h[0]) && !used.has(h[1]));
      if (!valid.length) return null;
      for (let i = 0; i < iterations; i++) {
        const vHole = valid[Math.floor(Math.random() * valid.length)];
        const eq = runOnce(heroHole, vHole, board, used);
        win += eq.win; tie += eq.tie; total++;
      }
    } else {
      // 具体手牌
      const vHole = villainSpec;
      if (used.has(vHole[0]) || used.has(vHole[1])) return null;
      for (let i = 0; i < iterations; i++) {
        const eq = runOnce(heroHole, vHole, board, used);
        win += eq.win; tie += eq.tie; total++;
      }
    }
    return { winRate: (win + tie / 2) / total, win, tie, total };
  }

  function runOnce(heroHole, vHole, board, used) {
    const allUsed = new Set([...used, ...vHole]);
    const rest = PC.newDeck().filter(c => !allUsed.has(c));
    const need = 5 - board.length;
    const runout = board.slice();
    for (let k = 0; k < need; k++) {
      const j = Math.floor(Math.random() * rest.length);
      runout.push(rest.splice(j, 1)[0]);
    }
    const cmp = PC.compareHands(heroHole, vHole, runout);
    return { win: cmp > 0 ? 1 : 0, tie: cmp === 0 ? 1 : 0 };
  }

  /* ---------- 牌选择器 ---------- */
  const SUIT_SYMBOL = PC.SUIT_SYMBOL;
  const SUIT_COLOR = { s: 'black', h: 'red', d: 'red', c: 'black' };

  function cardPickerHtml(idPrefix, selected) {
    return `
      <div class="card-picker" id="${idPrefix}-picker">
        ${PC.RANKS.slice().reverse().map(r => `
          <div class="picker-row">
            ${PC.SUITS.map(s => {
              const card = r + s;
              const sel = selected.includes(card);
              return `<button type="button" class="picker-card ${SUIT_COLOR[s]} ${sel ? 'selected' : ''}" data-card="${card}" data-prefix="${idPrefix}">
                <span class="picker-rank">${r}</span><span class="picker-suit">${SUIT_SYMBOL[s]}</span>
              </button>`;
            }).join('')}
          </div>`).join('')}
      </div>`;
  }

  function renderSelectedCards(idPrefix, cards, max) {
    const el = $(`#${idPrefix}-selected`);
    if (!el) return;
    el.innerHTML = cards.length
      ? cards.map((c, i) => `
        <span class="pcard ${SUIT_COLOR[c[1]]}" style="cursor:pointer" data-prefix="${idPrefix}" data-remove="${i}">
          <span class="rank">${c[0]}</span><span class="suit">${SUIT_SYMBOL[c[1]]}</span>
        </span>`).join('')
      : `<span style="color:var(--text-dim);font-size:13px">点击左侧牌面选择（${max === 2 ? '2 张手牌' : '0~5 张公共牌'}）</span>`;
    // 点击已选牌可移除
    el.querySelectorAll('[data-remove]').forEach(el2 => {
      el2.addEventListener('click', () => {
        const idx = Number(el2.dataset.remove);
        const prefix = el2.dataset.prefix;
        if (prefix === 'hero') { state.heroCards.splice(idx, 1); }
        else if (prefix === 'villain') { state.villainCards.splice(idx, 1); }
        else { state.boardCards.splice(idx, 1); }
        renderPicker(prefix);
      });
    });
  }

  function renderPicker(prefix) {
    const map = { hero: state.heroCards, villain: state.villainCards, board: state.boardCards };
    const selected = map[prefix];
    const max = prefix === 'board' ? 5 : 2;
    const picker = $(`#${prefix}-picker`);
    if (!picker) return;
    picker.querySelectorAll('.picker-card').forEach(btn => {
      const card = btn.dataset.card;
      btn.classList.toggle('selected', selected.includes(card));
      btn.disabled = !selected.includes(card) && selected.length >= max;
    });
    renderSelectedCards(prefix, selected, max);
  }

  function bindPicker(prefix) {
    const picker = $(`#${prefix}-picker`);
    if (!picker) return;
    picker.addEventListener('click', e => {
      const btn = e.target.closest('.picker-card');
      if (!btn || btn.disabled) return;
      const card = btn.dataset.card;
      const map = { hero: state.heroCards, villain: state.villainCards, board: state.boardCards };
      const arr = map[prefix];
      const idx = arr.indexOf(card);
      const max = prefix === 'board' ? 5 : 2;
      if (idx >= 0) arr.splice(idx, 1);
      else if (arr.length < max) arr.push(card);
      renderPicker(prefix);
      updateCalcButton();
    });
  }

  /* ---------- 主界面 ---------- */
  const state = {
    heroCards: [],
    villainCards: [],
    boardCards: [],
    mode: 'hand',        // 'hand' | 'range'
    rangeStr: '',
    result: null,
    calculating: false
  };

  function render() {
    $('#equity-panel').innerHTML = `
      <div class="panel">
        <h2>胜率计算器</h2>
        <p class="sub">输入你的手牌、对手手牌（或范围）和公共牌，蒙特卡洛模拟 5000 次计算胜率。支持翻牌前、翻牌圈、转牌圈任意阶段。</p>

        <div class="equity-grid">
          <div class="equity-col">
            <h3>🧑 你的手牌（选 2 张）</h3>
            <div class="selected-cards" id="hero-selected"></div>
            ${cardPickerHtml('hero', state.heroCards)}
          </div>
          <div class="equity-col">
            <h3>🤖 对手</h3>
            <div class="mode-tabs">
              <button class="btn mode-tab ${state.mode === 'hand' ? 'primary' : ''}" data-mode="hand">指定手牌</button>
              <button class="btn mode-tab ${state.mode === 'range' ? 'primary' : ''}" data-mode="range">范围</button>
            </div>
            <div id="villain-hand-area" class="${state.mode === 'range' ? 'hidden' : ''}">
              <div class="selected-cards" id="villain-selected"></div>
              ${cardPickerHtml('villain', state.villainCards)}
            </div>
            <div id="villain-range-area" class="${state.mode === 'hand' ? 'hidden' : ''}">
              <input type="text" id="range-input" class="range-input" placeholder="如：AKs,QQ+,A2s+,KTo" value="${esc(state.rangeStr)}">
              <div class="range-hint">
                支持格式：对子 <code>QQ+</code>、同花 <code>AKs</code>、杂色 <code>KTo</code>、范围 <code>A2s+</code>，逗号分隔多个；也可以直接点下方矩阵
              </div>
              <div class="range-matrix-wrap">
                <div class="range-matrix" id="range-matrix"></div>
                <div class="range-matrix-legend">
                  <span><i class="rg-swatch pair"></i>对子</span>
                  <span><i class="rg-swatch suited"></i>同花</span>
                  <span><i class="rg-swatch offsuit"></i>杂色</span>
                  <span id="range-stats" class="range-stats"></span>
                </div>
              </div>
              <div class="range-presets">
                <span style="font-size:12px;color:var(--text-dim)">快捷范围：</span>
                ${[
                  '顶端 5%：QQ+,AKs',
                  '顶端 10%：77+,ATs+,KTs+,AQo+',
                  '顶端 20%：55+,A8s+,KTs+,QTs+,AJo+,KQo',
                  'UTG 开池 ~15%：77+,ATs+,KTs+,QJs,AQo+',
                  'MP 开池 ~22%：55+,A8s+,KTs+,QTs+,JTs,AJo+,KQo',
                  'CO 开池 ~30%：22+,A2s+,K9s+,Q9s+,J9s+,T9s,98s,ATo+,KJo+,QJo',
                  'BTN 开池 ~45%：22+,A2s+,K2s+,Q2s+,J4s+,T6s+,96s+,86s+,75s+,65s,54s,A2o+,K8o+,Q9o+,J9o+,T9o'
                ].map(p => {
                  const [label, val] = p.split('：');
                  return `<button class="chip preset-chip" data-range="${esc(val)}">${esc(label)}</button>`;
                }).join('')}
                <button class="chip preset-chip" data-range="__clear__">清空范围</button>
              </div>
            </div>
          </div>
          <div class="equity-col">
            <h3>🃏 公共牌（选 0~5 张）</h3>
            <div class="selected-cards" id="board-selected"></div>
            ${cardPickerHtml('board', state.boardCards)}
          </div>
        </div>

        <div style="margin-top:20px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <button class="btn primary" id="calc-btn" ${state.calculating ? 'disabled' : ''}>
            ${state.calculating ? '计算中…' : '计算胜率'}
          </button>
          <button class="btn" id="reset-btn">清空重选</button>
          <span style="font-size:12px;color:var(--text-dim)">5000 次蒙特卡洛模拟 · 约 1~2 秒</span>
        </div>

        <div id="equity-result" style="margin-top:20px"></div>
      </div>`;

    // 绑定事件
    ['hero', 'villain', 'board'].forEach(p => { bindPicker(p); renderPicker(p); });
    renderMatrix();
    bindMatrix();
    document.querySelectorAll('.mode-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        state.mode = btn.dataset.mode;
        render();
      });
    });
    const rangeInput = $('#range-input');
    if (rangeInput) {
      rangeInput.addEventListener('input', () => {
        state.rangeStr = rangeInput.value;
        renderMatrix();
        updateCalcButton();
      });
    }
    document.querySelectorAll('.preset-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        state.rangeStr = btn.dataset.range === '__clear__' ? '' : btn.dataset.range;
        state.mode = 'range';
        render();
      });
    });
    $('#calc-btn').addEventListener('click', calculate);
    $('#reset-btn').addEventListener('click', () => {
      state.heroCards = []; state.villainCards = []; state.boardCards = [];
      state.rangeStr = ''; state.result = null;
      render();
    });
    updateCalcButton();
  }

  /* ---------- 范围矩阵（13×13） ---------- */
  // 矩阵坐标规则由 range-core.js 的 matrixKey 提供
  function renderMatrix() {
    const el = $('#range-matrix');
    if (!el) return;
    const set = parseRangeClasses(state.rangeStr);
    let html = '';
    for (let row = 0; row < 13; row++) {
      for (let col = 0; col < 13; col++) {
        const key = matrixKey(row, col);
        const kind = row === col ? 'pair' : col > row ? 'suited' : 'offsuit';
        html += `<button type="button" class="rg-cell ${kind} ${set.has(key) ? 'on' : ''}" data-key="${key}">${key}</button>`;
      }
    }
    el.innerHTML = html;
    renderRangeStats(set);
  }

  function renderRangeStats(set) {
    const el = $('#range-stats');
    if (!el) return;
    if (!set.size) { el.textContent = '未选择任何手牌'; return; }
    const combos = expandClasses(set).length;
    const pct = (combos / 1326 * 100).toFixed(1);
    el.textContent = `已选 ${set.size} 类手牌 · ${combos} 组合 · 约 ${pct}%`;
  }

  function bindMatrix() {
    const el = $('#range-matrix');
    if (!el) return;
    el.addEventListener('click', e => {
      const cell = e.target.closest('.rg-cell');
      if (!cell) return;
      const set = parseRangeClasses(state.rangeStr);
      const key = cell.dataset.key;
      if (set.has(key)) set.delete(key); else set.add(key);
      state.rangeStr = compressRange(set);
      const input = $('#range-input');
      if (input) input.value = state.rangeStr;
      renderMatrix();
      updateCalcButton();
    });
  }

  function updateCalcButton() {
    const btn = $('#calc-btn');
    if (!btn) return;
    const heroOk = state.heroCards.length === 2;
    const boardOk = state.boardCards.length === 0 || state.boardCards.length === 3 || state.boardCards.length === 4 || state.boardCards.length === 5;
    let villainOk = false;
    if (state.mode === 'hand') villainOk = state.villainCards.length === 2;
    else villainOk = !!parseRange(state.rangeStr);
    btn.disabled = !(heroOk && boardOk && villainOk) || state.calculating;
  }

  function calculate() {
    if (state.calculating) return;
    state.calculating = true;
    render();

    setTimeout(() => {
      const hero = state.heroCards;
      const board = state.boardCards;
      let villainSpec;
      if (state.mode === 'hand') {
        villainSpec = state.villainCards;
      } else {
        villainSpec = parseRange(state.rangeStr);
        if (!villainSpec) {
          state.calculating = false;
          state.result = { error: '范围格式无法解析，请检查输入。' };
          render();
          return;
        }
      }

      const result = calcEquity(hero, villainSpec, board, 5000);
      state.calculating = false;
      if (!result) {
        state.result = { error: '手牌与公共牌/对手牌有冲突，请重新选择。' };
      } else {
        state.result = result;
      }
      render();
      showResult();
    }, 50);
  }

  function showResult() {
    const el = $('#equity-result');
    if (!el || !state.result) return;
    const r = state.result;
    if (r.error) {
      el.innerHTML = `<div class="lib-warn"><b>⚠️ 错误</b><p>${esc(r.error)}</p></div>`;
      return;
    }
    const heroPct = (r.winRate * 100).toFixed(1);
    const villainPct = (100 - r.winRate * 100).toFixed(1);
    const heroCls = r.winRate >= 0.6 ? 'good' : r.winRate >= 0.4 ? 'mid' : 'low';
    const villainCls = r.winRate >= 0.6 ? 'low' : r.winRate >= 0.4 ? 'mid' : 'good';

    const boardTxt = state.boardCards.length
      ? state.boardCards.map(c => PC.cardDisplay(c).text).join(' ')
      : '（翻牌前）';
    const villainTxt = state.mode === 'hand'
      ? state.villainCards.map(c => PC.cardDisplay(c).text).join(' ')
      : `范围：${esc(state.rangeStr)}`;

    el.innerHTML = `
      <div class="equity-result-box">
        <h3 style="margin-bottom:12px">📊 计算结果（${r.total} 次模拟）</h3>
        <div class="equity-compare">
          <div class="equity-side">
            <div class="equity-label">🧑 你</div>
            <div class="equity-hand">${state.heroCards.map(c => `<span class="pcard ${SUIT_COLOR[c[1]]}"><span class="rank">${c[0]}</span><span class="suit">${SUIT_SYMBOL[c[1]]}</span></span>`).join('')}</div>
            <div class="equity-pct ${heroCls}">${heroPct}%</div>
          </div>
          <div class="equity-vs">VS</div>
          <div class="equity-side">
            <div class="equity-label">🤖 对手</div>
            <div class="equity-hand" style="font-size:13px;color:var(--text-dim);padding:8px 0">${villainTxt}</div>
            <div class="equity-pct ${villainCls}">${villainPct}%</div>
          </div>
        </div>
        <div style="font-size:13px;color:var(--text-dim);margin-top:10px">
          公共牌：${boardTxt} · 胜 ${r.win} 次 / 平 ${r.tie} 次 / 负 ${r.total - r.win - r.tie} 次
        </div>
        <div class="lib-tip" style="margin-top:12px">
          <b>💡 解读</b>
          <p>${interpret(r.winRate)}</p>
        </div>
      </div>`;
  }

  function interpret(rate) {
    if (rate >= 0.75) return '你是绝对领先方（约 3:1 优势）。这种牌力在大多数局面下应该主动建立底池、榨取价值。';
    if (rate >= 0.6) return '你有明显优势（约 3:2）。可以自信地游戏这手牌，加注和持续下注都有正期望。';
    if (rate >= 0.5) return '略微领先。优势不大，注意位置和下注尺度，避免在不利局面过度投入。';
    if (rate >= 0.4) return '略微落后，但仍有可观胜率。面对合理价格可以跟注（用底池赔率判断），不宜主动大注。';
    if (rate >= 0.3) return '明显落后。只有在底池赔率极好或有隐含赔率时才应继续，多数情况弃牌是正确选择。';
    return '严重落后（不足 3 成胜率）。除非免费看牌，否则应该弃牌。长期在这种情况下跟注会持续亏损。';
  }

  window.Equity = { render };
})();
