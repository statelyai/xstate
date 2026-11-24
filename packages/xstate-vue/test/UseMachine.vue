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
import { createActor, createMachine, AnyState } from 'xstate';
import { restoreActor } from 'xstate/persist';
import { createAsyncLogic } from 'xstate/actors';

const context = {
  data: undefined
};
const fetchMachine = createMachine({
  id: 'fetch',
  actors: {
    fetchData: createAsyncLogic({ run: async (): Promise<string> => '' })
  },
  initial: 'idle',
  context: context as any,
  states: {
    idle: {
      on: { FETCH: { target: 'loading' } }
    },
    loading: {
      invoke: {
        id: 'fetchData',
        src: 'fetchData',
        onDone: ({ event }) => {
          if (!event.output.length) {
            return;
          }
          return {
            target: 'success',
            context: {
              data: event.output
            }
          };
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

    const logic = fetchMachine.provide({
      actors: {
        fetchData: createAsyncLogic({ run: onFetch })
      }
    });
    const { snapshot, send, actorRef } = useMachine(
      persistedState ? restoreActor(logic, persistedState) : createActor(logic)
    );
    return { snapshot, send, actorRef };
  }
});
</script>
