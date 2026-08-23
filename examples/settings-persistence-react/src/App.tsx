import { useActor } from '@xstate/react';
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();
import {
  effectiveTheme,
  settingsMachine,
  type Density,
  type ThemePreference
} from './settingsMachine';

const THEMES: ThemePreference[] = ['light', 'dark', 'system'];

export default function App() {
  const [state, send] = useActor(settingsMachine, {
    inspect: inspector.inspect
  });
  const { theme, density, reducedMotion, systemDark } = state.context;

  return (
    <main>
      <h1>Settings</h1>

      <form onSubmit={(e) => e.preventDefault()}>
        <label>
          Theme
          <select
            value={theme}
            onChange={(e) =>
              send({
                type: 'setTheme',
                theme: e.target.value as ThemePreference
              })
            }
          >
            {THEMES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Density
          <select
            value={density}
            onChange={(e) =>
              send({ type: 'setDensity', density: e.target.value as Density })
            }
          >
            <option value="comfortable">comfortable</option>
            <option value="compact">compact</option>
          </select>
        </label>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={reducedMotion}
            onChange={(e) =>
              send({
                type: 'setReducedMotion',
                reducedMotion: e.target.checked
              })
            }
          />
          Reduce motion
        </label>

        <button type="button" onClick={() => send({ type: 'reset' })}>
          Reset to defaults
        </button>
      </form>

      <p className="ok">
        Effective theme: <strong>{effectiveTheme(state.context)}</strong>
      </p>
      <p className="hint">
        The OS currently prefers {systemDark ? 'dark' : 'light'}. Change it
        while this page is open — with <code>system</code> selected, the
        effective theme follows along.
      </p>
      <p className="hint">
        Every change is written to <code>localStorage</code>. Reload the page to
        see it restored.
      </p>
    </main>
  );
}
