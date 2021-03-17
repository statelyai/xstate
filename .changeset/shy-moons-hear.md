---
'@xstate/vue': minor
---

import { useInterpret } from '@xstate/vue';
import { someMachine } from '../path/to/someMachine';

export default defineComponent({
  setup() {
    const state = ref();
    const service = useInterpret(machine, {}, (nextState) => {
      state.value = nextState.value;
    });
    return { service, state };
  }
});
