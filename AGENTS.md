# AGENTS.md

> 德州扑克策略训练器 —— 项目技术设计与开发指引。
> 面向在此仓库协作的 AI Agent 与开发者：先读本文再动手。

## 1. 项目定位

面向「新手到进阶」的德州扑克学习工具，**纯前端、零依赖、零构建**：原生 HTML/CSS/JS，双击 `index.html` 即可运行，数据全部保存在浏览器 `localStorage`。

四大核心模块：题库训练、听牌特训、自由练习（人机单挑）、知识库 + 历史复盘。

## 2. 技术栈与约束

- **无任何第三方库、无构建步骤**。不要引入 npm 包、框架、打包器。
- 每个 JS 文件是一个 **IIFE**，通过 `window.Xxx` 暴露单一命名空间。
- 加载顺序（`index.html` 底部）**必须**保持依赖顺序：核心引擎 → 数据 → 存储 → 视图模块 → 入口。
- 中文界面，扑克牌用 Unicode 花色符号（♠♥♦♣）。牌用 `"As"`、`"Td"` 这类「点数 + 花色首字母」字符串表示（详见 §5）。
- 适配移动端：底部有 720px 断点的媒体查询。

## 3. 文件职责

| 文件 | 命名空间 | 职责 |
|---|---|---|
| `js/cards.js` | `PokerCore` | **扑克核心引擎**：发牌、洗牌、牌型评估（7 选 5）、手牌比较、手牌强度分级、**补牌计数 countOuts**、**蒙特卡洛胜率 realizeEquity** |
| `js/questions.js` | `QuizData` | 题库数据（30 题，`CATEGORIES` + `QUESTIONS`） |
| `js/library-data.js` | `LibraryData` | 知识库手册数据（6 章，`CHAPTERS`） |
| `js/store.js` | `Store` | `localStorage` 持久化（记录增删查 + 统计 `stats()`） |
| `js/quiz.js` | `Quiz` | 题库训练流程与 UI（含错题本、选项乱序、结算跳转） |
| `js/draws.js` | `Draws` | 听牌特训（程序随机生成场景 + 倒计时 + 三种题型） |
| `js/game.js` | `Game` | 人机单挑引擎（下注轮状态机、AI 决策、逐条点评、亮底牌） |
| `js/library.js` | `Library` | 知识库视图（章节目录 + 正文），提供 `Library.open(chapterId)` 供跨模块跳转 |
| `js/history.js` | `History` | 历史筛选 + 复盘详情 + 统计诊断面板（趋势图 + 失误分布） |
| `js/app.js` | `App` | 入口：标签切换 `App.switchView(name)` + 初始化 |

### 加载顺序（勿改）

```
cards.js → questions.js → library-data.js → store.js
→ quiz.js → draws.js → game.js → library.js → history.js → app.js
```

## 4. 视图结构

`index.html` 中每个功能是一个 `<section class="view" id="view-XXX">`，顶栏 `.tab` 按钮 `data-view` 对应视图 id。`app.js` 的 `switchView(name)` 负责切换，并调用对应模块的 `renderHome()`（library 是 `render()`，history 是 `render()`）。

**新增视图时**：① 在 `index.html` 加 `section` + `.tab` 按钮；② 在 `app.js` 的 `switchView` 加一行渲染调用。

## 5. 牌与引擎约定

- 牌字符串：`rank + suit`，rank ∈ `2..9,T,J,Q,K,A`，suit ∈ `s,h,d,c`（黑桃/红桃/方块/梅花）。如 `"As"`=黑桃A，`"Td"`=方块T。
- `PokerCore` 关键 API：
  - `newDeck()` / `shuffle(deck)` / `evaluate7(cards)` / `compareHands(a,b,board)`
  - `handNotation(hole)` → `"AKs"`、`"77"`、`"QJo"`
  - `cardDisplay(c)` → `{ text:'A♠', color:'red'|'black' }`（**注意**：`text[0]` 是 rank、`text.slice(1)` 是花色符号）
  - `holeTier(hole)` → `premium|strong|playable|weak`
  - `countOuts(hole, board)` → `{ outs, flushOuts, straightOuts, improveOuts, parts[] }`
  - `realizeEquity(hole, board, iterations)` → 0~1 胜率
- **牌面渲染**用双行布局：`<span class="pcard red"><span class="rank">A</span><span class="suit">♠</span></span>`。新增牌渲染逻辑请复用各模块内的 `cardHtml(c)` 帮助函数，保持结构一致。

## 6. 数据结构与 localStorage Schema

- key：`poker_trainer_records_v1`，值为记录数组（最新在前，最多 500 条）。
- **迭代红线（保护用户历史记录）**：
  - 主 key `poker_trainer_records_v1` **永远不许改名**；新增功能一律用新 key。
  - **禁止**调用 `localStorage.clear()` 或整体覆盖；`Store.clear()` 只能由用户在历史页手动触发。
  - 每次写入会同步写备份 key `poker_trainer_records_v1_backup`；主 key 缺失/损坏时 `loadAll()` 自动从备份恢复，不要移除该机制。
  - localStorage 按来源隔离：file:// 直开与 `http://localhost:<port>` 是不同数据空间，换端口也会换空间——预览/使用请固定一种打开方式。
- 记录通用字段：`{ id, ts, type }`，`type` ∈ `'quiz' | 'game' | 'draw'`。

### quiz 记录

```js
{ type:'quiz', title, avgScore, count, good,
  details:[ { qid, title, category, catKey, difficulty, chosen, best, score, theory } ] }
```

### game 记录

```js
{ type:'game', title, score, hands, totalDelta, goodActions, badActions,
  details:[ { handNo, result, heroDelta, heroHand, board, aiHand, aiMade,
              reviews:[ { grade:'good|mixed|bad', title, body, theory:{name,cat}, action } ],
              handLog:[...] } ] }
```

### draw 记录

```js
{ type:'draw', title, avgScore, count, good,
  details:[ { type:'outs|rule|odds', ok, timedOut, score, street:'flop|turn' } ] }
```

### theory 字段约定

`theory` 在 quiz 中是**字符串**，在 game 的 review 中是 **`{ name, cat }` 对象**（`cat` 是知识库章节 id）。history.js 渲染时做了兼容处理。新增点评时，务必带上 `cat`（取值见下），用于「去读章节」跳转。

**章节 id → 中文名**：`starting` 起手牌 / `position` 位置 / `sizing` 下注尺度 / `gto` GTO 基础 / `exploit` 剥削打法 / `appendix` 附录。

## 7. 关键实现约定

- **错题本**（`quiz.js`）：`bestScores()` 从全部 quiz 记录中取每题历史最好分；「只练未掌握」= 最好分 <80 或未作答；「只练错题」= 作答过且 <80。选项顺序通过 `session.orders` 随机打乱（防止位置记忆）。
- **听牌特训**（`draws.js`）：场景由 `genScenario()` 按 30% 听花 / 25% OESD / 20% 卡顺 / 15% 花顺双抽 / 10% 兜底构造，保证 outs 在 4~15；三种题型（数补牌 / 二四法则算胜率 / 赔率决策）按 4:3:3 抽取。计时翻牌 30s、转牌 15s，答对有速度奖励。
- **亮底牌**（`game.js`）：`settle()` 无论是否摊牌都写 `state.aiReveal`（含 `aiHand`/`aiMade`），`renderShowdown` 展示，并随 `finishHand` 存入历史。
- **点评跳转**：`game.js` 每条 review 的 `theory.cat` + `quiz.js` 的 `q.category`（即 catKey）都是章节 id，统一走 `window.Library.open(chapterId)`。
- **知识库跳转**：`Library.open(chapterId)` 会先 `App.switchView('library')` 再定位章节。
- **结算日志**：`game.js` 用 `log()`（写入滚动日志 + 手牌日志）与 `logMeta()`（只写滚动日志）区分，避免结算信息在 handLog 里重复。

## 8. 设计风格

- 浅色主题，扑克桌绿（`--green: #0e7a46`）作品牌色。
- 卡片、面板统一圆角 + 轻阴影（见 `css/style.css` 的 CSS 变量）。
- 状态色：正确/优秀=绿，一般=琥珀 `--amber`，错误/失误=红 `--red`。
- 所有 CSS 变量集中在 `:root`，新增样式优先复用变量，勿硬编码颜色。

## 9. 待办（TODO）

按优先级排列：

- [x] **多人桌（6-max）**：当前仅单挑。需扩展 `game.js` 状态机支持多玩家、位置环、多人底池与边池计算。
- [x] **3-bet / 4-bet 底池专项场景**：新增 `questions.js` `3bet` 分类 9 题 + 附录术语（挤压、4Bet 构成、冷跟门槛、全下临界计算等）。
- [ ] **ICM / 锦标赛概念**：全下弃牌权益（fold equity）、奖金结构相关训练。
- [x] **场景特训（drill）**：`js/drill.js` 固定牌面 + 固定筹码深度的单点决策挑战（13 个场景，5 类），区别于随机题库。
- [x] **范围可视化**：手牌范围表（range chart）图形化，替代纯文字范围描述。
- [x] **胜率计算器**：交互式输入手牌 vs 范围，调用 `realizeEquity` 展示胜率（可作独立小工具）。
- [ ] **数据导出/导入**：localStorage 记录的 JSON 备份与迁移。
- [ ] **音效与操作反馈**：可选。
- [x] **题库扩充**：当前 42 题，含多人底池、翻牌后多街、范围阅读、3Bet/4Bet 底池。
- [ ] **i18n**：如需英文界面，抽离文案。

## 10. 修改后必做

1. `node --check js/<改动文件>.js`（用仓库外的 Node 即可）。
2. 涉及 `cards.js` 引擎改动时，跑 `countOuts`/`evaluate7` 的边界用例（同花顺/轮子/平分底池等，历史单测见 README）。
3. 手动打开 `index.html` 走一遍：题库 → 听牌特训 → 自由练习（打完一手看点评+亮底牌）→ 历史复盘（看趋势图与分布）。
