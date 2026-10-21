import { Effect, Layer } from 'effect';
import { AsyncResult, Atom, AtomRegistry } from 'effect/reactivity';
import { waitFor } from '@xstate/effect';
import { createActorAtoms } from '@xstate/effect/atom';
import { createMachine } from 'xstate';

const reviewMachine = createMachine({
  initial: 'pending',
  states: {
    pending: { on: { APPROVE: { target: 'approved' } } },
    approved: {}
  }
});

const runtime = Atom.runtime(Layer.empty);
const review = createActorAtoms(runtime, reviewMachine);
const status = review.select((snapshot) => snapshot.value);
const registry = AtomRegistry.make();
const unmount = registry.mount(status);

export let result: string | undefined;
try {
  const actor = await Effect.runPromise(
    AtomRegistry.getResult(registry, review.actor)
  );
  // Wait for the runtime before sending.
  registry.set(review.send, { type: 'APPROVE' });
  await Effect.runPromise(waitFor(actor, (s) => s.matches('approved')));
  const current = registry.get(status);
  if (AsyncResult.isSuccess(current)) {
    result = current.value;
    console.log(result); // 'approved'
  }
} finally {
  unmount();
  registry.dispose();
}
