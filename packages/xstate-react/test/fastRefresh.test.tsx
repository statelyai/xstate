import { act, render } from '@testing-library/react';
import * as React from 'react';
import { createLogic, createMachine, setup } from 'xstate';
import { standardSchemaValidator } from 'xstate/validation';
import { z } from 'zod';
import { useActorRef } from '../src/index.ts';

// Stands in for React Fast Refresh: replacing `refresh.signal` makes the next
// render look like a refresh re-render.
const refresh = vi.hoisted(() => ({ signal: {} as object }));
vi.mock('../src/fastRefresh.ts', () => ({
  useFastRefreshSignal: () => refresh.signal
}));

function simulateRefresh() {
  refresh.signal = {};
}

function mount(machine: any) {
  let actorRef!: any;
  const App = ({ machine }: { machine: any }) => {
    actorRef = useActorRef(machine);
    return null;
  };
  const utils = render(<App machine={machine} />);
  return {
    get actorRef() {
      return actorRef;
    },
    refreshTo(next: any) {
      simulateRefresh();
      act(() => {
        utils.rerender(<App machine={next} />);
      });
    }
  };
}

const createEditor = (extra: Record<string, any> = {}) =>
  createMachine({
    id: 'editor',
    context: () => {
      const cyclic: Record<string, unknown> = {};
      cyclic.self = cyclic;
      return { el: document.createElement('div'), cyclic };
    },
    initial: 'idle',
    states: {
      idle: { on: { NEXT: { target: 'editing' } } },
      editing: { on: { ...extra } },
      ...(extra.DONE ? { done: {} } : {})
    }
  } as any);

describe('Fast Refresh', () => {
  it('keeps the running actor and its live context across a refresh', () => {
    const v1 = createEditor();
    const app = mount(v1);
    const original = app.actorRef;
    act(() => original.send({ type: 'NEXT' }));
    const { el, cyclic } = original.getSnapshot().context;

    const v2 = createEditor({ DONE: { target: 'done' } });
    expect(() => app.refreshTo(v2)).not.toThrow();

    expect(app.actorRef).toBe(original);
    expect(app.actorRef.logic).toBe(v2);
    const snapshot = app.actorRef.getSnapshot();
    expect(snapshot.value).toBe('editing');
    expect(snapshot.context.el).toBe(el);
    expect(snapshot.context.cyclic).toBe(cyclic);

    // The new machine's transitions apply.
    act(() => app.actorRef.send({ type: 'DONE' }));
    expect(app.actorRef.getSnapshot().value).toBe('done');
  });

  it('starts a fresh actor when the current state no longer exists', () => {
    const v1 = createEditor();
    const app = mount(v1);
    const original = app.actorRef;
    act(() => original.send({ type: 'NEXT' }));

    const v2 = createMachine({
      id: 'editor',
      initial: 'idle',
      states: { idle: {} }
    });
    app.refreshTo(v2);

    expect(app.actorRef).not.toBe(original);
    expect(app.actorRef.logic).toBe(v2);
    expect(app.actorRef.getSnapshot().value).toBe('idle');
  });

  it('starts a fresh actor when the context validator rejects the context', () => {
    const v1 = createEditor();
    const app = mount(v1);
    const original = app.actorRef;
    act(() => original.send({ type: 'NEXT' }));

    const v2 = setup({
      validator: standardSchemaValidator(),
      schemas: { context: z.object({ count: z.number() }) }
    }).createMachine({
      id: 'editor',
      context: { count: 0 },
      initial: 'idle',
      states: {
        idle: { on: { NEXT: { target: 'editing' } } },
        editing: {}
      }
    });
    app.refreshTo(v2);

    expect(app.actorRef).not.toBe(original);
    expect(app.actorRef.getSnapshot().value).toBe('idle');
    expect(app.actorRef.getSnapshot().context).toEqual({ count: 0 });
  });

  it('keeps children whose logic is unchanged and restarts the others', () => {
    const stable = createLogic({ context: 0, run: () => undefined });
    const createParent = (other: any) =>
      createMachine({
        id: 'parent',
        actors: { stable, other },
        invoke: [
          { id: 'stable', src: ({ actors }: any) => actors.stable },
          { id: 'other', src: ({ actors }: any) => actors.other }
        ]
      });

    const app = mount(
      createParent(createLogic({ context: 0, run: () => undefined }))
    );
    const before = app.actorRef.getSnapshot().children;

    app.refreshTo(
      createParent(createLogic({ context: 0, run: () => undefined }))
    );

    const after = app.actorRef.getSnapshot().children;
    expect(after.stable).toBe(before.stable);
    expect(after.other).not.toBe(before.other);
    expect(after.other.getSnapshot().status).toBe('active');
    expect(before.other.getSnapshot().status).toBe('stopped');
  });

  it('keeps the first machine when the machine changes without a refresh', () => {
    const v1 = createEditor();
    let actorRef!: any;
    const App = ({ machine }: { machine: any }) => {
      actorRef = useActorRef(machine);
      return null;
    };
    const { rerender } = render(<App machine={v1} />);
    const original = actorRef;
    rerender(<App machine={createEditor({ DONE: { target: 'done' } })} />);

    expect(actorRef).toBe(original);
    expect(actorRef.logic).toBe(v1);
  });
});
