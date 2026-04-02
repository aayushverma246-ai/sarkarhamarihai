import React, { createContext, useContext, useState, useCallback } from 'react';
import { translations, LangCode, LANGUAGE_NAMES } from './translations';

interface LanguageContextType {
    language: LangCode;
    setLanguage: (lang: LangCode) => void;
    t: (key: string) => string;
}

const LANG_KEY = 'sarkar_language';

const LanguageContext = createContext<LanguageContextType>({
    language: 'en',
    setLanguage: () => { },
    t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLangState] = useState<LangCode>(() => {
        const saved = localStorage.getItem(LANG_KEY) as LangCode | null;
        return saved && translations[saved] ? saved : 'en';
    });

    const setLanguage = useCallback((lang: LangCode) => {
        setLangState(lang);
        localStorage.setItem(LANG_KEY, lang);
    }, []);

    const t = useCallback((key: string): string => {
        // Try current language first, fallback to English
        return translations[language]?.[key] ?? translations.en[key] ?? key;
    }, [language]);

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    return useContext(LanguageContext);
}

export { LANGUAGE_NAMES };
export type { LangCode };
