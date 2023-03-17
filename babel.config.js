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

// TODO: consider enabling loose mode
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        // we want to test files transpiled in the very same way as when we build dist files
        // we don't use async functions in our public APIs though, so we can skip transforms related to them safely
        exclude: isTest
          ? [
              '@babel/plugin-transform-async-to-generator',
              '@babel/plugin-transform-regenerator'
            ]
          : []
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
            // this is the only overriden option
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
