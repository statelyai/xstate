# 标识 State 节点

[:rocket: 快速参考](#快速参考)

默认情况下，状态节点的 `id` 是其区分的完整路径。 你可以使用这个默认的 `id` 来指定一个状态节点：

```js
const lightMachine = createMachine({
  id: 'light',
  initial: 'green',
  states: {
    green: {
      // 默认 ID: 'light.green'
      on: {
        // 你可以按默认 ID 定位状态节点。
        // 这与 TIMER 相同：'yellow'
        TIMER: { target: '#light.yellow' }
      }
    },
    yellow: {
      on: {
        TIMER: { target: 'red' }
      }
    },
    red: {
      on: {
        TIMER: { target: 'green' }
      }
    }
  }
});
```

## 相关目标

通过指定一个点（`'.'`）后跟它们的键，可以相对于它们的父节点来定位子状态节点：

```js {10-12}
const optionsMachine = createMachine({
  id: 'options',
  initial: 'first',
  states: {
    first: {},
    second: {},
    third: {}
  },
  on: {
    SELECT_FIRST: { target: '.first' }, // resolves to 'options.first'
    SELECT_SECOND: { target: '.second' }, // 'options.second'
    SELECT_THIRD: { target: '.third' } // 'options.third'
  }
});
```

默认情况下，相对目标是 [内部转换](./transitions.md#internal-transitions)，这意味着父状态将 _不_ 退出并重新进入。 你可以通过指定 `internal: false` 来使相对目标外部转换：

```js {4}
// ...
on: {
  SELECT_FIRST: {
    target: { target: '.first' },
    internal: false // 外部转换，将退出/重新进入父状态节点
  }
}
```

## 自定义 ID

可以通过唯一标识符而不是相对标识符来定位状态节点。 这可以简化复杂状态图的创建。

要为状态节点指定 ID，请提供唯一的字符串标识符作为其 `id` 属性，例如，`id: 'greenLight'`。

要通过 ID 定位状态节点，请在其字符串 ID 前添加 `#` 符号，例如，`TIMER: '#greenLight'`。

```js
const lightMachine = createMachine({
  id: 'light',
  initial: 'green',
  states: {
    green: {
      // 自定义 id
      id: 'greenLight',
      on: {
        // 目标状态节点通过其 ID
        TIMER: { target: '#yellowLight' }
      }
    },
    yellow: {
      id: 'yellowLight',
      on: {
        TIMER: { target: '#redLight' }
      }
    },
    red: {
      id: 'redLight',
      on: {
        // 相对目标仍然有效
        TIMER: { target: 'green' }
      }
    }
  }
});
```

**笔记:**

- 始终建议为根状态节点使用 ID。
- 确保所有 ID 都是唯一的，以防止命名冲突。 这自然由自动生成的 ID 强制执行。

::: warning
不要将自定义标识符与相对标识符混合使用。 例如，如果上面的 `red` 状态节点有一个自定义的 `"redLight"` ID 和一个子 `walking` 状态节点，例如：

```js
// ...
red: {
  id: 'redLight',
  initial: 'walking',
  states: {
    // ID 仍然解析为“light.red.walking”
    walking: {/* ... */},
    // ...
  }
}
// ...
```

那么你就不能通过 `'#redLight.walking'` 定位 `'walking'` 状态，因为它的 ID 被解析为 `'#light.red.walking'`。 以`'#'` 开头的目标将始终引用 `'#[state node ID]'` 的 _完全匹配_。
:::

## 快速参考

**默认自动生成 ID:**

```js
const lightMachine = createMachine({
  id: 'light',
  initial: 'green',
  states: {
    // ID: "light.green"
    green: {
      /* ... */
    },
    // ID: "light.yellow"
    yellow: {
      /* ... */
    },
    // ID: "light.red"
    red: {
      /* ... */
    }
  }
});
```

**自定义 ID**

```js
// ...
states: {
  active: {
    id: 'custom-active', // can be any unique string
    // ...
  }
}
```

**通过 ID 定位到 state:**

```js
// ...
on: {
  EVENT: { target: '#light.yellow' }, // 目标到默认 ID
  ANOTHER_EVENT: { target: '#custom-id' } // 目标到自定义 ID
}
```
