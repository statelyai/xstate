# Reddit API

_本文由 [Redux Docs: Advanced Tutorial](https://redux.js.org/advanced/advanced-tutorial) 修改而来_

假设我们要写一个 App 来展示 reddit 帖子, 它的主要功能:

- 包含一个可供用户选择的预定义的帖子列表
- 加载已选帖子
- 展示上一次帖子加载的时间
- 重新加载已选的帖子
- 随时可以切换不同的帖子

App 的逻辑、状态可以被建模为单应用层状态机, 也可以为每个 subreddit 逻辑建模调用子状态机. 现在, 让我们从单一的状态机开始.

## 为App建模

我们可以为 Reddit App 创建2个顶级的状态:

- `'idle'` - 还没有 subreddit 被选中 (初始状态)
- `'selected'` - 选择了一个 subreddit 

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

我们需要一个地方来存储 `subreddit`, 我们可以把它放到 [`context`](../guides/context.md) 中:

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

因为用户每次次只能选中一个 subreddit, 我们可以为 `'SELECT'` 事件创建一个顶层 `'transition'` .
这个事件包含一个 `.name` 的荷载用来存放被选中的 subreddit 的名字:

```js
// sample SELECT event
const selectEvent = {
  type: 'SELECT', // event type
  name: 'reactjs' // subreddit name
};
```

事件会在顶层被处理. 所以, 无论什么时候触发 `'SELECT'` 状态机都会:

- 过渡 [transition](../guides/transitions.md) 到子状态 `'.selected'` (注意 select 前面的点儿, 它代表一个关联目标 [relative target](../guides/ids.md#relative-targets))
- 指派 [assign](../guides/context.md#updating-context-with-assign) `event.name` 给 `context.subreddit`

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

## 异步流

当 subreddit 被选中后 (也就是触发 `'SELECT'` 事件, 状态机处于 `'selected'` 选中状态时), 状态机开始加载 subreddit 数据. 为了实现这个, 我们通过 [invoke a Promise](../guides/communication.html#invoking-promises) 来 resolve 加载选中 subreddit 的数据:

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
  <summary>为什么要设置 invoke ID ?</summary>

为 `invoke` 配置对象配置一个 `id` 可以让调试和可视化更清晰,也可以通过发送这个`id`直接触发它的实体.

</details>

进入到 `'selected'` 状态后, `invokeFetchSubreddit(...)` 调用时会以 `context` 和 `event`(此处没用到) 作为上下文环境, 并开始从 Reddit API 拉取 subreddit 数据. 此处调用 promise 可以触发两次过渡:

- `onDone` - 当 Promise 的结果为 resolves 时触发
- `onError` - 当 Promise 的结果为 rejects 时触发

这也是嵌套状态 [nested (hierarchical) states](../guides/hierarchical.md) 的有用之处. 我们可以创建三个子状态,分别表示 `'loading'`, `'loaded'` or `'failed'` 三种不同情况(也可选择适合的用例名称):

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

注意我们是如何把 `invoke` 配置放到 `'loading'` 状态的. 这很有用,因为以后如果想改 app 逻辑为 `'paused'` 或者 `'canceled'` 子状态,触发后的 Promise 就会自动被 "canceled" 掉,因为它一旦触发后就不在`'loading'` 状态了.

当 Promise 被 resolves 时, 一个特殊的 `'done.invoke.<invoke ID>'` 事件会被发送给状态机, 同时包含被 resolved 的数据 `event.data`.方便起见, XState会把 `invoke` 对象中的 `onDone` 属性跟该事件映射. 你可以在里面将 resolved 后的赋值给 `context.posts`:

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

## 测试

可以测试一下状态机的逻辑是否和你的程序逻辑是否一致. 最直接的测试程序逻辑的办法是编写**集成测试**(**integration tests**). 你可以直接测试或者用mock的方式测试你的程序逻辑(e.g., using real services, making API calls, etc.), 你也可以通过 `interpret(...)` [run the logic in an interpreter](../guides/interpretation.md) 编写异步测试来验证状态机是否达到预期的状态:

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

## 实现UI

现在, 你的 app 逻辑独立存在 `redditMachine` 文件中, 它可以被独立使用,也可以在任何框架中被引入, 如: React, Vue, Angular, Svelte 等等.

下面有一个 React [used in React with `@xstate/react`](../packages/xstate-react) 的例子:

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

## 拆分状态机

选择一个UI框架后, 组件提供了自然的隔离和逻辑的封装. 我们可以利用这一点去组织逻辑, 可以创建更小、更利用管理的状态机.

探讨两种状态机:

- `redditMachine` 应用级状态机, 用来渲染已选 subreddit 组件
- `subredditMachine` 用来负责加载和显示某个 subreddit 的状态机

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

注意: 原先的一些组织在 `redditMachine` 的逻辑被迁移到了 `subredditMachine`. 这样我们可以根据领域去拆分逻辑, 让 `redditMachine` 更通用, 无需考虑 subreddit 的加载逻辑:

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

接着, 在 UI 框架中(这里指React), `<Subreddit>` 组件负责展示 subreddit , 逻辑放在 `subredditMachine`:

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

在 app 中可以使用 `<Subreddit>` 组件:

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

## 使用 Actors

这个状态机可以用了, 符合我们的基本使用情况. 但是我们希望支持更多的功能:

- 当选中一个 subreddit 后, 它必须被完全加载, 无论它之前是否被选中过(通过缓存)
- 用户可以看到 subreddit 的更新时间, 也可以刷新 subreddit .

[Actor model](../guides/actors.md) 是一个不错的心智模型, 让每一个被拆分的 subreddit 都有它自己的基于事件控制内外逻辑的 "actor".

## 调用 subreddit 的 Actors

回顾一下, actor 是一个拥有逻辑/行为(logic/behavior)的实体, 它可以对其它 actors 接收和发送事件.

<mermaid>
  graph TD;
  A("subreddit (reactjs)")
  B("subreddit (vuejs)")
  C("subreddit (frontend)")
  reddit-.->A;
  reddit-.->B;
  reddit-.->C;
</mermaid>

`redditMachine` 的 `context` 需要这样设计:

- 维护一个 subreddit 和 actors 的映射
- 记录当前可见的 subreddit 

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

当选择一个 subreddit 时,会触发如下事件中的一个:

1. 如果 `context.subreddits` 对象中已存在某个 subreddit  actor, 就调用 `assign()` 赋值给当前 `context.subreddit`
2. 调用 `spawn()`,从 `createSubredditMachine` 发出一个新的 subreddit 行为, 并把它指派给当前 `context.subreddit`、存储在 `context.subreddits` 对象中.

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

## 综合一起

现在, 每个 subreddit 的的逻辑和行为都被封装在它自己的 actor 中了, 我们可以把这些 actor 引用 (or "refs") 作为数据传递.状态机创建的 actors 在 XState 中被称做服务(services). 就像 actor 一样,事件可以被发送给这些 services, 而这些 services 也可以被订阅.每当服务更新时,订阅者会接收当前服务 (services) 的状态.

::: tip
在 React 中,变化检测是由引用(references)变化来完成的, props/state 的变化会导致重新渲染.actor 的 引用 永远不会变化,但它内部的状态也许会改变.这使得顶级状态需要维护 referneces 来触发 actors 时,actors 就成为了一个理想的选择,但是不应该通过触发改变 actor 来重新渲染（除非通过发送给父级的事件明确要求这样做）

换句话说,已触发的子 actors 变化不应造成不必要的渲染. 🎉
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

使用 actor 模型,和仅在组件层级使用状态机（比如 React）的区别有:

- 数据流和逻辑层应在 XState 服务中,而不是组件中. 这点很重要,特别当 subreddit 需要继续加载时,无论  `<Subreddit>` 组件是否被卸载时.
- UI框架（比如 React）成为一个纯粹的视图层; 非必要时, 逻辑和副作用不应直接绑定到UI层. 
- `redditMachine` → `subredditMachine` 是 "self-sustaining" 的, 同时可以传递逻辑给任何 UI 框架,甚至没框架也行.

## React Demo

<iframe src="https://codesandbox.io/embed/xstate-react-reddit-example-with-actors-5g9nu?fontsize=14" title="XState React Reddit Example with Actors" allow="geolocation; microphone; camera; midi; vr; accelerometer; gyroscope; payment; ambient-light-sensor; encrypted-media; usb" style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;" sandbox="allow-modals allow-forms allow-popups allow-scripts allow-same-origin"></iframe>

## Vue Demo

Unsurprisingly, the same machines can be used in a Vue app that exhibits the exact same behavior (thanks to [Chris Hannaby](https://github.com/chrishannaby)):

毫不例外, 同样的状态机也可以用在 Vue 应用中,用以展示同样的行为, 感谢 ([Chris Hannaby](https://github.com/chrishannaby)):

<iframe
  src="https://codesandbox.io/embed/xstate-vue-reddit-example-with-actors-uvu14?fontsize=14"
  style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;"
  title="XState Vue Reddit Example with Actors"
  allow="geolocation; microphone; camera; midi; vr; accelerometer; gyroscope; payment; ambient-light-sensor; encrypted-media; usb"
  sandbox="allow-modals allow-forms allow-popups allow-scripts allow-same-origin"
></iframe>
