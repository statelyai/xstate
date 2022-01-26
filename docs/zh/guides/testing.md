# 测试状态机

一般来说，测试状态机和状态图应该通过测试状态机的 _整体行为_ 来完成； 那是：

> 给定**当前状态**，当某些**事件序列**发生时，被测系统应该处于**某种状态**和/或表现出特定的**输出**。

这遵循 [行为驱动开发 (BDD)](https://en.wikipedia.org/wiki/Behavior-driven_development) 和 [黑盒测试](https://en.wikipedia.org/wiki/Black-box_testing) 策略。 不应直接测试状态机的内部工作； 相反，应该测试观察到的行为。 这使得测试状态机比单元测试更接近于集成或端到端 (E2E) 测试。

## 测试纯逻辑

如果你不想测试副作用，例如执行操作或调用 演员，而是想测试纯逻辑，则可以使用 `machine.transition(...)` 函数来断言已达到特定状态 给定初始状态和事件：

```js
import { lightMachine } from '../path/to/lightMachine';

it('should reach "yellow" given "green" when the "TIMER" event occurs', () => {
  const expectedValue = 'yellow'; // 预期状态值

  const actualState = lightMachine.transition('green', { type: 'TIMER' });

  expect(actualState.matches(expectedValue)).toBeTruthy();
});
```

## 测试服务

服务的行为和输出可以通过断言它 _最终_ 达到预期状态来测试，给定初始状态和一系列事件：

```js
import { fetchMachine } from '../path/to/fetchMachine';

it('should eventually reach "success"', (done) => {
  const fetchService = interpret(fetchMachine).onTransition((state) => {
    // 这是你期望最终达到状态的地方
    if (state.matches('success')) {
      done();
    }
  });

  fetchService.start();

  // 向服务发送零个或多个事件，使其最终达到预期状态
  fetchService.send({ type: 'FETCH', id: 42 });
});
```

::: tip
请记住，大多数测试框架都有一个默认超时，并且异步测试预计会在该超时之前完成。 如有必要，配置超时（[例如，`jest.setTimeout(timeout)`](https://jestjs.io/docs/en/jest-object#jestsettimeouttimeout)）用于更长时间运行的测试。
:::

## 模拟副作用

由于动作和调用/生成 演员 是副作用，因此在测试环境中执行它们可能是不可取的。 你可以使用 `machine.withConfig(...)` 选项来更改某些操作的实现细节：

```js
import { fetchMachine } from '../path/to/fetchMachine';

it('should eventually reach "success"', (done) => {
  let userAlerted = false;

  const mockFetchMachine = fetchMachine.withConfig({
    services: {
      fetchFromAPI: (_, event) =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({ id: event.id });
          }, 50);
        })
    },
    actions: {
      alertUser: () => {
        // 设置一个标志而不是执行原来的动作
        userAlerted = true;
      }
    }
  });

  const fetchService = interpret(mockFetchMachine).onTransition((state) => {
    if (state.matches('success')) {
      // 断言效果已执行
      expect(userAlerted).toBeTruthy();
      done();
    }
  });

  fetchService.start();

  fetchService.send({ type: 'FETCH', id: 42 });
});
```
