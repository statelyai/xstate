<template>
  <div>
    Hallo
    <button v-if="snapshot.matches('idle')" @click="send({ type: 'FETCH' })">
      Fetch
    </button>
    <div v-else-if="snapshot.matches('loading')">Loading...</div>
    <div v-else-if="snapshot.matches('success')">
      Success! Data:
      <div data-testid="data">{{ snapshot.context.data }}</div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import { useMachine } from '../src/index.ts';
import { createMachine, assign, AnyState } from 'xstate';
import { fromPromise } from 'xstate/actors';

const context = {
  data: undefined
};
const fetchMachine = createMachine({
  id: 'fetch',
  initial: 'idle',
  context,
  states: {
    idle: {
      on: { FETCH: 'loading' }
    },
    loading: {
      invoke: {
        id: 'fetchData',
        src: 'fetchData',
        onDone: {
          target: 'success',
          actions: assign({
            data: ({ event }) => event.output
          }),
          guard: ({ event }) => event.output.length
        }
      }
    },
    success: {
      type: 'final'
    }
  }
});

export default defineComponent({
  props: {
    persistedState: {
      type: Object as PropType<AnyState>
    }
  },
  setup({ persistedState }) {
    const onFetch = () =>
      new Promise((res) => setTimeout(() => res('some data'), 50));

    const { snapshot, send, actorRef } = useMachine(
      fetchMachine.provide({
        actors: {
          fetchData: fromPromise(onFetch)
        }
      }),
      {
        snapshot: persistedState
      }
    );
    return { snapshot, send, actorRef };
  }
});
</script>
