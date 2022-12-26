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
    '@babel/preset-react',
    [
      '@babel/preset-typescript',
      {
        isTSX: true,
        allExtensions: true,
        disallowAmbiguousJSXLike: true,
        // Svelte script and template parts of a file are handled separately
        // so Babel can't recognize that an import for a child component was actually being referenced by a source file
        // because only the script is handed to it and the reference is in the template
        onlyRemoveTypeImports: true
      }
    ]
  ],
  plugins: [
    stripSymbolObservableMethodPlugin,
    '@babel/proposal-class-properties'
  ]
};
