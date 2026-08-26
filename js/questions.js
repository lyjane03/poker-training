/* =========================================================
 * questions.js — 策略题库
 * 每题结构：
 * {
 *   id, category, difficulty(1~3), title,
 *   scenario: { heroHand, position, stackDepth, board, potInfo, villainAction, extra },
 *   options: [{ key:'check|call|raise|fold', label, score(0~100), feedback }],
 *   theory: { name, points: [..] }
 * }
 * score: 100=最佳，60~80=可接受次优，0~30=明显错误
 * ========================================================= */
(function () {
  'use strict';

  const CATEGORIES = {
    starting: '起手牌选择',
    position: '位置策略',
    sizing: '下注尺度',
    gto: 'GTO 基础',
    exploit: '剥削打法',
    multiway: '多人底池',
    postflop: '翻牌后多街',
    range: '范围阅读',
    '3bet': '3Bet/4Bet 底池'
  };

  const QUESTIONS = [
    /* ================= 起手牌选择（难度 1~2） ================= */
    {
      id: 'st-01', category: 'starting', difficulty: 1,
      title: '枪口位的 72o',
      scenario: {
        heroHand: '7♠ 2♦', position: 'UTG（枪口位，9人桌）', stackDepth: '100BB',
        board: '—（翻牌前）', potInfo: '底池 1.5BB（盲注）',
        villainAction: '前面无人行动，轮到你第一个说话',
        extra: '满员桌，后位玩家尚未行动'
      },
      options: [
        { key: 'fold', label: '弃牌（Fold）', score: 100, feedback: '正确。72o 是德扑最差起手牌，在枪口位面对 8 名未行动玩家，没有任何可玩性。' },
        { key: 'call', label: '跟注 1BB（Limp）', score: 10, feedback: 'Limp 弱牌是新手最常见漏洞：既暴露牌力又容易被后位加注挤压，长期严重亏损。' },
        { key: 'raise', label: '加注到 3BB', score: 20, feedback: '枪口位加注范围应控制在约前 15% 手牌（77+、ATs+、KQs、AQo+ 等），72o 远远不达标。' }
      ],
      theory: {
        name: '起手牌选择 · 位置范围表',
        points: [
          '前位（UTG/UTG+1）可玩范围最紧，约前 10%~15% 手牌。',
          '72o 既无对子、无同花、无连张，且点数极低，属于 169 种起手牌中最差的一档。',
          '纪律性弃牌（fold preflop）是新手盈利的第一来源——大多数亏损来自玩了不该玩的牌。'
        ]
      }
    },
    {
      id: 'st-02', category: 'starting', difficulty: 1,
      title: '按钮位的同花连张',
      scenario: {
        heroHand: '8♥ 7♥', position: 'BTN（按钮位）', stackDepth: '100BB',
        board: '—（翻牌前）', potInfo: '底池 1.5BB',
        villainAction: '全部弃牌到你',
        extra: '盲注位两名玩家尚未行动'
      },
      options: [
        { key: 'raise', label: '加注到 2.5BB', score: 100, feedback: '正确。按钮位开池范围可放宽到 40%+，同花连张是标准的偷盲/开池牌型。' },
        { key: 'fold', label: '弃牌（Fold）', score: 40, feedback: '过于保守。87s 在按钮位是明确的开池牌，弃掉等于白白放弃位置与偷盲权益。' },
        { key: 'call', label: '平跟 1BB（Limp）', score: 25, feedback: 'Limp 让大盲免费看翻牌，且无法在翻牌前拿下底池。现代策略中开池几乎只选加注或弃牌。' }
      ],
      theory: {
        name: '起手牌选择 · 位置放宽原则',
        points: [
          '位置越靠后，开池范围越宽：按钮位可开池 40% 以上手牌。',
          '同花连张（suited connectors）具有顺子和同花双重潜力，隐含赔率高，适合在后位游戏。',
          '开池加注同时具有「立即偷盲」和「掌握主动权」双重价值。'
        ]
      }
    },
    {
      id: 'st-03', category: 'starting', difficulty: 2,
      title: '面对 3Bet 的 AJo',
      scenario: {
        heroHand: 'A♦ J♠', position: 'CO（关煞位）', stackDepth: '100BB',
        board: '—（翻牌前）', potInfo: '你开池 3BB，对手 3Bet 到 11BB',
        villainAction: '按钮位紧凶玩家 3Bet 到 11BB',
        extra: '对手 3Bet 频率仅 4%，属于极紧范围'
      },
      options: [
        { key: 'fold', label: '弃牌（Fold）', score: 100, feedback: '正确。面对紧手 4% 的 3Bet 范围（大致 QQ+、AK），AJo 处于明显劣势，弃牌是标准打法。' },
        { key: 'call', label: '跟注 8BB', score: 35, feedback: 'AJo 被对手范围严重压制（dominated），跟注后在无位置情况下打大底池，期望值长期为负。' },
        { key: 'raise', label: '4Bet 全下 100BB', score: 5, feedback: '用被压制的牌对紧手全下是灾难级打法，对手只会用碾压你的范围跟注。' }
      ],
      theory: {
        name: '起手牌选择 · 压制（Domination）概念',
        points: [
          'AJ 面对 AK/AQ 时被「压制」：共享 A 时踢脚输，胜率仅约 25%~30%。',
          '评估跟注 3Bet 时，先估算对手范围，再看自己的牌在范围对决中的胜率，而非看牌的绝对强度。',
          '对紧手的 3Bet 要显著收紧继续范围；对松手才可放宽 4Bet 诈唬与跟注范围。'
        ]
      }
    },
    {
      id: 'st-04', category: 'starting', difficulty: 2,
      title: '小盲位的小对子',
      scenario: {
        heroHand: '5♣ 5♦', position: 'SB（小盲位）', stackDepth: '有效筹码 120BB',
        board: '—（翻牌前）', potInfo: 'CO 开池 3BB',
        villainAction: 'CO 位松凶玩家开池到 3BB',
        extra: '大盲位是较弱的休闲玩家'
      },
      options: [
        { key: 'call', label: '跟注 2.5BB', score: 100, feedback: '正确。120BB 深筹码下，小对子跟注博三条（set mining）隐含赔率充足，且可诱使大盲入池。' },
        { key: 'raise', label: '3Bet 到 12BB', score: 55, feedback: '可行但非最优。小对子 3Bet 后在不利位置难打，被 4Bet 只能弃牌；深筹码下平跟隐含赔率更好。' },
        { key: 'fold', label: '弃牌（Fold）', score: 40, feedback: '太紧。面对松凶的宽开池范围，55 的摊牌价值与博三条潜力都足够支持跟注。' }
      ],
      theory: {
        name: '起手牌选择 · Set Mining（博三条）',
        points: [
          '小对子（22~66）翻牌中三条概率约 12%，需要至少约 8~10 倍隐含赔率才值得跟注。',
          '有效筹码越深，set mining 越有利；浅筹码（<40BB）时应直接收紧或弃牌。',
          'Set mining 理想条件：深筹码 + 对手范围强（中了能拿到支付）+ 成本低廉。'
        ]
      }
    },

    /* ================= 位置策略（难度 1~3） ================= */
    {
      id: 'po-01', category: 'position', difficulty: 1,
      title: '为什么位置值钱',
      scenario: {
        heroHand: 'K♠ Q♦', position: 'BTN（按钮位）', stackDepth: '100BB',
        board: 'J♥ 8♣ 4♦（翻牌圈）', potInfo: '底池 12BB',
        villainAction: '大盲位对手过牌（Check）给你',
        extra: '单挑底池，翻牌前你开池、大盲跟注'
      },
      options: [
        { key: 'raise', label: '持续下注 6~8BB', score: 100, feedback: '正确。有位置的持续下注（c-bet）可经常直接拿下底池，被跟注后仍保有位置优势与两张补牌。' },
        { key: 'check', label: '过牌（Check）', score: 45, feedback: 'KQ 有两张高牌+后门顺子潜力，过牌放弃了免费拿池的机会，也让对手免费看转牌实现权益。' }
      ],
      theory: {
        name: '位置策略 · 位置优势（Positional Advantage）',
        points: [
          '有位置 = 每条街都最后行动，能先看到对手行动再做决定，信息优势巨大。',
          '有位置时 c-bet 成功率更高：对手过牌示弱后，下注可接管底池。',
          '统计显示同一玩家按钮位盈利远高于盲注位——位置本身就是长期利润来源。'
        ]
      }
    },
    {
      id: 'po-02', category: 'position', difficulty: 2,
      title: '不利位置的边缘牌',
      scenario: {
        heroHand: 'A♣ 9♠', position: 'SB（小盲位）', stackDepth: '100BB',
        board: '—（翻牌前）', potInfo: 'HJ 开池 2.5BB',
        villainAction: '中位（HJ）未知玩家开池到 2.5BB',
        extra: '你整手牌都将在最不利位置行动'
      },
      options: [
        { key: 'fold', label: '弃牌（Fold）', score: 90, feedback: '最佳。A9o 在小盲位面对中位开池是边缘牌：易被压制（AT+）、无位置、难打翻牌后，弃牌零损失。' },
        { key: 'raise', label: '3Bet 到 10BB', score: 60, feedback: '作为诈唬/价值混合 3Bet 可以接受，但需要对手弃牌率数据支持；对未知玩家偏激进。' },
        { key: 'call', label: '跟注 2BB', score: 25, feedback: '最差选项。平跟后在全场最差位置玩被压制的牌，是典型的「跟注站」式亏损打法。' }
      ],
      theory: {
        name: '位置策略 · 不利位置收紧原则',
        points: [
          '盲注位是桌上长期亏损最多的位置——策略核心是「少输」，即收紧范围、多用 3Bet 或弃牌而非平跟。',
          '无位置时信息劣势贯穿整手牌，边缘牌（A9o、KJo 等）的难打程度会被放大。',
          '「Fold 不亏筹码，错误的 call 才亏」——无位置时倾向弃掉边缘牌。'
        ]
      }
    },
    {
      id: 'po-03', category: 'position', difficulty: 3,
      title: '用位置做底池控制',
      scenario: {
        heroHand: 'Q♥ Q♣', position: 'BTN（按钮位）', stackDepth: '100BB',
        board: 'A♠ 7♦ 2♣ K♠（转牌圈）', potInfo: '底池 30BB',
        villainAction: '翻牌对手跟注你的 c-bet；转牌对手过牌',
        extra: '牌面出现 A 和 K 两张高牌，对手翻牌前是紧手'
      },
      options: [
        { key: 'check', label: '过牌（Check back）', score: 100, feedback: '正确。QQ 在此牌面是中等牌力：下注打不走 Ax/Kx，只会被更强的牌跟注。过牌控制底池，保留河牌摊牌或抓诈选项。' },
        { key: 'raise', label: '下注 20BB', score: 35, feedback: '下注缺乏明确目的：作价值下注几乎没有更差牌会跟；作诈唬又打不走 Ax。属于「烧钱下注」。' },
        { key: 'fold', label: '（此时无法弃牌）', score: 0, feedback: '转牌对手过牌后你可以免费看河牌，不存在弃牌选项。' }
      ],
      theory: {
        name: '位置策略 · 底池控制（Pot Control）',
        points: [
          '中等牌力 + 有位置 = 底池控制的经典组合：过牌回来保持底池小，用摊牌价值兑现。',
          '下注前先问：更差的牌会跟吗（价值）？更好的牌会弃吗（诈唬）？两者都不成立就该过牌。',
          '位置让你「免费」实现底池控制——对手过牌后你才有 check back 的权利。'
        ]
      }
    },

    /* ================= 下注尺度（难度 2~3） ================= */
    {
      id: 'sz-01', category: 'sizing', difficulty: 2,
      title: '价值下注的尺度',
      scenario: {
        heroHand: 'K♦ K♣', position: 'BTN', stackDepth: '后手 80BB',
        board: 'K♠ 9♦ 4♣ 2♥ 7♠（河牌圈）', potInfo: '底池 40BB',
        villainAction: '对手在河牌过牌（整手牌一直是跟注站风格）',
        extra: '你持有顶三条，对手是跟注站（calling station）'
      },
      options: [
        { key: 'raise', label: '下注 30~40BB（大注）', score: 100, feedback: '正确。对跟注站要用大尺度榨取最大价值——他们跟注范围对尺度不敏感，会用手对/两对跟大注。' },
        { key: 'raise', label: '下注 10BB（小注）', score: 55, feedback: '能拿到价值但严重不足。对跟注站下小注等于每次河牌少赢 20BB+，长期是巨大损失。' },
        { key: 'check', label: '过牌求稳', score: 20, feedback: '坚果级牌力过牌是严重错误，白白放弃一整条街的价值。' }
      ],
      theory: {
        name: '下注尺度 · 价值榨取（Value Sizing）',
        points: [
          '下注尺度应匹配对手类型的弹性：跟注站对价格不敏感 → 用大注；紧手对价格敏感 → 用中小注。',
          '河牌纯价值下注常见尺度为底池 66%~100%，牌力越接近坚果尺度越大。',
          '先定目标（让哪些更差牌跟注），再定尺度，而不是固定「下半池」。'
        ]
      }
    },
    {
      id: 'sz-02', category: 'sizing', difficulty: 3,
      title: '诈唬的最小有效尺度',
      scenario: {
        heroHand: '6♠ 5♠', position: 'BTN', stackDepth: '100BB',
        board: 'A♦ K♦ 3♣ 8♥（转牌圈）', potInfo: '底池 20BB',
        villainAction: '翻牌你 c-bet 被跟；转牌对手过牌',
        extra: '你只有卡顺听牌（gutshot）+ 后门花破产，想半诈唬'
      },
      options: [
        { key: 'raise', label: '下注 7~10BB（半池）', score: 100, feedback: '正确。半池尺度达到与更大注相近的弃牌率，同时控制诈唬成本；半诈唬还有 4 张顺子补牌兜底。' },
        { key: 'raise', label: '下注 25BB（超池）', score: 40, feedback: '超池提高了诈唬成本。对手范围在此牌面若有 A 基本不会弃，超池只是让诈唬更贵。' },
        { key: 'check', label: '过牌看免费牌', score: 65, feedback: '可接受的稳健选项：卡顺只有约 8% 河牌命中率，免费看牌也不算错，但放弃了弃牌权益。' }
      ],
      theory: {
        name: '下注尺度 · 诈唬盈亏平衡（Bluff Break-even）',
        points: [
          '诈唬需要的成功率 = 下注额 ÷（下注额 + 底池）。半池诈唬只需 33% 弃牌率即回本，超池需 50%+。',
          '半诈唬（semi-bluff）= 弃牌权益 + 成牌赔率双通道盈利，优先用听牌而非纯空气诈唬。',
          '诈唬尺度够用就好：先找能达成弃牌效果的最小尺度，保留筹码效率。'
        ]
      }
    },
    {
      id: 'sz-03', category: 'sizing', difficulty: 2,
      title: '给听牌错误的赔率',
      scenario: {
        heroHand: 'A♥ Q♥', position: 'BB', stackDepth: '100BB',
        board: 'J♥ 8♥ 3♣（翻牌圈，你两高张+同花听牌）', potInfo: '底池 10BB',
        villainAction: '对手（翻牌前加注者）下注仅 2BB（20% 底池）',
        extra: '对手小额试探性下注'
      },
      options: [
        { key: 'raise', label: '加注到 8~10BB', score: 100, feedback: '正确。同花听牌+两高张约有 50%+ 权益，加注既可能直接收池，被跟也有大量补牌，同时惩罚对手的弱尺度。' },
        { key: 'call', label: '跟注 2BB', score: 60, feedback: '赔率上跟注完全可行（15:1 的底池赔率），但被动打法放弃了弃牌权益，也暴露了听牌信息。' },
        { key: 'fold', label: '弃牌（Fold）', score: 10, feedback: '严重错误。手持坚果同花听牌+两张高张，面对 1/5 底池的小注弃牌等于白送权益。' }
      ],
      theory: {
        name: '下注尺度 · 底池赔率与加注惩罚',
        points: [
          '听牌需要的隐含赔率：同花听牌翻牌后约 35% 权益，几乎永远不会因单次小注弃牌。',
          '对手下注过小时，加注可「纠正」底池赔率，迫使对手为继续看牌付出合理价格。',
          '强听牌（12+ 补牌）可以当成成牌打——加注/全下常常是最优线。'
        ]
      }
    },

    /* ================= GTO 基础（难度 2~3） ================= */
    {
      id: 'gt-01', category: 'gto', difficulty: 3,
      title: '河牌的价值诈唬比',
      scenario: {
        heroHand: 'A♦ 5♦', position: 'BTN', stackDepth: '100BB',
        board: 'K♦ 7♦ 2♣ 9♠ 4♥（河牌，你同花成牌）', potInfo: '底池 50BB，你打算做底池大小下注',
        villainAction: '对手河牌过牌',
        extra: '思考：整条河牌下注范围应如何构建？'
      },
      options: [
        { key: 'raise', label: '下注 50BB：同花价值下注', score: 100, feedback: '正确。底池大小下注时，河牌范围理论配比约 2:1（价值:诈唬），同花是范围顶端，必须下注。' },
        { key: 'check', label: '过牌求摊牌', score: 30, feedback: '同花是范围顶部牌，过牌让价值白白流失；GTO 要求用最强牌持续施压，才能给诈唬提供掩护。' }
      ],
      theory: {
        name: 'GTO 基础 · 极化范围与价值诈唬比',
        points: [
          '河牌底池大小下注时，对手跟注需 33% 胜率；因此你的范围应保持约 2:1 的价值诈唬比，让对手抓诈无利可图。',
          '极化下注（polarized betting）：用大注时下注范围 = 强价值牌 + 精选诈唬，中等牌力则过牌。',
          'GTO 不是「每手都打对」，而是让整体范围在任何决策点都不被对手利用。'
        ]
      }
    },
    {
      id: 'gt-02', category: 'gto', difficulty: 2,
      title: '最小防守频率',
      scenario: {
        heroHand: 'J♦ T♦', position: 'BB', stackDepth: '100BB',
        board: 'Q♠ 8♦ 5♣（翻牌圈）', potInfo: '底池 12BB',
        villainAction: '按钮位对手持续下注半池 6BB',
        extra: '你有卡顺听牌+两张高张+后门同花'
      },
      options: [
        { key: 'call', label: '跟注 6BB', score: 100, feedback: '正确。底池赔率 3:1 只需 25% 胜率，卡顺+高张+后门权益足够；且按 MDF 你必须高频防守半池注。' },
        { key: 'fold', label: '弃牌（Fold）', score: 35, feedback: '弃牌过度。面对半池 c-bet 弃掉所有听牌/高张会让对手用任意两张牌获利，你在被系统性剥削。' },
        { key: 'raise', label: '加注到 18BB', score: 55, feedback: '半诈唬加注是合理的攻击性选项（尤其对有后门花的听牌），但在盲注位无位置时频率不宜过高。' }
      ],
      theory: {
        name: 'GTO 基础 · 最小防守频率（MDF）',
        points: [
          'MDF = 底池 ÷（底池 + 对手下注）。面对半池注，你需用约 67% 的范围继续，否则对手可全范围诈唬获利。',
          'MDF 是「不被剥削的底线」，不是必须死守的目标——对从不诈唬的对手可以合法地过度弃牌。',
          '选择防守范围时优先保留：对子、听牌、带后门权益的高张。'
        ]
      }
    },
    {
      id: 'gt-03', category: 'gto', difficulty: 3,
      title: '阻断牌（Blocker）诈唬',
      scenario: {
        heroHand: 'A♦ Q♠', position: 'BB', stackDepth: '80BB',
        board: 'K♦ J♦ 4♦ 7♠ 2♦（河牌，四张方块）', potInfo: '底池 45BB',
        villainAction: '整手牌对手连续下注，河牌过牌',
        extra: '你持有 A♦——坚果同花阻断牌，但本身只是 A 高'
      },
      options: [
        { key: 'raise', label: '诈唬下注 30~45BB', score: 100, feedback: '正确。A♦ 阻断了对手坚果同花的可能，是河牌诈唬的理想候选：阻断强牌 + 自身无摊牌价值。' },
        { key: 'check', label: '过牌摊牌', score: 40, feedback: 'A 高在四同花牌面几乎没有摊牌价值（输给任何对子和任意方块）。过牌等于放弃了权益最高的诈唬机会。' },
        { key: 'fold', label: '（无法弃牌）', score: 0, feedback: '对手过牌后你可以选择过牌摊牌或下注，不存在弃牌。' }
      ],
      theory: {
        name: 'GTO 基础 · 阻断牌效应（Blockers）',
        points: [
          '阻断牌：你手里的牌降低了对手持有特定强牌的组合数。持 A♦ 时，对手不可能是坚果同花。',
          '优秀诈唬候选 = 阻断对手跟注范围 + 不阻断对手弃牌范围 + 自身摊牌价值低。',
          '同理，价值下注时希望「反阻断」：手里没有对手跟注范围的阻断牌。'
        ]
      }
    },

    /* ================= 剥削打法（难度 1~3） ================= */
    {
      id: 'ex-01', category: 'exploit', difficulty: 1,
      title: '面对从不弃牌的跟注站',
      scenario: {
        heroHand: '7♠ 6♠', position: 'BTN', stackDepth: '100BB',
        board: 'A♣ K♦ 9♥ 4♠ 2♦（河牌，你完全错过）', potInfo: '底池 30BB',
        villainAction: '对手（著名跟注站，跟注率 70%）河牌过牌',
        extra: '对手数据：跟注任何尺度，从不弃掉对子'
      },
      options: [
        { key: 'check', label: '过牌认输', score: 100, feedback: '正确。剥削跟注站的第一原则：永远不对他们诈唬。他们不弃牌，诈唬等于直接送筹码。' },
        { key: 'raise', label: '大注诈唬 25BB', score: 5, feedback: '对跟注站诈唬是经典烧钱行为。剥削打法要求：对跟注站只价值下注（且加大尺度），零诈唬。' }
      ],
      theory: {
        name: '剥削打法 · 对付跟注站（Calling Station）',
        points: [
          'GTO 假设对手会正确弃牌；跟注站不会，所以对他们的诈唬频率应降到接近零。',
          '对跟注站的利润全部来自价值下注：放宽价值范围、加大下注尺度。',
          '剥削的核心逻辑：识别对手系统性偏离均衡的方向，然后向相反方向调整自己的策略。'
        ]
      }
    },
    {
      id: 'ex-02', category: 'exploit', difficulty: 2,
      title: '剥削过度弃牌的紧弱玩家',
      scenario: {
        heroHand: '4♣ 3♣', position: 'SB', stackDepth: '60BB',
        board: 'A♠ 9♦ 9♣ 6♥（转牌圈）', potInfo: '底池 16BB',
        villainAction: '大盲位紧弱玩家（面对转牌注弃牌率 75%）过牌',
        extra: '你在翻牌 c-bet 小注被跟；转牌仍是空气牌'
      },
      options: [
        { key: 'raise', label: '第二枪下注 10~12BB', score: 100, feedback: '正确。对手转牌弃牌率 75%，半池多一点（需约 40% 弃牌率回本）的诈唬期望值显著为正。' },
        { key: 'check', label: '过牌放弃', score: 35, feedback: '对普通对手放弃没问题，但对「面对转牌注弃牌率 75%」的明确漏洞不收网，等于错过送钱机会。' }
      ],
      theory: {
        name: '剥削打法 · 攻击过度弃牌（Over-folding）',
        points: [
          '当对手弃牌率高于诈唬盈亏平衡所需时，任意两张牌诈唬都是正 EV。',
          '紧弱玩家（nit）在 A 高牌面、连张牌面的弃牌率通常极高——这是第二个枪（double barrel）的黄金目标。',
          '剥削需要数据支撑：靠印象「他很紧」不可靠，靠统计「转牌弃牌率 75%」才可行动。'
        ]
      }
    },
    {
      id: 'ex-03', category: 'exploit', difficulty: 3,
      title: '识别疯狂玩家的价值线',
      scenario: {
        heroHand: 'Q♠ J♠', position: 'BB', stackDepth: '90BB',
        board: 'Q♦ 8♣ 3♠ 7♥（转牌圈）', potInfo: '底池 28BB',
        villainAction: '疯狂玩家（Maniac，加注率 40%）转牌全下 70BB',
        extra: '对手整晚用空气牌施压，已三次诈唬被抓'
      },
      options: [
        { key: 'call', label: '跟注全下 70BB', score: 100, feedback: '正确。对疯狂玩家要放宽抓诈范围：顶对好踢脚面对他 40% 的激进频率，领先他范围里大量的诈唬与更差 Qx。' },
        { key: 'fold', label: '弃牌（Fold）', score: 30, feedback: '对普通玩家弃牌合理，但对 maniac 弃掉顶对等于让他用空气白捡底池——正中其下怀。' },
        { key: 'raise', label: '（无法再加注）', score: 0, feedback: '对手已全下，你只有跟注或弃牌两个选择。' }
      ],
      theory: {
        name: '剥削打法 · 对付疯狂玩家（Maniac）',
        points: [
          '疯狂玩家的范围被大量空气稀释，你的「抓诈范围」应整体下移：顶对≈对普通玩家的超对。',
          '对付 maniac 用「诱捕」策略：用强牌过牌/跟注，让他用诈唬给你送筹码。',
          '注意波动管理：跟注 maniac 的全下胜率高但波动大，需确保资金与心态能承受。'
        ]
      }
    },
    {
      id: 'ex-04', category: 'exploit', difficulty: 2,
      title: '从 GTO 切换到剥削的时机',
      scenario: {
        heroHand: 'K♥ J♥', position: 'CO', stackDepth: '100BB',
        board: '—（翻牌前）', potInfo: '底池 1.5BB',
        villainAction: '全桌水平未知，刚上桌第一手牌',
        extra: '你对桌上所有玩家没有任何数据'
      },
      options: [
        { key: 'raise', label: '标准开池 2.5BB', score: 100, feedback: '正确。无信息时默认用接近 GTO 的基线策略：KJs 在 CO 是标准开池牌。' },
        { key: 'raise', label: '加注到 6BB 试探对手', score: 35, feedback: '无目的的非标尺度只是在泄露信息。剥削必须建立在已观察到的漏洞上，而不是凭空「试探」。' },
        { key: 'fold', label: '弃牌观望', score: 25, feedback: '过度谨慎。基线策略要求你正常游戏强牌；一味弃牌等数据本身就在亏损。' }
      ],
      theory: {
        name: '剥削打法 · 基线策略与调整（Baseline & Adjust）',
        points: [
          '正确流程：先用 GTO 基线策略游戏 → 观察对手偏离 → 针对性剥削 → 对手反制时回到基线。',
          '没有读牌信息时，任何「剥削」都只是随机偏离，长期期望为负。',
          '剥削本身会让你偏离均衡而被反剥削——留意对手是否察觉并调整。'
        ]
      }
    },

    /* ================= 追加题库（第二批） ================= */

    /* ---------- 起手牌选择 ---------- */
    {
      id: 'st-05', category: 'starting', difficulty: 1,
      title: '大盲位的免费过牌',
      scenario: {
        heroHand: '9♦ 3♠', position: 'BB（大盲位）', stackDepth: '100BB',
        board: '—（翻牌前）', potInfo: '底池 4.5BB（三人平跟入池）',
        villainAction: '三名玩家先后平跟 1BB，小盲补齐，轮到你',
        extra: '你已投入 1BB 大盲注'
      },
      options: [
        { key: 'check', label: '过牌（免费看翻牌）', score: 100, feedback: '正确。已投入的盲注是沉没成本，零成本看翻牌总是正确——93o 免费中牌稳赚，不中轻松弃。' },
        { key: 'raise', label: '加注到 6BB 挤压', score: 30, feedback: '用 93o 这种垃圾牌在四人池挤压，被任何一人跟注后都无位置无牌力，诈唬性价比极低。' }
      ],
      theory: {
        name: '起手牌选择 · 大盲的免费看牌权（BB Option）',
        points: [
          '大盲位已强制投入 1BB，无人加注时可以选择过牌免费看翻牌——这是盲注位唯一的「福利」。',
          '沉没成本原理：决策只看「从现在起」的投入产出，已投入的盲注不影响当前选择。',
          '免费看牌 + 不中即弃（fit-or-fold）是处理垃圾牌的标准打法。'
        ]
      }
    },
    {
      id: 'st-06', category: 'starting', difficulty: 2,
      title: '枪口位的 ATo 困境',
      scenario: {
        heroHand: 'A♣ T♦', position: 'UTG（枪口位，9人桌）', stackDepth: '100BB',
        board: '—（翻牌前）', potInfo: '底池 1.5BB',
        villainAction: '前面无人行动，你第一个说话',
        extra: '满员桌，8 名玩家在你之后行动'
      },
      options: [
        { key: 'fold', label: '弃牌（Fold）', score: 85, feedback: '稳健的选择。ATo 在枪口位是教科书级的边缘弃牌：无位置、易被 AQ/AK 压制，多数标准范围表将其列为 fold。' },
        { key: 'raise', label: '加注到 3BB', score: 70, feedback: '在偏松的牌桌或对盲注位有明确读牌时可以开池，但作为默认打法偏松——你将频繁在不利位置打被压制的牌。' },
        { key: 'call', label: '平跟 1BB（Limp）', score: 10, feedback: '最差选项。Limp 传递弱势信号，后位任何加注都让你进退两难。' }
      ],
      theory: {
        name: '起手牌选择 · 边缘牌与位置惩罚',
        points: [
          'ATo/KJo/QJo 被称为「新手陷阱牌」：看起来强，实际在前位频繁被压制（dominated）。',
          '位置惩罚：同样的牌，枪口位是弃牌，按钮位可能就是加注——位置决定范围。',
          '记一份标准开池范围表（UTG 约 15%），比凭感觉判断可靠得多。'
        ]
      }
    },
    {
      id: 'st-07', category: 'starting', difficulty: 3,
      title: '小盲位的挤压时机',
      scenario: {
        heroHand: 'A♠ Q♣', position: 'SB（小盲位）', stackDepth: '有效筹码 90BB',
        board: '—（翻牌前）', potInfo: '底池 8BB（开池 3BB + 两人跟注）',
        villainAction: '松凶玩家在 CO 开池 3BB，按钮和大盲都跟注',
        extra: '开池者范围宽（约 35%），跟注者多为投机牌'
      },
      options: [
        { key: 'raise', label: '挤压加注到 16BB（Squeeze）', score: 100, feedback: '正确。死钱 8BB + 开池者范围宽 + 两个跟注者显示弱牌——挤压经常直接收池，AQ 被跟注后也有不错权益。' },
        { key: 'call', label: '跟注 2.5BB', score: 45, feedback: '跟注后四人池 + 全场最差位置，AQo 的权益难以实现，中了顶对也难处理多人底池。' },
        { key: 'fold', label: '弃牌（Fold）', score: 20, feedback: '太浪费。AQo 明显领先松手开池范围，这里有大量死钱可以争夺。' }
      ],
      theory: {
        name: '起手牌选择 · 挤压打法（Squeeze Play）',
        points: [
          '挤压条件：开池者范围宽 + 中间有跟注者（死钱）+ 你有可玩的强牌。',
          '跟注者的存在反而增强挤压效果——他们的平跟范围封顶（cap），基本排除了超强牌。',
          '挤压尺度要大于普通 3Bet（底池已膨胀），通常取底池大小左右，给所有人错误的跟注价格。'
        ]
      }
    },

    /* ---------- 位置策略 ---------- */
    {
      id: 'po-04', category: 'position', difficulty: 1,
      title: '劫持位的偷盲意识',
      scenario: {
        heroHand: 'K♦ 8♠', position: 'HJ（劫持位）', stackDepth: '40BB',
        board: '—（翻牌前）', potInfo: '底池 1.5BB',
        villainAction: '全部弃牌到你',
        extra: 'CO、BTN、两个盲注位都是紧手玩家'
      },
      options: [
        { key: 'raise', label: '加注到 2.5BB', score: 100, feedback: '正确。后位四人都是紧手，K8o 在 HJ 的偷盲成功率大幅提升，这是位置 + 读牌的双重价值。' },
        { key: 'fold', label: '弃牌（Fold）', score: 55, feedback: '对紧手桌偏保守。K8o 在标准范围里属于 HJ 边缘牌，但对手越紧越应开池。' },
        { key: 'call', label: '平跟 1BB', score: 15, feedback: 'Limp 放弃了偷盲可能，还邀请盲注位廉价入池。' }
      ],
      theory: {
        name: '位置策略 · 偷盲（Blind Stealing）',
        points: [
          '中后位（HJ/CO/BTN）的开池收益很大一部分来自「直接赢下盲注」，对手越紧偷盲越有利可图。',
          '偷盲只需一个能打的牌力底线——K8o、Q9o、同花任意两张高牌都够格。',
          '锦标赛/短筹码中偷盲价值更高：盲注占筹码比例大，每次成功偷盲都显著提升存活率。'
        ]
      }
    },
    {
      id: 'po-05', category: 'position', difficulty: 3,
      title: '按钮位的 float 跟注',
      scenario: {
        heroHand: 'J♦ 9♦', position: 'BTN（按钮位）', stackDepth: '100BB',
        board: 'K♣ 7♠ 2♦（翻牌圈）', potInfo: '底池 12BB',
        villainAction: 'CO 位玩家（翻牌前加注者）持续下注 8BB',
        extra: '你只有后门同花 + 后门顺子 + 两张低牌，无对子'
      },
      options: [
        { key: 'call', label: '跟注 8BB（Float）', score: 90, feedback: '正确（有位置时）。你有位置优势：对手转牌过牌率高时，你可接管底池；后门权益也提供了少量直接胜率。这是对「翻牌 100% c-bet」玩家的标准反击。' },
        { key: 'fold', label: '弃牌（Fold）', score: 50, feedback: '稳健但错失机会。如果对手翻牌 c-bet 频率过高、转牌经常放弃，弃牌等于让他用空气稳定盈利。' },
        { key: 'raise', label: '加注到 22BB', score: 30, feedback: '用纯空气在 K 高牌面加注，对手的范围里有大量 Kx 不会弃牌，诈唬效率低。Float 的成本和胜率结构更优。' }
      ],
      theory: {
        name: '位置策略 · 漂浮跟注（Floating）',
        points: [
          'Float = 有位置时用弱牌跟注翻牌，计划在对手转牌示弱时偷取底池。',
          'Float 的前提：对手翻牌 c-bet 频率高但转牌持续下注频率低（turn c-bet% < 45% 左右）。',
          '有位置才能 Float——你能在转牌看到对手行动后再决定；无位置做同样的事叫「烧钱跟注」。'
        ]
      }
    },

    /* ---------- 下注尺度 ---------- */
    {
      id: 'sz-04', category: 'sizing', difficulty: 1,
      title: '翻牌前开池尺度',
      scenario: {
        heroHand: 'J♠ J♥', position: 'CO（关煞位）', stackDepth: '100BB',
        board: '—（翻牌前）', potInfo: '底池 1.5BB',
        villainAction: '全部弃牌到你',
        extra: '常规现金桌，盲注 0.5/1BB'
      },
      options: [
        { key: 'raise', label: '加注到 2.5~3BB', score: 100, feedback: '正确。标准开池尺度 2.5~3BB：足够惩罚平跟、建立主动权，又不会为过强/过弱牌泄露信息。' },
        { key: 'raise', label: '加注到 8BB（拿 JJ 怕输）', score: 30, feedback: '「怕输心理」导致的过大尺度：只用强牌下大注会被读出范围，且让 JJ 打走所有更差的牌——恰好是你想留下的支付者。' },
        { key: 'call', label: '平跟 1BB 设陷阱', score: 20, feedback: '慢打 JJ 的风险远大于收益：多人池里 JJ 被超对牌面击中的概率大增，且你把主动权拱手让人。' }
      ],
      theory: {
        name: '下注尺度 · 开池尺度一致性',
        points: [
          '开池尺度应该对所有手牌保持一致（2.5~3BB），否则等于向会观察的对手公开你的手牌强度。',
          '尺度的目标是「给对手错误的价格」：让投机牌跟注不舒服，让强牌愿意加注你。',
          'JJ/TT 的处理原则：正常加注打价值，不要因恐惧而改变尺度——恐惧本身就是漏洞。'
        ]
      }
    },
    {
      id: 'sz-05', category: 'sizing', difficulty: 2,
      title: '干牌面的小额持续下注',
      scenario: {
        heroHand: 'A♠ Q♦', position: 'BTN', stackDepth: '100BB',
        board: 'K♦ 7♣ 2♠（翻牌圈，彩虹干燥牌面）', potInfo: '底池 12BB',
        villainAction: '大盲位对手过牌',
        extra: '单挑池，你翻牌前开池、大盲跟注'
      },
      options: [
        { key: 'raise', label: '小额 c-bet 3~4BB（1/3 底池）', score: 100, feedback: '正确。干燥牌面你的范围优势巨大（你有全部 K 高组合而对手很少），1/3 底池小注用全部范围下注即可，成本最低、弃牌率不打折。' },
        { key: 'raise', label: '大注 10BB（80% 底池）', score: 45, feedback: '牌力与牌面不支持大注：你只有 A 高，大注被跟注后转牌被动；且大注打走的牌小注也能打走。' },
        { key: 'check', label: '过牌', score: 40, feedback: '浪费范围优势。这种牌面应该高频小额下注，过牌让对手免费实现 6 张高牌的权益。' }
      ],
      theory: {
        name: '下注尺度 · 牌面结构与范围优势',
        points: [
          '干燥牌面（如 K-7-2 彩虹）对翻牌前加注者极有利：范围里集中了全部顶对以上组合——应该用「全部范围 + 小尺度」高频下注。',
          '湿润牌面（如 9-8-7 两色）则相反：对手范围击中率高，应降低 c-bet 频率、加大尺度。',
          '小注 1/3 底池的诈唬只需 25% 弃牌率即回本——配合范围优势几乎自动盈利。'
        ]
      }
    },
    {
      id: 'sz-06', category: 'sizing', difficulty: 3,
      title: '河牌超池下注',
      scenario: {
        heroHand: 'Q♦ J♦', position: 'BTN', stackDepth: '后手 120BB',
        board: 'T♦ 9♦ 2♣ 4♠ K♦（河牌，你 Q 高同花）', potInfo: '底池 60BB',
        villainAction: '对手在河牌过牌（翻牌转牌都跟注了你的下注）',
        extra: '牌面有四张方片可能？不——牌面只有三张方片 T♦9♦K♦，你是 Q♦J♦ 组成坚果第二同花，对手范围有大量 K♦x、中小方片和对子'
      },
      options: [
        { key: 'raise', label: '超池下注 80~120BB', score: 100, feedback: '正确。河牌出现第三张方片后，你的范围极化为同花或空气，对手用 K♦ 单张或小花跟注动机强——超池最大化价值。' },
        { key: 'raise', label: '标准下注 30BB（半池）', score: 60, feedback: '能拿到价值但偏保守。对手连续跟注两条街显示有成牌/听牌，第三张方片后愿意为大注支付的次级同花不少。' },
        { key: 'check', label: '过牌求稳', score: 15, feedback: '范围顶端的牌过牌是重大价值流失——河牌没有「下一街」可以弥补。' }
      ],
      theory: {
        name: '下注尺度 · 超池下注（Overbet）',
        points: [
          '超池适用场景：你的范围极化（坚果或空气）而对手范围封顶（有上限，无坚果）。',
          '坚果优势（nut advantage）：只有你范围里存在最强牌时，超池让对手无法用任何牌舒服地防守。',
          '河牌是价值浓度最高的一街——尺度从保守到激进，EV 差距可达数十 BB。'
        ]
      }
    },

    /* ---------- GTO 基础 ---------- */
    {
      id: 'gt-04', category: 'gto', difficulty: 1,
      title: '底池赔率快速计算',
      scenario: {
        heroHand: '8♥ 7♥', position: 'BB', stackDepth: '100BB',
        board: 'A♥ K♦ 6♥ 3♣（转牌圈，你有同花听牌）', potInfo: '底池 24BB',
        villainAction: '对手下注 12BB（半池）',
        extra: '你跟注后底池将变成 48BB，河牌还剩一张牌'
      },
      options: [
        { key: 'call', label: '跟注 12BB', score: 100, feedback: '正确。需要胜率 = 12÷48 = 25%；同花听牌河牌约 19.6% 直接胜率，略低——但击中后通常能再赢一条街（隐含赔率补足），跟注是正 EV。' },
        { key: 'fold', label: '弃牌（Fold）', score: 45, feedback: '直接赔率差一点（19.6% vs 25%），若没有隐含赔率概念弃牌可以理解——但坚果同花听牌的隐含赔率几乎总是够的。' },
        { key: 'raise', label: '加注到 36BB 半诈唬', score: 55, feedback: '单挑池中有一定弃牌权益时可行，但对手在 A 高牌面连打两条街，范围偏强，诈唬成功率存疑。' }
      ],
      theory: {
        name: 'GTO 基础 · 底池赔率与隐含赔率',
        points: [
          '底池赔率公式：所需胜率 = 跟注额 ÷（底池 + 跟注额 × 2 后的总池）……简化：跟注 12 赢 36（24+12），需 12/48=25%。',
          '速记「二四法则」：转牌后听牌胜率 ≈ 补牌数 × 2%（同花听牌 9 补 ≈ 18%）。',
          '直接赔率不够时看隐含赔率：坚果听牌击中后能从强牌身上再榨一条街，差的几%通常能补回来。'
        ]
      }
    },
    {
      id: 'gt-05', category: 'gto', difficulty: 2,
      title: '持续下注的频率',
      scenario: {
        heroHand: '6♦ 5♦', position: 'CO', stackDepth: '100BB',
        board: 'J♠ 9♠ 8♥（翻牌圈，极度湿润，你有卡顺）', potInfo: '底池 10BB',
        villainAction: '大盲位跟注者过牌',
        extra: '这是翻牌前加注者最难受的一类牌面'
      },
      options: [
        { key: 'check', label: '过牌（Check）', score: 100, feedback: '正确。J-9-8 这种连贯湿润牌面集中击中大盲的跟注范围（顺子、两对、对子+听牌极多），你的 c-bet 弃牌率会很低，用卡顺免费看牌更好。' },
        { key: 'raise', label: '标准 c-bet 5BB', score: 40, feedback: '习惯性质疑：「我加注了就该 c-bet」是机械打法。在对手范围优势牌面高频下注 = 稳定送钱。' },
        { key: 'raise', label: '大注 10BB 施压', score: 35, feedback: '对手范围里大量成牌不会弃，大注只是放大你卡顺的烧钱速度。' }
      ],
      theory: {
        name: 'GTO 基础 · 范围优势决定 c-bet 频率',
        points: [
          'c-bet 频率的核心变量：谁的范围更契合这个牌面？翻牌前加注者在 A-K-Q 高牌面占优，在 9-8-7 类连贯牌面占劣。',
          '范围劣势牌面应大幅提高过牌频率（甚至全范围过牌），保留强牌平衡过牌范围。',
          '「我开池了所以我要 c-bet」是最常见的机械错误——每条街都重新评估，而不是执行剧本。'
        ]
      }
    },
    {
      id: 'gt-06', category: 'gto', difficulty: 3,
      title: '权益实现与下注的必要性',
      scenario: {
        heroHand: 'A♦ 5♣', position: 'SB', stackDepth: '100BB',
        board: 'K♠ 9♦ 4♣（翻牌圈）', potInfo: '底池 8BB',
        villainAction: '你（翻牌前跟注了按钮的开池）首先行动',
        extra: '你只有 A 高 + 后门顺子，无位置'
      },
      options: [
        { key: 'check', label: '过牌（Check）', score: 100, feedback: '正确。无位置 + 边缘权益的 A 高，过牌是最优：可以跟注小注实现权益，也可以在对手过牌后免费看转牌。' },
        { key: 'raise', label: '主动下注 4BB（Donk Bet）', score: 35, feedback: '反主动下注（donk）在这里没有明确目的：你没有范围优势，下注只是替对手做决定——他弃掉空气你赚不了，他跟注/加注你都难受。' },
        { key: 'fold', label: '（此时无需弃牌）', score: 0, feedback: '你是第一个行动者，没有人下注，不存在弃牌选项——过牌即可。' }
      ],
      theory: {
        name: 'GTO 基础 · 权益实现（Equity Realization）',
        points: [
          '一手牌的「原始权益」不等于「实际收益」：无位置时权益实现率打折，很多 25% 权益的牌实际只能兑现 15%。',
          'A 高在干燥牌面有约 25%~30% 原始权益，过牌-跟注小注通常是实现这部分权益成本最低的方式。',
          'Donk bet 仅在「牌面剧烈变化使你的范围反超」时有价值（如翻牌集中击中你的跟注范围），此处不满足。'
        ]
      }
    },

    /* ---------- 剥削打法 ---------- */
    {
      id: 'ex-05', category: 'exploit', difficulty: 1,
      title: '对付从不持续下注的玩家',
      scenario: {
        heroHand: '7♦ 6♦', position: 'BB', stackDepth: '100BB',
        board: 'Q♠ 8♣ 2♦（翻牌圈，你完全错过）', potInfo: '底池 9BB',
        villainAction: '按钮位玩家（翻牌前加注者）过牌——他的数据显示 c-bet 频率仅 25%，过牌≈放弃',
        extra: '对手风格：开池后不中就过牌放弃，极少诈唬'
      },
      options: [
        { key: 'raise', label: '主动下注 5BB 抢池', score: 100, feedback: '正确。对手过牌高度可靠地意味着放弃——这类「诚实型」玩家的过牌就是送钱信号，任何两张牌都该主动抢。' },
        { key: 'check', label: '过牌看转牌', score: 40, feedback: '对普通对手可以接受，但对明确「过牌=放弃」的玩家，免费看牌不如直接收池——你错过了已被识别的漏洞。' }
      ],
      theory: {
        name: '剥削打法 · 读取「诚实信号」',
        points: [
          '许多弱玩家的行动与牌力高度相关：下注=有牌，过牌=没牌。这类玩家是最好剥削的对象。',
          '识别方法：观察摊牌回放，记录「过牌后摊牌时的牌力」——若过牌范围里几乎没有强牌，就放心攻击。',
          '对诚实型玩家反过来也成立：他们下注时，你的边缘牌可以安心过度弃牌。'
        ]
      }
    },
    {
      id: 'ex-06', category: 'exploit', difficulty: 3,
      title: '面对只拿坚果加注的玩家',
      scenario: {
        heroHand: 'A♣ K♠', position: 'BTN', stackDepth: '110BB',
        board: 'K♦ 7♠ 5♣ 2♥（转牌圈，你顶对顶踢脚）', potInfo: '底池 35BB',
        villainAction: '你转牌下注 20BB，紧守型对手加注到 65BB——他的历史数据：翻牌后加注 8 次，8 次全是两对以上',
        extra: '对手的转牌加注范围经数据验证=超强牌'
      },
      options: [
        { key: 'fold', label: '弃牌（Fold）', score: 100, feedback: '正确。剥削打法最爽的时刻：对手范围被数据封顶为「两对+」，你的 TPTK 是他范围的最底端——弃牌是巨大正 EV。' },
        { key: 'call', label: '跟注 45BB', score: 25, feedback: '对均衡范围跟注合理，但这个对手的范围没有诈唬——跟注等于花 45BB 买一个已知的坏消息。' },
        { key: 'raise', label: '全下 110BB', score: 5, feedback: '用最差的情况撞上对手已验证的超强范围，等于直接转账。' }
      ],
      theory: {
        name: '剥削打法 · 过度弃牌的合法性（Exploitative Over-folding）',
        points: [
          'GTO 要求你用一定比例的范围防守加注，否则被诈唬剥削——但前提是对手真的会诈唬。',
          '当数据证明对手「只拿坚果加注」时，MDF 不再适用：防守范围里所有落后于坚果的牌都应弃掉。',
          '这正是剥削与 GTO 的分工：GTO 防你被剥削，剥削帮你抓对手的失衡。'
        ]
      }
    },

    /* ================= 追加题库（第三批：多人底池 / 翻牌后多街 / 范围阅读） ================= */

    /* ---------- 多人底池（multiway） ---------- */
    {
      id: 'mw-01', category: 'multiway', difficulty: 2,
      title: '三人池里的顶对',
      scenario: {
        heroHand: 'A♠ K♦', position: 'BTN', stackDepth: '100BB',
        board: 'K♠ 9♥ 5♣（翻牌圈，你顶对顶踢脚）', potInfo: '底池 18BB（三人池）',
        villainAction: '大盲过牌，中位玩家（松凶）下注 12BB',
        extra: '三人池，你翻牌前开池，两人跟注'
      },
      options: [
        { key: 'call', label: '跟注 12BB', score: 100, feedback: '正确。多人池里顶对的相对价值下降，但面对松凶玩家的领先下注，跟注是标准防守；加注会打走所有更差牌、只被更强牌跟。' },
        { key: 'raise', label: '加注到 32BB', score: 40, feedback: '多人池加注过于激进：你打走了 9x、55 等支付牌，只被三条、两对跟注——赢小输大的结构。' },
        { key: 'fold', label: '弃牌（Fold）', score: 20, feedback: '顶对顶踢脚在三人池面对单次下注弃牌，属于过度弃牌——对手的范围里有大量更差 Kx 和听牌。' }
      ],
      theory: {
        name: '多人底池 · 顶对价值衰减',
        points: [
          '单挑池里顶对顶踢脚（TPTK）≈强牌；三人以上底池里，TPTK 只是中等偏上牌力——总有人可能持有两对以上。',
          '多人池原则：「坚果浓度」决定下注策略。非坚果强牌在多人池里倾向于跟注控制底池，而非加注膨胀底池。',
          '多人池里诈唬成功率大幅下降（需要所有人弃牌），但价值下注可以放宽——总有人会有第二好的牌。'
        ]
      }
    },
    {
      id: 'mw-02', category: 'multiway', difficulty: 1,
      title: '多人池的小对子',
      scenario: {
        heroHand: '6♣ 6♦', position: 'CO', stackDepth: '有效筹码 130BB',
        board: '—（翻牌前）', potInfo: '底池 7.5BB（UTG 开池 3BB + 两人跟注）',
        villainAction: 'UTG 标准玩家开池，按钮跟注，轮到你',
        extra: '130BB 深筹码，多人池结构'
      },
      options: [
        { key: 'call', label: '跟注 3BB', score: 100, feedback: '正确。130BB 深筹码 + 多人池 = set mining 的理想条件。底池已有 7.5BB，你只需 3BB 博一个可能赢 100BB+ 的底池。' },
        { key: 'raise', label: '挤压加注到 14BB', score: 45, feedback: '小对子挤压在多人池里风险高：UTG 范围强，被跟注后无位置打多人池，66 的权益难以实现。' },
        { key: 'fold', label: '弃牌（Fold）', score: 35, feedback: '太紧。深筹码多人池是小对子最赚钱的场景之一，弃掉等于放弃了隐含赔率最好的一次机会。' }
      ],
      theory: {
        name: '多人底池 · Set Mining 的黄金场景',
        points: [
          '多人池反而增强 set mining 价值：更多对手 = 更可能有人持有强牌支付你。',
          '深筹码（120BB+）+ 多人池 + 低跟注成本 = 小对子隐含赔率的完美组合。',
          '注意反向隐含赔率：UTG 强范围意味着翻牌后他不容易弃牌——这正是你想要的支付者。'
        ]
      }
    },
    {
      id: 'mw-03', category: 'multiway', difficulty: 3,
      title: '多人池的诈唬禁忌',
      scenario: {
        heroHand: 'Q♠ J♠', position: 'BTN', stackDepth: '100BB',
        board: 'A♥ 8♣ 4♦ 2♠（转牌圈，你只有两高张+卡顺）', potInfo: '底池 25BB（三人池）',
        villainAction: '大盲和中位都过牌',
        extra: '翻牌没人下注，转牌再次全过'
      },
      options: [
        { key: 'check', label: '过牌（Check back）', score: 100, feedback: '正确。多人池转牌诈唬需要所有对手弃牌，概率极低；保留筹码到河牌再评估，或在对手再次示弱时小规模试探。' },
        { key: 'raise', label: '下注 15BB 半诈唬', score: 30, feedback: '两人过牌后你仍需要同时打走两个范围——即使每人弃牌率 60%，同时弃牌也只有 36%，低于半池诈唬所需的 40%。' },
        { key: 'raise', label: '全下诈唬 80BB', score: 5, feedback: '用空气在三人池全下是灾难级打法。总有人会有一对以上牌力跟注。' }
      ],
      theory: {
        name: '多人底池 · 诈唬数学',
        points: [
          '多人池诈唬成功概率 = 各人弃牌率的乘积。三人池里即使每人 60% 弃牌率，总成功率也只有 36%。',
          '因此多人池应大幅缩减诈唬频率，把诈唬留给单挑池或有明确读牌时。',
          '多人池的正确利润来源：价值下注放宽（更多人有第二好牌）+ 减少诈唬 + 用强听牌半诈唬。'
        ]
      }
    },
    {
      id: 'mw-04', category: 'multiway', difficulty: 2,
      title: '湿润牌面的多人池防守',
      scenario: {
        heroHand: 'A♦ Q♦', position: 'BB', stackDepth: '100BB',
        board: 'J♦ T♦ 5♠（翻牌圈，你有坚果同花听牌+卡顺+两高张）', potInfo: '底池 15BB（三人池）',
        villainAction: 'CO 位玩家下注 10BB，按钮跟注',
        extra: '两人持续行动，牌面极其湿润'
      },
      options: [
        { key: 'raise', label: '加注到 35BB', score: 100, feedback: '正确。你有 12+ 张补牌（坚果同花 9 + 卡顺 3~6），加注可以同时打走弱牌、建立底池、利用弃牌权益+成牌赔率双通道盈利。' },
        { key: 'call', label: '跟注 10BB', score: 55, feedback: '跟注可行但被动：你让按钮用便宜价格继续，且翻牌圈不加注后转牌很可能面对更大压力。强听牌应该主动。' },
        { key: 'fold', label: '弃牌（Fold）', score: 5, feedback: '严重错误。12+ 补牌的强听牌在多人池里是「准成牌」，弃牌等于放弃大量权益。' }
      ],
      theory: {
        name: '多人底池 · 强听牌的主动出击',
        points: [
          '强听牌（12+ 补牌）在多人池里应该打得像成牌一样激进：加注/全下通常是最优线。',
          '多人池里跟注强听牌的问题：你给了后面玩家便宜的跟注价格，稀释了自己的弃牌权益。',
          '湿润牌面（J-T-5 两色）集中击中大量范围，加注可以打走脆弱的一对，同时保留成牌潜力。'
        ]
      }
    },

    /* ---------- 翻牌后多街决策（postflop） ---------- */
    {
      id: 'pf-01', category: 'postflop', difficulty: 2,
      title: '翻牌中顶对后的转牌决策',
      scenario: {
        heroHand: 'A♠ K♥', position: 'BTN', stackDepth: '后手 85BB',
        board: 'K♦ 7♣ 2♠ 9♥（转牌圈，你顶对顶踢脚）', potInfo: '底池 28BB',
        villainAction: '你翻牌 c-bet 8BB 被跟，转牌对手过牌',
        extra: '牌面干燥，无明显听牌完成'
      },
      options: [
        { key: 'raise', label: '第二枪下注 16~18BB', score: 100, feedback: '正确。干燥牌面 + 顶对顶踢脚 = 继续拿价值。对手范围里有大量 7x、9x、中对愿意再支付一条街。' },
        { key: 'check', label: '过牌控池', score: 45, feedback: '过于保守。翻牌被跟注说明对手有牌力（对子/听牌），转牌过牌放弃了明确的价值——这不是中等牌力，是强牌。' },
        { key: 'raise', label: '全下 85BB', score: 15, feedback: '过度膨胀底池。顶对顶踢脚是强牌但不是坚果，全下只会被更强的牌（两对+）跟注。' }
      ],
      theory: {
        name: '翻牌后多街 · 第二枪（Double Barrel）价值线',
        points: [
          '转牌继续下注的条件：你的牌力领先对手跟注范围的大部，且牌面没有剧烈变化（如听牌完成）。',
          '干燥牌面（K-7-2-9 彩虹）对翻牌前加注者有利，第二枪弃牌率高且价值充足。',
          '区分「价值枪」和「诈唬枪」：这里你的 AK 是价值下注——打走的是更差 Kx，被跟注也领先。'
        ]
      }
    },
    {
      id: 'pf-02', category: 'postflop', difficulty: 3,
      title: '河牌的薄价值判断',
      scenario: {
        heroHand: 'Q♥ J♥', position: 'CO', stackDepth: '后手 70BB',
        board: 'Q♠ 8♦ 3♣ 6♥ 2♦（河牌，你顶对好踢脚）', potInfo: '底池 40BB',
        villainAction: '翻牌你 c-bet 被跟，转牌双方过牌，河牌对手过牌',
        extra: '对手是被动的休闲玩家，翻牌跟注范围：Qx、8x、小对子、听牌'
      },
      options: [
        { key: 'raise', label: '薄价值下注 12~15BB（1/3 池）', score: 100, feedback: '正确。对手范围里有大量 8x、6x、小对子会跟注小注，而你只输给 QK/QA。小尺度薄价值是利润来源。' },
        { key: 'raise', label: '大注 30BB（3/4 池）', score: 45, feedback: '大注打走了所有你想让跟注的牌（8x、6x），只留下 QK/QA 和诈唬——赢小输大的结构。' },
        { key: 'check', label: '过牌求摊牌', score: 35, feedback: '错失薄价值。被动玩家在河牌很少诈唬，他们的过牌范围里有大量愿意跟小注的第二好牌。' }
      ],
      theory: {
        name: '翻牌后多街 · 薄价值下注（Thin Value）',
        points: [
          '薄价值 = 用不是坚果的牌下注，目标是让范围里「刚好更差」的牌跟注。这是中高级玩家的核心利润来源。',
          '薄价值的尺度原则：越小越好。1/3 底池能让 8x、6x 甚至小对子舒服地跟注，大注则只能被更强牌跟。',
          '判断标准：问自己「对手范围里有多少更差的牌会跟注这个小注？」如果答案 ≥ 2 种，就值得下注。'
        ]
      }
    },
    {
      id: 'pf-03', category: 'postflop', difficulty: 2,
      title: '危险牌面的减速带',
      scenario: {
        heroHand: 'A♣ A♦', position: 'BTN', stackDepth: '后手 90BB',
        board: 'T♠ 9♠ 8♦ 7♣（转牌圈，牌面四连张+两黑桃）', potInfo: '底池 30BB',
        villainAction: '你翻牌 c-bet 10BB 被大盲跟注，转牌对手主动下注 20BB',
        extra: '对手是标准玩家，翻牌前跟注你的开池'
      },
      options: [
        { key: 'call', label: '跟注 20BB', score: 100, feedback: '正确。AA 在此牌面从「超强牌」降为「抓诈牌」——对手范围里有大量顺子、两对、三条。跟注控制底池，河牌再评估。' },
        { key: 'raise', label: '加注到 55BB', score: 25, feedback: '用一手抓诈牌加注是灾难：你打走了所有诈唬，只被顺子、三条、两对跟注——恰好是你落后的牌。' },
        { key: 'fold', label: '弃牌（Fold）', score: 40, feedback: '对标准玩家弃牌可以理解但偏紧。他的范围里仍有半诈唬（Jx、Qx、听花）和更差超对，跟注一次看河牌是合理的。' }
      ],
      theory: {
        name: '翻牌后多街 · 牌面剧烈变化时的重新评估',
        points: [
          '翻牌圈强牌 ≠ 转牌圈强牌。牌面每出一张新牌，都要重新评估你的相对牌力。',
          '四连张牌面（T-9-8-7）让任何 J 或 6 成顺，对手范围集中击中——你的 AA 从顶端跌到「抓诈牌」区间。',
          '抓诈牌的正确打法：跟注控制底池，不主动膨胀，河牌根据对手行动再做最终决定。'
        ]
      }
    },
    {
      id: 'pf-04', category: 'postflop', difficulty: 3,
      title: '河牌面对大额下注',
      scenario: {
        heroHand: 'K♠ Q♠', position: 'BB', stackDepth: '后手 75BB',
        board: 'K♦ 9♣ 4♠ 2♥ 7♦（河牌，你顶对好踢脚）', potInfo: '底池 50BB',
        villainAction: '整手牌你一直跟注对手的下注，河牌对手全下 75BB（1.5 倍底池）',
        extra: '对手是松凶玩家，有能力做三条街诈唬'
      },
      options: [
        { key: 'call', label: '跟注全下 75BB', score: 85, feedback: '可以跟注。松凶玩家的河牌超池范围极化：要么是三条/两对，要么是纯空气诈唬。KQo 赢他所有的诈唬和更差 Kx，输给两对+——对松凶玩家跟注正 EV。' },
        { key: 'fold', label: '弃牌（Fold）', score: 55, feedback: '对紧手这是标准弃牌，但对有能力三条街诈唬的松凶玩家，弃掉顶对好踢脚等于让他用空气稳定剥削你。' }
      ],
      theory: {
        name: '翻牌后多街 · 河牌抓诈决策框架',
        points: [
          '河牌抓诈三步：①对手会用什么牌诈唬？②我的牌赢他的诈唬吗？③底池赔率够吗？',
          '超池下注（1.5x 底池）让对手的范围极化：超强牌或纯空气。你的顶对赢所有空气，输给超强牌——关键是对手诈唬频率。',
          '对松凶玩家放宽抓诈范围；对紧手玩家收紧到两对以上。对手类型决定一切。'
        ]
      }
    },

    /* ---------- 范围阅读（range） ---------- */
    {
      id: 'rg-01', category: 'range', difficulty: 1,
      title: '紧手玩家的翻牌前范围',
      scenario: {
        heroHand: 'A♦ T♠', position: 'BB', stackDepth: '100BB',
        board: '—（翻牌前）', potInfo: '底池 4.5BB',
        villainAction: 'UTG 位极紧玩家（开池率 8%）加注到 3BB',
        extra: '对手数据：VPIP 12%，PFR 8%，翻牌前 3Bet 仅 2%'
      },
      options: [
        { key: 'fold', label: '弃牌（Fold）', score: 100, feedback: '正确。UTG 8% 开池范围 ≈ 77+、ATs+、KQs、AKo。ATo 被其中大量牌压制（AK、AQ、AJ），弃牌是标准打法。' },
        { key: 'call', label: '跟注 2BB', score: 30, feedback: '被压制的牌在无位置打紧手范围，长期期望为负。即使中 A 也可能被 AK/AQ 碾压。' },
        { key: 'raise', label: '3Bet 到 11BB', score: 20, feedback: '对 8% 开池范围 3Bet 诈唬 = 撞钢板。对手只会用 QQ+/AK 继续，你的 ATo 被碾压。' }
      ],
      theory: {
        name: '范围阅读 · 用数据估算对手范围',
        points: [
          'VPIP（自愿入池率）和 PFR（翻牌前加注率）是最基本的范围指标：12/8 意味着他只玩前 12% 的牌，其中 8% 主动加注。',
          '紧手的 UTG 开池范围非常透明：大对子 + 强 Broadway。你的边缘 Ax 面对这个范围处于严重劣势。',
          '范围阅读第一步不是「他有什么牌」，而是「他没有什么牌」——排除法比猜测更可靠。'
        ]
      }
    },
    {
      id: 'rg-02', category: 'range', difficulty: 2,
      title: '范围封顶与坚果优势',
      scenario: {
        heroHand: '8♠ 8♣', position: 'BB', stackDepth: '100BB',
        board: '8♦ 5♣ 2♠（翻牌圈，你三条 8）', potInfo: '底池 12BB',
        villainAction: '按钮位玩家（翻牌前跟注你的 3Bet）过牌',
        extra: '你翻牌前 3Bet，对手跟注——他的范围封顶（cap）在 QQ 以下'
      },
      options: [
        { key: 'raise', label: '下注 6~8BB（小尺度）', score: 100, feedback: '正确。你有坚果优势（牌面最高三条），对手范围封顶——小尺度下注让他范围里所有对子、两高张都能舒服跟注，最大化价值。' },
        { key: 'check', label: '过牌诱捕', score: 50, feedback: '可以理解但非最优。对手范围封顶意味着他不太可能有强牌主动下注，过牌可能白白损失一条街价值。小尺度下注更好。' },
        { key: 'raise', label: '大注 15BB 施压', score: 30, feedback: '对手范围封顶意味着他大多是中小对子和高牌——大注只会打走你想让跟注的牌。' }
      ],
      theory: {
        name: '范围阅读 · 范围封顶（Capped Range）',
        points: [
          '封顶 = 对手的行动排除了他范围里的最强牌。翻牌前跟注 3Bet 通常排除了 AA/KK/AK——他的范围「封顶」在 QQ 以下。',
          '当你有坚果优势（范围里有最强牌而对手没有），可以高频小尺度下注：对手无法用任何牌舒服地加注你。',
          '反之，当你的范围封顶时要小心——对手知道你没有坚果，可以用大注施压。'
        ]
      }
    },
    {
      id: 'rg-03', category: 'range', difficulty: 3,
      title: '河牌的范围收窄',
      scenario: {
        heroHand: 'A♥ Q♥', position: 'BTN', stackDepth: '后手 65BB',
        board: 'K♥ 7♥ 2♣ 4♠ 9♦（河牌，你只有 A 高）', potInfo: '底池 45BB',
        villainAction: '你翻牌 c-bet 被跟，转牌双方过牌，河牌对手过牌',
        extra: '对手是标准玩家。翻牌他跟注你的 c-bet，转牌过牌-过牌'
      },
      options: [
        { key: 'raise', label: '诈唬下注 20~25BB', score: 85, feedback: '可以诈唬。对手翻牌跟注+转牌过牌的范围大多是弱对子（7x、4x、口袋小对）和破产听牌。你有 K 高牌面阻隔，下注可以打走他范围里的大部分。' },
        { key: 'check', label: '过牌认输', score: 50, feedback: '稳健但错失机会。A 高在此牌面几乎无摊牌价值（输给任何对子），过牌等于放弃了一个有利可图的诈唬机会。' }
      ],
      theory: {
        name: '范围阅读 · 河牌诈唬的范围分析',
        points: [
          '河牌诈唬前先构建对手范围：翻牌跟注 c-bet → 转牌过牌-过牌 → 河牌过牌，这条线强烈暗示弱对子或破产听牌。',
          '你的 A♥Q♥ 阻断了对手的一些 Ax 跟注组合，同时 K 高牌面对你有利——你是翻牌前加注者，范围里有大量 Kx。',
          '诈唬的目标不是「让对手弃掉好牌」，而是「让对手范围里占比最大的弱牌弃牌」。'
        ]
      }
    },
    {
      id: 'rg-04', category: 'range', difficulty: 2,
      title: '对手翻牌前 3Bet 的范围',
      scenario: {
        heroHand: 'J♠ J♦', position: 'CO', stackDepth: '100BB',
        board: '—（翻牌前）', potInfo: '你开池 3BB，按钮 3Bet 到 10BB',
        villainAction: '按钮位松凶玩家 3Bet 到 10BB——他的 3Bet 频率 12%',
        extra: '12% 3Bet 范围 ≈ 77+、A9s+、KTs+、QTs+、JTs、Ajo+、KQo + 部分诈唬'
      },
      options: [
        { key: 'call', label: '跟注 7BB', score: 100, feedback: '正确。JJ 在 12% 3Bet 范围对决中约 55% 胜率，跟注正 EV。4Bet 会打走所有更差牌，只被 QQ+/AK 跟注。' },
        { key: 'raise', label: '4Bet 到 28BB', score: 35, feedback: 'JJ 4Bet 后面对 5Bet 全下只能弃牌（对手 5Bet 范围≈QQ+/AK），你把一手好牌变成了诈唬。' },
        { key: 'fold', label: '弃牌（Fold）', score: 20, feedback: '对 12% 3Bet 范围弃掉 JJ 太紧。JJ 领先他范围里大量牌（TT、99、AQ、AJ、KQ），弃牌是被剥削。' }
      ],
      theory: {
        name: '范围阅读 · 3Bet 范围的对抗策略',
        points: [
          '面对 3Bet，先估算对手 3Bet 频率：紧手（3~5%）范围≈QQ+/AK，松手（10%+）范围包含大量 Broadway 和诈唬。',
          'JJ/TT 的处理原则：对紧手 3Bet 可以弃牌或跟注；对松手 3Bet 必须继续——它们领先大部分范围。',
          '关键概念「范围对决胜率」：不要想「JJ 有多强」，要想「JJ 对对手 12% 的 3Bet 范围有多少胜率」。'
        ]
      }
    },

    /* ================= 3Bet/4Bet 底池（难度 2~3） ================= */
    {
      id: '3b-01', category: '3bet', difficulty: 2,
      title: '按钮位挤压：开池+跟注后的 AQo',
      scenario: {
        heroHand: 'A♥ Q♣', position: 'BTN（按钮位）', stackDepth: '100BB',
        board: '—（翻牌前）', potInfo: 'CO 开池 2.5BB，HJ 跟注，底池 6.5BB',
        villainAction: '关煞位开池，劫持位跟注，轮到你',
        extra: '两名对手都是常规玩家，无特殊倾向'
      },
      options: [
        { key: 'raise', label: '加注到 11~12BB（挤压）', score: 100, feedback: '正确。经典挤压场景：开池者范围宽、跟注者范围封顶（有强牌早加注了），大尺度 3Bet 经常直接收下 6.5BB 死钱，被跟注后 AQo 也有可玩性。' },
        { key: 'call', label: '跟注 2.5BB', score: 40, feedback: '平跟让大盲便宜跟入、形成 4 人底池，AQo 的赢率被大幅稀释，且放弃了惩罚宽范围的机会。' },
        { key: 'fold', label: '弃牌（Fold）', score: 15, feedback: 'AQo 在按钮位面对宽开池范围弃牌过于保守——这手牌领先 CO 开池范围的大部分。' }
      ],
      theory: {
        name: '3Bet/4Bet 底池 · 挤压打法（Squeeze）',
        points: [
          '挤压条件：开池者范围宽 + 中间有跟注死钱 + 你持有可玩的强牌。',
          '中间跟注者的范围封顶：他有强牌（QQ+/AK）早就 3Bet 了，平跟暴露中等牌力。',
          '挤压尺度应大于普通 3Bet（约等于底池大小），给所有人错误的跟注价格。',
          '优先在后位或盲注位挤压：无位置挤压被冷跟后底池巨大、后续难打。'
        ]
      }
    },
    {
      id: '3b-02', category: '3bet', difficulty: 2,
      title: '小盲位面对偷盲：A5s 的 3Bet',
      scenario: {
        heroHand: 'A♠ 5♠', position: 'SB（小盲位）', stackDepth: '100BB',
        board: '—（翻牌前）', potInfo: '按钮开池 2.5BB，底池 4BB',
        villainAction: '按钮位（开池率 45% 的松手）开池 2.5BB，大盲弃牌到你',
        extra: '按钮位是高频偷盲者，范围很宽'
      },
      options: [
        { key: 'raise', label: '3Bet 到 9BB', score: 100, feedback: '正确。A5s 是盲注位 3Bet 的经典候选：阻断对手的 AA/A5 组合、有坚果同花潜力，且小盲位平跟是全桌最差打法（大盲还在身后）。' },
        { key: 'call', label: '跟注 2BB', score: 25, feedback: '小盲位平跟大忌：大盲获得极好赔率跟入，你在三人底池里位置最差，A5s 的赢率被稀释。' },
        { key: 'fold', label: '弃牌（Fold）', score: 35, feedback: '面对 45% 的宽开池弃掉 A5s 太紧——它在同花 Ax 里属于质量最高的一档。' }
      ],
      theory: {
        name: '3Bet/4Bet 底池 · 盲注位的 3Bet 反击',
        points: [
          '小盲位策略基调是「3Bet 或弃牌」，尽量避免平跟（大盲在身后随时挤压你）。',
          '同花 Ax（尤其 A2s~A5s）是优质 3Bet 候选：阻断坚果 Ax 组合 + 同花潜力 + 轮子顺可能。',
          '3Bet 的盈利 = 弃牌收益（对手弃掉 45% 范围里的大部分）+ 被跟注后的翻牌后权益。'
        ]
      }
    },
    {
      id: '3b-03', category: '3bet', difficulty: 3,
      title: '4Bet 诈唬：AKo 面对紧手 3Bet',
      scenario: {
        heroHand: 'A♦ K♣', position: 'CO（关煞位）', stackDepth: '100BB',
        board: '—（翻牌前）', potInfo: '你开池 2.5BB，按钮 3Bet 到 9BB',
        villainAction: '按钮位紧凶玩家（3Bet 频率 8%）3Bet 到 9BB',
        extra: '对手有 3Bet 诈唬习惯，范围含部分 Axs 诈唬'
      },
      options: [
        { key: 'raise', label: '4Bet 到 22BB', score: 100, feedback: '正确。AKo 面对 8% 3Bet 范围是价值 4Bet：领先范围里的 AQ/AJ 诈唬与部分对子；对手弃牌你赢 11.5BB，全下对决也不吃亏（AK vs QQ ≈ 45%）。' },
        { key: 'call', label: '跟注 6.5BB', score: 55, feedback: '可接受但不是最优。跟注后无位置打 3Bet 底池，翻牌不中（约 2/3 概率）很难继续；AK 的价值最好在翻牌前兑现。' },
        { key: 'fold', label: '弃牌（Fold）', score: 10, feedback: 'AKo 弃牌给 8% 3Bet 范围是严重过紧——它领先范围内大量诈唬牌。' }
      ],
      theory: {
        name: '3Bet/4Bet 底池 · 4Bet 的构成',
        points: [
          '4Bet 范围 = 价值牌（QQ+/AK）+ 精选诈唬（带阻断牌的 Axs、KQs），保持约 2:1 价值诈唬比。',
          'AK 的特殊地位：对任何非 AA/KK 的牌都有 40%+ 胜率，是最强的「半诈唬」4Bet 牌。',
          '4Bet 尺度约 2.2~2.5 倍对手 3Bet：太小给对手好赔率，太大浪费诈唬成本。',
          '对手 3Bet 频率越高（>7%），你的 4Bet 范围就应该越宽。'
        ]
      }
    },
    {
      id: '3b-04', category: '3bet', difficulty: 3,
      title: '3Bet 底池翻牌后：A 高干燥面持续下注',
      scenario: {
        heroHand: 'K♠ K♦', position: 'BTN（按钮位）', stackDepth: '100BB，剩余约 88BB',
        board: 'A♣ 8♦ 3♠（翻牌）', potInfo: '你 3Bet 到 11BB，UTG 跟注，底池 23.5BB',
        villainAction: 'UTG 过牌，轮到你行动',
        extra: '对手跟注 3Bet 范围：77~QQ、AQ、AJ、部分同花 Broadway'
      },
      options: [
        { key: 'raise', label: '下注 8BB（1/3 底池）', score: 100, feedback: '正确。A 高干燥面极度有利于 3Bet 者范围（你有所有 AA/AK/AQ），对手跟注范围里大量对子（77~QQ）面对 A 面很难受。小注即可高效施压，诈唬只需 25% 弃牌率回本。' },
        { key: 'check', label: '过牌（Check back）', score: 30, feedback: '浪费了范围优势最大的牌面。KK 在 A 面确实是「摊牌价值牌」，但小注能打走 QQ/JJ/TT 且被更差牌跟注的可能性不小——全范围小注是标准打法。' },
        { key: 'raise2', label: '下注 20BB（接近底池）', score: 40, feedback: '尺度错误。干燥面大注只会打走所有你想让他留下的牌（Qx、中对），留下碾压你的 Ax——大注留给湿润面或极化场合。' }
      ],
      theory: {
        name: '3Bet/4Bet 底池 · 翻牌后范围优势',
        points: [
          '3Bet 底池的翻牌后核心问题：这个牌面更契合谁的范围？A 高面、K 高面天然偏向 3Bet 者。',
          '范围优势大 → 全范围高频小注（1/3 底池），用最小成本施压整个范围。',
          '低张连面（如 7♦6♣5♠）偏向跟注者范围，3Bet 者应降低 c-bet 频率。',
          '3Bet 底池 SPR 低（通常 3~4），顶对及以上牌力通常可以直接打光。'
        ]
      }
    },
    {
      id: '3b-05', category: '3bet', difficulty: 2,
      title: '面对 3Bet：TT 的选择',
      scenario: {
        heroHand: 'T♥ T♣', position: 'MP（中位）', stackDepth: '100BB',
        board: '—（翻牌前）', potInfo: '你开池 2.5BB，大盲 3Bet 到 10BB',
        villainAction: '大盲位（对偷盲反击积极的常客）3Bet 到 10BB',
        extra: '对手大盲位 3Bet 频率 9%，含一定诈唬'
      },
      options: [
        { key: 'call', label: '跟注 7.5BB', score: 100, feedback: '正确。TT 面对 9% 3Bet 范围有约 50%+ 胜率，跟注正 EV；4Bet 只会打走诈唬、被 JJ+/AK 继续，把成牌变诈唬。' },
        { key: 'raise', label: '4Bet 到 24BB', score: 30, feedback: 'TT 4Bet 的尴尬：对手弃牌你只赢小池，对手 5Bet 全下你必须弃牌——把领先大量范围的成牌打成了纯诈唬。' },
        { key: 'fold', label: '弃牌（Fold）', score: 20, feedback: '对 9% 的 3Bet 范围弃 TT 过紧。它领先 77~99、AQ、AJ、KTs 等大量组合。' }
      ],
      theory: {
        name: '3Bet/4Bet 底池 · 中等对子的处理',
        points: [
          'TT/99 面对 3Bet 的默认打法是跟注：领先诈唬范围，但不足以价值 4Bet。',
          '判断标准：你的牌 4Bet 后，有更差的牌跟注你吗？TT 4Bet 只有 JJ+ 和 AK 继续——没有。',
          '跟注后翻牌出 A/K/Q 时做好过牌弃牌准备：高牌面对 3Bet 者有利。',
          '例外：有效筹码 <40BB 时 TT 可以 4Bet 全下，低 SPR 下它的摊牌权益足够。'
        ]
      }
    },
    {
      id: '3b-06', category: '3bet', difficulty: 3,
      title: '4Bet 后被 5Bet 全下：AKs 跟不跟',
      scenario: {
        heroHand: 'A♣ K♣', position: 'BTN（按钮位）', stackDepth: '100BB',
        board: '—（翻牌前）', potInfo: '你开池 2.5BB，大盲 3Bet 到 10BB，你 4Bet 到 24BB，对手 5Bet 全下 100BB',
        villainAction: '大盲位紧凶玩家（5Bet 范围≈QQ+/AK）全下，你要跟注 76BB',
        extra: '底池已有 124.5BB，跟注需 76BB'
      },
      options: [
        { key: 'call', label: '跟注 76BB', score: 100, feedback: '正确。跟注所需胜率 = 76 ÷ 200.5 ≈ 38%。AKs 对 QQ+/AK 范围胜率约 40%（对 QQ 约 46%，平分 AK，只输 AA/KK），数学上是跟注。AKs 的同花权益比 AKo 高约 3%，恰好跨过临界线。' },
        { key: 'fold', label: '弃牌（Fold）', score: 45, feedback: '接近临界。AKo（非同花）弃牌更好——胜率约 37% 不够；AKs 则刚好够。这正是「同花值 3%」的实战意义。' }
      ],
      theory: {
        name: '3Bet/4Bet 底池 · 全下对决的临界计算',
        points: [
          '全下跟注公式：所需胜率 = 跟注额 ÷（跟注后总底池）。76 ÷ 200.5 ≈ 38%。',
          'AKs vs QQ+/AK 范围：vs QQ 约 46%，vs KK 约 34%，vs AA 约 12%，vs AK 平分——综合约 40%。',
          '同花与杂色的 3% 差距在临界决策中是决定性的：AKs 跟、AKo 弃，是标准的锦标赛/深筹码分界线。',
          '深筹码（150BB+）时 5Bet 范围更纯（AA/KK），AKs 也应该弃牌——深度改变一切。'
        ]
      }
    },
    {
      id: '3b-07', category: '3bet', difficulty: 2,
      title: '枪口开池被 3Bet：AQo 的取舍',
      scenario: {
        heroHand: 'A♦ Q♥', position: 'UTG（枪口位）', stackDepth: '100BB',
        board: '—（翻牌前）', potInfo: '你开池 3BB，按钮 3Bet 到 10BB',
        villainAction: '按钮位紧手（3Bet 频率 3.5%）3Bet 到 10BB',
        extra: '对手 3.5% 范围 ≈ JJ+、AK，几乎无诈唬'
      },
      options: [
        { key: 'fold', label: '弃牌（Fold）', score: 100, feedback: '正确。AQo 面对 JJ+/AK 的纯价值范围胜率仅约 35%，且无位置。弃牌不是示弱，是拒绝打负 EV 的底池。' },
        { key: 'call', label: '跟注 7BB', score: 30, feedback: '被压制重灾区：翻牌出 A 输给 AK/AA，出 Q 输给 QQ/KK/AA。你中了牌反而是最危险的时候——反向隐含赔率拉满。' },
        { key: 'raise', label: '4Bet 到 25BB', score: 10, feedback: '对 3.5% 无诈唬范围 4Bet 是烧钱：对手只会用 AA/KK/QQ/AK 继续，你的 AQo 全部落后。' }
      ],
      theory: {
        name: '3Bet/4Bet 底池 · 对紧手的过度弃牌是合法剥削',
        points: [
          '紧手 3Bet 频率 3%~4% 时范围 ≈ JJ+/AK，无诈唬——MDF 不再适用，可以合法地过度弃牌。',
          'AQ/AJ/KQ 这类「被压制牌」对纯价值范围是负 EV 跟注：中了顶对往往还是输。',
          '你的开池位置越靠前，对手 3Bet 越尊重你（范围越强）——UTG 开池被 3Bet 要收紧继续范围。',
          '反过来：你 3Bet 别人的 UTG 开池时，范围也应以价值为主。'
        ]
      }
    },
    {
      id: '3b-08', category: '3bet', difficulty: 3,
      title: '3Bet 底池湿润面：AK 没中怎么打',
      scenario: {
        heroHand: 'A♠ K♥', position: 'BTN（按钮位）', stackDepth: '剩余约 85BB',
        board: 'J♦ 9♦ 8♣（翻牌）', potInfo: '你 3Bet 到 11BB，CO 跟注，底池 23.5BB',
        villainAction: 'CO 过牌，轮到你行动',
        extra: '对手跟注 3Bet 范围含大量同花连张、中对子'
      },
      options: [
        { key: 'check', label: '过牌（Check back）', score: 100, feedback: '正确。J♦9♦8♣ 是对手跟注范围最契合的牌面（同花连张天堂），你的两高张只有 6 张抽对补牌。在对手范围优势面高频下注等于烧钱——过牌保留转牌免费牌机会。' },
        { key: 'raise', label: '下注 16BB（2/3 底池）', score: 25, feedback: '湿润连张面大注是双重错误：对手范围里全是继续牌（对子+听牌），你的 AK 落后于任何对子；诈唬成本还高。' },
        { key: 'raise2', label: '下注 8BB（1/3 底池）', score: 45, feedback: '小注勉强可以接受（范围下注策略），但相比 A 高干燥面，这个牌面的弃牌率低得多——选择性过牌更优。' }
      ],
      theory: {
        name: '3Bet/4Bet 底池 · 牌面结构决定 c-bet 频率',
        points: [
          '湿润连张面（J♦9♦8♣ 类）偏向跟注者：他的同花连张、中对子全部命中或成听牌。',
          '3Bet 者的范围优势在 A/K 高干燥面，在湿润面反而处于「范围劣势」——降低频率、选择性下注。',
          'AK 没中时的补牌现实：抽对 6 张、胜率约 24%，不够支撑进攻性下注线。',
          '检查范围里应包含强牌陷阱（AA 在湿润面也可以偶尔过牌），保持平衡。'
        ]
      }
    },
    {
      id: '3b-09', category: '3bet', difficulty: 2,
      title: '冷跟 3Bet 的诱惑：同花 JTs',
      scenario: {
        heroHand: 'J♥ T♥', position: 'MP（中位）', stackDepth: '100BB',
        board: '—（翻牌前）', potInfo: 'UTG 开池 3BB，CO 3Bet 到 10BB',
        villainAction: 'UTG 开池，CO 常客 3Bet 到 10BB，轮到你',
        extra: '你身后还有按钮和两名盲注玩家未行动'
      },
      options: [
        { key: 'fold', label: '弃牌（Fold）', score: 100, feedback: '正确。冷跟 3Bet（cold-call）需要极强理由：身后还有 3 人可能被挤压，且你面对两个强范围。JTs 虽好，但这里 4Bet 诈唬都比跟注合理——跟注是最差选项。' },
        { key: 'call', label: '跟注 10BB', score: 25, feedback: '冷跟 3Bet 的经典亏损点：投 10BB 看翻牌，不中即弃；身后有人 4Bet 你连翻牌都看不到。位置与主动权双失。' },
        { key: 'raise', label: '4Bet 到 26BB', score: 55, feedback: '有想法但对象不对：冷 4Bet 诈唬需要阻断牌（Axs 更好），JTs 的玩法价值在于翻牌后，4Bet 把它的可玩性浪费了。' }
      ],
      theory: {
        name: '3Bet/4Bet 底池 · 冷跟 3Bet 的门槛',
        points: [
          '冷跟 3Bet（面对开池+3Bet 跟入）是高级打法，默认选择应该是弃牌。',
          '冷跟条件：深筹码 + 有位置 + 手牌隐含赔率高（小对子/同花连张）+ 身后无人可挤压。',
          '本局三条全不满足：身后 3 人未行动 + 面对两个强范围——弃牌无悬念。',
          '注意区分：你开池后跟注对手的 3Bet（正常防守）≠ 冷跟别人的开池+3Bet。'
        ]
      }
    }
  ];

  window.QuizData = { CATEGORIES, QUESTIONS };
})();
