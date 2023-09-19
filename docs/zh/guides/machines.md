# 状态机 Machines

状态机是一组有限的状态，可以根据事件确定性地相互转换。 要了解更多信息，请阅读 [介绍状态图](./introduction-to-state-machines-and-statecharts/index.md)。

## 配置

状态机和状态图都是使用 `createMachine()` 工厂函数定义的：

```js
import { createMachine } from 'xstate';

const lightMachine = createMachine({
  // 状态机标识
  id: 'light',

  // 初始状态
  initial: 'green',

  // 整个状态机的本地 context
  context: {
    elapsed: 0,
    direction: 'east'
  },

  // 状态定义
  states: {
    green: {
      /* ... */
    },
    yellow: {
      /* ... */
    },
    red: {
      /* ... */
    }
  }
});
```

状态机配置与 [状态节点配置](./statenodes.md) 相同，增加了上下文（context）属性：

代表状态机所有嵌套状态的本地“扩展状态”。 有关更多详细信息，请参阅文档 [context 文档](./context.md)。

## 选项

[actions](./actions.md)、 [delays](./delays.md)、 [guards](./guards.md)、 和 [services](./communication.md) 的实现可以在状态机配置中作为字符串引用，然后在 `createMachine()` 的第二个参数中指定为对象：

```js
const lightMachine = createMachine(
  {
    id: 'light',
    initial: 'green',
    states: {
      green: {
        // 通过字符串引用 action
        entry: 'alertGreen'
      }
    }
  },
  {
    actions: {
      // action 执行
      alertGreen: (context, event) => {
        alert('Green!');
      }
    },
    delays: {
      /* ... */
    },
    guards: {
      /* ... */
    },
    services: {
      /* ... */
    }
  }
);
```

该对象有 5 个可选属性：

- `actions` - action 名称到它们的执行的映射
- `delays` - delays 名称与其执行的映射
- `guards` - 转换守卫 (`cond`) ，名称与其执行的映射
- `services` - 调用的服务 (`src`) ，名称与其执行的映射
- `activities` (deprecated) - activities 名称与其执行的映射

## 扩展状态机

可以使用 `.withConfig()` 扩展现有状态机，它采用与上述相同的对象结构：

```js
const lightMachine = // (同上面的例子一样)

const noAlertLightMachine = lightMachine.withConfig({
  actions: {
    alertGreen: (context, event) => {
      console.log('green');
    }
  }
});
```

## 初始化 Context

如第一个示例所示，`context` 直接在配置本身中定义。 如果要使用不同的初始 `context` 扩展现有状态机，可以使用 `.withContext()` 并传入自定义 `context`：

```js
const lightMachine = // (像第一个例子)

const testLightMachine = lightMachine.withContext({
  elapsed: 1000,
  direction: 'north'
});
```

::: warning
这 _不会_ 对原始 `context` 进行浅层合并，而是将原始 `context` 替换为 `.withContext(...)` 的 `context`。 你仍然可以通过引用 `machine.context` 手动“合并”上下文：

```js
const testLightMachine = lightMachine.withContext({
  // 合并原始 context
  ...lightMachine.context,
  elapsed: 1000
});
```

:::
