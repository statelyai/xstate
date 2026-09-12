import { createActor, type Snapshot } from 'xstate';
import { donutMachine } from './donutMachine';
import { TaskQueue } from './TaskQueue';

export function createDonutSession({
  snapshot,
  save,
  onError
}: {
  snapshot?: Snapshot<unknown>;
  save: (snapshot: Snapshot<unknown>) => Promise<void>;
  onError: (error: unknown) => void;
}) {
  const actor = createActor(donutMachine, { snapshot });
  const queue = new TaskQueue();
  actor.subscribe({
    next() {
      const persisted = actor.getPersistedSnapshot();
      void queue.addTask(() => save(persisted)).catch(onError);
    },
    error: onError
  });
  return { actor, flush: () => queue.flush() };
}
