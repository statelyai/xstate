module.exports = {
  title: 'XState Docs',
  description:
    'Documentation for XState: State Machines and Statecharts for the Modern Web',
  ga: 'UA-129726387-1',
  themeConfig: {
    logo: '/logo.svg',
    nav: [
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
          '/guides/states',
          '/guides/transitions',
          '/guides/hierarchical',
          '/guides/parallel',
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
        children: ['/recipes/react', '/recipes/rxjs']
      }
    ]
  }
};
