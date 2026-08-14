import { Todos } from './Todos';
import { createActorContext } from '@xstate/react';
import { todosMachine } from './todosMachine';

const persistedSnapshot = JSON.parse(localStorage.getItem('todos') || 'null');

export const TodosContext = createActorContext(todosMachine, {
  snapshot: persistedSnapshot ?? undefined
});

function App() {
  return (
    <TodosContext.Provider>
      <Todos />

      <footer className="info">
        <p>Double-click to edit a todo</p>
        <p>
          Template by <a href="http://sindresorhus.com">Sindre Sorhus</a>
        </p>
        <p>
          Created by <a href="http://todomvc.com">you</a>
        </p>
        <p>
          Part of <a href="http://todomvc.com">TodoMVC</a>
        </p>
      </footer>
    </TodosContext.Provider>
  );
}

export default App;
