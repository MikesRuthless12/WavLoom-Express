import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import es from '../locales/es.json';
import ptBR from '../locales/pt-BR.json';
import fr from '../locales/fr.json';
import de from '../locales/de.json';
import ja from '../locales/ja.json';
import ko from '../locales/ko.json';
import zhCN from '../locales/zh-CN.json';
import ru from '../locales/ru.json';
import hi from '../locales/hi.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    'pt-BR': { translation: ptBR },
    fr: { translation: fr },
    de: { translation: de },
    ja: { translation: ja },
    ko: { translation: ko },
    'zh-CN': { translation: zhCN },
    ru: { translation: ru },
    hi: { translation: hi },
  },
  lng: 'en',
  fallbackLng: 'en',
  ns: ['translation'],
  defaultNS: 'translation',
  interpolation: {
    escapeValue: false,
  },
});

// Apply saved language preference on startup
window.electronAPI?.getSetting('language').then((lang) => {
  if (lang && lang !== i18n.language) {
    i18n.changeLanguage(lang);
  }
});

export default i18n;
