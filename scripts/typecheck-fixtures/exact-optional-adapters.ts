import {
  createActor,
  setup,
  types
} from '../../packages/core/dist/xstate.cjs.mjs';
import {
  useActor as useReactActor,
  useActorRef as useReactActorRef,
  useMachine as useReactMachine,
  useSelector as useReactSelector
} from '../../packages/xstate-react/dist/xstate-react.cjs.mjs';
import {
  useActor as useSolidActor,
  useActorRef as useSolidActorRef,
  useMachine as useSolidMachine
} from '../../packages/xstate-solid/dist/xstate-solid.cjs.mjs';
import {
  useActor as useSvelteActor,
  useActorRef as useSvelteActorRef,
  useMachine as useSvelteMachine,
  useSelector as useSvelteSelector
} from '../../packages/xstate-svelte/dist/xstate-svelte.cjs.mjs';
import {
  useActor as useVueActor,
  useActorRef as useVueActorRef,
  useMachine as useVueMachine,
  useSelector as useVueSelector
} from '../../packages/xstate-vue/dist/xstate-vue.cjs.mjs';

const machine = setup({
  schemas: {
    context: types<{ count: number }>()
  }
}).createMachine({
  context: { count: 0 }
});

const actor = createActor(machine);
declare function expectNumber(value: number): void;

useVueSelector(actor, (snapshot) => snapshot.context.count);
useReactSelector(actor, (snapshot) => snapshot.context.count);
useSvelteSelector(actor, (snapshot) => snapshot.context.count);

expectNumber(useVueActor(machine).snapshot.value.context.count);
expectNumber(useVueMachine(machine).snapshot.value.context.count);
expectNumber(useVueActorRef(machine).getSnapshot().context.count);

expectNumber(useReactActor(machine)[0].context.count);
expectNumber(useReactMachine(machine)[0].context.count);
expectNumber(useReactActorRef(machine).getSnapshot().context.count);

useSvelteActor(machine).snapshot.subscribe(
  (snapshot) => snapshot.context.count
);
useSvelteMachine(machine).snapshot.subscribe(
  (snapshot) => snapshot.context.count
);
expectNumber(useSvelteActorRef(machine).getSnapshot().context.count);

expectNumber(useSolidActor(machine)[0].context.count);
expectNumber(useSolidMachine(machine)[0].context.count);
expectNumber(useSolidActorRef(machine).getSnapshot().context.count);
