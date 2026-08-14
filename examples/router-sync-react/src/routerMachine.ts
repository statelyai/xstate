import { setup, types, createCallbackLogic } from 'xstate';

export type RouteName = 'home' | 'about' | 'item' | 'notFound';

export interface RouterContext {
  /** The `:id` segment when the current route is `/items/:id`. */
  itemId: string | null;
  path: string;
}

export const ITEMS = ['alpha', 'beta', 'gamma'];

/** Parse a pathname into a route name plus its parameters. */
export function matchRoute(pathname: string): {
  route: RouteName;
  itemId: string | null;
} {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return { route: 'home', itemId: null };
  }
  if (segments.length === 1 && segments[0] === 'about') {
    return { route: 'about', itemId: null };
  }
  if (segments.length === 2 && segments[0] === 'items') {
    return { route: 'item', itemId: segments[1] };
  }
  return { route: 'notFound', itemId: null };
}

/** The inverse of `matchRoute`: build the pathname a route should live at. */
export function routeToPath(route: RouteName, itemId: string | null): string {
  switch (route) {
    case 'home':
      return '/';
    case 'about':
      return '/about';
    case 'item':
      return `/items/${itemId ?? ''}`;
    case 'notFound':
      return window.location.pathname;
  }
}

/** Side effect: push a new history entry. Enqueued on user-driven navigation. */
export function pushPath(path: string) {
  if (path !== window.location.pathname) {
    window.history.pushState(null, '', path);
  }
}

/**
 * Long-running actor: listens for back/forward navigation and feeds it back
 * into the machine as a `popped` event.
 */
const history = createCallbackLogic({
  schemas: { input: types<{}>() },
  run: ({ sendBack }) => {
    const handler = () => {
      sendBack({ type: 'popped', path: window.location.pathname });
    };

    window.addEventListener('popstate', handler);

    return () => window.removeEventListener('popstate', handler);
  }
});

/** Deep-link hydration: the initial state comes from the current URL. */
const initial = matchRoute(window.location.pathname);

export const routerMachine = setup({
  schemas: {
    context: types<RouterContext>(),
    events: {
      navigate: types<{ route: RouteName; itemId: string | null }>(),
      popped: types<{ path: string }>()
    }
  },
  actors: { history }
}).createMachine({
  id: 'router',
  context: {
    itemId: initial.itemId,
    path: window.location.pathname
  },
  initial: initial.route,
  invoke: { src: history, input: {} },
  on: {
    // The user clicked a link: the machine changes state and the URL follows.
    navigate: ({ event }, enq) => {
      const path = routeToPath(event.route, event.itemId);
      enq(pushPath, path);
      return {
        target: `.${event.route}`,
        context: { itemId: event.itemId, path }
      };
    },
    // The browser changed the URL: the URL leads and the machine follows. No
    // `pushState` here, or back/forward would pile entries onto the stack.
    popped: ({ event }) => {
      const matched = matchRoute(event.path);
      return {
        target: `.${matched.route}`,
        context: { itemId: matched.itemId, path: event.path }
      };
    }
  },
  states: {
    home: {},
    about: {},
    item: {},
    notFound: {}
  }
});
