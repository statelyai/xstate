<template>
  <div>
    Hallo
    <button v-if="state.matches('idle')" @click="send('FETCH')">Fetch</button>
    <div v-else-if="state.matches('loading')">Loading...</div>
    <div v-else-if="state.matches('success')">
      Success! Data:
      <div data-testid="data">{{ state.context.data }}</div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import { useMachine } from '../src';
import { createMachine, assign, State, AnyState } from 'xstate';

const context = {
  data: undefined
};
const fetchMachine = createMachine<typeof context, any>({
  id: 'fetch',
  initial: 'idle',
  context,
  states: {
    idle: {
      on: { FETCH: 'loading' }
    },
    loading: {
      invoke: {
        src: 'fetchData',
        onDone: {
          target: 'success',
          actions: assign({
            data: (_, e) => e.data
          }),
          cond: (_, e) => e.data.length
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

    const { state, send, service } = useMachine(fetchMachine, {
      services: {
        fetchData: onFetch
      },
      state: persistedState
    });
    return { state, send, service };
  }
});
</script>
