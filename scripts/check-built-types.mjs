import { createRequire } from 'node:module';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
const compilerManifest = require('typescript/package.json');
const compiler = join(
  dirname(require.resolve('typescript/package.json')),
  compilerManifest.bin.tsc ?? compilerManifest.bin.tsc6
);
const publicEntries = Object.keys(
  require(join(root, 'packages/core/package.json')).exports
).filter((entry) => entry !== './package.json');
const imports = publicEntries
  .map(
    (entry, index) =>
      `import * as entry${index} from ${JSON.stringify(entry === '.' ? 'xstate' : 'xstate' + entry.slice(1))};`
  )
  .join('\n');
const cache = join(root, 'node_modules', '.cache');
mkdirSync(cache, { recursive: true });
const consumer = mkdtempSync(join(cache, 'xstate-types-'));
try {
  mkdirSync(join(consumer, 'node_modules'));
  symlinkSync(
    join(root, 'packages', 'core'),
    join(consumer, 'node_modules', 'xstate'),
    'dir'
  );
  writeFileSync(
    join(consumer, 'index.mts'),
    `
    import { createActor, createMachine, setup, types, type ContextFrom, type EventFrom } from 'xstate';
    ${imports}
    const actor = createActor(createMachine({ initial: 'idle', states: { idle: {} } }));
    actor.start(); actor.stop();
    void [${publicEntries.map((_, index) => `entry${index}`).join(',')}];

    // The machine's internal-event marker must survive \`stripInternal\`, or
    // \`send\`/\`trigger\` silently accept internal events for every consumer of
    // the published declarations. An unused \`@ts-expect-error\` fails here.
    const internalsMachine = setup({
      schemas: {
        events: { start: types<{}>() },
        internalEvents: {
          tick: types<{ at: number }>(),
          'progress.*': types<{ bytes: number }>()
        }
      }
    }).createMachine({ initial: 'idle', states: { idle: {} } });
    const internals = createActor(internalsMachine);
    const validated = await internalsMachine.eventSchema['~standard'].validate({ type: 'start' });
    if (!validated.issues) {
      const publicType: 'start' = validated.value.type;
      void publicType;
      // @ts-expect-error internal fields are excluded from public schema output
      validated.value.at;
    }
    internals.send({ type: 'start' });
    // @ts-expect-error an exact internal key is not part of the public protocol
    internals.send({ type: 'tick', at: 1 });
    // @ts-expect-error a wildcard internal key is not either
    internals.send({ type: 'progress.chunk', bytes: 1 });
    // @ts-expect-error internal keys are absent from \`trigger\`
    internals.trigger.tick({ at: 1 });

    // With the marker published, helpers that match \`StateMachine<...>\`
    // must list its internal-event parameter, or they resolve to \`never\`.
    const fromEvent: EventFrom<typeof internalsMachine> = { type: 'tick', at: 1 };
    const fromKey: EventFrom<typeof internalsMachine, 'start'> = { type: 'start' };
    const fromContext: ContextFrom<typeof internalsMachine> = {};
    void [fromEvent, fromKey, fromContext];

    // The original action result contract must survive declaration emit,
    // including when a provided implementation narrows that result.
    const patches = setup({
      actions: {
        update: (_id: string): { context: { currency: 'EUR' | 'USD' } } => ({
          context: { currency: 'USD' }
        }),
        notify: (_id: string): void => {}
      }
    }).createMachine({});
    const euro = patches.provide({
      actions: { update: () => ({ context: { currency: 'EUR' } }) }
    });
    euro.provide({
      actions: { update: () => ({ context: { currency: 'USD' } }) }
    });
    euro.provide({
      actions: {
        // @ts-expect-error a result-producing action must return its result
        update: () => {}
      }
    });
    patches.provide({
      actions: {
        // @ts-expect-error replacement results must match the declared result
        update: () => ({ context: { currency: 'EURO' } })
      }
    });
    const notified = patches.provide({ actions: { notify: (_id) => 42 } });
    const notification: number = notified._actionMap.notify('id');
    notified.provide({ actions: { notify: () => {} } });
    void notification;

    // Reserved descriptor helpers are referenced by the published config types.
    // They must survive declaration stripping and retain their event payloads.
    setup({ schemas: { events: { GO: types<{}>() } } }).createMachine({
      on: {
        GO: () => {},
        'xstate.error.execution': ({ event }) => {
          const error: unknown = event.error;
          void error;
        },
        'xstate.error.actor': ({ event }) => {
          const actorId: string = event.actorId;
          const error: unknown = event.error;
          void [actorId, error];
        },
        // @ts-expect-error reserved descriptor typos are not public events
        'xstate.eror.actor': () => {}
      }
    });
  `
  );
  writeFileSync(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        types: [],
        lib: ['ES2022', 'DOM']
      },
      files: ['index.mts']
    })
  );
  const result = spawnSync(
    process.execPath,
    [compiler, '--project', join(consumer, 'tsconfig.json')],
    { cwd: consumer, stdio: 'inherit' }
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      'Built package declarations failed strict consumer typechecking'
    );
  console.log('Built package declarations pass strict consumer typechecking.');
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
