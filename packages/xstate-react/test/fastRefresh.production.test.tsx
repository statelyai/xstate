import { act, render } from '@testing-library/react';
import * as React from 'react';
import { createMachine } from 'xstate';
import { useActorRef } from '../src/index.ts';

const refresh = vi.hoisted(() => ({ signal: {} as object }));
vi.mock('../src/fastRefresh.ts', () => ({
  useFastRefreshSignal: () => refresh.signal
}));
vi.mock('#is-development', () => ({ default: false }));

const createToggle = (extra: Record<string, any> = {}) =>
  createMachine({
    id: 'toggle',
    initial: 'off',
    states: {
      off: { on: { TOGGLE: { target: 'on' } } },
      on: { on: { ...extra } },
      ...(extra.RESET ? { reset: {} } : {})
    }
  } as any);

it('keeps the first machine on a refresh signal in production builds', () => {
  const v1 = createToggle();
  let actorRef!: any;
  const App = ({ machine }: { machine: any }) => {
    actorRef = useActorRef(machine);
    return null;
  };
  const { rerender } = render(<App machine={v1} />);
  const original = actorRef;
  act(() => original.send({ type: 'TOGGLE' }));

  refresh.signal = {};
  rerender(<App machine={createToggle({ RESET: { target: 'reset' } })} />);

  expect(actorRef).toBe(original);
  expect(actorRef.logic).toBe(v1);
  act(() => actorRef.send({ type: 'RESET' }));
  expect(actorRef.getSnapshot().value).toBe('on');
});
