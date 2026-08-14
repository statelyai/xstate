import { useActor } from '@xstate/react';
import { formMachine } from './formMachine';

const USERNAME_STATUS = {
  pristine: '',
  debouncing: 'Waiting for you to stop typing…',
  checking: 'Checking availability…',
  available: 'Available',
  taken: 'Already taken'
} as const;

type UsernameState = keyof typeof USERNAME_STATUS;

export default function App() {
  const [state, send] = useActor(formMachine);

  const usernameStates = [
    'debouncing',
    'checking',
    'available',
    'taken'
  ] as const satisfies readonly UsernameState[];

  const username: UsernameState =
    usernameStates.find((value) => state.matches({ username: value })) ??
    'pristine';

  const email =
    (['valid', 'invalid'] as const).find((value) =>
      state.matches({ email: value })
    ) ?? 'pristine';

  return (
    <main>
      <h1>Sign up</h1>
      <form onSubmit={(e) => e.preventDefault()}>
        <label>
          Username
          <input
            value={state.context.username}
            onChange={(e) =>
              send({ type: 'changeUsername', value: e.target.value })
            }
          />
        </label>
        <p className={username === 'taken' ? 'error' : 'hint'}>
          {username === 'available' ? (
            <span className="ok">{USERNAME_STATUS.available}</span>
          ) : (
            USERNAME_STATUS[username]
          )}
        </p>

        <label>
          Email
          <input
            value={state.context.email}
            onChange={(e) =>
              send({ type: 'changeEmail', value: e.target.value })
            }
          />
        </label>
        <p className={email === 'invalid' ? 'error' : 'hint'}>
          {email === 'invalid'
            ? 'That does not look like an email address.'
            : email === 'valid'
              ? 'Looks good'
              : ''}
        </p>

        <button
          type="submit"
          disabled={username !== 'available' || email !== 'valid'}
        >
          Create account
        </button>
      </form>
      <p className="hint">
        <code>ada</code>, <code>grace</code> and <code>alan</code> are taken.
      </p>
    </main>
  );
}
