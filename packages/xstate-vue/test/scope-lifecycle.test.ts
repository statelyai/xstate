import { render } from '@testing-library/vue';
import { createSharedComposable } from '@vueuse/shared';
import { defineComponent, effectScope, h, nextTick, ref } from 'vue';
import { createMachine } from 'xstate';
import { createCallbackLogic } from 'xstate/actors';
import {
  useActor,
  useActorRef,
  useMachine,
  useSelector
} from '../src/index.ts';

function createCounter() {
  const started = vi.fn();
  const cleanedUp = vi.fn();
  const machine = createMachine({
    context: { count: 0 },
    invoke: {
      src: createCallbackLogic(() => {
        started();
        return cleanedUp;
      })
    },
    on: {
      INC: ({ context }) => ({ context: { count: context.count + 1 } })
    }
  });
  return { machine, started, cleanedUp };
}

it.each(['useMachine', 'useActor', 'useActorRef'] as const)(
  '%s retains a shared actor until the last consumer disposes',
  async (hook) => {
    const { machine, started, cleanedUp } = createCounter();
    const useShared = createSharedComposable(() => {
      if (hook === 'useActorRef') {
        const actorRef = useActorRef(machine);
        return { actorRef, snapshot: useSelector(actorRef, (s) => s) };
      }
      return hook === 'useMachine' ? useMachine(machine) : useActor(machine);
    });
    const instances: ReturnType<typeof useShared>[] = [];
    const Consumer = defineComponent({
      setup() {
        const shared = useShared();
        instances.push(shared);
        return () => h('output', String(shared.snapshot.value.context.count));
      }
    });
    const showA = ref(true);
    const showB = ref(true);
    const { container, unmount } = render(
      defineComponent({
        setup: () => () => [
          showA.value ? h(Consumer, { key: 'a' }) : null,
          showB.value ? h(Consumer, { key: 'b' }) : null
        ]
      })
    );
    const first = instances[0].actorRef;
    expect(instances[1].actorRef).toBe(first);
    expect(started).toHaveBeenCalledTimes(1);
    first.send({ type: 'INC' });
    await nextTick();
    expect(container.textContent).toBe('11');

    showA.value = false;
    await nextTick();
    expect(first.getSnapshot().status).toBe('active');
    expect(cleanedUp).not.toHaveBeenCalled();
    instances[1].actorRef.send({ type: 'INC' });
    await nextTick();
    expect(container.textContent).toBe('2');

    showB.value = false;
    await nextTick();
    expect(first.getSnapshot().status).toBe('stopped');
    expect(cleanedUp).toHaveBeenCalledTimes(1);

    showA.value = true;
    await nextTick();
    const fresh = instances[2].actorRef;
    expect(fresh).not.toBe(first);
    expect(started).toHaveBeenCalledTimes(2);
    expect(container.textContent).toBe('0');
    fresh.send({ type: 'INC' });
    await nextTick();
    expect(container.textContent).toBe('1');
    unmount();
    expect(fresh.getSnapshot().status).toBe('stopped');
    expect(cleanedUp).toHaveBeenCalledTimes(2);
  }
);

it('defers startup and observer calls until mount, then cleans up on unmount', () => {
  const { machine, started, cleanedUp } = createCounter();
  const observer = { next: vi.fn(), complete: vi.fn() };
  const { unmount } = render(
    defineComponent({
      setup() {
        useActorRef(machine, {}, observer);
        expect(started).not.toHaveBeenCalled();
        expect(observer.next).not.toHaveBeenCalled();
        return () => h('div');
      }
    })
  );
  expect(started).toHaveBeenCalledTimes(1);
  expect(observer.next).toHaveBeenCalledTimes(1);
  unmount();
  expect(cleanedUp).toHaveBeenCalledTimes(1);
  expect(observer.complete).toHaveBeenCalledTimes(1);
});

it('does not start an actor whose owning scope was disposed before mount', () => {
  const { machine, started, cleanedUp } = createCounter();
  const observer = vi.fn();
  const { unmount } = render(
    defineComponent({
      setup() {
        const scope = effectScope();
        scope.run(() => useActorRef(machine, {}, observer));
        scope.stop();
        scope.stop();
        return () => h('div');
      }
    })
  );
  expect(started).not.toHaveBeenCalled();
  expect(observer).not.toHaveBeenCalled();
  unmount();
  expect(cleanedUp).not.toHaveBeenCalled();
});
