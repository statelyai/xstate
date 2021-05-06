# Reddit API

_Adapted from the [Redux Docs: Advanced Tutorial](https://redux.js.org/advanced/advanced-tutorial)_

Suppose we wanted to create an app that displays a selected subreddit's posts. The app should be able to:

- Have a predefined list of subreddits that the user can select from
- Load the selected subreddit
- Display the last time the selected subreddit was loaded
- Reload the selected subreddit
- Select a different subreddit at any time

The app logic and state can be modeled with a single app-level machine, as well as invoked child machines for modeling the logic of each individual subreddit. For now, let's start with a single machine.

## Modeling the App

The Reddit app we're creating can be modeled with two top-level states:

- `'idle'` - no subreddit selected yet (the initial state)
- `'selected'` - a subreddit is selected

```js {6-9}
import { createMachine, assign } from 'xstate';

const redditMachine = createMachine({
  id: 'reddit',
  initial: 'idle',
  states: {
    idle: {},
    selected: {}
  }
});
```

We also need somewhere to store the selected `subreddit`, so let's put that in [`context`](../guides/context.md):

```js {6-8}
// ...

const redditMachine = createMachine({
  id: 'reddit',
  initial: 'idle',
  context: {
    subreddit: null // none selected
  },
  states: {
    /* ... */
  }
});
```

Since a subreddit can be selected at any time, we can create a top-level transition for a `'SELECT'` event, which signals that a subreddit was selected by the user. This event will have a payload that has the selected subreddit name in `.name`:

```js
// sample SELECT event
const selectEvent = {
  type: 'SELECT', // event type
  name: 'reactjs' // subreddit name
};
```

This event will be handled at the top-level, so that whenever the `'SELECT'` event occurs, the machine will:

- [transition](../guides/transitions.md) to its child `'.selected'` state (notice the dot, which indicates a [relative target](../guides/ids.md#relative-targets))
- [assign](../guides/context.md#updating-context-with-assign) `event.name` to the `context.subreddit`

```js {10-17}
const redditMachine = createMachine({
  id: 'reddit',
  initial: 'idle',
  context: {
    subreddit: null // none selected
  },
  states: {
    /* ... */
  },
  on: {
    SELECT: {
      target: '.selected',
      actions: assign({
        subreddit: (context, event) => event.name
      })
    }
  }
});
```

## Async Flow

When a subreddit is selected (that is, when the machine is in the `'selected'` state due to a `'SELECT'` event), the machine should start loading the subreddit data. To do this, we [invoke a Promise](../guides/communication.html#invoking-promises) that will resolve with the selected subreddit data:

```js {1-7,14-17}
function invokeFetchSubreddit(context) {
  const { subreddit } = context;

  return fetch(`https://www.reddit.com/r/${subreddit}.json`)
    .then((response) => response.json())
    .then((json) => json.data.children.map((child) => child.data));
}

const redditMachine = createMachine({
  /* ... */
  states: {
    idle: {},
    selected: {
      invoke: {
        id: 'fetch-subreddit',
        src: invokeFetchSubreddit
      }
    }
  },
  on: {
    /* ... */
  }
});
```

<details>
  <summary>Why specify the invoke ID?</summary>

Specifying an `id` on the `invoke` config object allows clearer debugging and visualization, as well as the ability to send events directly to an invoked entity by its `id`.

</details>

When the `'selected'` state is entered, `invokeFetchSubreddit(...)` will be called with the current `context` and `event` (not used here) and start fetching subreddit data from the Reddit API. The promise can then take two special transitions:

- `onDone` - taken when the invoked promise resolves
- `onError` - taken when the invoked promise rejects

This is where it's helpful to have [nested (hierarchical) states](../guides/hierarchical.md). We can make 3 child states that represent when the subreddit is `'loading'`, `'loaded'` or `'failed'` (pick names appropriate to your use-cases):

```js {8-17}
const redditMachine = createMachine({
  /* ... */
  states: {
    idle: {},
    selected: {
      initial: 'loading',
      states: {
        loading: {
          invoke: {
            id: 'fetch-subreddit',
            src: invokeFetchSubreddit,
            onDone: 'loaded',
            onError: 'failed'
          }
        },
        loaded: {},
        failed: {}
      }
    }
  },
  on: {
    /* ... */
  }
});
```

Notice how we moved the `invoke` config to the `'loading'` state. This is useful because if we want to change the app logic in the future to have some sort of `'paused'` or `'canceled'` child state, the invoked promise will automatically be "canceled" since it's no longer in the `'loading'` state where it was invoked.

When the promise resolves, a special `'done.invoke.<invoke ID>'` event will be sent to the machine, containing the resolved data as `event.data`. For convenience, XState maps the `onDone` property within the `invoke` object to this special event. You can assign the resolved data to `context.posts`:

```js {18-20}
const redditMachine = createMachine({
  /* ... */
  context: {
    subreddit: null,
    posts: null
  },
  states: {
    idle: {},
    selected: {
      initial: 'loading',
      states: {
        loading: {
          invoke: {
            id: 'fetch-subreddit',
            src: invokeFetchSubreddit,
            onDone: {
              target: 'loaded',
              actions: assign({
                posts: (context, event) => event.data
              })
            },
            onError: 'failed'
          }
        },
        loaded: {},
        failed: {}
      }
    }
  },
  on: {
    /* ... */
  }
});
```

## Testing It Out

It's a good idea to test that your machine's logic matches the app logic you intended. The most straightforward way to confidently test your app logic is by writing **integration tests**. You can test against a real or mock implementation of your app logic (e.g., using real services, making API calls, etc.), you can [run the logic in an interpreter](../guides/interpretation.md) via `interpret(...)` and write an async test that finishes when the state machine reaches a certain state:

```js
import { interpret } from 'xstate';
import { assert } from 'chai';

import { redditMachine } from '../path/to/redditMachine';

describe('reddit machine (live)', () => {
  it('should load posts of a selected subreddit', (done) => {
    const redditService = interpret(redditMachine)
      .onTransition((state) => {
        // when the state finally reaches 'selected.loaded',
        // the test has succeeded.

        if (state.matches({ selected: 'loaded' })) {
          assert.isNotEmpty(state.context.posts);

          done();
        }
      })
      .start(); // remember to start the service!

    // Test that when the 'SELECT' event is sent, the machine eventually
    // reaches the { selected: 'loaded' } state with posts
    redditService.send('SELECT', { name: 'reactjs' });
  });
});
```

## Implementing the UI

From here, your app logic is self-contained in the `redditMachine` and can be used however you want, in any front-end framework, such as React, Vue, Angular, Svelte, etc.

Here's an example of how it would be [used in React with `@xstate/react`](../packages/xstate-react):

```jsx
import React from 'react';
import { useMachine } from '@xstate/react';
import { redditMachine } from '../path/to/redditMachine';

const subreddits = ['frontend', 'reactjs', 'vuejs'];

const App = () => {
  const [current, send] = useMachine(redditMachine);
  const { subreddit, posts } = current.context;

  return (
    <main>
      <header>
        <select
          onChange={(e) => {
            send('SELECT', { name: e.target.value });
          }}
        >
          {subreddits.map((subreddit) => {
            return <option key={subreddit}>{subreddit}</option>;
          })}
        </select>
      </header>
      <section>
        <h1>{current.matches('idle') ? 'Select a subreddit' : subreddit}</h1>
        {current.matches({ selected: 'loading' }) && <div>Loading...</div>}
        {current.matches({ selected: 'loaded' }) && (
          <ul>
            {posts.map((post) => (
              <li key={post.title}>{post.title}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
};
```

## Splitting Machines

Within the chosen UI framework, components provide natural isolation and encapsulation of logic. We can take advantage of that to organize logic and make smaller, more manageable machines.

Consider two machines:

- A `redditMachine`, which is the app-level machine, responsible for rendering the selected subreddit component
- A `subredditMachine`, which is the machine responsible for loading and displaying its specified subreddit

```js
const createSubredditMachine = (subreddit) => {
  return createMachine({
    id: 'subreddit',
    initial: 'loading',
    context: {
      subreddit, // subreddit name passed in
      posts: null,
      lastUpdated: null
    },
    states: {
      loading: {
        invoke: {
          id: 'fetch-subreddit',
          src: invokeFetchSubreddit,
          onDone: {
            target: 'loaded',
            actions: assign({
              posts: (_, event) => event.data,
              lastUpdated: () => Date.now()
            })
          },
          onError: 'failure'
        }
      },
      loaded: {
        on: {
          REFRESH: 'loading'
        }
      },
      failure: {
        on: {
          RETRY: 'loading'
        }
      }
    }
  });
};
```

Notice how a lot of the logic in the original `redditMachine` was moved to the `subredditMachine`. That allows us to isolate logic to their specific domains and make the `redditMachine` more general, without being concerned with subreddit loading logic:

```js {9}
const redditMachine = createMachine({
  id: 'reddit',
  initial: 'idle',
  context: {
    subreddit: null
  },
  states: {
    idle: {},
    selected: {} // no invocations!
  },
  on: {
    SELECT: {
      target: '.selected',
      actions: assign({
        subreddit: (context, event) => event.name
      })
    }
  }
});
```

Then, in the UI framework (React, in this case), a `<Subreddit>` component can be responsible for displaying the subreddit, using the logic from the created `subredditMachine`:

```jsx
const Subreddit = ({ name }) => {
  // Only create the machine based on the subreddit name once
  const subredditMachine = useMemo(() => {
    return createSubredditMachine(name);
  }, [name]);

  const [current, send] = useMachine(subredditMachine);

  if (current.matches('failure')) {
    return (
      <div>
        Failed to load posts.{' '}
        <button onClick={(_) => send('RETRY')}>Retry?</button>
      </div>
    );
  }

  const { subreddit, posts, lastUpdated } = current.context;

  return (
    <section
      data-machine={subredditMachine.id}
      data-state={current.toStrings().join(' ')}
    >
      {current.matches('loading') && <div>Loading posts...</div>}
      {posts && (
        <>
          <header>
            <h2>{subreddit}</h2>
            <small>
              Last updated: {lastUpdated}{' '}
              <button onClick={(_) => send('REFRESH')}>Refresh</button>
            </small>
          </header>
          <ul>
            {posts.map((post) => {
              return <li key={post.id}>{post.title}</li>;
            })}
          </ul>
        </>
      )}
    </section>
  );
};
```

And the overall app can use that `<Subreddit>` component:

```jsx {8}
const App = () => {
  const [current, send] = useMachine(redditMachine);
  const { subreddit } = current.context;

  return (
    <main>
      <header>{/* ... */}</header>
      {subreddit && <Subreddit name={subreddit} key={subreddit} />}
    </main>
  );
};
```

## Using Actors

The machines we've created work, and fit our basic use-cases. However, suppose we want to support the following use-cases:

- When a subreddit is selected, it should load fully, even if a different one is selected (basic "caching")
- The user should see when a subreddit was last updated, and have the ability to refresh the subreddit.

A good mental model for this is the [Actor model](../guides/actors.md), where each individual subreddit is its own "actor" that controls its own logic based on events, whether internal or external.

## Spawning Subreddit Actors

Recall that an actor is an entity that has its own logic/behavior, and it can receive and send events to other actors.

<mermaid>
  graph TD;
  A("subreddit (reactjs)")
  B("subreddit (vuejs)")
  C("subreddit (frontend)")
  reddit-.->A;
  reddit-.->B;
  reddit-.->C;
</mermaid>

The `context` of the `redditMachine` needs to be modeled to:

- maintain a mapping of subreddits to their spawned actors
- keep track of which subreddit is currently visible

```js {4,5}
const redditMachine = createMachine({
  // ...
  context: {
    subreddits: {},
    subreddit: null
  }
  // ...
});
```

When a subreddit is selected, one of two things can happen:

1. If that subreddit actor already exists in the `context.subreddits` object, `assign()` it as the current `context.subreddit`.
2. Otherwise, `spawn()` a new subreddit actor with subreddit machine behavior from `createSubredditMachine`, assign it as the current `context.subreddit`, and save it in the `context.subreddits` object.

```js
const redditMachine = createMachine({
  // ...
  context: {
    subreddits: {},
    subreddit: null
  },
  // ...
  on: {
    SELECT: {
      target: '.selected',
      actions: assign((context, event) => {
        // Use the existing subreddit actor if one already exists
        let subreddit = context.subreddits[event.name];

        if (subreddit) {
          return {
            ...context,
            subreddit
          };
        }

        // Otherwise, spawn a new subreddit actor and
        // save it in the subreddits object
        subreddit = spawn(createSubredditMachine(event.name));

        return {
          subreddits: {
            ...context.subreddits,
            [event.name]: subreddit
          },
          subreddit
        };
      })
    }
  }
});
```

## Putting It All Together

Now that we have each subreddit encapsulated in its own "live" actor with its own logic and behavior, we can pass these actor references (or "refs") around as data. These actors created from machines are called "services" in XState. Just like any actor, events can be sent to these services, but these services can also be subscribed to. The subscriber will receive the most current state of the service whenever it's updated.

::: tip
In React, change detection is done by reference, and changes to props/state cause rerenders. An actor's reference never changes, but its internal state may change. This makes actors ideal for when top-level state needs to maintain references to spawned actors, but should _not_ rerender when a spawned actor changes (unless explicitly told to do so via an event sent to the parent).

In other words, spawned child actors updating will _not_ cause unnecessary rerenders. 🎉
:::

```jsx
// ./Subreddit.jsx

const Subreddit = ({ service }) => {
  const [current, send] = useService(service);

  // ... same code as previous Subreddit component
};
```

```jsx
// ./App.jsx

const App = () => {
  const [current, send] = useMachine(redditMachine);
  const { subreddit } = current.context;

  return (
    <main>
      {/* ... */}
      {subreddit && <Subreddit service={subreddit} key={subreddit.id} />}
    </main>
  );
};
```

The differences between using the actor model above and just using machines with a component hierarchy (e.g., with React) are:

- The data flow and logic hierarchy live in the XState services, not in the components. This is important when the subreddit needs to continue loading, even when its `<Subreddit>` component may be unmounted.
- The UI framework layer (e.g., React) becomes a plain view layer; logic and side-effects are not tied directly to the UI, except where it is appropriate.
- The `redditMachine` → `subredditMachine` actor hierarchy is "self-sustaining", and allows for the logic to be transferred to any UI framework, or even no framework at all!

## React Demo

<iframe src="https://codesandbox.io/embed/xstate-react-reddit-example-with-actors-5g9nu?fontsize=14" title="XState React Reddit Example with Actors" allow="geolocation; microphone; camera; midi; vr; accelerometer; gyroscope; payment; ambient-light-sensor; encrypted-media; usb" style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;" sandbox="allow-modals allow-forms allow-popups allow-scripts allow-same-origin"></iframe>

## Vue Demo

Unsurprisingly, the same machines can be used in a Vue app that exhibits the exact same behavior (thanks to [Chris Hannaby](https://github.com/chrishannaby)):

<iframe
  src="https://codesandbox.io/embed/xstate-vue-reddit-example-with-actors-uvu14?fontsize=14"
  style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;"
  title="XState Vue Reddit Example with Actors"
  allow="geolocation; microphone; camera; midi; vr; accelerometer; gyroscope; payment; ambient-light-sensor; encrypted-media; usb"
  sandbox="allow-modals allow-forms allow-popups allow-scripts allow-same-origin"
></iframe>
