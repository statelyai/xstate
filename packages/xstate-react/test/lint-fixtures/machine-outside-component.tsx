import { useMachine } from '@xstate/react';
import { useMemo, useState } from 'react';
import { createMachine, setup } from 'xstate';

const counterMachine = createMachine({});

export function createCounterMachine() {
  return setup({}).createMachine({});
}

export function Counter() {
  const [snapshot] = useMachine(counterMachine);
  return <p>{String(snapshot.value)}</p>;
}

export function Memoized() {
  const machine = useMemo(() => createMachine({}), []);
  const [lazy] = useState(() => setup({}).createMachine({}));
  const [snapshot] = useMachine(machine);
  return <p>{String(snapshot.value) + String(lazy.id)}</p>;
}
