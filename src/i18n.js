import { createI18n } from 'vue-i18n';
import ja from './locales/ja.json';
import zh from './locales/zh.json';

function getInitialLocale() {
  try {
    const raw = localStorage.getItem('mainSettings');
    if (!raw) return 'ja';
    const parsed = JSON.parse(raw);
    const lang = parsed?.language;
    return lang === 'ja' || lang === 'zh' ? lang : 'ja';
  } catch {
    return 'ja';
  }
}

const i18n = createI18n({
  legacy: false, // Vue 3 Composition APIを使用するためfalseに設定
  locale: getInitialLocale(),
  fallbackLocale: 'ja', // フォールバック言語
  messages: {
    ja,
    zh,
  },
});

export default i18n;
