import { useMachine } from '@xstate/react';
import { createStore } from '@xstate/store';
import * as React from 'react';
import { forwardRef, memo } from 'react';
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

export const Memoized = memo(() => {
  const [snapshot] = useMachine(createMachine({}));
  return <p>{String(snapshot.value)}</p>;
});

export const Wrapped = React.memo(() => {
  const [snapshot] = useMachine(createMachine({}));
  return <p>{String(snapshot.value)}</p>;
});

export const Field = forwardRef<HTMLInputElement>(function (_props, ref) {
  const [snapshot] = useMachine(setup({}).createMachine({}));
  return <input ref={ref} value={String(snapshot.value)} />;
});

export const Input = React.forwardRef<HTMLInputElement>((_props, ref) => {
  const [snapshot] = useMachine(createMachine({}));
  return <input ref={ref} value={String(snapshot.value)} />;
});
