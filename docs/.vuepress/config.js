const { slugify } = require('@vuepress/shared-utils');

// TODO: remove once https://github.com/vuejs/vuepress/issues/1985 will be fixed
function slugifyWithBadges(str) {
  // remove badges and use original slugify function
  return slugify(str.replace(/<Badge[^>]*\/>/, ''));
}

module.exports = {
  title: 'XState Docs',
  base: '/docs/',
  description:
    'Documentation for XState: State Machines and Statecharts for the Modern Web',
  locales: {
    '/': {
      lang: 'en-US'
    },
    '/zh/': {
      lang: 'zh-CN',
      title: 'XState 文档',
      description: 'XState 文档：现代 Web 的状态机和状态图'
    },
    '/fr/': {
      lang: 'fr-FR',
      title: 'Documentation XState',
      description:
        "Documentation XState : Machines d'état et diagrammes d'état pour le Web moderne"
    }
  },
  markdown: {
    toc: { includeLevel: [2, 3], slugify: slugifyWithBadges }
  },
  head: [
    ['script', { src: 'https://plausible.io/js/plausible.js', defer: 'defer' }]
  ],
  themeConfig: {
    lastUpdated: 'Last Updated',
    repo: 'davidkpiano/xstate',
    docsDir: 'docs',
    docsBranch: 'main',
    editLinks: true,
    logo: '/logo.svg',
    algolia: {
      apiKey: 'ddd397151aad9f0662ca36e5b39fed61',
      indexName: 'xstatejs'
    },
    locales: {
      '/': {
        label: 'English'
      },
      '/zh/': {
        selectText: '选择语言',
        label: '简体中文',
        editLinkText: '在 GitHub 上编辑此页',
        lastUpdated: '上次更新',
        nav: [
          { text: 'API', link: 'https://paka.dev/npm/xstate/' },
          { text: '可视化工具', link: 'https://stately.ai/viz' },
          { text: 'Discord', link: 'https://discord.gg/xtWgFTgvNV' },
          {
            text: '社区',
            link: 'https://github.com/statelyai/xstate/discussions'
          }
        ],
        sidebar: [
          {
            title: '什么是 XState?',
            children: ['/zh/visualizer/']
          },
          {
            title: '关于',
            children: [
              '/zh/about/concepts',
              '/zh/about/goals',
              '/zh/about/showcase',
              '/zh/about/resources',
              '/zh/about/tutorials',
              '/zh/about/glossary'
            ]
          },
          {
            title: '向导',
            children: [
              '/zh/guides/start',
              '/zh/guides/installation',
              '/zh/guides/introduction-to-state-machines-and-statecharts/',
              '/zh/guides/machines',
              '/zh/guides/states',
              '/zh/guides/statenodes',
              '/zh/guides/events',
              '/zh/guides/transitions',
              '/zh/guides/hierarchical',
              '/zh/guides/parallel',
              '/zh/guides/final',
              '/zh/guides/effects',
              '/zh/guides/actions',
              '/zh/guides/guards',
              '/zh/guides/context',
              '/zh/guides/models',
              '/zh/guides/activities',
              '/zh/guides/communication',
              '/zh/guides/actors',
              '/zh/guides/delays',
              '/zh/guides/history',
              '/zh/guides/ids',
              '/zh/guides/interpretation',
              '/zh/guides/testing',
              '/zh/guides/typescript',
              '/zh/guides/scxml'
            ]
          },
          {
            title: '教程',
            children: [
              '/zh/tutorials/reddit',
              {
                title: '7GUIs',
                children: [
                  '/tutorials/7guis/counter',
                  '/tutorials/7guis/temperature',
                  '/tutorials/7guis/flight',
                  '/tutorials/7guis/timer'
                ]
              }
            ]
          },
          {
            title: '配方',
            children: [
              '/recipes/react',
              '/recipes/vue',
              '/recipes/rxjs',
              '/recipes/ember',
              '/recipes/stencil',
              '/recipes/svelte'
            ]
          },
          {
            title: '包',
            children: [
              '/packages/xstate-react/',
              '/packages/xstate-vue/',
              '/packages/xstate-graph/',
              '/packages/xstate-test/',
              '/packages/xstate-immer/',
              '/packages/xstate-inspect/',
              '/packages/xstate-svelte/',
              '/packages/xstate-cli/'
            ]
          },
          {
            title: '模式',
            children: ['/patterns/sequence']
          },
          {
            title: '示例',
            children: [
              '/examples/counter',
              '/examples/todomvc',
              '/examples/calculator',
              '/examples/covid-tracker'
            ]
          },
          {
            title: '新闻和有用地址',
            children: [
              ['https://statelyai.canny.io', 'Roadmap'],
              '/updates/',
              [
                'https://github.com/statelyai/xstate/blob/main/CODE_OF_CONDUCT.md',
                '行为守则'
              ],
              ['https://stately.ai/privacy', '隐私政策']
            ]
          }
        ]
      },
      '/fr/': {
        selectText: 'Choisissez une langue',
        label: 'Français',
        editLinkText: 'Modifier cette page sur GitHub',
        lastUpdated: 'Dernière mise à jour',
        nav: [
          { text: 'API', link: 'https://paka.dev/npm/xstate/' },
          { text: 'Visualiseur', link: 'https://stately.ai/viz' },
          { text: 'Discord', link: 'https://discord.gg/xtWgFTgvNV' },
          {
            text: 'Communauté',
            link: 'https://github.com/statelyai/xstate/discussions'
          }
        ],
        sidebar: [
          {
            title: "Qu'est-ce que XState?",
            children: ['/fr/visualizer/']
          },
          {
            title: 'À propos',
            children: [
              '/fr/about/concepts',
              '/fr/about/goals',
              '/fr/about/showcase',
              '/fr/about/resources',
              '/fr/about/tutorials',
              '/fr/about/glossary'
            ]
          },
          {
            title: 'Guides',
            children: [
              '/fr/guides/start',
              '/fr/guides/installation',
              '/fr/guides/introduction-to-state-machines-and-statecharts/',
              '/fr/guides/machines',
              '/fr/guides/states',
              '/fr/guides/statenodes',
              '/fr/guides/events',
              '/fr/guides/transitions',
              '/fr/guides/hierarchical',
              '/fr/guides/parallel',
              '/fr/guides/final',
              '/fr/guides/effects',
              '/fr/guides/actions',
              '/fr/guides/guards',
              '/fr/guides/context',
              '/fr/guides/models',
              '/fr/guides/activities',
              '/fr/guides/communication',
              '/fr/guides/actors',
              '/fr/guides/delays',
              '/fr/guides/history',
              '/fr/guides/ids',
              '/fr/guides/interpretation',
              '/fr/guides/testing',
              '/fr/guides/typescript',
              '/fr/guides/scxml'
            ]
          },
          {
            title: 'Tutoriels',
            children: [
              '/fr/tutorials/reddit',
              {
                title: '7GUIs',
                children: [
                  '/fr/tutorials/7guis/counter',
                  '/fr/tutorials/7guis/temperature',
                  '/fr/tutorials/7guis/flight',
                  '/fr/tutorials/7guis/timer'
                ]
              }
            ]
          },
          {
            title: 'Recettes',
            children: [
              '/fr/recipes/react',
              '/fr/recipes/vue',
              '/fr/recipes/rxjs',
              '/fr/recipes/ember',
              '/fr/recipes/stencil',
              '/fr/recipes/svelte'
            ]
          },
          {
            title: 'Packages',
            children: [
              '/fr/packages/xstate-react/',
              '/fr/packages/xstate-vue/',
              '/fr/packages/xstate-graph/',
              '/fr/packages/xstate-test/',
              '/fr/packages/xstate-immer/',
              '/fr/packages/xstate-inspect/',
              '/fr/packages/xstate-svelte/',
              '/fr/packages/xstate-cli/'
            ]
          },
          {
            title: 'Motifs',
            children: ['/fr/patterns/sequence']
          },
          {
            title: 'Exemples',
            children: [
              '/fr/examples/counter',
              '/fr/examples/todomvc',
              '/fr/examples/calculator',
              '/fr/examples/covid-tracker'
            ]
          },
          {
            title: 'Actualités et liens utiles',
            children: [
              ['https://statelyai.canny.io', 'Roadmap'],
              '/fr/updates/',
              [
                'https://github.com/statelyai/xstate/blob/main/CODE_OF_CONDUCT.md',
                'Code de conduite'
              ],
              ['https://stately.ai/privacy', 'Politique de confidentialité']
            ]
          }
        ]
      }
    },
    nav: [
      { text: 'API', link: 'https://paka.dev/npm/xstate/' },
      { text: 'Visualizer', link: 'https://stately.ai/viz' },
      { text: 'Discord', link: 'https://discord.gg/xtWgFTgvNV' },
      {
        text: 'Community',
        link: 'https://github.com/statelyai/xstate/discussions'
      }
    ],
    sidebar: [
      {
        title: 'What is XState?',
        children: ['/visualizer/']
      },
      {
        title: 'About',
        children: [
          '/about/concepts',
          '/about/goals',
          '/about/showcase',
          '/about/resources',
          '/about/tutorials',
          '/about/glossary'
        ]
      },
      {
        title: 'Guides',
        children: [
          '/guides/start',
          '/guides/installation',
          '/guides/introduction-to-state-machines-and-statecharts/',
          '/guides/machines',
          '/guides/states',
          '/guides/statenodes',
          '/guides/events',
          '/guides/transitions',
          '/guides/hierarchical',
          '/guides/parallel',
          '/guides/final',
          '/guides/effects',
          '/guides/actions',
          '/guides/guards',
          '/guides/context',
          '/guides/models',
          '/guides/activities',
          '/guides/communication',
          '/guides/actors',
          '/guides/delays',
          '/guides/history',
          '/guides/ids',
          '/guides/interpretation',
          '/guides/testing',
          '/guides/typescript',
          '/guides/scxml'
        ]
      },
      {
        title: 'Tutorials',
        children: [
          '/tutorials/reddit',
          {
            title: '7GUIs',
            children: [
              '/tutorials/7guis/counter',
              '/tutorials/7guis/temperature',
              '/tutorials/7guis/flight',
              '/tutorials/7guis/timer'
            ]
          }
        ]
      },
      {
        title: 'Recipes',
        children: [
          '/recipes/react',
          '/recipes/vue',
          '/recipes/rxjs',
          '/recipes/ember',
          '/recipes/stencil',
          '/recipes/svelte'
        ]
      },
      {
        title: 'Packages',
        children: [
          'packages/xstate-react/',
          'packages/xstate-vue/',
          'packages/xstate-graph/',
          'packages/xstate-test/',
          'packages/xstate-immer/',
          'packages/xstate-inspect/',
          'packages/xstate-svelte/',
          'packages/xstate-cli/'
        ]
      },
      {
        title: 'Patterns',
        children: ['/patterns/sequence']
      },
      {
        title: 'Examples',
        children: [
          '/examples/counter',
          '/examples/todomvc',
          '/examples/calculator',
          '/examples/covid-tracker'
        ]
      },
      {
        title: 'News and Useful Links',
        children: [
          ['https://statelyai.canny.io', 'Roadmap'],
          '/updates/',
          [
            'https://github.com/statelyai/xstate/blob/main/CODE_OF_CONDUCT.md',
            'Code of Conduct'
          ],
          ['https://stately.ai/privacy', 'Privacy Policy']
        ]
      }
    ]
  },
  plugins: ['vuepress-plugin-export']
};
