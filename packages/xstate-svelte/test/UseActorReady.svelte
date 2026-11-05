<script lang="ts">
  import type { AnyActor } from 'xstate';
  import { useActor } from '../src/index.ts';

  export let actor: AnyActor;
  export let onActorRef: (actorRef: AnyActor) => void = () => {};

  const { snapshot, actorRef } = useActor(actor);
  onActorRef(actorRef);
</script>

<div data-testid="value">{$snapshot.value}</div>
