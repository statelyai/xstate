/* @jsxImportSource @solidjs/web */
import { Loading, createMemo, createSignal, flush } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { createActor, createMachine, types } from 'xstate';
import { restoreActor } from 'xstate/persist';
import { useActor, useActorRef } from '../src/index.ts';

const machine = createMachine({
  id: 'toggle',
  initial: 'off',
  schemas: {
    input: types<{ label: string } | undefined>(),
    context: types<{ label: string }>()
  },
  context: ({ input }) => ({ label: input?.label ?? '' }),
  states: {
    off: { on: { toggle: { target: 'on' } } },
    on: { on: { toggle: { target: 'off' } } }
  }
});

describe('useActor with an actor accessor', () => {
  it('derives the actor from props and swaps it when they change', () => {
    const [label, setLabel] = createSignal('a');
    const actors: any[] = [];

    function Toggle(props: { label: string }) {
      const [snapshot, send, actorRef] = useActor(() =>
        createActor(machine, { input: { label: props.label } })
      );
      actors.push(actorRef);
      return (
        <button data-testid="b" onClick={() => send({ type: 'toggle' })}>
          {snapshot.context.label}:{String(snapshot.value)}
        </button>
      );
    }

    render(() => <Toggle label={label()} />);
    flush();
    expect(screen.getByTestId('b').textContent).toBe('a:off');

    fireEvent.click(screen.getByTestId('b'));
    flush();
    expect(screen.getByTestId('b').textContent).toBe('a:on');

    const first = actors[0]();
    setLabel('b');
    flush();
    expect(screen.getByTestId('b').textContent).toBe('b:off');
    expect(first.getSnapshot().status).toBe('stopped');
    expect(actors[0]().getSnapshot().status).toBe('active');
    expect(actors.length).toBe(1);
  });

  it('restores from an async snapshot under Loading', async () => {
    const seed = createActor(machine).start();
    seed.send({ type: 'toggle' });
    const persisted = JSON.parse(JSON.stringify(seed.getPersistedSnapshot()));
    seed.stop();
    let bodies = 0;

    function View() {
      bodies++;
      const saved = createMemo(
        () => new Promise<any>((r) => setTimeout(() => r(persisted), 10))
      );
      const [snapshot, send] = useActor(() => restoreActor(machine, saved()));
      return (
        <Loading fallback={<p data-testid="v">loading</p>}>
          <p data-testid="v" onClick={() => send({ type: 'toggle' })}>
            {String(snapshot.value)}
          </p>
        </Loading>
      );
    }

    render(() => <View />);
    expect(screen.getByTestId('v').textContent).toBe('loading');
    await waitFor(() => expect(screen.getByTestId('v').textContent).toBe('on'));
    fireEvent.click(screen.getByTestId('v'));
    flush();
    expect(screen.getByTestId('v').textContent).toBe('off');
    expect(bodies).toBe(1);
  });

  it('stops the derived actor on unmount', () => {
    let ref: any;
    function C() {
      ref = useActorRef(() => createActor(machine));
      return null;
    }
    const { unmount } = render(() => <C />);
    flush();
    expect(ref().getSnapshot().status).toBe('active');
    const a = ref();
    unmount();
    expect(a.getSnapshot().status).toBe('stopped');
  });
});
