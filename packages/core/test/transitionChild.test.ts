import { describe, expect, it, vi } from 'vitest';
import {
  createAsyncLogic,
  createMachine,
  executeEffects,
  getChildSnapshot,
  getEffectDescriptor,
  initialTransition,
  setup,
  stopActor,
  terminateActor,
  transition,
  transitionChild,
  withChildSnapshot,
  type AnyActor,
  type AnyEventObject,
  type AnyMachineSnapshot,
  type AnyStateMachine,
  type ExecutableActionObject
} from '../src/index.ts';
import { createDurable } from '../src/durable/index.ts';

const retry = createMachine({
  id: 'retry',
  initial: 'idle',
  states: {
    idle: { after: { 1000: { target: 'ended' } } },
    ended: { type: 'final', output: 'retried' }
  }
});
const worker = setup({ actors: { retry } }).createMachine({
  id: 'worker',
  initial: 'running',
  states: {
    running: {
      invoke: {
        id: 'retry',
        src: 'retry',
        registryKey: 'retrier',
        onDone: { target: 'done' }
      }
    },
    done: { type: 'final' }
  }
});
const root = setup({ actors: { worker } }).createMachine({
  id: 'root',
  initial: 'running',
  states: {
    running: {
      invoke: { id: 'worker', src: 'worker', onDone: { target: 'done' } }
    },
    done: { type: 'final' }
  }
});

const RETRY_TIMER = 'xstate.after.1000.retry.idle';

function restoreFresh(machine: AnyStateMachine = root): AnyMachineSnapshot {
  const [initial] = initialTransition(machine as typeof root);
  return (machine as typeof root).restoreSnapshot(
    JSON.parse(JSON.stringify(machine.getPersistedSnapshot(initial)))
  ) as AnyMachineSnapshot;
}

function describeEffects(effects: ExecutableActionObject[]) {
  return effects.map((effect) => {
    const descriptor = getEffectDescriptor(effect) as Record<string, unknown>;
    return [descriptor.type, descriptor.actor ?? descriptor.source];
  });
}

function persist(snapshot: AnyMachineSnapshot) {
  return JSON.parse(
    JSON.stringify(root.getPersistedSnapshot(snapshot as never))
  );
}

describe('getChildSnapshot / withChildSnapshot / transitionChild', () => {
  it('getChildSnapshot resolves root, child, grandchild after JSON round-trip + restoreSnapshot', () => {
    const snapshot = restoreFresh();

    expect(getChildSnapshot(snapshot, 'root')).toBe(snapshot);
    expect(
      (getChildSnapshot(snapshot, 'root/worker') as AnyMachineSnapshot).value
    ).toBe('running');
    const grandchild = getChildSnapshot(
      snapshot,
      'root/worker/retry'
    ) as AnyMachineSnapshot;
    expect(grandchild.value).toBe('idle');
    expect(Object.keys(grandchild.timers)).toEqual([RETRY_TIMER]);
  });

  it("getChildSnapshot decodes percent-encoded segments (id 'a/b' → 'root/a%2Fb') and returns undefined for unknown/partial prefixes", () => {
    const child = createMachine({ initial: 'on', states: { on: {} } });
    const machine = setup({ actors: { child } }).createMachine({
      id: 'root',
      invoke: { id: 'a/b', src: 'child' }
    });
    const snapshot = restoreFresh(machine as never);

    expect(
      (getChildSnapshot(snapshot, 'root/a%2Fb') as AnyMachineSnapshot).value
    ).toBe('on');
    expect(getChildSnapshot(snapshot, 'root/a/b')).toBeUndefined();
    expect(getChildSnapshot(snapshot, 'root/a')).toBeUndefined();
    expect(getChildSnapshot(snapshot, 'roo')).toBeUndefined();
    expect(getChildSnapshot(snapshot, 'root/')).toBeUndefined();
    expect(getChildSnapshot(snapshot, 'other/a%2Fb')).toBeUndefined();
    expect(getChildSnapshot(snapshot, 'root/a%2Fb/nested')).toBeUndefined();
  });

  it('withChildSnapshot is immutable: original root, its children, and getPersistedSnapshot(original) unchanged; id/address/src/registryKey/sessionId preserved', () => {
    const snapshot = restoreFresh();
    const persistedBefore = persist(snapshot);
    const workerRef = snapshot.children.worker as AnyActor;
    const workerSnapshot = workerRef.getSnapshot();
    const retryRef = workerSnapshot.children.retry as AnyActor;
    const retrySnapshot = retryRef.getSnapshot();

    const [nextRetry] = transition((retryRef as any).logic, retrySnapshot, {
      type: 'xstate.timer',
      id: RETRY_TIMER
    } as never);
    const next = withChildSnapshot(snapshot, 'root/worker/retry', nextRetry);

    expect(next).not.toBe(snapshot);
    expect(snapshot.children.worker).toBe(workerRef);
    expect(workerRef.getSnapshot()).toBe(workerSnapshot);
    expect(workerSnapshot.children.retry).toBe(retryRef);
    expect(retryRef.getSnapshot()).toBe(retrySnapshot);
    expect(persist(snapshot)).toEqual(persistedBefore);

    const nextRetryRef = getChildRef(next, 'worker', 'retry');
    expect(nextRetryRef).not.toBe(retryRef);
    expect(nextRetryRef.getSnapshot()).toBe(nextRetry);
    for (const ref of [
      [nextRetryRef, retryRef],
      [next.children.worker as AnyActor, workerRef]
    ] as const) {
      expect({
        id: ref[0].id,
        address: ref[0].address,
        src: ref[0].src,
        registryKey: ref[0].registryKey,
        sessionId: ref[0].sessionId
      }).toEqual({
        id: ref[1].id,
        address: ref[1].address,
        src: ref[1].src,
        registryKey: ref[1].registryKey,
        sessionId: ref[1].sessionId
      });
    }
    expect(nextRetryRef.registryKey).toBe('retrier');
    expect(
      persist(next).children.worker.snapshot.children.retry.snapshot.status
    ).toBe('done');
  });

  it('transitionChild delivers xstate.timer to root/worker/retry; persisted grandchild timers cleared; effects carry grandchild address', () => {
    const pausingRetry = createMachine({
      id: 'retry',
      initial: 'idle',
      states: {
        idle: { after: { 1000: { target: 'paused' } } },
        paused: {}
      }
    });
    const machine = root.provide({
      actors: {
        worker: worker.provide({ actors: { retry: pausingRetry as never } })
      }
    });
    const snapshot = restoreFresh(machine as never);

    const [next, effects] = transitionChild(
      machine,
      snapshot as never,
      'root/worker/retry',
      { type: 'xstate.timer', id: RETRY_TIMER }
    );

    expect(describeEffects(effects)).toEqual([
      ['@xstate.cancel', 'root/worker/retry']
    ]);
    const persisted = JSON.parse(
      JSON.stringify(machine.getPersistedSnapshot(next))
    );
    const grandchild = persisted.children.worker.snapshot.children.retry;
    expect(grandchild.snapshot.value).toBe('paused');
    expect(grandchild.snapshot.timers).toEqual({});
    expect(next.status).toBe('active');
  });

  it('transitionChild folds done upward: grandchild final → worker onDone → root onDone; single terminal root; effect order as §2', () => {
    const snapshot = restoreFresh();

    const [next, effects] = transitionChild(
      root,
      snapshot as never,
      'root/worker/retry',
      { type: 'xstate.timer', id: RETRY_TIMER }
    );

    expect(next.status).toBe('done');
    expect(next.value).toBe('done');
    expect(next.children).toEqual({});
    expect(describeEffects(effects)).toEqual([
      ['@xstate.cancel', 'root/worker/retry'],
      ['@xstate.terminate', 'root/worker/retry'],
      ['@xstate.stop', 'root/worker/retry'],
      ['@xstate.terminate', 'root/worker'],
      ['@xstate.stop', 'root/worker'],
      ['@xstate.terminate', 'root']
    ]);
    expect(
      effects.filter(
        (effect) =>
          effect.type === '@xstate.terminate' &&
          (effect as any).actor.address === 'root'
      )
    ).toHaveLength(1);
  });

  it('transitionChild folds error: grandchild throws → xstate.error.actor handled by worker onError; no fold past a handling ancestor', () => {
    const job = createAsyncLogic({
      run: async () => {
        throw new Error('unreachable in a pure transition');
      }
    });
    const failingWorker = setup({ actors: { job } }).createMachine({
      id: 'worker',
      initial: 'running',
      states: {
        running: {
          invoke: { id: 'job', src: 'job', onError: { target: 'failed' } }
        },
        failed: {}
      }
    });
    const machine = setup({ actors: { worker: failingWorker } }).createMachine({
      id: 'root',
      initial: 'running',
      states: {
        running: {
          invoke: {
            id: 'worker',
            src: 'worker',
            onError: { target: 'rootFailed' }
          }
        },
        rootFailed: {}
      }
    });
    const snapshot = restoreFresh(machine as never);
    const error = new Error('boom');

    const [next, effects] = transitionChild(
      machine,
      snapshot as never,
      'root/worker/job',
      { type: 'xstate.async.reject', error }
    );

    expect(next.status).toBe('active');
    expect(next.value).toBe('running');
    const workerSnapshot = getChildSnapshot(
      next,
      'root/worker'
    ) as AnyMachineSnapshot;
    expect(workerSnapshot.value).toBe('failed');
    expect(workerSnapshot.children.job).toBeUndefined();
    const terminations = effects.filter(
      (effect) => effect.type === '@xstate.terminate'
    );
    expect(terminations).toHaveLength(1);
    expect(terminations[0]).toMatchObject({ status: 'error', error });
    expect((terminations[0] as any).actor.address).toBe('root/worker/job');
  });

  it('folded @xstate.terminate does not relay: a runtime whose sendEvent records calls sees no xstate.done.actor after executeEffects', async () => {
    const sent: AnyEventObject[] = [];
    const runtime = {
      sendEvent: (_s: AnyActor | undefined, _t: AnyActor, event: any) => {
        sent.push(event);
      },
      terminateActor: terminateActor,
      stopActor: stopActor,
      cancelTimer: () => {}
    };
    const install = (effects: ExecutableActionObject[]) => {
      for (const effect of effects) {
        const actor = ((effect as any).actor ?? (effect as any).source) as
          | AnyActor
          | undefined;
        if (actor) {
          actor.system.runtime = runtime;
        }
      }
    };

    // Control: the plain per-actor transition relays the completion.
    const retryRef = getChildRef(restoreFresh(), 'worker', 'retry');
    const [, plainEffects] = transition(
      (retryRef as any).logic,
      retryRef.getSnapshot(),
      { type: 'xstate.timer', id: RETRY_TIMER } as never
    );
    install(plainEffects);
    await executeEffects(plainEffects, runtime);
    expect(sent.map((event) => event.type)).toEqual(['xstate.done.actor']);

    sent.length = 0;
    const [, effects] = transitionChild(
      root,
      restoreFresh() as never,
      'root/worker/retry',
      { type: 'xstate.timer', id: RETRY_TIMER }
    );
    install(effects);
    await executeEffects(effects, runtime);
    expect(sent).toEqual([]);
  });

  it('a runtime that copies the termination before terminateActor still does not relay a folded completion', async () => {
    const sent: AnyEventObject[] = [];
    const recorded: object[] = [];
    const runtime = {
      sendEvent: (_s: AnyActor | undefined, _t: AnyActor, event: any) => {
        sent.push(event);
      },
      terminateActor: (actor: AnyActor, termination: any) => {
        const copy = { ...termination };
        recorded.push(copy);
        return terminateActor(actor, copy);
      },
      stopActor: stopActor,
      cancelTimer: () => {}
    };
    const [, effects] = transitionChild(
      root,
      restoreFresh() as never,
      'root/worker/retry',
      { type: 'xstate.timer', id: RETRY_TIMER }
    );
    for (const effect of effects) {
      const actor = ((effect as any).actor ?? (effect as any).source) as
        | AnyActor
        | undefined;
      if (actor) {
        actor.system.runtime = runtime;
      }
    }
    await executeEffects(effects, runtime);
    expect(recorded).toContainEqual(
      expect.objectContaining({ status: 'done', completionDelivered: true })
    );
    expect(sent.filter((event) => event.type === 'xstate.done.actor')).toEqual(
      []
    );
  });

  it('stale timer id → unchanged snapshot (===) and no effects', () => {
    const snapshot = restoreFresh();

    const [next, effects] = transitionChild(
      root,
      snapshot as never,
      'root/worker/retry',
      { type: 'xstate.timer', id: 'xstate.after.1000.retry.gone' }
    );

    expect(next).toBe(snapshot);
    expect(effects).toEqual([]);
  });

  it('address through embedChildren:false remote handle throws the remote-reference error; missing address throws', () => {
    const [initial] = initialTransition(root);
    const remote = root.restoreSnapshot(
      JSON.parse(
        JSON.stringify(
          root.getPersistedSnapshot(initial, { embedChildren: false })
        )
      )
    );

    expect(() =>
      transitionChild(root, remote, 'root/worker/retry', {
        type: 'xstate.timer',
        id: RETRY_TIMER
      })
    ).toThrow(
      "Cannot transition 'root/worker/retry': 'worker' is a remote reference; its state lives with another runtime."
    );
    expect(getChildSnapshot(remote, 'root/worker/retry')).toBeUndefined();
    expect(() =>
      transitionChild(root, restoreFresh() as never, 'root/worker/nope', {
        type: 'xstate.timer',
        id: RETRY_TIMER
      })
    ).toThrow("Unable to find actor 'root/worker/nope' in snapshot of 'root'.");
    expect(() =>
      withChildSnapshot(restoreFresh(), 'root/nope', initial)
    ).toThrow("Unable to find actor 'root/nope' in snapshot of 'root'.");
  });

  it('durable.transitionChild tags cascade under one transitionIndex; replaying the same (address,event) journal yields identical snapshots, effects and descriptors', () => {
    const [initial] = initialTransition(root);
    const checkpoint = JSON.stringify(root.getPersistedSnapshot(initial));

    const run = () => {
      const durable = createDurable(root, {
        executionId: 'exec',
        transitionIndex: 7,
        executeAction: () => {},
        waitForEvent: () => new Promise(() => {})
      });
      const [next, effects] = durable.transitionChild(
        root.restoreSnapshot(JSON.parse(checkpoint)),
        'root/worker/retry',
        { type: 'xstate.timer', id: RETRY_TIMER }
      );
      return {
        next,
        effects,
        nextTransitionIndex: durable.nextTransitionIndex
      };
    };

    const first = run();
    expect(first.nextTransitionIndex).toBe(8);
    expect(first.effects.map((effect) => effect.id)).toEqual([
      '7:0',
      '7:1',
      '7:2',
      '7:3',
      '7:4',
      '7:5'
    ]);
    expect(
      new Set(first.effects.map((effect) => effect.transitionIndex))
    ).toEqual(new Set([7]));

    const replay = run();
    expect(root.getPersistedSnapshot(replay.next)).toEqual(
      root.getPersistedSnapshot(first.next)
    );
    expect(replay.effects.map((effect) => effect.descriptor)).toEqual(
      first.effects.map((effect) => effect.descriptor)
    );
    expect(replay.effects.map((effect) => effect.id)).toEqual(
      first.effects.map((effect) => effect.id)
    );

    // The envelope is unchanged: formatVersion 1 keys only.
    const persisted = root.getPersistedSnapshot(first.next) as object;
    expect(Object.keys(persisted).sort()).toEqual(
      [
        '_nextActorIds',
        '_nextTimerId',
        'children',
        'context',
        'error',
        'formatVersion',
        'historyValue',
        'output',
        'status',
        'timers',
        'value'
      ].sort()
    );
    const active = root.getPersistedSnapshot(
      transitionChild(
        root,
        root.restoreSnapshot(JSON.parse(checkpoint)),
        'root/worker',
        { type: 'UNKNOWN' }
      )[0]
    ) as unknown as { children: Record<string, object> };
    expect(Object.keys(active.children.worker).sort()).toEqual(
      ['address', 'registryKey', 'snapshot', 'src', 'syncSnapshot'].sort()
    );
  });
});

describe('transitionChild edges', () => {
  it('non-terminal transitionChild: getActorRef and system.get resolve the new tree; the original snapshot keeps the old one', () => {
    const pausingRetry = createMachine({
      id: 'retry',
      initial: 'idle',
      states: {
        idle: { after: { 1000: { target: 'paused' } } },
        paused: { on: { RESUME: { target: 'resumed' } } },
        resumed: {}
      }
    });
    const pausingWorker = setup({
      actors: { retry: pausingRetry }
    }).createMachine({
      id: 'worker',
      invoke: { id: 'retry', src: 'retry', registryKey: 'retrier' }
    });
    const machine = setup({ actors: { worker: pausingWorker } }).createMachine({
      id: 'root',
      invoke: { id: 'worker', src: 'worker' }
    });
    const durable = createDurable(machine, {
      executionId: 'exec',
      executeAction: () => {},
      waitForEvent: () => new Promise(() => {})
    });
    const snapshot = restoreFresh(machine as never);

    const [next] = durable.transitionChild(
      snapshot as never,
      'root/worker/retry',
      { type: 'xstate.timer', id: 'xstate.after.1000.retry.idle' }
    );

    const valueAt = (s: AnyMachineSnapshot, address: string) =>
      (
        durable
          .getActorRef(s as never, address)!
          .getSnapshot() as AnyMachineSnapshot
      ).value;
    expect(valueAt(next, 'root/worker/retry')).toBe('paused');
    expect(valueAt(snapshot, 'root/worker/retry')).toBe('idle');
    expect(
      (durable.getActorRef(next)!.getSnapshot() as AnyMachineSnapshot).children
        .worker
    ).toBe(next.children.worker);
    const system = durable.getActorRef(next)!.system;
    expect(
      (system.get('retrier')!.getSnapshot() as AnyMachineSnapshot).value
    ).toBe('paused');
    expect(
      (
        durable
          .getActorRef(snapshot as never)!
          .system.get('retrier')!
          .getSnapshot() as AnyMachineSnapshot
      ).value
    ).toBe('idle');

    const [after] = durable.transitionChild(next, 'root/worker/retry', {
      type: 'RESUME'
    });
    expect(valueAt(after, 'root/worker/retry')).toBe('resumed');
    expect(valueAt(next, 'root/worker/retry')).toBe('paused');
  });

  it('is transition() for the root address', () => {
    const snapshot = restoreFresh();
    const event = { type: 'xstate.done.actor', actorId: 'worker', output: 1 };
    const sessionId = (snapshot.children.worker as AnyActor).sessionId;
    const [viaChild, childEffects] = transitionChild(
      root,
      snapshot as never,
      'root',
      { ...event, sessionId }
    );
    const [viaRoot, rootEffects] = transition(
      root,
      snapshot as never,
      {
        ...event,
        sessionId
      } as never
    );
    expect(root.getPersistedSnapshot(viaChild)).toEqual(
      root.getPersistedSnapshot(viaRoot)
    );
    expect(describeEffects(childEffects)).toEqual(describeEffects(rootEffects));
  });

  it('warns once per actor about a completion event without sessionId', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const snapshot = restoreFresh();
      const event = { type: 'xstate.done.actor', actorId: 'worker' } as never;
      const [next] = transition(root, snapshot as never, event);
      transition(root, snapshot as never, event);
      expect(next.value).toBe('done');
      expect(warn.mock.calls).toEqual([
        [
          "Completion event for actor 'root/worker' has no sessionId; stale-completion protection is bypassed — deliver completions via transition()/transitionChild()."
        ]
      ]);
    } finally {
      warn.mockRestore();
    }
  });
});

function getChildRef(snapshot: AnyMachineSnapshot, ...ids: string[]): AnyActor {
  let ref: AnyActor | undefined;
  let current = snapshot;
  for (const id of ids) {
    ref = current.children[id] as AnyActor;
    current = ref.getSnapshot();
  }
  return ref!;
}
