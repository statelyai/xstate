import {
  createActor,
  createCallbackLogic,
  createMachine,
  types
} from '../src/index.ts';

it.each(['external callback', 'receive callback', 'startup callback'])(
  'cleans up a replaced callback before starting its replacement (%s)',
  (trigger) => {
    const log: string[] = [];
    const sends: Array<() => void> = [];
    let count = 0;
    const work = createCallbackLogic(({ sendBack, receive }) => {
      const id = ++count;
      log.push(`start ${id}`);
      sends.push(() => sendBack({ type: 'tick' }));
      receive(() => sendBack({ type: 'tick' }));
      if (trigger === 'startup callback' && id === 1) {
        sendBack({ type: 'tick' });
      }
      return () => log.push(`cleanup ${id}`);
    });
    const actor = createActor(
      createMachine({
        initial: 'busy',
        states: {
          busy: {
            invoke: { id: 'work', src: work },
            on: { tick: { target: 'busy', reenter: true } }
          }
        }
      })
    ).start();
    if (trigger === 'external callback') sends[0]();
    if (trigger === 'receive callback')
      actor.getSnapshot().children.work!.send({ type: 'go' });
    expect(log).toEqual(['start 1', 'cleanup 1', 'start 2']);
    sends[0]();
    expect(log).toEqual(['start 1', 'cleanup 1', 'start 2']);
    actor.stop();
    expect(log).toEqual(['start 1', 'cleanup 1', 'start 2', 'cleanup 2']);
  }
);

it('preserves parent-send order when a parent replies to the first send', () => {
  const seen: number[] = [];
  const child = createMachine({
    on: {
      go: ({ parent }, enq) => {
        const first = { type: 'item', n: 1 };
        enq.sendTo(parent!, first);
        const second = { type: 'item', n: 2 };
        enq.sendTo(parent!, second);
      },
      reply: ({ parent }, enq) => {
        const third = { type: 'item', n: 3 };
        enq.sendTo(parent!, third);
      }
    }
  });
  const parent = createActor(
    createMachine({
      schemas: { events: { item: types<{ n: number }>() } },
      invoke: { id: 'child', src: child },
      on: {
        item: ({ event, children }, enq) => {
          seen.push(event.n);
          if (event.n === 1) enq.sendTo(children.child!, { type: 'reply' });
          return {};
        }
      }
    })
  ).start();
  parent.getSnapshot().children.child!.send({ type: 'go' });
  expect(seen).toEqual([1, 2, 3]);
  parent.stop();
});
