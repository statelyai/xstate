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
import { useMachine } from '../src';
import { Machine, assign, Interpreter, spawn, doneInvoke, State } from 'xstate';
import { watch } from '@vue/composition-api';
import { spawnPromise } from 'xstate/invoke';

const context = {
  data: undefined
};
const fetchMachine = Machine<typeof context, any>({
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

export default {
  props: ['persistedState'],
  setup({ persistedState }: { persistedState: State<any, any> }) {
    const onFetch = () =>
      new Promise(res => setTimeout(() => res('some data'), 50));

    const { state, send, service } = useMachine(fetchMachine, {
      services: {
        fetchData: spawnPromise(onFetch)
      },
      state: persistedState
    });
    return { state, send, service };
  }
};
</script>
