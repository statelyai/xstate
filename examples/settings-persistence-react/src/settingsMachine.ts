import { setup, types, createCallbackLogic } from 'xstate';

export type ThemePreference = 'light' | 'dark' | 'system';
export type Density = 'comfortable' | 'compact';

export interface Settings {
  theme: ThemePreference;
  density: Density;
  reducedMotion: boolean;
}

const STORAGE_KEY = 'xstate-example-settings';

const DEFAULTS: Settings = {
  theme: 'system',
  density: 'comfortable',
  reducedMotion: false
};

const DARK_QUERY = '(prefers-color-scheme: dark)';

function isTheme(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function isDensity(value: unknown): value is Density {
  return value === 'comfortable' || value === 'compact';
}

/**
 * Reads persisted settings synchronously. Anything missing or malformed falls
 * back to the defaults, so the very first run with empty storage works.
 */
function readSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULTS;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return DEFAULTS;
    }
    const stored = parsed as Partial<Record<keyof Settings, unknown>>;
    return {
      theme: isTheme(stored.theme) ? stored.theme : DEFAULTS.theme,
      density: isDensity(stored.density) ? stored.density : DEFAULTS.density,
      reducedMotion:
        typeof stored.reducedMotion === 'boolean'
          ? stored.reducedMotion
          : DEFAULTS.reducedMotion
    };
  } catch {
    return DEFAULTS;
  }
}

/** Side effect: write the settings back to storage. Enqueued on every change. */
export function persist(settings: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable (private mode, quota). Preferences are not
    // worth failing the app over.
  }
}

function prefersDark(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia(DARK_QUERY).matches
  );
}

/** Side effect: reflect the effective theme on the document element. */
export function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.dataset.theme = theme;
}

export function effectiveTheme(context: SettingsContext): 'light' | 'dark' {
  if (context.theme === 'system') {
    return context.systemDark ? 'dark' : 'light';
  }
  return context.theme;
}

/**
 * Long-running actor: subscribes to the OS colour-scheme media query and sends
 * a `systemThemeChanged` event whenever it flips.
 */
const systemTheme = createCallbackLogic({
  schemas: { input: types<{}>() },
  run: ({ sendBack }) => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const query = window.matchMedia(DARK_QUERY);
    const handler = (event: MediaQueryListEvent) => {
      sendBack({ type: 'systemThemeChanged', dark: event.matches });
    };

    query.addEventListener('change', handler);

    return () => query.removeEventListener('change', handler);
  }
});

export interface SettingsContext extends Settings {
  systemDark: boolean;
}

export const settingsMachine = setup({
  schemas: {
    context: types<SettingsContext>(),
    events: {
      setTheme: types<{ theme: ThemePreference }>(),
      setDensity: types<{ density: Density }>(),
      setReducedMotion: types<{ reducedMotion: boolean }>(),
      systemThemeChanged: types<{ dark: boolean }>(),
      reset: types<{}>()
    }
  },
  actors: { systemTheme }
}).createMachine({
  id: 'settings',
  // Lazy context initializer: hydration from `localStorage` is synchronous, so
  // there is nothing to wait for and no `loading` state to render.
  context: () => ({ ...readSettings(), systemDark: prefersDark() }),
  entry: ({ context }, enq) => {
    enq(applyTheme, effectiveTheme(context));
  },
  invoke: { src: 'systemTheme', input: {} },
  on: {
    setTheme: ({ context, event }, enq) => {
      const next: Settings = { ...context, theme: event.theme };
      enq(persist, next);
      enq(applyTheme, effectiveTheme({ ...context, ...next }));
      return { context: next };
    },
    setDensity: ({ context, event }, enq) => {
      const next: Settings = { ...context, density: event.density };
      enq(persist, next);
      return { context: next };
    },
    setReducedMotion: ({ context, event }, enq) => {
      const next: Settings = { ...context, reducedMotion: event.reducedMotion };
      enq(persist, next);
      return { context: next };
    },
    // Only changes what the user sees when `theme` is `'system'`, but the
    // machine always tracks the OS preference so the toggle is instant.
    systemThemeChanged: ({ context, event }, enq) => {
      const next = { ...context, systemDark: event.dark };
      enq(applyTheme, effectiveTheme(next));
      return { context: { systemDark: event.dark } };
    },
    reset: ({ context }, enq) => {
      enq(persist, DEFAULTS);
      enq(applyTheme, effectiveTheme({ ...context, ...DEFAULTS }));
      return { context: DEFAULTS };
    }
  }
});
