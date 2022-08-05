# 词汇表

改编自 [状态图世界 (Glossary)](https://statecharts.dev/glossary/)。

## 动作（Action）

动作，是作为对状态转换，而执行的 [作用（Effect）](../guides/effects.md)。

## 演员（Actor）

演员是一个实体，它可以向其他演员发送消息、接收消息，并指定其响应消息的行为，其中可能包括产生其他新的演员。

## 原子状态（Atomic state）

原子状态是没有子状态的状态节点。

## 复合状态（Compound state）

一个复合状态有一个或多个子状态。这些子状态之一必须是初始状态，这是进入父级复合状态时，进入的默认状态节点。

## 条件（Condition）

参考 [守卫（guard）](#guard)。

## 进入动作（Entry action）

进入动作是在进入其父级状态时执行的[动作（action）](#action)。

## 事件（Event）

事件表示某事发生在特定时刻。事件是状态机接收的内容，并且是可能进行转换的原因。

## 无事件转换（Eventless transition）

无事件转换，是在其父级状态处于活动状态时自动进行的转换。

## 退出动作（Exit action）

退出动作是在退出其父级状态时执行的[动作（action）](#action)。

## 外部转换（External transition）

在 SCXML 中，外部转换是，当目标状态是源状态的后代时，退出源状态的转换。有关详细信息，请参阅 [选择转换 (SCXML)](https://www.w3.org/TR/scxml/#SelectingTransitions)。

## 最终状态（Final state）

最终状态表示该状态已“完成”，并且不会再处理任何事件。

## 守卫（Guard）

守卫是一个布尔表达式，用于确定是启用（如果条件计算为 _true_）还是禁用（_false_）的转换。也称为 [条件（condition）](#condition)。

## 历史状态（History state）

历史状态是一种伪状态，它会记住并转换到其父级状态的最近活动的子状态或默认目标状态。

## 初始状态（Initial state）

复合状态的初始状态，是进入复合状态时，进入的默认子状态。

## 内部事件（Internal event）

内部事件是由状态机本身引发的事件。内部事件在前一个事件之后立即处理。

## 内部转换（Internal transition）

在 SCXML 中，内部转换是在不退出源状态的情况下转换到后代目标状态的转换。这是默认的转换行为。有关详细信息，请参阅[选择转换 (SCXML)](https://www.w3.org/TR/scxml/#SelectingTransitions)。

## 计算的数学模型

计算的数学模型，是一种基于数学函数描述事物如何计算（给定输入，输出是什么？）的方式。对于状态机和状态图，相关函数是 _状态转换函数_ (参考 [有限状态机：状态模型 (Wikipedia)](https://en.wikipedia.org/wiki/Finite-state_machine#Mathematical_model))。

有关更多，请参阅 [计算模型 (Wikipedia)](https://en.wikipedia.org/wiki/Model_of_computation) 和 [数学模型 (Wikipedia)](https://en.wikipedia.org/wiki/Mathematical_model)。

## 正交状态（Orthogonal state）

参考 [并行状态（parallel state）](#parallel-state)。

## 并行状态（Parallel state）

并行状态，是一种复合状态，其中所有子状态（称为 _区域_ ）同时处于活动状态。

## 假状态（Pseudostate）

一种瞬间的。例如，[初始状态](#initial-state) 或 [历史状态](#history-state)。

## 引发事件（Raised event）

参考 [内部事件](#internal-event).

## 服务（Service）

服务是解释（interpreter）的 [状态机](#state-machine); 即，代表状态机的 [演员]](#actor)。

## 状态机

状态机，是系统行为的数学模型。它通过 [状态](#state)、[事件](#event) 和 [转换](#transition) 来描述行为。

## 状态

状态，表示状态机的整体行为。在状态图中，状态是所有活动状态（可以是原子的、复合的、并行的或最终的）的集合。

## 瞬间状态（Transient state）

瞬间状态是只有 [无事件转换](#eventless-transition) 的状态。

## 转换（Transition）

转换，是对在转换的源状态中发生特定 [事件](#event) 时，状态机将立即处于哪些目标 [状态](#state) 和 [动作](#action) 的描述。

## 可视化表达

可视化表达，是一种精确的语言（如编程语言），主要使用视觉符号（状态、转换等），而不仅仅是代码或文本。状态图就是这种表达。

> 可视化表达是图解和直观的，在数学上是严格的语言。
>
> – https://link.springer.com/referenceworkentry/10.1007%2F978-0-387-39940-9_444
