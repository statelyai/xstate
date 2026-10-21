import { babel } from 'svelte-preprocess';

export default {
  preprocess: [
    babel({
      rootMode: 'upward'
    })
  ]
};
