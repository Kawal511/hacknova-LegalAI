import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import locales from './locales.json';

// Type definitions
type LanguageCode = 'en' | 'es' | 'hi' | 'fr' | 'de' | 'zh-CN' | 'ta' | 'te' | 'bn' | 'mr' | 'gu' | 'kn' | 'ml' | 'pa';

interface Translations {
    [key: string]: string;
}

interface LanguageContextType {
    language: LanguageCode;
    setLanguage: (lang: LanguageCode) => void;
    t: (key: string) => string;
    formatDate: (date: string | Date) => string;
    formatCurrency: (amount: number, currency?: string) => string;
    formatNumber: (num: number) => string;
    availableLanguages: { code: LanguageCode; name: string }[];
}

// Available languages with display names
const AVAILABLE_LANGUAGES: { code: LanguageCode; name: string }[] = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'हिन्दी (Hindi)' },
    { code: 'ta', name: 'தமிழ் (Tamil)' },
    { code: 'te', name: 'తెలుగు (Telugu)' },
    { code: 'bn', name: 'বাংলা (Bengali)' },
    { code: 'mr', name: 'मराठी (Marathi)' },
    { code: 'gu', name: 'ગુજરાતી (Gujarati)' },
    { code: 'kn', name: 'ಕನ್ನಡ (Kannada)' },
    { code: 'ml', name: 'മലയാളം (Malayalam)' },
    { code: 'pa', name: 'ਪੰਜਾਬੀ (Punjabi)' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'zh-CN', name: '中文' },
];

// Create context with default values
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Storage key for persistence
const LANGUAGE_STORAGE_KEY = 'preferred_language';

interface LanguageProviderProps {
    children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
    // Initialize from localStorage or default to 'en'
    const [language, setLanguageState] = useState<LanguageCode>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
            if (saved && AVAILABLE_LANGUAGES.some(l => l.code === saved)) {
                return saved as LanguageCode;
            }
        }
        return 'en';
    });

    // Update localStorage when language changes
    useEffect(() => {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }, [language]);

    // Set language function
    const setLanguage = (lang: LanguageCode) => {
        if (AVAILABLE_LANGUAGES.some(l => l.code === lang)) {
            setLanguageState(lang);
        }
    };

    // Translation function
    const t = (key: string): string => {
        const translations = (locales as Record<LanguageCode, Translations>)[language];
        if (translations && translations[key]) {
            return translations[key];
        }
        // Fallback to English
        const enTranslations = (locales as Record<LanguageCode, Translations>)['en'];
        if (enTranslations && enTranslations[key]) {
            return enTranslations[key];
        }
        // Return key if not found
        return key;
    };

    // Date formatter using Intl API
    const formatDate = (date: string | Date): string => {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        const localeMap: Record<LanguageCode, string> = {
            'en': 'en-US',
            'es': 'es-ES',
            'hi': 'hi-IN',
            'fr': 'fr-FR',
            'de': 'de-DE',
            'zh-CN': 'zh-CN',
            'ta': 'ta-IN',
            'te': 'te-IN',
            'bn': 'bn-IN',
            'mr': 'mr-IN',
            'gu': 'gu-IN',
            'kn': 'kn-IN',
            'ml': 'ml-IN',
            'pa': 'pa-IN',
        };
        try {
            return new Intl.DateTimeFormat(localeMap[language], {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            }).format(dateObj);
        } catch {
            return dateObj.toLocaleDateString();
        }
    };

    // Currency formatter using Intl API
    const formatCurrency = (amount: number, currency: string = 'INR'): string => {
        const localeMap: Record<LanguageCode, string> = {
            'en': 'en-IN',
            'es': 'es-ES',
            'hi': 'hi-IN',
            'fr': 'fr-FR',
            'de': 'de-DE',
            'zh-CN': 'zh-CN',
            'ta': 'ta-IN',
            'te': 'te-IN',
            'bn': 'bn-IN',
            'mr': 'mr-IN',
            'gu': 'gu-IN',
            'kn': 'kn-IN',
            'ml': 'ml-IN',
            'pa': 'pa-IN',
        };
        try {
            return new Intl.NumberFormat(localeMap[language], {
                style: 'currency',
                currency: currency,
            }).format(amount);
        } catch {
            return `₹${amount.toFixed(2)}`;
        }
    };

    // Number formatter using Intl API
    const formatNumber = (num: number): string => {
        const localeMap: Record<LanguageCode, string> = {
            'en': 'en-IN',
            'es': 'es-ES',
            'hi': 'hi-IN',
            'fr': 'fr-FR',
            'de': 'de-DE',
            'zh-CN': 'zh-CN',
            'ta': 'ta-IN',
            'te': 'te-IN',
            'bn': 'bn-IN',
            'mr': 'mr-IN',
            'gu': 'gu-IN',
            'kn': 'kn-IN',
            'ml': 'ml-IN',
            'pa': 'pa-IN',
        };
        try {
            return new Intl.NumberFormat(localeMap[language]).format(num);
        } catch {
            return num.toString();
        }
    };

    const value: LanguageContextType = {
        language,
        setLanguage,
        t,
        formatDate,
        formatCurrency,
        formatNumber,
        availableLanguages: AVAILABLE_LANGUAGES,
    };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

// Custom hook for using the language context
export function useLanguage(): LanguageContextType {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}

// Export the context for advanced use cases
export { LanguageContext };
export type { LanguageCode, LanguageContextType };
