import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import translationEN from './locales/en/translation.json';
import translationVI from './locales/vi/translation.json';
import translationCN from './locales/cn/translation.json';
import translationFR from './locales/fr/translation.json';
import translationJP from './locales/jp/translation.json';
import translationKR from './locales/kr/translation.json';

// Mapping between AI language codes and UI language codes
export const LANGUAGE_MAP = {
    'vie_Latn': 'vi',
    'eng_Latn': 'en',
    'zho_Hans': 'zh',
    'jpn_Jpan': 'ja',
    'kor_Hang': 'ko',
    'fra_Latn': 'fr'
};

const resources = {
  en: translationEN,
  vi: translationVI,
  zh: translationCN,
  fr: translationFR,
  ja: translationJP,
  ko: translationKR,
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
