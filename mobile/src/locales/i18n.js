import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from './en/translation.json';
import vi from './vi/translation.json';

const resources = {
  en: { translation: en },
  vi: { translation: vi },
};

// Get device language
const getDeviceLanguage = () => {
  const locale = Localization.getLocales()[0].languageCode;
  return resources[locale] ? locale : 'en';
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getDeviceLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
