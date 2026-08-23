import { useState } from 'react';
import { useActor } from '@xstate/react';
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();
import {
  accountErrors,
  profileErrors,
  signupMachine,
  type Role
} from './signupMachine';

const ROLES: Role[] = ['developer', 'designer', 'manager'];

export default function App() {
  const [state, send] = useActor(signupMachine, {
    inspect: inspector.inspect
  });
  // Only show validation messages once the user has tried to advance.
  const [tried, setTried] = useState(false);

  const context = state.context;

  function attemptNext(errors: string[]) {
    setTried(errors.length > 0);
    send({ type: 'next' });
  }

  if (state.matches('account')) {
    const errors = accountErrors(context);

    return (
      <main>
        <h1>Sign up — step 1 of 3</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            attemptNext(errors);
          }}
        >
          <label>
            Email
            <input
              type="text"
              value={context.email}
              onChange={(e) =>
                send({ type: 'setEmail', value: e.target.value })
              }
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={context.password}
              onChange={(e) =>
                send({ type: 'setPassword', value: e.target.value })
              }
            />
          </label>
          <button type="submit">Continue</button>
        </form>
        {tried && <Errors errors={errors} />}
      </main>
    );
  }

  if (state.matches('profile')) {
    const errors = profileErrors(context);

    return (
      <main>
        <h1>Sign up — step 2 of 3</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            attemptNext(errors);
          }}
        >
          <label>
            Name
            <input
              type="text"
              value={context.name}
              onChange={(e) => send({ type: 'setName', value: e.target.value })}
            />
          </label>
          <label>
            Role
            <select
              value={context.role}
              onChange={(e) =>
                send({ type: 'setRole', value: e.target.value as Role })
              }
            >
              <option value="">Choose a role…</option>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Continue</button>
        </form>
        {tried && <Errors errors={errors} />}
        <button onClick={() => send({ type: 'back' })}>Back</button>
      </main>
    );
  }

  if (state.matches('done')) {
    return (
      <main>
        <h1>Account created</h1>
        <p className="ok">Welcome, {context.name}.</p>
        <p className="hint">Signed up as {context.email}.</p>
      </main>
    );
  }

  const submitting = state.matches('submitting');

  return (
    <main>
      <h1>Sign up — step 3 of 3</h1>
      <ul>
        <li>Email: {context.email}</li>
        <li>Name: {context.name}</li>
        <li>Role: {context.role}</li>
      </ul>
      {state.matches('submitFailed') ? (
        <>
          <p className="error">{context.error}</p>
          <button onClick={() => send({ type: 'retry' })}>Retry</button>
        </>
      ) : (
        <button disabled={submitting} onClick={() => send({ type: 'submit' })}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      )}
      <button disabled={submitting} onClick={() => send({ type: 'back' })}>
        Back
      </button>
      <p className="hint">The mock service fails the first attempt.</p>
    </main>
  );
}

function Errors({ errors }: { errors: string[] }) {
  return errors.length === 0 ? null : (
    <ul className="error">
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  );
}
