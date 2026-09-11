/* 自动化回归测试：用最小 DOM mock 驱动 game.js 打完整场。
 * 用法：node test/harness.js [手数] [循环次数]
 *
 * 原理：mock document/localStorage，让 game.js 以为自己在浏览器里。
 * - querySelector('#game-table') 返回共享元素，innerHTML setter 记录最新渲染结果
 *   并按 HTML 重建可交互元素（data-act 按钮 / data-size chip / raise-amt 输入框），
 *   这样 render() 里 addEventListener 绑定的 handler 落在 mock 元素上，
 *   随后用 .click() 触发即可，完全走产品代码路径。
 * - setTimeout 收集到队列，flushTimers() 同步排空（AI 思考 550ms 变同步）。
 * - 玩家策略：随机行动（跟注/过牌/弃牌/加注），保证覆盖各分支。
 * 卡死判定：界面上既没有可点按钮、也没有结束文案，且无待触发定时器。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const handsTarget = Number(process.argv[2] || 5);
const rounds = Number(process.argv[3] || 30);

/* ---------- 最小 DOM mock ---------- */
function makeEl(tag) {
  const handlers = {};
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    dataset: {},
    value: '',
    _handlers: handlers,
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      toggle(c, force) {
        if (force === undefined) { this._set.has(c) ? this._set.delete(c) : this._set.add(c); }
        else if (force) this._set.add(c); else this._set.delete(c);
      },
      contains(c) { return this._set.has(c); }
    },
    addEventListener(ev, fn) { (handlers[ev] ||= []).push(fn); },
    click() {
      // 模拟真实点击：新渲染的元素只触发本次渲染后绑定的 handler
      (handlers.click || []).forEach(fn => fn());
    }
  };
  return el;
}

let currentTableHTML = '';
let interactive = [];   // 本次渲染产生的可交互元素
const staticEls = new Map();

const tableEl = makeEl('div');
Object.defineProperty(tableEl, 'innerHTML', {
  get() { return currentTableHTML; },
  set(v) {
    currentTableHTML = v;
    interactive = [];
    // 重建 data-act / data-size 按钮
    const re = /<(button|input)[^>]*>/g;
    let m;
    while ((m = re.exec(v))) {
      const raw = m[0];
      const el = makeEl(m[1]);
      const am = raw.match(/data-act="([^"]+)"/); if (am) el.dataset.act = am[1];
      const sm = raw.match(/data-size="([^"]+)"/); if (sm) el.dataset.size = sm[1];
      const im = raw.match(/id="([^"]+)"/); if (im) el.id = im[1];
      const vm = raw.match(/value="([^"]*)"/); if (vm && m[1] === 'input') el.value = vm[1];
      interactive.push(el);
    }
  }
});

global.document = {
  querySelector(sel) {
    if (sel === '#game-table') return tableEl;
    // 静态元素（#game-home 等）直接复用；id 选择器优先从最近渲染中找
    const byId = sel.startsWith('#') ? interactive.find(e => e.id === sel.slice(1)) : null;
    if (byId) return byId;
    if (!staticEls.has(sel)) staticEls.set(sel, makeEl('div'));
    return staticEls.get(sel);
  },
  querySelectorAll(sel) {
    if (sel.includes('data-act')) return interactive.filter(e => e.dataset.act);
    if (sel.includes('size-chips')) return interactive.filter(e => e.dataset.size);
    if (sel.includes('lib-link')) return [];
    return [];
  }
};

global.window = {};
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] ?? null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; }
};
global.alert = (msg) => { console.log('[alert]', msg); };

const timers = [];
global.setTimeout = (fn) => { timers.push(fn); return timers.length; };
function flushTimers() {
  let guard = 0;
  while (timers.length && guard++ < 5000) timers.shift()();
}

/* ---------- 加载产品代码 ---------- */
for (const f of ['cards.js', 'store.js', 'game.js']) {
  (0, eval)(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'));
}

/* ---------- 驱动对局 ---------- */
let stuck = 0, finished = 0;

for (let round = 0; round < rounds; round++) {
  // 预建 #game-hands（renderHome 不会主动 querySelector 它，读值发生在点击开始后）
  const handsSel = makeEl('select');
  handsSel.value = String(handsTarget);
  staticEls.set('#game-hands', handsSel);

  window.Game.renderHome();
  staticEls.get('#game-start').click();

  let steps = 0;
  const MAX = 3000;
  while (steps++ < MAX) {
    flushTimers();
    if (currentTableHTML.includes('本场对局结束')) { finished++; break; }

    const btns = interactive.filter(e => e.dataset.act);
    if (btns.length) {
      // raise 时给合法输入：追加额 > 当前跟注额（从按钮文本解析"跟注 XBB"）
      const input = interactive.find(e => e.id === 'raise-amt');
      if (input) {
        const callBtn = btns.find(b => b.dataset.act === 'call');
        const cm = callBtn && currentTableHTML.match(/data-act="call">跟注 ([\d.]+)BB/);
        const toCall = cm ? Number(cm[1]) : 0;
        input.value = String(toCall + 2 + Math.floor(Math.random() * 6));
      }
      btns[Math.floor(Math.random() * btns.length)].click();
      continue;
    }
    // 无按钮：若有"下一手/总结"按钮（id 型）也点掉
    const next = interactive.find(e => e.id === 'hand-next' || e.id === 'gm-again');
    if (next) { next.click(); continue; }

    // 既无按钮也无定时器 → 卡死
    if (!timers.length) {
      stuck++;
      console.log(`✗ [round ${round}] 卡死 @step ${steps}，最后 300 字符：`);
      console.log(currentTableHTML.slice(-300).replace(/\s+/g, ' '));
      break;
    }
  }
  if (steps >= MAX) { stuck++; console.log(`✗ [round ${round}] 超步数上限（疑似死循环）`); }
}

console.log(`\n=== 结果：${rounds} 场中 ${finished} 场正常结束，${stuck} 场卡死 ===`);
process.exit(stuck ? 1 : 0);
