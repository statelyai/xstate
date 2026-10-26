import {
  createActor,
  createMachine,
  initialTransition,
  transition,
  initialSystemTransition,
  systemTransition
} from '../src/index.ts';

// An independent, finite reference model: each region is a modular counter.
// No transition selection, state-value construction or normalization helpers
// from the interpreter are used to predict its state.
it.each(Array.from({ length: 24 }, (_, seed) => seed))(
  'agrees with a generated parallel reference model (seed %s)',
  (seed) => {
    let randomState = seed + 1;
    const random = () => {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      return randomState;
    };
    const widths = Array.from(
      { length: 1 + (random() % 3) },
      () => 2 + (random() % 4)
    );
    const observed: Array<{ region: number; position: number }> = [];
    function record(value: { region: number; position: number }) {
      observed.push(value);
    }
    const regions = Object.fromEntries(
      widths.map((width, region) => [
        `r${region}`,
        {
          initial: 's0',
          states: Object.fromEntries(
            Array.from({ length: width }, (_, position) => [
              `s${position}`,
              {
                on: {
                  STEP: ({ context, event }: any, enq: any) => {
                    if (
                      !context.enabled ||
                      event.region !== region ||
                      event.by === 0
                    )
                      return;
                    const next =
                      (((position + event.by) % width) + width) % width;
                    enq(record, { region, position: next });
                    return { target: `s${next}` };
                  }
                }
              }
            ])
          )
        }
      ])
    );
    const machine = createMachine({
      id: `model-${seed}`,
      context: { enabled: true },
      initial: 'running',
      on: {
        ENABLE: ({ event }: any) => ({ context: { enabled: event.enabled } })
      },
      states: {
        running: {
          type: 'parallel',
          states: regions,
          on: { STOP: { target: 'stopped' } }
        },
        stopped: { type: 'final' }
      }
    } as any);
    const actor = createActor(machine).start();
    let [pure] = initialTransition(machine);
    const systemLogic = { root: machine, effects: { record } };
    let [system] = initialSystemTransition(systemLogic);
    const positions = widths.map(() => 0);
    let enabled = true;
    let stopped = false;
    let expectedEffects = 0;
    const events = Array.from({ length: 64 }, () => {
      const choice = random() % 6;
      return choice === 0
        ? { type: 'ENABLE', enabled: random() % 2 === 0 }
        : choice === 1
          ? { type: 'UNKNOWN' }
          : {
              type: 'STEP',
              region: random() % widths.length,
              by: (random() % 5) - 2
            };
    });
    events.push({ type: 'STOP' }, { type: 'STEP', region: 0, by: 1 });
    try {
      for (const event of events) {
        if (!stopped) {
          if (event.type === 'ENABLE') enabled = event.enabled!;
          if (event.type === 'STOP') stopped = true;
          if (event.type === 'STEP' && enabled && event.by !== 0) {
            const region = event.region!;
            positions[region] =
              (((positions[region] + event.by!) % widths[region]) +
                widths[region]) %
              widths[region];
            expectedEffects++;
          }
        }
        actor.send(event);
        [pure] = transition(machine, pure, event);
        [system] = systemTransition(systemLogic, system, system.root, event);
        const expected = stopped
          ? 'stopped'
          : {
              running: Object.fromEntries(
                positions.map((position, region) => [
                  `r${region}`,
                  `s${position}`
                ])
              )
            };
        expect(actor.getSnapshot().value).toEqual(expected);
        expect(pure.value).toEqual(expected);
        expect(system.actors[system.root].snapshot).toMatchObject({
          value: expected
        });
        expect(actor.getSnapshot().context).toEqual({ enabled });
        expect(pure.context).toEqual({ enabled });
        expect(observed).toHaveLength(expectedEffects);
        const active = new Set(pure.nodes);
        for (const node of pure.nodes) {
          const children = Object.values(node.states);
          if (node.type === 'compound')
            expect(children.filter((child) => active.has(child))).toHaveLength(
              1
            );
          if (node.type === 'parallel')
            expect(children.every((child) => active.has(child))).toBe(true);
        }
      }
    } finally {
      actor.stop();
    }
  }
);
