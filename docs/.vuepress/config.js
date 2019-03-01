const mdCodesandboxPlugin = require('markdown-it-codesandbox-embed');

module.exports = {
  title: 'XState Docs',
  base: '/docs/',
  description:
    'Documentation for XState: State Machines and Statecharts for the Modern Web',
  ga: 'UA-129726387-1',
  markdown: {
    // config: md => {
    //   md.use(mdCodesandboxPlugin, {
    //     directory: 'sandboxes',
    //   })
    // }
  },
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'API', link: 'https://xstate.js.org/api' },
      { text: 'Visualizer', link: 'https://statecharts.github.io/xstate-viz' },
      { text: 'Chat', link: 'https://gitter.im/statecharts/statecharts' },
      { text: 'Community', link: 'https://spectrum.chat/statecharts' },
      { text: 'GitHub', link: 'https://github.com/davidkpiano/xstate' }
    ],
    sidebar: [
      {
        title: 'Guides',
        children: [
          '/guides/start',
          '/guides/installation',
          '/guides/machines',
          '/guides/states',
          '/guides/statenodes',
          '/guides/events',
          '/guides/transitions',
          '/guides/hierarchical',
          '/guides/parallel',
          '/guides/effects',
          '/guides/actions',
          '/guides/guards',
          '/guides/context',
          '/guides/activities',
          '/guides/communication',
          '/guides/delays',
          '/guides/final',
          '/guides/history',
          '/guides/ids',
          '/guides/internal',
          '/guides/interpretation',
          '/guides/typescript'
        ]
      },
      {
        title: 'Recipes',
        children: ['/recipes/react', '/recipes/vue', '/recipes/rxjs']
      },
      {
        title: 'Patterns',
        children: ['/patterns/sequence']
      },
      {
        title: 'Examples',
        children: ['/examples/todomvc', '/examples/calculator']
      }
    ]
  }
};
