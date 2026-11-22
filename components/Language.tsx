"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { languages, translate, type Lang, type TranslationKey } from "@/data/translations";

const STORAGE_KEY = "aurelia-lang";

const LanguageContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "en", setLang: () => {} });

function isLang(v: unknown): v is Lang {
  return languages.some((l) => l.code === v);
}

/**
 * Remembers the visitor's language in this browser. The page is first rendered in English
 * (as the server sends it) and switches right after loading if another language was chosen.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // storage blocked — stay in English
    }
    // Read after hydration: the server always renders English, so reading storage during render would mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isLang(saved) && saved !== "en") setLangState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = languages.find((l) => l.code === lang)!.htmlLang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // not remembered, but still switched for this visit
    }
  }, []);

  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useT() {
  const { lang } = useContext(LanguageContext);
  return useCallback((key: TranslationKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
}

/** Translated text, usable inside server components. */
export function T({ k, v }: { k: TranslationKey; v?: Record<string, string | number> }) {
  const t = useT();
  return <>{t(k, v)}</>;
}

/** EN · ગુ · हि switch. */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLanguage();
  const t = useT();
  return (
    <div className={`lang ${className}`} role="group" aria-label={t("lang.label")}>
      {languages.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.htmlLang}
          aria-pressed={lang === l.code}
          aria-label={l.label}
          title={l.label}
          onClick={() => setLang(l.code)}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}
