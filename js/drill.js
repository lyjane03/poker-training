/* =========================================================
 * drill.js — 场景特训（drill）
 * 固定翻牌面 + 固定筹码深度的单点决策挑战（区别于随机题库）
 * 每个场景精心构造一个教学决策点，30 秒作答，超时按 0 分
 * 记录结构：{ type:'drill', title, avgScore, count, good,
 *   details:[ { id, cat, title, ok, timedOut, score } ] }
 * ========================================================= */
(function () {
  'use strict';

  const PC = window.PokerCore;
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- 场景库 ---------- */
  // cat 取值见 CAT_NAME；lib 为知识库章节 id（「去读章节」跳转）
  const CAT_NAME = {
    preflop: '翻牌前决策',
    cbet: '持续下注判断',
    defense: '防守与反击',
    river: '河牌决断',
    odds: '赔率与全下'
  };

  const DRILLS = [
    /* ===== 翻牌前决策 ===== */
    {
      id: 'dr-pf-01', cat: 'preflop', lib: 'starting',
      title: '枪口开池后的按钮 3Bet：你拿 KQo',
      hole: ['Kc', 'Qd'], board: [],
      position: 'UTG（枪口位）', stack: '100BB',
      potInfo: '你开池 3BB，按钮 3Bet 到 10BB，底池 14.5BB',
      villain: '按钮位紧凶常客 3Bet（频率约 6%），跟注需 7BB',
      options: [
        { label: '弃牌', score: 100, feedback: '正确。KQo 面对 6% 3Bet 范围（99+、AQ+）被严重压制：翻牌出 K 输 AK，出 Q 输 AQ/QQ。UTG 开池被 3Bet 时，KQo 是标准弃牌。' },
        { label: '跟注 7BB', score: 30, feedback: '被压制的牌在 3Bet 底池无位置跟注，是长期出血点。中了顶对往往还是第二好牌——反向隐含赔率极高。' },
        { label: '4Bet 到 24BB', score: 10, feedback: 'KQo 4Bet 只会被碾压你的范围（AA/KK/AK）继续，所有更差牌都弃牌——你把一手被压制的牌打成了纯诈唬。' }
      ],
      theory: '压制概念：共享高牌时踢脚小的一方胜率仅约 25%~30%。'
    },
    {
      id: 'dr-pf-02', cat: 'preflop', lib: 'starting',
      title: '大盲防守：面对按钮 2BB 小开池的 76s',
      hole: ['7h', '6h'], board: [],
      position: 'BB（大盲位）', stack: '100BB',
      potInfo: '按钮开池 2BB，小盲弃牌，底池 3.5BB，跟注仅需 1BB',
      villain: '按钮位开池率 50% 的松手，最小尺度开池',
      options: [
        { label: '跟注 1BB', score: 100, feedback: '正确。跟注 1BB 赢 4.5BB 总池，所需胜率仅 22%——76s 对 50% 范围有约 38% 原始胜率，防守是自动的。同花连张隐含赔率还好。' },
        { label: '弃牌', score: 35, feedback: '价格太好了：22% 的门槛几乎任何可玩牌都该防守。大盲位过度弃牌是被松手偷盲剥削的直接原因。' },
        { label: '3Bet 到 8BB', score: 55, feedback: '有位置意识的玩家会做这个混合打法，但 76s 跟注的 EV 已很高；3Bet 留给 Axs、KQo 这类阻断/价值候选更平衡。' }
      ],
      theory: '大盲防守由底池赔率决定，不是凭感觉：所需胜率 = 跟注额 ÷ 跟注后总底池。'
    },

    /* ===== 持续下注判断 ===== */
    {
      id: 'dr-cb-01', cat: 'cbet', lib: 'sizing',
      title: 'K 高干燥面：顶对顶踢脚的持续下注',
      hole: ['As', 'Kh'], board: ['Kd', '7c', '2s'],
      position: 'BTN（按钮位）', stack: '剩余约 92BB',
      potInfo: '你开池 2.5BB，大盲跟注，底池 5.5BB',
      villain: '大盲过牌，轮到你',
      options: [
        { label: '下注 2BB（1/3 底池）', score: 100, feedback: '正确。干燥 K 高面对开池者范围极有利（你有所有 KK/AK/KQ），全范围小注是现代标准打法——诈唬只需 25% 弃牌率回本，何况你中了顶对顶踢脚。' },
        { label: '过牌', score: 40, feedback: '浪费了最有利的牌面。这个牌面打走对手全部未成牌范围、还拿 Kx 更差踢脚的价值，过牌等于免费给 QJ 看转牌。' },
        { label: '下注 4.5BB（接近底池）', score: 45, feedback: '尺度偏大。干燥面大注打走所有想留的牌（7x、口袋小对），只留碾压你的 K 大踢脚——1/3 小注效率更高。' }
      ],
      theory: '干燥高牌面 = 范围优势方全范围小注（1/3 底池）。'
    },
    {
      id: 'dr-cb-02', cat: 'cbet', lib: 'sizing',
      title: 'J♠9♠8♥ 湿润面：超对 AA 的下注决策',
      hole: ['Ac', 'Ad'], board: ['Js', '9s', '8h'],
      position: 'CO（关煞位）', stack: '剩余约 90BB',
      potInfo: '你开池 2.5BB，按钮跟注，底池 6.5BB',
      villain: '按钮（跟注范围含大量同花连张）过牌',
      options: [
        { label: '下注 5BB（3/4 底池）', score: 100, feedback: '正确。湿润面强牌要下大注：牌面上听牌泛滥（顺子、同花、组合听牌），必须给所有听牌错误的价格。AA 现在领先，但近一半转牌都会让你难受——现在就收费。' },
        { label: '下注 2BB（1/3 底池）', score: 35, feedback: '湿润面小注 = 给听牌送正确赔率。同花听牌翻牌后约 35% 权益，小注让它轻松跟注；你的超对在被抽死的路上。' },
        { label: '过牌控池', score: 40, feedback: 'AA 过牌在这个牌面过于谨慎：你仍有明显范围优势，且免费牌几乎全是坏牌（任何黑桃、T、Q、7）。控池留给中对类牌力。' }
      ],
      theory: '牌面越湿润，成牌下注越大——核心是剥夺听牌的正确跟注价。'
    },
    {
      id: 'dr-cb-03', cat: 'cbet', lib: 'sizing',
      title: '8♣4♦2♦ 低张面：两高张的过牌选择',
      hole: ['Ah', 'Qc'], board: ['8c', '4d', '2d'],
      position: 'BTN（按钮位）', stack: '剩余约 93BB',
      potInfo: '你开池 2.5BB，大盲跟注，底池 5.5BB',
      villain: '大盲过牌，轮到你',
      options: [
        { label: '过牌', score: 100, feedback: '正确。低张面对大盲跟注范围最有利（小对子、同花连张全中），你的 AQ 只有 6 张抽对补牌。低频率 c-bet 或 check back 是标准打法——别在对手的范围优势面烧钱。' },
        { label: '下注 2BB', score: 45, feedback: '范围下注流可以接受小注，但这个牌面弃牌率远低于 A/K 高面，AQ 无后门权益，check back 的 EV 更高。' },
        { label: '下注 4BB', score: 25, feedback: '低张面大注只会被中对、对子、听牌继续——全是领先你的牌。诈唬投入大、成功率低，双重负 EV。' }
      ],
      theory: '牌面结构决定 c-bet 频率：对手范围优势面要降频甚至全范围过牌。'
    },

    /* ===== 防守与反击 ===== */
    {
      id: 'dr-df-01', cat: 'defense', lib: 'position',
      title: '按钮位 Float 机会：翻牌对手机械 c-bet',
      hole: ['9h', '8h'], board: ['Kc', '6d', '2s'],
      position: 'BTN（按钮位）', stack: '剩余约 92BB',
      potInfo: '对手 CO 开池 2.5BB，你跟注，底池 6.5BB，对手 c-bet 2BB',
      villain: '对手翻牌 c-bet 率 85%，但转牌继续率仅 30%（机械一枪流）',
      options: [
        { label: '跟注 2BB（Float）', score: 100, feedback: '正确。教科书 Float 场景：有位置 + 对手一枪流 + 你有后门花顺权益。转牌他过牌（70% 概率）你主动下注收池；他还打你还有补牌可跟。' },
        { label: '弃牌', score: 40, feedback: '对机械一枪流弃牌正中下怀。他 85% 频率下注说明大量是空气——弃牌等于放弃针对他漏洞的剥削机会。' },
        { label: '加注到 7BB', score: 35, feedback: '翻牌 bluff raise 对机械 c-bet 者效率不高：他范围里真有 K 时会继续，你的加注成本高。Float 成本更低且保留信息优势。' }
      ],
      theory: 'Float = 有位置跟注翻牌、计划转牌对手示弱时偷池，专罚「翻牌必打、转牌就弃」的机械玩家。'
    },
    {
      id: 'dr-df-02', cat: 'defense', lib: 'gto',
      title: '河牌面对超池：抓诈牌 A♦ 高牌的 MDF 判断',
      hole: ['Ad', '7s'], board: ['Kc', '8d', '3h', '2c', '9s'],
      position: 'BB（大盲位）', stack: '剩余约 60BB',
      potInfo: '底池 30BB，对手河牌超池下注 45BB',
      villain: '对手是平衡型常客，行动线：翻牌前他跟注你的开池，翻牌后连过三街后河牌突然超池',
      options: [
        { label: '弃牌', score: 100, feedback: '正确。面对 1.5x 超池需要 37.5% 胜率，且 MDF 仅 40%。A 高牌在这个行动线下只赢纯诈唬——对手超池极化后，你的抓诈牌赔率与频率都不够，让顶端范围去防守。' },
        { label: '跟注 45BB', score: 25, feedback: '超池的数学：跟注 45 赢 120 总池需 37.5% 胜率。A 高对价值范围（顺子/两对+）全输，只在对手诈唬率超 4 成时正确——对平衡型常客不能这么假设。' }
      ],
      theory: 'MDF 与极化：超池下注是极化信号，边缘抓诈牌让给范围顶端，过度弃牌在此合法。'
    },
    {
      id: 'dr-df-03', cat: 'defense', lib: 'exploit',
      title: '面对跟注站的三连枪：顶对还打吗',
      hole: ['Ah', 'Jd'], board: ['Jc', '7d', '2s', '4c', 'Qh'],
      position: 'BTN（按钮位）', stack: '剩余约 75BB',
      potInfo: '你翻牌、转牌连打两条街（均被跟注），河牌底池 28BB',
      villain: '对手是跟注站（跟注率 60%，几乎不弃牌），河牌你顶对好踢脚',
      options: [
        { label: '下注 20BB（价值）', score: 100, feedback: '正确。跟注站原则：永远不诈唬，但价值下注范围整体下移+尺度拉满。他用 Jx 弱踢脚、7x、4x 都会跟——顶对好踢脚在河牌是明显的三条街价值牌。' },
        { label: '过牌求摊牌', score: 35, feedback: '对跟注站过牌顶对是白白送钱：他跟注范围里大量更差牌愿意再支付一街。对价格不敏感的对手，河牌价值浓度最高。' },
        { label: '全下 75BB', score: 40, feedback: '过犹不及。超池全下只留 JQ/Qx 两对以上，打走全部想拿价值的 Jx——跟注站也要按合理大尺度（60%~80% 底池）定价。' }
      ],
      theory: '剥削跟注站 = 零诈唬 + 放宽价值范围 + 加大价值尺度。'
    },

    /* ===== 河牌决断 ===== */
    {
      id: 'dr-rv-01', cat: 'river', lib: 'gto',
      title: '河牌阻断牌诈唬：A♦ 在手，花成面偷池',
      hole: ['Ad', '5c'], board: ['Kd', '8d', '2h', '4s', '9d'],
      position: 'BTN（按钮位）', stack: '剩余约 55BB',
      potInfo: '翻牌、转牌都过牌，河牌第三张方块落下，底池 12BB',
      villain: '对手（大盲）河牌过牌，行动线显示牌力封顶（有同花转牌会打）',
      options: [
        { label: '下注 10BB（诈唬）', score: 100, feedback: '正确。完美诈唬三要素全齐：① A♦ 阻断坚果同花（对手不可能是 nuts）；② 行动线对手范围封顶；③ 你摊牌价值为零（A 高输给任何对子）。半池以上尺度代表同花。' },
        { label: '过牌摊牌', score: 30, feedback: 'A 高在这个牌面几乎赢不了摊牌（对手任何对子、Kx 都赢你）。零摊牌价值 + 坚果阻断牌 = 最优先诈唬候选，过牌是浪费阻断信息。' },
        { label: '全下 55BB', score: 35, feedback: '4.5 倍超池用力过猛：只需让 Kx、中对弃牌，10~15BB 已足够；全下把诈唬成本推到极限，只被同花跟注——风险回报失衡。' }
      ],
      theory: '诈唬候选三要素：阻断对手跟注范围 + 自身摊牌价值低 + 行动线支持故事的牌。'
    },
    {
      id: 'dr-rv-02', cat: 'river', lib: 'sizing',
      title: '河牌薄价值：顶对顶踢脚该下多大',
      hole: ['As', 'Qh'], board: ['Qd', '8c', '3s', '5h', '2d'],
      position: 'CO（关煞位）', stack: '剩余约 70BB',
      potInfo: '你翻牌、转牌连续中小注，对手均跟注，河牌白板 2♦，底池 24BB',
      villain: '对手（被动型）河牌过牌，你跟注范围读为 Qx、8x、听牌未中',
      options: [
        { label: '下注 14BB（约 60% 底池）', score: 100, feedback: '正确。薄价值的定价艺术：对手范围里 Qx 弱踢脚愿意支付中注，太小（<1/3）浪费价值，太大（>底池）只留两对以上。被动玩家对价格不敏感但范围封顶——60% 底池是甜点。' },
        { label: '过牌', score: 40, feedback: '顶对顶踢脚 + 白板河牌 + 对手封顶范围，过牌等于放弃最后一枪价值。8x 支付不了但 QJ/QT 一定会跟。' },
        { label: '全下 70BB', score: 20, feedback: '近 3 倍超池只被两对、Set 跟注——全赢你的牌。薄价值牌用超池是把价值下注打成自杀式极化。' }
      ],
      theory: '价值下注先定目标再定尺度：想让哪些更差牌跟？它们愿意支付多少？'
    },

    /* ===== 赔率与全下 ===== */
    {
      id: 'dr-od-01', cat: 'odds', lib: 'gto',
      title: '翻牌花顺双抽面对全下：跟注的数学',
      hole: ['Jd', 'Td'], board: ['9d', '8h', '2d'],
      position: 'BB（大盲位）', stack: '剩余 35BB',
      potInfo: '翻牌前你跟注开池，底池 8BB，对手翻牌全下 35BB',
      villain: '短筹码对手全下，你是花顺双抽（15 张补牌），跟注需 35BB 赢 78BB',
      options: [
        { label: '跟注全下', score: 100, feedback: '正确。15 张补牌 × 4% ≈ 54% 胜率（翻牌后看两张牌），所需胜率仅 35 ÷ 78 ≈ 45%——数学上明确跟注。花顺双抽在翻牌圈甚至领先大多数成牌。' },
        { label: '弃牌', score: 20, feedback: '对最强听牌弃牌是数学错误：你有 15 张补牌，胜率过半，跟注长期是印钞机。把「听牌」和「弱牌」划等号是新手误区。' }
      ],
      theory: '听牌决策三步链：数补牌（15）→ 二四法则算胜率（54%）→ 对比底池赔率（需 45%）。'
    },
    {
      id: 'dr-od-02', cat: 'odds', lib: 'gto',
      title: '卡顺+高张面对 2/3 池注：隐含赔率够不够',
      hole: ['As', 'Qd'],
      board: ['Kc', '8h', '3d'],
      position: 'BTN（按钮位）', stack: '剩余约 80BB（对手 cover）',
      potInfo: '底池 18BB，对手转牌前位下注 12BB（2/3 池）',
      villain: '紧手转牌大注，你卡 J 顺 + 两张高张',
      options: [
        { label: '弃牌', score: 100, feedback: '正确。卡顺 4 张补牌 × 2% ≈ 9% 胜率（转牌圈），所需胜率 12 ÷ 42 ≈ 29%，差距悬殊。高张抽对不能算标准补牌（可能撞上对手两对/Set），紧手大注时反向隐含赔率还高——弃牌清晰。' },
        { label: '跟注 12BB', score: 25, feedback: '直接赔率差 3 倍，隐含赔率也补不上：中了 J 你未必赢（对手可能是顺子面的一部分），中了 A/Q 还可能被 AK 压制。模糊权益不是跟注理由。' },
        { label: '加注到 36BB', score: 15, feedback: '半诈唬需要弃牌率 + 补牌双支撑：紧手 2/3 池注代表强牌不愿弃，你的补牌只有 4 张——两个条件都没有，加注是纯烧钱。' }
      ],
      theory: '警惕脏补牌与抽对陷阱：中了未必赢的牌要打折，模糊权益不算补牌。'
    },
    {
      id: 'dr-od-03', cat: 'odds', lib: 'starting',
      title: '15BB 短筹码：小对子的翻牌前全下判断',
      hole: ['6c', '6s'], board: [],
      position: 'CO（关煞位）', stack: '15BB',
      potInfo: '前面全弃到你，底池 1.5BB',
      villain: '后位三家筹码都 cover 你',
      options: [
        { label: '全下 15BB', score: 100, feedback: '正确。15BB 深度小对子全下是标准打法：① 翻牌前拿下 1.5BB 收益可观；② 被对子跟注时 66 领先 22~55、对两高张约 55:45 抛硬币；③ 开池小注后被 3Bet 反而难打——短筹码直接兑现弃牌权益。' },
        { label: '开池 2.5BB', score: 45, feedback: '可混合但非最优：15BB 开池后面对 3Bet 只剩「全下或弃牌」，被宽范围 3Bet 时 66 的处境尴尬。直接全下简化决策且数学不亏。' },
        { label: '弃牌', score: 20, feedback: '15BB 的 66 弃牌太紧：它是明显的盈利全下牌，弃牌等于白送盲注。短筹码阶段每 1.5BB 都至关重要。' },
        { label: '平跟 1BB', score: 10, feedback: '短筹码 Limp 是最差选项：暴露牌力、给盲注免费看牌、被加注后进退两难。15BB 只有全下或弃牌两种打法。' }
      ],
      theory: '短筹码（<20BB）小对子：Set Mining 隐含赔率不再成立，全下兑现弃牌权益更优。'
    }
  ];

  /* ---------- 会话状态 ---------- */
  const session = {
    drills: [], idx: 0, results: [],
    answered: false, deadline: 0, timer: null
  };
  const TIME_LIMIT = 30; // 秒

  /* ---------- 首页 ---------- */
  function renderHome() {
    const stats = window.Store.stats();
    const catOptions = ['<option value="all">全部场景（混合）</option>']
      .concat(Object.entries(CAT_NAME).map(([k, v]) => `<option value="${k}">${v}</option>`)).join('');

    $('#drill-home').innerHTML = `
      <div class="panel">
        <h2>场景特训</h2>
        <p class="sub">固定牌面 + 固定筹码深度的单点决策挑战。与随机题库不同，每个场景都是精心构造的教学决策点——${DRILLS.length} 个经典场面，覆盖翻牌前、持续下注、防守反击、河牌决断与赔率计算。每题 30 秒作答。</p>
        <div class="quiz-stats">
          <span class="stat-chip">场景库 ${DRILLS.length} 个</span>
          <span class="stat-chip">已训练 ${stats.drillCount || 0} 组</span>
          ${stats.drillAvg != null ? `<span class="stat-chip">平均分 ${stats.drillAvg}</span>` : ''}
        </div>
        <div class="filters">
          <div class="filter-group">
            <label>场景类别</label>
            <select id="drill-cat">${catOptions}</select>
          </div>
          <div class="filter-group">
            <label>本次题数</label>
            <select id="drill-count">
              <option value="5" selected>5 题（快速）</option>
              <option value="10">10 题（标准）</option>
              <option value="0">全部</option>
            </select>
          </div>
          <button class="btn primary" id="drill-start">开始特训</button>
        </div>
        <div class="lib-tip" style="margin-top:14px">
          <b>💡 怎么用最高效</b>
          <p>先按类别逐个击破（如连刷 3 组「河牌决断」），再切混合模式检验。每题答完务必读解析——场景特训的价值在解析里的决策逻辑，不在分数本身。</p>
        </div>
      </div>`;
    $('#drill-start').addEventListener('click', startSession);
  }

  function startSession() {
    const cat = $('#drill-cat').value;
    const count = Number($('#drill-count').value);
    let pool = DRILLS.filter(d => cat === 'all' || d.cat === cat);
    pool = pool.slice().sort(() => Math.random() - 0.5);
    if (count > 0) pool = pool.slice(0, count);
    if (!pool.length) { alert('该类别暂无场景。'); return; }
    session.drills = pool;
    session.idx = 0;
    session.results = [];
    // 选项乱序（防位置记忆）
    session.orders = pool.map(d => d.options.map((_, i) => i).sort(() => Math.random() - 0.5));
    $('#drill-home').classList.add('hidden');
    $('#drill-session').classList.remove('hidden');
    renderDrill();
  }

  function cardHtml(c) {
    const d = PC.cardDisplay(c);
    return `<span class="pcard ${d.color}"><span class="rank">${d.text[0]}</span><span class="suit">${d.text.slice(1)}</span></span>`;
  }

  function renderDrill() {
    const d = session.drills[session.idx];
    session.answered = false;
    const pct = Math.round((session.idx / session.drills.length) * 100);
    const order = session.orders[session.idx];
    session.deadline = Date.now() + TIME_LIMIT * 1000;

    $('#drill-session').innerHTML = `
      <div class="panel">
        <div class="q-head">
          <span class="badge cat">${CAT_NAME[d.cat]}</span>
          <span class="badge d2">固定场景</span>
          <span style="margin-left:auto;font-size:13px;color:var(--text-dim)">第 ${session.idx + 1} / ${session.drills.length} 题</span>
        </div>
        <div class="progress"><div style="width:${pct}%"></div></div>
        <div class="draw-timer"><div class="draw-timer-bar" id="drill-timer-bar" style="width:100%"></div></div>
        <h2 style="font-size:18px;margin:10px 0">${esc(d.title)}</h2>
        <div class="table-wrap" style="padding:18px">
          ${d.board.length ? `
          <div class="board-area">
            <div class="street-label">公共牌（${['翻牌','转牌','河牌'][d.board.length - 3] || ''}）</div>
            <div class="pcards">${d.board.map(cardHtml).join('')}</div>
          </div>` : '<div class="street-label" style="text-align:center;color:var(--text-dim)">— 翻牌前 —</div>'}
          <div class="seat hero">
            <div class="who"><span class="name">🧑 你的手牌</span><span class="chips">${PC.handNotation(d.hole)}</span></div>
            <div class="pcards" style="margin-top:8px">${d.hole.map(cardHtml).join('')}</div>
          </div>
        </div>
        <div class="scenario" style="margin-top:12px">
          <div class="row"><span class="k">你的位置</span><span>${esc(d.position)}</span></div>
          <div class="row"><span class="k">筹码深度</span><span>${esc(d.stack)}</span></div>
          <div class="row"><span class="k">底池</span><span>${esc(d.potInfo)}</span></div>
          <div class="row"><span class="k">对手信息</span><span>${esc(d.villain)}</span></div>
        </div>
        <p style="font-size:14px;font-weight:600;margin:12px 0 6px">你的决策是？</p>
        <div class="opt-list" id="opt-list">
          ${order.map((oi, i) => `<button class="opt" data-i="${i}">${'ABCD'[i]}. ${esc(d.options[oi].label)}</button>`).join('')}
        </div>
        <div id="drill-feedback"></div>
      </div>`;

    document.querySelectorAll('#opt-list .opt').forEach(btn =>
      btn.addEventListener('click', () => answer(d, Number(btn.dataset.i))));

    clearInterval(session.timer);
    session.timer = setInterval(() => {
      const remain = Math.max(0, session.deadline - Date.now());
      const bar = $('#drill-timer-bar');
      if (bar) {
        bar.style.width = (remain / (TIME_LIMIT * 1000) * 100) + '%';
        bar.classList.toggle('low', remain < 5000);
      }
      if (remain <= 0) { clearInterval(session.timer); answer(d, undefined); }
    }, 100);
  }

  function answer(d, shownIdx) {
    if (session.answered) return;
    session.answered = true;
    clearInterval(session.timer);

    const timedOut = shownIdx === undefined;
    const order = session.orders[session.idx];
    const chosen = timedOut ? null : d.options[order[shownIdx]];
    const best = d.options.reduce((a, b) => (b.score > a.score ? b : a));
    const ok = !!chosen && chosen.score >= 80;
    const remainBonus = ok ? Math.round(Math.max(0, session.deadline - Date.now()) / 1000 / TIME_LIMIT * 15) : 0;
    const score = timedOut ? 0 : Math.min(100, chosen.score + (ok ? remainBonus : 0));
    session.results.push({ id: d.id, cat: d.cat, title: d.title, ok, timedOut, score });

    document.querySelectorAll('#opt-list .opt').forEach((btn, i) => {
      btn.disabled = true;
      const o = d.options[order[i]];
      if (o === best) btn.classList.add('correct');
      else if (i === shownIdx) btn.classList.add(o.score >= 45 ? 'partial' : 'wrong');
      else btn.classList.add('dim');
    });

    const lastOne = session.idx === session.drills.length - 1;
    const scoreLabel = timedOut ? '⏰ 超时未作答'
      : chosen.score >= 80 ? '✅ 优秀决策'
      : chosen.score >= 45 ? '🟡 可接受但非最优' : '❌ 明显错误';

    $('#drill-feedback').innerHTML = `
      <div class="explain">
        <div class="score-line">${scoreLabel}　本题得分：<b>${score}</b> / 100${ok && remainBonus ? `（含速度奖励 +${remainBonus}）` : ''}</div>
        ${chosen ? `<p style="font-size:14px;margin-bottom:8px;">${esc(chosen.feedback)}</p>` : ''}
        ${chosen !== best ? `<p style="font-size:14px;margin-bottom:8px;"><b>最优选择：</b>${esc(best.label)}</p>` : ''}
        <p style="font-size:13.5px;color:var(--text-dim)">📖 理论：${esc(d.theory)}</p>
        <div style="margin-top:10px">
          <button class="btn lib-link" id="drill-lib">📖 去读相关章节</button>
        </div>
        <div style="margin-top:12px;text-align:right">
          <button class="btn primary" id="drill-next">${lastOne ? '查看本组成绩' : '下一题'}</button>
        </div>
      </div>`;
    $('#drill-lib').addEventListener('click', () => {
      clearInterval(session.timer);
      window.Library.open(d.lib, { returnView: 'drill', returnLabel: '场景特训' });
    });
    $('#drill-next').addEventListener('click', () => {
      if (lastOne) finishSession(); else { session.idx++; renderDrill(); }
    });
  }

  function finishSession() {
    const avg = Math.round(session.results.reduce((s, r) => s + r.score, 0) / session.results.length);
    const good = session.results.filter(r => r.ok).length;
    window.Store.add({
      type: 'drill',
      title: `场景特训 ${session.drills.length} 题`,
      avgScore: avg,
      count: session.drills.length,
      good,
      details: session.results
    });

    // 按类别统计本组表现
    const catStat = {};
    session.results.forEach(r => {
      catStat[r.cat] = catStat[r.cat] || { n: 0, ok: 0 };
      catStat[r.cat].n++;
      if (r.ok) catStat[r.cat].ok++;
    });

    $('#drill-session').innerHTML = `
      <div class="panel" style="text-align:center">
        <h2>本组特训完成</h2>
        <p style="font-size:44px;font-weight:800;color:var(--green-dark);margin:14px 0 4px">${avg}</p>
        <p style="color:var(--text-dim)">平均分（满分 100） · 优秀 ${good}/${session.drills.length} 题</p>
        <div style="margin-top:16px;text-align:left;max-width:420px;margin-left:auto;margin-right:auto">
          ${Object.entries(catStat).map(([k, v]) => `
            <div class="bar-row">
              <span class="bar-label">${CAT_NAME[k]}</span>
              <span class="bar-track"><span class="bar-fill ${v.ok / v.n < 0.6 ? 'high' : ''}" style="width:${Math.round(v.ok / v.n * 100)}%"></span></span>
              <span class="bar-num">${v.ok}/${v.n} 优秀</span>
            </div>`).join('')}
        </div>
        <div style="margin-top:20px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button class="btn primary" id="drill-again">再来一组</button>
          <button class="btn" id="drill-back">返回</button>
          <button class="btn" id="drill-history">查看历史记录</button>
        </div>
      </div>`;
    $('#drill-again').addEventListener('click', () => {
      $('#drill-session').classList.add('hidden');
      $('#drill-home').classList.remove('hidden');
      startSession();
    });
    $('#drill-back').addEventListener('click', exitSession);
    $('#drill-history').addEventListener('click', () => { exitSession(); window.App.switchView('history'); });
  }

  function exitSession() {
    clearInterval(session.timer);
    $('#drill-session').classList.add('hidden');
    $('#drill-home').classList.remove('hidden');
    renderHome();
  }

  window.Drill = { renderHome };
})();
