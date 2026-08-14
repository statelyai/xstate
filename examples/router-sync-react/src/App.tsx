import { useActor } from '@xstate/react';
import { ITEMS, routerMachine, type RouteName } from './routerMachine';

export default function App() {
  const [state, send] = useActor(routerMachine);
  const { itemId, path } = state.context;

  function link(label: string, route: RouteName, id: string | null = null) {
    return (
      <button
        type="button"
        onClick={() => send({ type: 'navigate', route, itemId: id })}
      >
        {label}
      </button>
    );
  }

  return (
    <main>
      <h1>Router sync</h1>

      <nav>
        {link('Home', 'home')}
        {link('About', 'about')}
        {ITEMS.map((id) => (
          <span key={id}>{link(id, 'item', id)}</span>
        ))}
      </nav>

      {state.matches('home') && <p>Pick an item, or read the about page.</p>}

      {state.matches('about') && (
        <p>
          The machine state is the route. Navigation buttons send events; the
          browser's back and forward buttons send <code>popped</code> events.
        </p>
      )}

      {state.matches('item') && (
        <>
          <h2>Item: {itemId}</h2>
          <p className="hint">
            Reload this page — the machine starts in this state because it reads{' '}
            <code>window.location.pathname</code> at creation.
          </p>
        </>
      )}

      {state.matches('notFound') && <p className="error">No such route.</p>}

      <p className="token">
        state <code>{String(state.value)}</code> · url <code>{path}</code>
      </p>
      <p className="hint">
        Use the browser's back and forward buttons — the machine follows them.
      </p>
    </main>
  );
}
