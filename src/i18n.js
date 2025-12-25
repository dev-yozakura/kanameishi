import { createI18n } from 'vue-i18n';
import ja from './locales/ja.json';
import zh from './locales/zh.json';

const i18n = createI18n({
  legacy: false, // Vue 3 Composition APIを使用するためfalseに設定
  locale: 'zh', // デフォルト言語
  fallbackLocale: 'ja', // フォールバック言語
  messages: {
    ja,
    zh,
  },
});

export default i18n;
