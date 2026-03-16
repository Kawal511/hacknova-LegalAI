import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>(() => {
        // Check localStorage for saved preference
        const saved = localStorage.getItem('nyayazephyr-theme');
        return (saved as Theme) || 'light';
    });

    useEffect(() => {
        // Save to localStorage
        localStorage.setItem('nyayazephyr-theme', theme);

        // Apply to document root for CSS
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

// Theme colors for components
export const themeColors = {
    light: {
        bg: '#f5f1e8',
        bgSecondary: '#f5e6c8',
        bgCard: '#d4c4a8',
        text: '#1a1a1a',
        textSecondary: '#666',
        border: '#d4b896',
        accent: '#f97316',
        grid: 'rgba(139, 115, 85, 0.15)',
        gradient1: 'rgba(245, 222, 179, 0.3)',
        gradient2: 'rgba(222, 184, 135, 0.2)',
        blockFrom: 'rgba(244, 228, 193, 0.9)',
        blockTo: 'rgba(232, 212, 168, 0.85)',
    },
    dark: {
        bg: '#1a1a2e',
        bgSecondary: '#16213e',
        bgCard: '#0f3460',
        text: '#eaeaea',
        textSecondary: '#a0a0a0',
        border: '#2a4a6d',
        accent: '#f97316',
        grid: 'rgba(100, 120, 150, 0.2)',
        gradient1: 'rgba(15, 52, 96, 0.5)',
        gradient2: 'rgba(22, 33, 62, 0.5)',
        blockFrom: 'rgba(15, 52, 96, 0.9)',
        blockTo: 'rgba(22, 33, 62, 0.85)',
    }
};

export function getThemeColors(isDark: boolean) {
    return isDark ? themeColors.dark : themeColors.light;
}
