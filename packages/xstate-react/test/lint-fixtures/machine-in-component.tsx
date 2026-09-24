import { useMachine } from '@xstate/react';
import { createStore } from '@xstate/store';
import { createMachine, setup } from 'xstate';

export function Counter() {
  const [snapshot] = useMachine(createMachine({}));
  return <p>{String(snapshot.value)}</p>;
}

export const Toggle = () => {
  const machine = setup({}).createMachine({});
  const [snapshot] = useMachine(machine);
  return <p>{String(snapshot.value)}</p>;
};

export function useCounterStore() {
  return createStore({ context: { count: 0 }, on: {} });
}

export const Form = function () {
  const onSubmit = () => createMachine({});
  return <form onSubmit={onSubmit} />;
};
