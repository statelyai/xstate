# 目标

## API 目标

- 遵守 [W3C SCXML 规范](https://www.w3.org/TR/scxml/) 和 David Harel 的原始状态图形式。
- 提升 [演员模型](https://en.wikipedia.org/wiki/Actor_model) 基于事件的架构
- 兼容所有框架和平台
- 够将状态机定义完全序列化为 JSON（和 SCXML）
- 纯函数 `createMachine(...)` API
- 0 依赖

## 选择 XState

如果你决定是否应该使用 XState，[John Yanarella](https://github.com/CodeCatalyst) 非常好地总结了他的理由（链接内容中，“我” 指的是链接内容中的作者）：

> When I was making that same choice as to whether to use and advocate for the use of XState where I work, the things that stood out for me were:
>
> 1. The **commitment to understanding the relevant prior art** and informing the implementation based on existing research papers (Harel's [original paper on statecharts](https://www.sciencedirect.com/science/article/pii/0167642387900359/pdf)), books (Horrocks' ["Constructing the User Interface with Statecharts"](https://www.amazon.com/Constructing-User-Interface-Statecharts-Horrocks/dp/0201342782/ref=sr_1_3?ie=UTF8&qid=1548690916&sr=8-3&keywords=statecharts)), and standards ([W3C's SCXML](https://www.w3.org/TR/scxml/)).
>
> Many of the other libraries I reviewed along the way are projects that stop at the point of implementing simple finite state machines. (If that's all you need - and it might be - David's been quick to point out how few lines it takes to just roll your own.) Their reach is shortened, since they don't address the subsequent limitations that can be overcome via a statechart.
>
> XState stands on the shoulders of giants by embracing [W3C's SCXML spec](https://www.w3.org/TR/scxml/) - it gets the benefit of that working group's research into edge cases.
>
> 2. It's a **refuge from the "shiny object syndrome"** of embracing the latest flavor-of-the-month "state management library". It faithfully implements a 30+ year old formalism. You end up putting your most important logic into something you can take with you to any UI framework (and potentially to other statechart implementations in other languages). It's a zero-dependency library.
>
> The front-end development world is the wild west, and it could stand to learn from what other engineering disciplines have known and employed for years.
>
> 3. It has **passed a critical threshold of maturity** as of version 4, particularly given the introduction of [the visualizer](https://statecharts.github.io/xstate-viz). And that's just the tip of the iceberg of where it could go next, as it (and [its community](https://github.com/statelyai/xstate/discussions)) introduces tooling that takes advantage of how a statechart can be visualized, analyzed, and tested.
>
> 4. The **community** that is growing around it and the awareness it is bringing to finite state machines and statecharts. If you read back through this gitter history, there's a wealth of links to research papers, other FSM and Statechart implementations, etc. that have been collected by [Erik Mogensen](https://twitter.com/mogsie) over at [statecharts.github.io](https://statecharts.github.io).
