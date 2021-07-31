<script>
  import { tick } from 'svelte';

  export let actor = null;

  const { send } = actor;
  $: ({ id, title, completed } = $actor.context);

  $: $actor.actions && select();

  let inputNode = null;
  async function select() {
    if (
      inputNode &&
      $actor.actions.find((action) => action.type === 'focusInput')
    ) {
      await tick();
      inputNode.select();
    }
  }

  function handleKeydown(event) {
    switch (event.key) {
      case 'Enter':
        send('COMMIT');
        break;
      case 'Escape':
        send('CANCEL');
        break;
    }
  }
</script>

<li
  class="todo"
  class:editing={$actor.matches('editing')}
  class:completed
  data-todo-state={completed ? 'completed' : 'active'}
>
  <div class="view">
    <input
      class="toggle"
      type="checkbox"
      on:change={() => send('TOGGLE_COMPLETE')}
      checked={completed}
    />
    <label for="edit-{id}" on:dblclick={() => send('EDIT')}>{title}</label>
    <button class="destroy" on:click={() => send('DELETE')} />
  </div>

  <input
    id="edit-{id}"
    class="edit"
    type="text"
    value={title}
    on:blur={() => send('BLUR')}
    on:input={(event) => send({ type: 'CHANGE', value: event.target.value })}
    on:keydown={handleKeydown}
    bind:this={inputNode}
  />
</li>
