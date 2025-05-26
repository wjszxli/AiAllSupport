import { en } from './en';
import { zhCN } from './zh-CN';
import { zhTW } from './zh-TW';
import { ja } from './ja';
import { ko } from './ko';
import { de } from './de';
import { fr } from './fr';
import { es } from './es';
import { ru } from './ru';

export type LocaleKey = keyof typeof en;

export const locales = {
    'en': en,
    'zh-CN': zhCN,
    'zh-TW': zhTW,
    'ja': ja,
    'ko': ko,
    'de': de,
    'fr': fr,
    'es': es,
    'ru': ru,
};

export type LocaleType = keyof typeof locales;

export const DEFAULT_LOCALE: LocaleType = 'zh-CN';
