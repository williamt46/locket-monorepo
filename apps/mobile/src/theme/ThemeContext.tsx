import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { ThemeTokens, lightTokens, darkTokens } from './colors';

export type ThemeMode = 'light' | 'dark' | 'device';

const THEME_MODE_KEY = 'locket_theme_mode';

interface ThemeContextValue {
    t: ThemeTokens;
    dark: boolean;
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
    t: lightTokens,
    dark: false,
    mode: 'device',
    setMode: () => { },
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemScheme = useColorScheme();
    const [mode, setModeState] = useState<ThemeMode>('device');

    useEffect(() => {
        SecureStore.getItemAsync(THEME_MODE_KEY)
            .then((saved) => {
                if (saved === 'light' || saved === 'dark' || saved === 'device') setModeState(saved);
            })
            .catch(() => { /* default to device */ });
    }, []);

    const setMode = (next: ThemeMode) => {
        setModeState(next);
        SecureStore.setItemAsync(THEME_MODE_KEY, next).catch(() => { });
    };

    const dark = mode === 'dark' || (mode === 'device' && systemScheme === 'dark');

    const value = useMemo<ThemeContextValue>(
        () => ({ t: dark ? darkTokens : lightTokens, dark, mode, setMode }),
        [dark, mode]
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => useContext(ThemeContext);
