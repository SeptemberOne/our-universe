import type { TranslationSchema } from './en';

export const zhCN: TranslationSchema = {
  app: {
    name: '我们的宇宙',
    tagline: '两颗心，一片宇宙。',
    privateBadge: '只属于两人的私密空间',
  },
  home: {
    welcomeTitle: '欢迎回到星海',
    welcomeBody: '在温柔的夜空里，珍藏我们喜欢的照片、轻松的小游戏与写给彼此的悄悄话。',
    sectionTitle: '星图入口',
    statusReady: '可立即游玩',
    statusNext: '开始游玩',
    statusPlanned: '规划中',
    openGameHint: '进入照片记忆翻牌游戏',
    footerNote: '默认私密保护 · 本地原型模式',
    destinations: {
      play: {
        title: '照片记忆翻牌',
        subtitle: '翻开星光卡片，一起找到成对的美好瞬间。',
      },
      memories: {
        title: '共同回忆',
        subtitle: '属于我们的私密相册与回忆小提示。',
      },
      letters: {
        title: '时光情书',
        subtitle: '只为彼此保存的信件与“当你……时打开”信封。',
      },
      garden: {
        title: '梦境花园',
        subtitle: '通过小游戏收集星光，装点我们的专属角落。',
      },
    },
  },
  language: {
    groupLabel: '语言切换',
    current: '当前语言：简体中文',
  },
  memoryMatch: {
    title: '照片记忆翻牌',
    sampleBadge: '星海示例卡组 · 离线可玩',
    instruction: '轻点两张星光卡片，找出所有成对的星海图案。',
    backLabel: '返回',
    backAccessibility: '返回我们的宇宙首页',
    resetLabel: '重新开始',
    resetAccessibility: '重新洗牌并开始新一局',
    stats: {
      moves: '步数',
      pairs: '已配对',
      time: '用时',
    },
    card: {
      hiddenLabel: '背面朝上的星光卡片',
      hiddenHint: '轻点翻开这张卡片',
      revealedLabel: '{{name}}，已翻开',
      matchedLabel: '{{name}}，已配对',
    },
    completion: {
      badge: '星图已点亮',
      title: '所有回忆都已相连',
      subtitle: '你们一起完成了全部 {{total}} 组星海配对。',
      playAgain: '再玩一局',
      backHome: '回到宇宙首页',
    },
    artworks: {
      crescentMoon: '新月微光',
      ringedPlanet: '光环行星',
      twinStars: '双子星辉',
      nebulaBloom: '星云绽放',
      shootingStar: '划过流星',
      eclipseHalo: '日蚀光晕',
    },
  },
};
