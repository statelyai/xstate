const { NODE_ENV } = process.env;
const isTest = NODE_ENV === 'test';

const stripSymbolObservableMethodPlugin = ({ types: t }) => {
  const isSymbolObservable = t.buildMatchMemberExpression('Symbol.observable');
  return {
    visitor: {
      Class(path) {
        path
          .get('body.body')
          .filter(
            (p) => p.isClassMethod() && isSymbolObservable(p.get('key').node)
          )
          .forEach((p) => p.remove());
      }
    }
  };
};

module.exports = {
  assumptions: {
    constantReexports: true, // only matters for tests (since only there we transpile to CJS using Babel), it makes debugging easier
    setClassMethods: true,
    setComputedProperties: true,
    setPublicClassFields: true,
    setSpreadProperties: true
  },
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          // Even though our packages are not node-only, we can use this as an approximation of the "target syntax level"
          // as Babel doesn't support targets like "ES2022". We currently target the latest LTS version of node here.
          // When targeting browsers, the code is usually going through some kind of bundler anyway
          // and thus it's the user's responsibility to downlevel the code to what they need.
          node: 18
        },
        exclude: [
          '@babel/plugin-proposal-optional-chaining' // despite being supported by node 16 optional chaining was still transpiled by some reason
        ]
      }
    ],
    ['@babel/preset-react', { runtime: 'automatic' }],
    [
      '@babel/preset-typescript',
      { isTSX: true, allExtensions: true, disallowAmbiguousJSXLike: true }
    ]
  ],
  overrides: [
    {
      test: /\.svelte$/,
      presets: [
        [
          '@babel/preset-typescript',
          {
            isTSX: true,
            allExtensions: true,
            disallowAmbiguousJSXLike: true,
            // this is the only overridden option
            // potentially we could just configure it for all the files but surprisingly something crashes when we try to do it
            onlyRemoveTypeImports: true
          }
        ]
      ]
    },
    {
      test: /\/xstate-solid\//,
      presets: ['babel-preset-solid']
    }
  ],
  plugins: [
    stripSymbolObservableMethodPlugin,
    '@babel/proposal-class-properties'
  ]
};
