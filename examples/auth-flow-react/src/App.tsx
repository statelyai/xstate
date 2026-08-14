import { useState } from 'react';
import { useActor } from '@xstate/react';
import { authMachine } from './authMachine';

export default function App() {
  const [state, send] = useActor(authMachine);
  const [email, setEmail] = useState('ada@example.com');
  const [password, setPassword] = useState('lovelace');

  const { session, error } = state.context;
  const isAuthenticating = state.matches('authenticating');

  if (state.matches('sessionExpired')) {
    return (
      <main>
        <h1>Session expired</h1>
        <p className="error">{error}</p>
        <button onClick={() => send({ type: 'retry' })}>Sign in again</button>
      </main>
    );
  }

  if (session) {
    return (
      <main>
        <h1>Signed in</h1>
        <p>
          Welcome, <strong>{session.user}</strong>
        </p>
        <p className="token">
          token <code>{session.token.slice(0, 8)}</code>
          {state.matches({ authenticated: 'refreshing' }) ? ' refreshing…' : ''}
        </p>
        <button onClick={() => send({ type: 'expire' })}>
          Simulate expiry
        </button>
        <button onClick={() => send({ type: 'logout' })}>Log out</button>
      </main>
    );
  }

  return (
    <main>
      <h1>Sign in</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send({ type: 'submit', email, password });
        }}
      >
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" disabled={isAuthenticating}>
          {isAuthenticating ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      <p className="hint">Any other password fails.</p>
    </main>
  );
}
