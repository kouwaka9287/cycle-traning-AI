/**
 * Lightweight i18n layer for CycleCoach.
 *
 * - Default language: Japanese (ja). Falls back to ja for any missing key.
 * - Persists user choice in localStorage under "cyclecoach.lang".
 * - Exposes a `t(key, params?)` function and a `lang` setter via React context.
 *
 * Translation values may include `{name}` style placeholders that are replaced
 * with values from the `params` object.
 */
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { dictionaries, type LangKey, type TranslationKey } from "./dictionary";

export const LANG_OPTIONS: { code: LangKey; label: string; native: string }[] = [
  { code: "ja", label: "Japanese", native: "日本語" },
  { code: "en", label: "English", native: "English" },
  { code: "zh", label: "Chinese (Simplified)", native: "简体中文" },
  { code: "ko", label: "Korean", native: "한국어" },
  { code: "fr", label: "French", native: "Français" },
  { code: "es", label: "Spanish", native: "Español" },
];

const STORAGE_KEY = "cyclecoach.lang";

type Params = Record<string, string | number>;

type I18nContextValue = {
  lang: LangKey;
  setLang: (l: LangKey) => void;
  // Accept any string so we can introduce keys progressively without type breaks.
  // Missing keys fall back through: current language -> Japanese -> raw key.
  t: (key: string, params?: Params) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, key) =>
    params[key] !== undefined ? String(params[key]) : m,
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangKey>(() => {
    if (typeof window === "undefined") return "ja";
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && saved in dictionaries) return saved as LangKey;
    return "ja";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = useCallback((l: LangKey) => setLangState(l), []);

  const t = useCallback(
    (key: string, params?: Params) => {
      const langDict = dictionaries[lang] as Record<string, string>;
      const jaDict = dictionaries.ja as Record<string, string>;
      const raw = langDict[key] ?? jaDict[key] ?? String(key);
      return interpolate(raw, params);
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Provide a graceful fallback so a missing provider does not crash trees -
    // particularly useful for tests / Storybook-like environments.
    return {
      lang: "ja",
      setLang: () => {},
      t: (k, p) =>
        interpolate(
          (dictionaries.ja as Record<string, string>)[k] ?? String(k),
          p,
        ),
    };
  }
  return ctx;
}

export type { LangKey, TranslationKey } from "./dictionary";
