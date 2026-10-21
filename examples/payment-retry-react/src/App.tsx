import { useState } from 'react';
import { useActor } from '@xstate/react';
import { paymentMachine, MAX_ATTEMPTS } from './paymentMachine';
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();

export default function App() {
  const [state, send] = useActor(paymentMachine, {
    inspect: inspector.inspect
  });
  const [failures, setFailures] = useState(2);
  const { amount, idempotencyKey, attempt, receipt, error } = state.context;

  const busy = state.matches('submitting') || state.matches('waiting');

  return (
    <main>
      <h1>Payment — {String(state.value)}</h1>

      {state.matches('idle') && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send({ type: 'pay', amount: 42, failures });
          }}
        >
          <label>
            Gateway failures to simulate
            <input
              type="number"
              min={0}
              max={5}
              value={failures}
              onChange={(e) => setFailures(Number(e.target.value))}
            />
          </label>
          <button type="submit">Pay $42</button>
          <p className="hint">
            Pick 4 or more failures to exhaust all {MAX_ATTEMPTS} attempts.
          </p>
        </form>
      )}

      {busy && (
        <>
          <p>
            Attempt {attempt} of {MAX_ATTEMPTS} for ${amount}
          </p>
          <p className="token">
            idempotency key <code>{idempotencyKey.slice(0, 8)}</code> — reused
            by every retry
          </p>
          <p>
            {state.matches('submitting')
              ? 'Contacting the gateway…'
              : 'Backing off before the next attempt…'}
          </p>
          {error && <p className="error">{error}</p>}
          <button onClick={() => send({ type: 'cancel' })}>Cancel</button>
        </>
      )}

      {state.matches('succeeded') && receipt && (
        <>
          <p className="ok">
            Paid ${receipt.amount} on attempt {attempt}
          </p>
          <p className="token">
            receipt <code>{receipt.id.slice(0, 8)}</code>
          </p>
          <button onClick={() => send({ type: 'reset' })}>Start over</button>
        </>
      )}

      {state.matches('failed') && (
        <>
          <p className="error">{error}</p>
          <p>
            The payment failed after {MAX_ATTEMPTS} attempts. Contact support at
            support@example.com and quote{' '}
            <code>{idempotencyKey.slice(0, 8)}</code>.
          </p>
          <button onClick={() => send({ type: 'reset' })}>Start over</button>
        </>
      )}

      {state.matches('canceled') && (
        <>
          <p>Payment canceled.</p>
          <button onClick={() => send({ type: 'reset' })}>Start over</button>
        </>
      )}
    </main>
  );
}
