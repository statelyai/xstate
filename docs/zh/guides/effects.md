# 作用 Effects

在状态图中，“副作用”可以分为两类：

**“即发即弃”副作用**，执行同步副作用，不将事件发送回状态图，或将 _事件同步发送_ 回状态图：

- [动作（Actions）](./actions.md) - 单一的、分散的作用
- [活动（Activities）](./activities.md) - 退出它们开始所处的状态时处理的连续作用

**调用作用**，它执行一个可以 _异步_ 发送和接收事件的副作用：

- [调用 Promises](./communication.md#invoking-promises) - 随着时间的推移，可能会 `resolve` 或 `reject` 一次的单个分散副作用，这些作用结果，通过事件发送到父状态机
- [调用 Callbacks](./communication.md#invoking-callbacks) - 随着时间的推移可能会发送多个事件的持续副作用，以及监听直接发送给它的事件，到/从 父状态机
- [调用 Observables](./communication.md#invoking-observables) - 随着时间的推移，可能会发送由来自观察流的消息触发的多个事件的持续副作用
- [调用 Machines](./communication.md#invoking-machines) - 由`Machine` 实例表示的连续副作用，可以发送/接收事件，也可以在达到 [最终状态](./final.md) 时通知父状态机
