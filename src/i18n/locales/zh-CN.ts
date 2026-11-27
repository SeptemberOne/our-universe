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
    statusReady: '基础已就绪',
    statusNext: '即将上线',
    statusPlanned: '规划中',
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
};
