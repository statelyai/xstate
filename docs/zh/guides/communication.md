# 调用 Services

[:rocket: 快速参考](#快速参考)

在一台状态机上表达整个应用程序的行为很快就会变得复杂和笨拙。 使用多个相互通信的状态机来表达复杂的逻辑是很自然的（并且受到鼓励！）。 这非常类似于 [演员（Actor）](https://www.brianstorti.com/the-actor-model/)，其中每个状态机实例都被视为一个“演员”，可以向其他“演员”（例如 Promise 或其他状态机）发送和接收事件（消息）并对其做出响应 .

为了让状态机相互通信，父状态机**调用**子状态机并通过监听子状态机`sendParent(...)`发送的事件，或者等待子状态机到达其[最终状态 ](./final.md)，这将导致进行`onDone`转换。

你可以调用：

- [Promises](#invoking-promises), 这将在 `resolve` 上采用 `onDone` 转换，或者在 `reject` 上采用 `onError` 转换
- [Callbacks](#invoking-callbacks), 它可以向父状态机发送事件和从父状态机接收事件
- [Observables](#invoking-observables), 它可以向父状态机发送事件，以及完成时的信号
- [Machines](#invoking-machines), 它还可以发送/接收事件，并在达到[最终状态](./final.md)时通知父状态机

## `invoke` 属性

调用是在状态节点的配置中使用 `invoke` 属性定义的，其值是一个包含以下内容的对象：

- `src` - 要调用的服务的来源，可以是：
  - 状态机
  - 一个返回 `Promise` 的函数
  - 一个返回“回调处理程序”的函数
  - 返回可观察的函数
  - 一个字符串，它指的是在这台状态机的 `options.services` 中定义的 4 个列出的选项中的任何一个
  - 一个调用源对象 <Badge text="4.12" />，它包含 `{ type: src }` 中的源字符串，以及任何其他元数据。
- `id` - 被调用服务的唯一标识符
- `onDone` - （可选）在以下情况下采用的 [转换](./transitions.md)：
  - 子状态机达到其 [最终状态](./final.md)，或
  - 调用的 Promise 的 resolve，或
  - 被调用的 observable 完成
- `onError` - （可选）当被调用的服务遇到执行错误时要进行的转换。
- `autoForward` - （可选）`true` 如果发送到这台状态机的所有事件也应该发送（或 _forwarded_）到被调用的子节点（默认情况下为 `false`）
  - ⚠️ 避免将 `autoForward` 设置为 `true`，因为盲目转发所有事件可能会导致意外行为和/或无限循环。 总是更喜欢显式发送事件，和/或使用 `forward(...)` 动作创建者直接将事件转发给被调用的孩子。 （目前仅适用于状态机！⚠️）
- `data` - （可选，仅在调用状态机时使用）将子状态机的 [context](./context.md) 的属性映射到从父状态机的 `context` 返回相应值的函数的对象。

::: warning
不要将状态的 `onDone` 属性与 `invoke.onDone` 混淆——它们是类似的转换，它们指的是不同的东西。

- [状态节点](./statenodes.md) 上的`onDone` 属性指的是复合状态节点到达[最终状态](./final.md)。
- `invoke.onDone` 属性指的是正在完成的调用 (`invoke.src`)。

```js {5,13}
// ...
loading: {
  invoke: {
    src: someSrc,
    onDone: {/* ... */} // 指的是 `someSrc` 正在完成
  },
  initial: 'loadFoo',
  states: {
    loadFoo: {/* ... */},
    loadBar: {/* ... */},
    loadingComplete: { type: 'final' }
  },
  onDone: 'loaded' // 指的是达到“loading.loadingComplete”
}
// ...
```

:::

## 调用 Promises

由于每个 Promise 都可以建模为状态机，因此 XState 可以按原样调用 Promise。 Promise 可以：

- `resolve()`, 这将采取`onDone`转换
- `reject()` （或抛出错误），这将采用 `onError` 转换

如果在 Promise resolve 之前，退出被调用的 Promise 处于活动状态的状态，则 Promise 的结果将被丢弃。

```js
// Function 返回 promise
// 这个 promise 可能会 resolve，例如，
// { name: 'David', location: 'Florida' }
const fetchUser = (userId) =>
  fetch(`url/to/user/${userId}`).then((response) => response.json());

const userMachine = createMachine({
  id: 'user',
  initial: 'idle',
  context: {
    userId: 42,
    user: undefined,
    error: undefined
  },
  states: {
    idle: {
      on: {
        FETCH: { target: 'loading' }
      }
    },
    loading: {
      invoke: {
        id: 'getUser',
        src: (context, event) => fetchUser(context.userId),
        onDone: {
          target: 'success',
          actions: assign({ user: (context, event) => event.data })
        },
        onError: {
          target: 'failure',
          actions: assign({ error: (context, event) => event.data })
        }
      }
    },
    success: {},
    failure: {
      on: {
        RETRY: { target: 'loading' }
      }
    }
  }
});
```

解析后的数据被放置在一个 `'xstate.done.actor.<id>'` 事件中，在 `data` 属性下，例如：

```js
{
  type: 'xstate.done.actor.getUser',
  data: {
    name: 'David',
    location: 'Florida'
  }
}
```

### Promise Rejection

如果 Promise 拒绝，则将使用 `{ type: 'xstate.error.actor' }` 事件进行 `onError` 转换。 错误数据在事件的 `data` 属性中可用：

```js
const search = (context, event) =>
  new Promise((resolve, reject) => {
    if (!event.query.length) {
      return reject('No query specified');
      // or:
      // throw new Error('No query specified');
    }

    return resolve(getSearchResults(event.query));
  });

// ...
const searchMachine = createMachine({
  id: 'search',
  initial: 'idle',
  context: {
    results: undefined,
    errorMessage: undefined
  },
  states: {
    idle: {
      on: {
        SEARCH: { target: 'searching' }
      }
    },
    searching: {
      invoke: {
        id: 'search',
        src: search,
        onError: {
          target: 'failure',
          actions: assign({
            errorMessage: (context, event) => {
              // event is:
              // { type: 'xstate.error.actor', data: 'No query specified' }
              return event.data;
            }
          })
        },
        onDone: {
          target: 'success',
          actions: assign({ results: (_, event) => event.data })
        }
      }
    },
    success: {},
    failure: {}
  }
});
```

::: warning

如果缺少 `onError` 转换并且 Promise 被拒绝，则错误将被忽略，除非你为状态机指定了 [严格模式](./machines.md#configuration)。 在这种情况下，严格模式将停止状态机并抛出错误。

:::

## 调用 Callbacks

发送到父状态机的事件流可以通过回调处理程序建模，这是一个接受两个参数的函数：

- `callback` - 使用要发送的事件调用
- `onReceive` - 使用 [监听来自父级的事件](#listening-to-parent-events) 的监听器调用

返回值（可选）应该是在退出当前状态时，对调用的服务执行清理（即取消订阅、防止内存泄漏等）的函数。 回调 **不能** 使用 `async/await` 语法，因为它会自动将返回值包装在 `Promise` 中。

```js
// ...
counting: {
  invoke: {
    id: 'incInterval',
    src: (context, event) => (callback, onReceive) => {
      // 这将每秒向父级发送 'INC' 事件
      const id = setInterval(() => callback('INC'), 1000);

      // 执行清理
      return () => clearInterval(id);
    }
  },
  on: {
    INC: { actions: assign({ counter: context => context.counter + 1 }) }
  }
}
// ...
```

### 收听父级事件

被调用的回调处理程序还被赋予了第二个参数 `onReceive`，它为从父级发送到回调处理程序的事件注册监听器。 这允许在父状态机和调用的回调服务之间进行父子通信。

例如，父状态机向子 `'ponger'` 服务发送 `'PING'` 事件。 子服务可以使用 `onReceive(listener)` 监听该事件，并将一个 `'PONG'` 事件发送回父级作为响应：

```js
const pingPongMachine = createMachine({
  id: 'pinger',
  initial: 'active',
  states: {
    active: {
      invoke: {
        id: 'ponger',
        src: (context, event) => (callback, onReceive) => {
          // 每当父级发送“PING”时，
          // 发送父'PONG'事件
          onReceive((e) => {
            if (e.type === 'PING') {
              callback('PONG');
            }
          });
        }
      },
      entry: send({ type: 'PING' }, { to: 'ponger' }),
      on: {
        PONG: { target: 'done' }
      }
    },
    done: {
      type: 'final'
    }
  }
});
const actor = interpret(pingPongMachine);
actor.subscribe({ complete: () => done() });
actor.start();
```

## 调用 Observables <Badge text="4.6"/>

[Observables](https://github.com/tc39/proposal-observable) 是随时间发出的值流。 将它们视为一个数组/集合，其值是异步发出的，而不是一次发出。 JavaScript 中有许多 observable 的实现； 最受欢迎的是 [RxJS](https://github.com/ReactiveX/rxjs)。

可以调用 Observables，它应该向父状态机发送事件（字符串或对象），但不接收事件（单向）。 一个 observable 调用是一个函数，它以 `context` 和 `event` 作为参数并返回一个可观察的事件流。 当退出调用它的状态时，observable 被取消订阅。

```js
import { createMachine, interpret } from 'xstate';
import { interval } from 'rxjs';
import { map, take } from 'rxjs/operators';

const intervalMachine = createMachine({
  id: 'interval',
  initial: 'counting',
  context: { myInterval: 1000 },
  states: {
    counting: {
      invoke: {
        src: (context, event) =>
          interval(context.myInterval).pipe(
            map((value) => ({ type: 'COUNT', value })),
            take(5)
          ),
        onDone: 'finished'
      },
      on: {
        COUNT: { actions: 'notifyCount' },
        CANCEL: { target: 'finished' }
      }
    },
    finished: {
      type: 'final'
    }
  }
});
```

上面的`intervalMachine` 将接收来自`interval(...)` 映射到事件对象的事件，直到可观察对象“完成”（完成发射值）。 如果 `"CANCEL"` 事件发生，observable 将被处理（`.unsubscribe()` 将在内部调用）。

::: tip
不一定需要为每次调用都创建 Observable。 可以改为引用“热可观察”：

```js
import { fromEvent } from 'rxjs';

const mouseMove$ = fromEvent(document.body, 'mousemove');

const mouseMachine = createMachine({
  id: 'mouse',
  // ...
  invoke: {
    src: (context, event) => mouseMove$
  },
  on: {
    mousemove: {
      /* ... */
    }
  }
});
```

:::

## 调用 Machines

状态机分层通信，被调用的状态机可以通信：

- 通过`send(EVENT, { to: 'someChildId' })` 动作实现父到子
- 通过 `sendParent(EVENT)` 操作实现子级到父级。

如果退出调用状态机的状态，则状态机停止。

```js
import { createMachine, interpret, send, sendParent } from 'xstate';

// 调用子状态机
const minuteMachine = createMachine({
  id: 'timer',
  initial: 'active',
  states: {
    active: {
      after: {
        60000: { target: 'finished' }
      }
    },
    finished: { type: 'final' }
  }
});

const parentMachine = createMachine({
  id: 'parent',
  initial: 'pending',
  states: {
    pending: {
      invoke: {
        src: minuteMachine,
        // 当 minuteMachine 达到其顶级最终状态时，将进行 onDone 转换。
        onDone: 'timesUp'
      }
    },
    timesUp: {
      type: 'final'
    }
  }
});

const service = interpret(parentMachine)
  .onTransition((state) => console.log(state.value))
  .start();
// => 'pending'
// ... after 1 minute
// => 'timesUp'
```

### 使用 Context 调用

子状态机可以使用从父状态机的 `context` 和 `data` 属性派生的 `context` 调用。 例如，下面的`parentMachine` 将调用一个新的`timerMachine` 服务，初始上下文为`{duration: 3000 }`：

```js
const timerMachine = createMachine({
  id: 'timer',
  context: {
    duration: 1000 // 默认 duration
  }
  /* ... */
});

const parentMachine = createMachine({
  id: 'parent',
  initial: 'active',
  context: {
    customDuration: 3000
  },
  states: {
    active: {
      invoke: {
        id: 'timer',
        src: timerMachine,
        // 从父上下文 派生子上下文
        data: {
          duration: (context, event) => context.customDuration
        }
      }
    }
  }
});
```

就像 [`assign(...)`](./context.md) 一样，子上下文可以映射为对象（首选）或函数：

```js
// 对象（每个属性）：
data: {
  duration: (context, event) => context.customDuration,
  foo: (context, event) => event.value,
  bar: 'static value'
}

// 函数（聚合），相当于上面的：
data: (context, event) => ({
  duration: context.customDuration,
  foo: event.value,
  bar: 'static value'
})
```

::: warning
`data` _替换_ 状态机上定义的默认`context`； 它没有合并。 此行为将在下一个主要版本中更改。
:::

### 完成数据

当子状态机到达其顶级[最终状态](./final.md)时，它可以在“done”事件中发送数据（例如，`{ type: 'xstate.done.actor.someId', data: .. .}`）。 这个“完成的数据”是在最终状态的`data`属性上指定的：

```js
const secretMachine = createMachine({
  id: 'secret',
  initial: 'wait',
  context: {
    secret: '42'
  },
  states: {
    wait: {
      after: {
        1000: { target: 'reveal' }
      }
    },
    reveal: {
      type: 'final',
      data: {
        secret: (context, event) => context.secret
      }
    }
  }
});

const parentMachine = createMachine({
  id: 'parent',
  initial: 'pending',
  context: {
    revealedSecret: undefined
  },
  states: {
    pending: {
      invoke: {
        id: 'secret',
        src: secretMachine,
        onDone: {
          target: 'success',
          actions: assign({
            revealedSecret: (context, event) => {
              // event is:
              // { type: 'xstate.done.actor.secret', data: { secret: '42' } }
              return event.data.secret;
            }
          })
        }
      }
    },
    success: {
      type: 'final'
    }
  }
});

const service = interpret(parentMachine)
  .onTransition((state) => console.log(state.context))
  .start();
// => { revealedSecret: undefined }
// ...
// => { revealedSecret: '42' }
```

### 发送事件

- 要从 **子** 状态机发送到 **父** 状态机，请使用 `sendParent(event)`（采用与 `send(...)` 相同的参数）
- 要从 **父** 状态机发送到 **子** 状态机，请使用 `send(event, { to: <child ID> })`

::: warning
`send(...)` 和 `sendParent(...)` 动作 创建者 _不是_ 命令式向状态机发送事件。 它们是返回动作对象的纯函数
描述要发送的内容，例如，`{ type: 'xstate.send', event: ... }`。 [解释（interpret）](./interpretation.md) 将读取这些对象，然后发送它们。

[阅读有关`send`的更多信息](/guides/actions.html#send-action)
:::

下面是两台状态机 `pingMachine` 和 `pongMachine` 相互通信的例子：

```js
import { createMachine, interpret, send, sendParent } from 'xstate';

// 父状态机
const pingMachine = createMachine({
  id: 'ping',
  initial: 'active',
  states: {
    active: {
      invoke: {
        id: 'pong',
        src: pongMachine
      },
      // 将“PING”事件发送到 ID 为“pong”的子状态机
      entry: send({ type: 'PING' }, { to: 'pong' }),
      on: {
        PONG: {
          actions: send({ type: 'PING' }, { to: 'pong', delay: 1000 })
        }
      }
    }
  }
});

// 调用子状态机
const pongMachine = createMachine({
  id: 'pong',
  initial: 'active',
  states: {
    active: {
      on: {
        PING: {
          // 向父状态机发送“PONG”事件
          actions: sendParent(
            { type: 'PONG' },
            {
              delay: 1000
            }
          )
        }
      }
    }
  }
});

const service = interpret(pingMachine).start();

// => 'ping'
// ...
// => 'pong'
// ..
// => 'ping'
// ...
// => 'pong'
// ...
```

## 发送响应 <Badge text="4.7+" />

被调用的服务（或 [创建的 演员](./actors.md)）可以 _响应_ 另一个 服务/演员； 即，它可以发送事件 _响应_ 另一个 服务/演员 发送的事件。 这是通过 `respond(...)` 动作 创建者完成的。

例如，下面的 `'client'` 状态机将 `'CODE'` 事件发送到调用的 `'auth-server'` 服务，然后在 1 秒后响应 `'TOKEN'` 事件。

```js
import { createMachine, send, actions } from 'xstate';

const { respond } = actions;

const authServerMachine = createMachine({
  id: 'server',
  initial: 'waitingForCode',
  states: {
    waitingForCode: {
      on: {
        CODE: {
          actions: respond('TOKEN', { delay: 1000 })
        }
      }
    }
  }
});

const authClientMachine = createMachine({
  id: 'client',
  initial: 'idle',
  states: {
    idle: {
      on: {
        AUTH: { target: 'authorizing' }
      }
    },
    authorizing: {
      invoke: {
        id: 'auth-server',
        src: authServerMachine
      },
      entry: send({ type: 'CODE' }, { to: 'auth-server' }),
      on: {
        TOKEN: { target: 'authorized' }
      }
    },
    authorized: {
      type: 'final'
    }
  }
});
```

这个特定的例子可以使用 `sendParent(...)` 来达到同样的效果； 不同之处在于 `respond(...)` 会将一个事件发送回接收到的事件的来源，它可能不一定是父状态机。

## 多服务

你可以通过在数组中指定每个服务来调用多个服务：

```js
// ...
invoke: [
  { id: 'service1', src: 'someService' },
  { id: 'service2', src: 'someService' },
  { id: 'logService', src: 'logService' }
],
// ...
```

每次调用都会创建该服务的 _新_ 实例，因此即使多个服务的 `src` 相同（例如，上面的 `'someService'`），也会调用多个 `'someService'` 的实例。

## 配置服务

调用源（服务）的配置方式类似于动作、守卫等的配置方式，通过将 `src` 指定为字符串并在 Machine 选项的 `services` 属性中定义它们：

```js
const fetchUser = // (和上面例子相同)

const userMachine = createMachine(
  {
    id: 'user',
    // ...
    states: {
      // ...
      loading: {
        invoke: {
          src: 'getUser',
          // ...
        }
      },
      // ...
    }
  },
  {
  services: {
    getUser: (context, event) => fetchUser(context.user.id)
  }
);
```

调用 `src` 也可以指定为一个对象 <Badge text="4.12" />，它用它的 `type` 和其他相关的元数据来描述调用源。 这可以从 `meta.src` 参数中的 `services` 选项中读取：

```js
const machine = createMachine(
  {
    initial: 'searching',
    states: {
      searching: {
        invoke: {
          src: {
            type: 'search',
            endpoint: 'example.com'
          }
          // ...
        }
        // ...
      }
    }
  },
  {
    services: {
      search: (context, event, { src }) => {
        console.log(src);
        // => { endpoint: 'example.com' }
      }
    }
  }
);
```

## 测试

通过将服务指定为上面的字符串，可以通过使用 `.withConfig()` 指定替代实现来完成“模拟”服务：

```js
import { interpret } from 'xstate';
import { assert } from 'chai';
import { userMachine } from '../path/to/userMachine';

const mockFetchUser = async (userId) => {
  // 模拟任何你想要的，但确保使用相同的行为和响应格式
  return { name: 'Test', location: 'Anywhere' };
};

const testUserMachine = userMachine.withConfig({
  services: {
    getUser: (context, event) => mockFetchUser(context.id)
  }
});

describe('userMachine', () => {
  it('should go to the "success" state when a user is found', (done) => {
    interpret(testUserMachine)
      .onTransition((state) => {
        if (state.matches('success')) {
          assert.deepEqual(state.context.user, {
            name: 'Test',
            location: 'Anywhere'
          });

          done();
        }
      })
      .start();
  });
});
```

## 引用服务 <Badge text="4.7+" />

服务（和 [演员](./actors.md)，它们是衍生的服务）可以从 `.children` 属性直接在 [状态对象](./states.md) 上引用。 `state.children` 对象是服务 ID（键）到这些服务实例（值）的映射：

```js
const machine = createMachine({
  // ...
  invoke: [
    { id: 'notifier', src: createNotifier },
    { id: 'logger', src: createLogger }
  ]
  // ...
});

const service = interpret(machine)
  .onTransition((state) => {
    state.children.notifier; // 来自 createNotifier() 的服务
    state.children.logger; // 来自 createLogger() 的服务
  })
  .start();
```

当 JSON 序列化时，`state.children` 对象是服务 ID（键）到包含有关该服务的元数据的对象的映射。

## 快速参考

**`invoke` 属性**

```js
const machine = createMachine({
  // ...
  states: {
    someState: {
      invoke: {
        // `src` 属性可以是：
        // - a string
        // - a machine
        // - a function that returns...
        src: (context, event) => {
          // - a promise
          // - a callback handler
          // - an observable
        },
        id: 'some-id',
        //（可选）将状态机事件转发到被调用的服务（目前仅适用于状态机！）
        autoForward: true,
        //（可选）调用的promise/observable/machine完成时的转换
        onDone: { target: /* ... */ },
        // （可选）当被调用的服务发生错误时的转换
        onError: { target: /* ... */ }
      }
    }
  }
});
```

**调用 Promises**

```js
// 返回 Promise 的函数
const getDataFromAPI = () => fetch(/* ... */)
    .then(data => data.json());


// ...
{
  invoke: (context, event) => getDataFromAPI,
  // resolved promise
  onDone: {
    target: 'success',
    // resolve promise 数据位于 event.data 属性上
    actions: (context, event) => console.log(event.data)
  },
  // rejected promise
  onError: {
    target: 'failure',
    // rejected promise 数据位于 event.data 属性上
    actions: (context, event) => console.log(event.data)
  }
}
// ...
```

**调用 Callbacks**

```js
// ...
{
  invoke: (context, event) => (callback, onReceive) => {
    // 将事件发送回父级
    callback({ type: 'SOME_EVENT' });

    // 接收来自父级的事件
    onReceive(event => {
      if (event.type === 'DO_SOMETHING') {
        // ...
      }
    });
  },
  // callback 错误
  onError: {
    target: 'failure',
    // 错误数据位于 event.data 属性上
    actions: (context, event) => console.log(event.data)
  }
},
on: {
  SOME_EVENT: { /* ... */ }
}
```

**调用 Observables**

```js
import { map } from 'rxjs/operators';

// ...
{
  invoke: {
    src: (context, event) => createSomeObservable(/* ... */).pipe(
        map(value => ({ type: 'SOME_EVENT', value }))
      ),
    onDone: 'finished'
  }
},
on: {
  SOME_EVENT: /* ... */
}
// ...
```

**调用 状态机**

```js
const someMachine = createMachine({ /* ... */ });

// ...
{
  invoke: {
    src: someMachine,
    onDone: {
      target: 'finished',
      actions: (context, event) => {
        // 子状态机的完成数据（其最终状态的 .data 属性）
        console.log(event.data);
      }
    }
  }
}
// ...
```
