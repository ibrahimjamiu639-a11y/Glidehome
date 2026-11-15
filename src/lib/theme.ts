import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'glide_theme_mode';
const THEME_CHANGE_EVENT = 'glide-theme-change';

export function isValidThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function getStoredThemeMode(): ThemeMode {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isValidThemeMode(raw)) {
      return raw;
    }
  } catch {
    // ignore storage access issues
  }
  return 'system';
}

export function getSystemResolvedTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'light' || mode === 'dark') {
    return mode;
  }
  return getSystemResolvedTheme();
}

export function applyThemeToDom(mode: ThemeMode): ResolvedTheme {
  const resolved = resolveTheme(mode);
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.style.colorScheme = resolved;
    root.dataset.themeMode = mode;
  }
  return resolved;
}

export function setStoredThemeMode(mode: ThemeMode): ResolvedTheme {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // ignore storage access issues
  }
  const resolved = applyThemeToDom(mode);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<ThemeMode>(THEME_CHANGE_EVENT, { detail: mode }));
  }
  return resolved;
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(() => getStoredThemeMode());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    applyThemeToDom(getStoredThemeMode())
  );

  const setMode = useCallback((nextMode: ThemeMode) => {
    const resolved = setStoredThemeMode(nextMode);
    setModeState(nextMode);
    setResolvedTheme(resolved);
  }, []);

  const cycleMode = useCallback(() => {
    const nextMap: Record<ThemeMode, ThemeMode> = {
      system: 'dark',
      dark: 'light',
      light: 'system',
    };
    setMode(nextMap[mode]);
  }, [mode, setMode]);

  useEffect(() => {
    setResolvedTheme(applyThemeToDom(mode));

    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    const handleMediaChange = () => {
      const current = getStoredThemeMode();
      setModeState(current);
      setResolvedTheme(applyThemeToDom(current));
    };

    const handleCustomEvent = (event: Event) => {
      const custom = event as CustomEvent<ThemeMode>;
      const next = isValidThemeMode(custom.detail) ? custom.detail : getStoredThemeMode();
      setModeState(next);
      setResolvedTheme(applyThemeToDom(next));
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        const next = isValidThemeMode(event.newValue) ? event.newValue : 'system';
        setModeState(next);
        setResolvedTheme(applyThemeToDom(next));
      }
    };

    mediaQuery?.addEventListener('change', handleMediaChange);
    window.addEventListener(THEME_CHANGE_EVENT, handleCustomEvent);
    window.addEventListener('storage', handleStorage);

    return () => {
      mediaQuery?.removeEventListener('change', handleMediaChange);
      window.removeEventListener(THEME_CHANGE_EVENT, handleCustomEvent);
      window.removeEventListener('storage', handleStorage);
    };
  }, [mode]);

  return {
    mode,
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
    setMode,
    cycleMode,
  };
}
