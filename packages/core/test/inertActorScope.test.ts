import { createMachine, initialTransition } from '../src/index.ts';
import {
  attachSnapshotActorRef,
  createInertActorScope,
  setInertActorScopeSnapshot
} from '../src/inertActorScope.ts';

describe('inert actor scopes', () => {
  it('releases consumed source references and keeps the current snapshot on self', () => {
    const child = createMachine({});
    const machine = createMachine({
      context: { count: 0 },
      invoke: { id: 'child', src: child }
    });
    const [previous] = initialTransition(machine);
    const scope = createInertActorScope(machine, previous);
    const state = Object.getOwnPropertySymbols(scope)
      .map((symbol) => Reflect.get(scope, symbol))
      .find((value) => value && 'sourceChildren' in value) as {
      sourceRef?: unknown;
      sourceChildren: Record<string, unknown>;
    };

    expect(state.sourceRef).toBeDefined();
    expect(state.sourceChildren.child).toBe(previous.children.child);
    const self = scope.self;
    expect(self.getSnapshot()).toBe(previous);
    expect(state.sourceRef).toBeUndefined();
    expect(state.sourceChildren).toEqual({});
    expect(Object.getPrototypeOf(self)._snapshot).toBeUndefined();

    const current = { ...previous, context: { count: 1 } };
    setInertActorScopeSnapshot(scope, current, false);
    attachSnapshotActorRef(scope, current);
    expect(self.getSnapshot()).toBe(current);
    expect(Object.getPrototypeOf(self)._snapshot).toBeUndefined();
  });
});
