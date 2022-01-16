# 安装

你可以从 NPM 或 Yarn 安装 XState，也可以直接从 CDN 嵌入 `<script>`。

## 包管理

```bash
npm install xstate@latest --save
# 或:
yarn add xstate@latest --save
```

## CDN

你可以直接从 [unpkg CDN](https://unpkg.com/xstate@4/dist/) 中包含 XState：

- XState core: [https://unpkg.com/xstate@4/dist/xstate.js](https://unpkg.com/xstate@4/dist/xstate.js)
- XState web: [https://unpkg.com/xstate@4/dist/xstate.web.js](https://unpkg.com/xstate@4/dist/xstate.web.js)
  - 浏览器兼容，ES module 构建

```html
<script src="https://unpkg.com/xstate@4/dist/xstate.js"></script>
```

变量 `XState` 将在全局范围内可用，这将使你能够访问顶级导出。

```js
const { createMachine, actions, interpret } = XState; // 全局变量: window.XState

const lightMachine = createMachine({
  // ...
});

const lightService = interpret(lightMachine);
```
