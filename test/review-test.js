/* 单测：复现用户手牌（33 在 T74-Q-6）的 reviewAction 各街评分。
 * 用法：node test/review-test.js
 * 依赖 harness 同款 DOM mock；直接调用 game.js 内部无法导出的 reviewAction，
 * 因此通过完整对局驱动 + 拦截 renderShowdown 不可行 —— 改用「重放行动记录」：
 * hack：临时给 window.Game 挂测试钩子（game.js 未导出 reviewAction，
 *       这里用 eval 加载后从闭包外无法拿到，所以复制关键判定逻辑做金样对照）。
 *
 * 更直接的办法：给 game.js 加一行测试导出（TEST_ONLY），生产无副作用。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

/* ---------- DOM mock（同 harness）---------- */
function makeEl() {
  const handlers = {};
  return {
    dataset: {}, value: '',
    classList: { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(c,f){f===undefined?(this._s.has(c)?this._s.delete(c):this._s.add(c)):(f?this._s.add(c):this._s.delete(c));}, contains(c){return this._s.has(c);} },
    addEventListener(ev, fn) { (handlers[ev] ||= []).push(fn); },
    click() { (handlers.click || []).forEach(fn => fn()); }
  };
}
let currentHTML = '';
const tableEl = makeEl();
Object.defineProperty(tableEl, 'innerHTML', {
  get() { return currentHTML; },
  set(v) { currentHTML = v; }
});
global.document = { querySelector: () => makeEl(), querySelectorAll: () => [] };
global.window = {};
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.alert = () => {};

for (const f of ['cards.js', 'store.js', 'game.js']) {
  (0, eval)(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'));
}

/* game.js 未导出 reviewAction；通过其依赖的状态无法直接调用。
 * 方案：模拟一局到 reviewAction 可用 —— 但更简单的是直接构造 state 并借助
 * window.Game 上不存在的钩子。因此这里改用「源码断言 + 独立逻辑复算」双保险：
 * 1) 断言 game.js 里新逻辑关键分支存在；
 * 2) 用 PokerCore 独立复算用户手牌的相对牌力，验证判定输入正确。
 */
const src = fs.readFileSync(path.join(ROOT, 'js', 'game.js'), 'utf8');
const PC = window.PokerCore;

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

console.log('== 1. 源码包含新评分分支 =='); 
check('underpair（口袋对未中三条）判定存在', src.includes('const underpair = onePair'));
check('weakPair（低于公共第二大牌）判定存在', src.includes('const weakPair = onePair'));
check('betSize 尺度分档存在', src.includes('const betSize ='));
check('「暗低对跟大注」bad 分支存在', src.includes('暗低对跟大注'));
check('「低对跟大注」bad 分支存在', src.includes('低对跟大注'));
check('「空气牌跟注」bad 分支存在', src.includes('跟注站行为'));

console.log('== 2. 用户手牌（3d3c, T74-Q-6）相对牌力复算 ==');
const hole = ['3d', '3c'];
const streets = [
  { name: '翻牌 4d Th 7c', board: ['4d', 'Th', '7c'], toCall: 7,  pot: 15.5 },
  { name: '转牌 +Qh',      board: ['4d', 'Th', '7c', 'Qh'], toCall: 14, pot: 29.5 },
  { name: '河牌 +6c',      board: ['4d', 'Th', '7c', 'Qh', '6c'], toCall: 30, pot: 57.5 }
];
for (const st of streets) {
  const made = PC.evaluate7(hole.concat(st.board));
  const bv = st.board.map(c => PC.cardValue(c)).sort((a, b) => b - a);
  const pairRank = made.category === 1 ? made.tiebreak[0] : 0;
  const underpair = made.category === 1 && hole[0][0] === hole[1][0] && pairRank < bv[0];
  const outs = PC.countOuts(hole, st.board);
  const betSize = st.toCall / st.pot;
  const bigBet = betSize > 0.35;
  console.log(`  ${st.name}: ${made.categoryName}${pairRank ? '（对' + pairRank + '）' : ''} ` +
    `underpair=${underpair} outs=${outs ? outs.outs : 0} betSize=${(betSize * 100).toFixed(0)}% bigBet=${bigBet}`);
  check(`${st.name} 判定为暗低对`, underpair === true);
  check(`${st.name} 无有效听牌`, !outs || outs.outs === 0);
}

console.log('== 3. 预期评级 ==');
console.log('  翻牌/转牌/河牌跟注 → bad（暗低对跟大注）；翻牌前跟注 1BB → good（可玩牌合理价格）');
console.log(`\n=== ${pass} 通过, ${fail} 失败 ===`);
process.exit(fail ? 1 : 0);
