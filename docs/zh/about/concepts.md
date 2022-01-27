# 概念

XState 是一个库，用于创建、解释和执行有限状态机和状态图，以及管理这些状态机与演员（Actor）调用。以下的计算机科学概念，对于了解如何充分使用 XState 非常重要，并且通常适用于你当前和未来的所有软件项目。

## 有限状态机

有限状态机是一种数学计算模型，它描述了在任何给定时间只能处于一种状态的系统的行为。例如，假设你可以由具有有限数量 (2) 个状态的状态机表示：`睡觉` 或 `清醒`。 在任何给定的时间，你要么 `睡觉`，要么 `清醒`。 你也不可能同时 `睡觉` 和 `清醒`，你也不可能同时不 `睡觉` 和不 `清醒`。

形式上，有限状态机有五个部分：

- 有限的 **状态** 数
- 有限的 **事件** 数
- 一个 **初始状态**
- 在给定当前状态和事件的情况下，确定下一个状态的 **转换函数**
- 一组（可能是空的）**最终状态**

**状态** 是指，由状态机建模的系统中某种有限的、_定性_ 的“模式”或“状态”，并不描述与该系统相关的所有（可能是无限的）数据。例如，水可以处于以下 4 种状态中的一种：`冰`、`液体`、`气体`或`等离子体`。然而，水的温度可以变化，所以其测量值是 _定量的_ 和无限的。

更多资源：

- [有限状态机](https://en.wikipedia.org/wiki/Finite-state_machine) article on Wikipedia
- [理解状态机](https://www.freecodecamp.org/news/state-machines-basics-of-computer-science-d42855debc66/) by Mark Shead
- [▶️ A-Level Comp Sci: 有限状态机](https://www.youtube.com/watch?v=4rNYAvsSkwk)

## 状态图

状态图是一种用于对有状态的交互式系统进行建模的表达。计算机科学家 David Harel 在他 1987 年的论文 [状态图: 一个复杂系统的可视化表达](https://www.sciencedirect.com/science/article/pii/0167642387900359/pdf) 中提出了这种表达作为状态机的扩展。一些扩展包括：

- 守卫（Guard）转换
- 动作（Action）（进入、退出、转换）
- 扩展状态（上下文）
- 并行状态
- 分层（嵌套）状态
- 历史

更多资源：

- [状态图 - 一个复杂系统的可视化表现](https://www.sciencedirect.com/science/article/pii/0167642387900359/pdf) by David Harel
- [状态图的世界](https://statecharts.github.io/) by Erik Mogensen

## 演员（Actor）模型

演员模型是另一个非常古老的数学模型，它与状态机配合得很好。 它指出，一切都是一个“演员”，可以做三件事：

- **接收** 消息
- **发送** 消息到其他 Actor
- 用它收到的消息做一些事情( **行为**)，比如：
  - 改变它的本地状态
  - 发送消息到其他演员
  - _产生_ 新的演员

演员的行为可以通过状态机（或状态图）来描述。

更多资源：

- [演员模型](https://en.wikipedia.org/wiki/Actor_model) article on Wikipedia
- [10 分钟演员模型](https://www.brianstorti.com/the-actor-model/) by Brian Storti
