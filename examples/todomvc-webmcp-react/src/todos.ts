import { createInspector } from '@statelyai/sdk';
import { createMockModelContext } from '@xstate/webmcp';
import { createActor } from 'xstate';
import { todosMachine } from './todosMachine';
import { createTodosWebMCP } from './webmcp';

const inspector = createInspector();

// The actor and its tools live outside React, so they are created and
// registered once, not on every render or component remount.
export const todosActor = createActor(todosMachine, {
  inspect: inspector.inspect
}).start();

export const webMCP = createTodosWebMCP(todosActor);

// Without native WebMCP support, register with an in-page model context so
// the agent panel can call the same tools.
export const modelContext =
  'modelContext' in document ? undefined : createMockModelContext();

const registration = webMCP.register({ modelContext });

// When Vite replaces this module, unregister first so the new module can
// register the same tool names.
import.meta.hot?.dispose(() => registration.unregister());
