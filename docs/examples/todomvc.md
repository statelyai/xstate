# TodoMVC Examples

:::warning These XState v4 docs are no longer maintained

XState v5 is out now! [Read more about XState v5](https://stately.ai/blog/2023-12-01-xstate-v5) and [check out the XState v5 docs](https://stately.ai/docs/xstate).

:::

Both demos share the same machines.

## TodoMVC with React

- Uses React with [hooks](https://reactjs.org/hooks)
- Two machines:
  - `todosMachine` controls the overall Todos application
  - `todoMachine` controls each individual todo item.

<iframe src="https://codesandbox.io/embed/33wr94qv1" style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;" sandbox="allow-modals allow-forms allow-popups allow-scripts allow-same-origin"></iframe>

## TodoMVC with Vue

- Uses Vue with [Composition API](https://vue-composition-api-rfc.netlify.com/)
- Two machines:
  - `todosMachine` controls the overall Todos application
  - `todoMachine` controls each individual todo item.

<iframe src="https://codesandbox.io/embed/github/davidkpiano/xstate/tree/main/examples/todo-mvc-vue" style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;" sandbox="allow-modals allow-forms allow-popups allow-scripts allow-same-origin"></iframe>
