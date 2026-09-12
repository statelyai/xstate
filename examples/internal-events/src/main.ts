import { createActor, setup, toPromise, types } from 'xstate';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) => console.log(message);

/**
 * An upload with a private progress protocol. `start` and `cancel` are public;
 * `progress.*` and `tick` are raised by the machine itself, so no caller can
 * fake progress or advance the retry clock.
 */
const uploadMachine = setup({
  schemas: {
    context: types<{ file: string; sent: number; total: number }>(),
    input: types<{ file: string; total: number }>(),
    events: {
      start: types<{}>(),
      cancel: types<{}>()
    },
    // Declared here rather than in `schemas.events`: part of the internal
    // event union, excluded from the public `send` protocol.
    internalEvents: {
      tick: types<{}>(),
      'progress.*': types<{ bytes: number }>()
    },
    output: types<{ file: string; sent: number; cancelled: boolean }>()
  },
  delays: { chunkInterval: 50 }
}).createMachine({
  id: 'upload',
  context: ({ input }) => ({ file: input.file, sent: 0, total: input.total }),
  initial: 'idle',
  states: {
    idle: {
      on: {
        start: { target: 'uploading' }
      }
    },
    uploading: {
      // The machine's own clock. Nothing outside can produce a `tick`.
      after: {
        chunkInterval: (_, enq) => {
          enq.raise({ type: 'progress.chunk', bytes: 256 });
        }
      },
      on: {
        'progress.chunk': ({ context, event }) => {
          const sent = Math.min(context.sent + event.bytes, context.total);
          log(`  progress: ${sent}/${context.total} bytes`);
          return {
            target: sent >= context.total ? 'complete' : 'uploading',
            context: { sent },
            reenter: true
          };
        },
        cancel: { target: 'cancelled' }
      }
    },
    complete: {
      type: 'final',
      output: ({ context }) => ({
        file: context.file,
        sent: context.sent,
        cancelled: false
      })
    },
    cancelled: {
      type: 'final',
      output: ({ context }) => ({
        file: context.file,
        sent: context.sent,
        cancelled: true
      })
    }
  }
});

const actor = createActor(uploadMachine, {
  input: { file: 'report.pdf', total: 1024 },
  // A rejected event is silent unless it is observed. `onRejectedEvent` is the
  // root actor's dead-letter hook: it fires for every event that was not
  // delivered, with the reason why.
  onRejectedEvent: (rejection) => {
    log(
      `dead letter: "${rejection.event.type}" from ${rejection.eventOrigin} ` +
        `(${rejection.reason}) — ${rejection.error?.message}`
    );
  },
  inspect: (event) => {
    // The same rejections reach inspection observers as `@xstate.deadletter`.
    if (event.type === '@xstate.deadletter') {
      log(`  inspected as ${event.type}: "${event.event.type}"`);
    }
    inspector?.inspect(event);
  }
});

actor.subscribe((snapshot) => log(`state: ${JSON.stringify(snapshot.value)}`));
actor.start();

// A public event: accepted, and it kicks off the private progress protocol.
actor.send({ type: 'start' });

// A private event from outside. `send` is fire-and-forget: it does not throw
// and the actor does not error. The event is dropped at the delivery boundary
// and reported as a dead letter.
//
// Wildcard `progress.*` entries are excluded from `actor.send` just like
// exact entries such as `tick`.
// @ts-expect-error — `progress.chunk` matches an internal wildcard.
actor.send({ type: 'progress.chunk', bytes: 999_999 });

// The same holds for `trigger`, the shorthand form of `send`.
// @ts-expect-error — `tick` is internal, so `actor.trigger` has no `tick`.
actor.trigger.tick({});

log(
  `state after the rejected sends: ${JSON.stringify(actor.getSnapshot().value)}`
);
log(`status after the rejected sends: ${actor.getSnapshot().status}`);
log(`bytes after the rejected sends: ${actor.getSnapshot().context.sent}`);

const output = await toPromise(actor);
log(`done: ${JSON.stringify(output)}`);

inspector?.destroy();
