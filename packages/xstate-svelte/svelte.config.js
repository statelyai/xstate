const { babel } = require('svelte-preprocess');

module.exports = {
  preprocess: [
    babel({
      rootMode: 'upward'
    })
  ]
};
