<script lang="ts">
  // this file acts as a type test
  import { createMachine, createActor } from 'xstate';

  const service = createActor(
    createMachine({
      types: {
        context: {} as { count: number }
      },
      context: {
        count: 0
      }
    })
  ).start();

  const { count } = $service.context;
  ((_val: number) => {})(count);
  // @ts-expect-error
  ((_val: string) => {})(count);
</script>

<div>$count</div>
