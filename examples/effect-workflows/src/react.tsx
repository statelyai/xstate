import { Suspense } from 'react';
import { Effect, Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import {
  RegistryProvider,
  useAtomSet,
  useAtomSuspense
} from '@effect/atom-react';
import { fromEffect, setupEffect } from '@xstate/effect';
import { createActorAtoms } from '@xstate/effect/atom';

const reviewMachine = setupEffect({
  actors: { publish: fromEffect(Effect.sleep('10 millis')) }
}).createMachine({
  initial: 'pending',
  states: {
    pending: { on: { APPROVE: { target: 'publishing' } } },
    publishing: {
      invoke: { src: 'publish', onDone: { target: 'published' } }
    },
    published: {}
  }
});

const runtime = Atom.runtime(Layer.empty);
const review = createActorAtoms(runtime, reviewMachine);
const status = review.select((snapshot) => snapshot.value);

function Review() {
  const { value } = useAtomSuspense(status);
  const send = useAtomSet(review.send);
  return (
    <section>
      <p role="status">{value}</p>
      <button
        disabled={value !== 'pending'}
        onClick={() => send({ type: 'APPROVE' })}
      >
        Approve release
      </button>
    </section>
  );
}

export function App() {
  return (
    <RegistryProvider>
      <Suspense fallback={<p>Starting review…</p>}>
        <Review />
      </Suspense>
    </RegistryProvider>
  );
}
