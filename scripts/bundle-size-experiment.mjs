import assert from 'node:assert/strict';

// Rejected size experiment, applied in memory only. Keep bound callbacks while
// deferring their creation to first access. This is not a production transform.
export function lazyBindingsExperiment(source) {
  for (const method of [
    'transition',
    'initialTransition',
    'getInitialSnapshot',
    'getPersistedSnapshot',
    'restoreSnapshot',
    'start'
  ]) {
    const binding = `this.${method} = this.${method}.bind(this);`;
    const declaration = `public ${method}(`;
    assert.ok(source.includes(binding), `Missing binding: ${method}`);
    assert.ok(source.includes(declaration), `Missing method: ${method}`);
    source = source.replace(binding, '').replace(
      declaration,
      `public get ${method}() {
        const bound = this._${method}.bind(this);
        Object.defineProperty(this, '${method}', {
          value: bound, writable: true, configurable: true, enumerable: true
        });
        return bound;
      }
      private _${method}(`
    );
  }
  return source;
}
