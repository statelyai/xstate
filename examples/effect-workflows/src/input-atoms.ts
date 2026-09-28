import { Effect, Layer, Schema } from 'effect';
import { Atom, AtomRegistry } from 'effect/unstable/reactivity';
import { fromEffect, join } from '@xstate/effect';
import { createActorAtoms } from '@xstate/effect/atom';

const prepare = fromEffect({
  schemas: { input: Schema.Struct({ release: Schema.String }) },
  effect: ({ input }) => Effect.succeed(`Prepared ${input.release}`)
});

const runtime = Atom.runtime(Layer.empty);
const atoms = createActorAtoms(runtime, prepare, {
  input: { release: 'v1.2.0' }
});
const registry = AtomRegistry.make();
const unmount = registry.mount(atoms.snapshot);

export let result: string | undefined;
try {
  const actor = await Effect.runPromise(
    AtomRegistry.getResult(registry, atoms.actor)
  );
  result = await Effect.runPromise(join(actor));
  console.log(result); // Prepared v1.2.0
} finally {
  unmount();
  registry.dispose();
}
