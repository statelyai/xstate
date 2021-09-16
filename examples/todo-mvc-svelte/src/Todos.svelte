<script>
  import { tick } from 'svelte';

  import Todo from './Todo.svelte';

  import { todosMachine } from './todos.machine';
  import { useMachine } from '@xstate/svelte';

  const { state, send, service } = useMachine(todosMachine, { devTools: true });
  // service.onTransition((state) => console.log(state));

  $: ({ todo, todos, filter } = $state.context);

  $: numActiveTodos = todos.filter((todo) => !todo.completed).length;
  $: allCompleted = todos.length > 0 && numActiveTodos === 0;
  $: mark = !allCompleted ? 'completed' : 'active';
  $: markEvent = `MARK.${mark}`;
  $: filteredTodos = filterTodos(filter, todos);

  function filterTodos(filter, todos) {
    switch (filter) {
      case 'active':
        return todos.filter((todo) => !todo.completed);
      case 'completed':
        return todos.filter((todo) => todo.completed);
      default:
        return todos;
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Enter') {
      send({ type: 'NEWTODO.COMMIT', value: event.target.value });
    }
  }

  function handleHashchange() {
    send({ type: 'SHOW', filter: window.location.hash.slice(2) || 'all' });
  }

  async function autofocus(node) {
    await tick();
    node.focus();
  }
</script>

<svelte:window on:hashchange={handleHashchange} />

<section class="todoapp" data-state={$state.toStrings()}>
  <header class="header">
    <h1>Todos</h1>
    <input
      class="new-todo"
      type="text"
      placeholder="What needs to be done?"
      on:input={(event) => {
        send({ type: 'NEWTODO.CHANGE', value: event.target.value });
      }}
      on:keydown={handleKeydown}
      value={todo}
      use:autofocus
    />
  </header>
  <section class="main">
    <input
      id="toggle-all"
      class="toggle-all"
      type="checkbox"
      checked={allCompleted}
      on:change={() => send(markEvent)}
    />
    <label for="toggle-all" title="Mark all as {mark}">Mark all as {mark}</label
    >
    <ul class="todo-list">
      {#each filteredTodos as filteredTodo (filteredTodo.id)}
        <Todo actor={filteredTodo.ref} />
      {/each}
    </ul>

    {#if todos.length > 0}
      <footer class="footer">
        <span class="todo-count">
          <strong>
            {numActiveTodos} item{numActiveTodos === 1 ? '' : 's'}
            left
          </strong>
        </span>
        <ul class="filters">
          <li>
            <a href="#/" class:selected={filter === 'all'}>All</a>
          </li>
          <li>
            <a href="#/active" class:selected={filter === 'active'}>Active</a>
          </li>
          <li>
            <a href="#/completed" class:selected={filter === 'completed'}
              >Completed</a
            >
          </li>
        </ul>
        {#if numActiveTodos < todos.length}
          <button
            class="clear-completed"
            on:click={() => send('CLEAR_COMPLETED')}>Clear completed</button
          >
        {/if}
      </footer>
    {/if}
  </section>
</section>
