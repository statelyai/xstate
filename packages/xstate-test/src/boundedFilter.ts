import * as fc from 'fast-check';

const MAX_FILTER_ATTEMPTS = 1000;

/**
 * Like `.filter()`, but throws after `MAX_FILTER_ATTEMPTS` consecutive
 * rejections instead of looping forever. Shrinking filters without a limit.
 */
export class BoundedFilterArbitrary<T> extends fc.Arbitrary<T> {
  private readonly arbitrary: fc.Arbitrary<T>;
  private readonly predicate: (value: T) => boolean;
  private readonly description: string;
  private readonly path: string;

  constructor(
    arbitrary: fc.Arbitrary<T>,
    predicate: (value: T) => boolean,
    description: string,
    path: string
  ) {
    super();
    this.arbitrary = arbitrary;
    this.predicate = predicate;
    this.description = description;
    this.path = path;
  }

  generate(mrng: fc.Random, biasFactor: number | undefined): fc.Value<T> {
    for (let attempt = 0; attempt < MAX_FILTER_ATTEMPTS; attempt++) {
      const generated = this.arbitrary.generate(mrng, biasFactor);
      if (this.predicate(generated.value)) {
        return generated;
      }
    }
    throw new Error(
      `[@xstate/test] Could not generate a value satisfying ${this.description} at '${this.path}' after ${MAX_FILTER_ATTEMPTS} attempts. Pass an explicit generator for this payload.`
    );
  }

  canShrinkWithoutContext(value: unknown): value is T {
    return (
      this.arbitrary.canShrinkWithoutContext(value) && this.predicate(value)
    );
  }

  shrink(value: T, context: unknown): fc.Stream<fc.Value<T>> {
    return this.arbitrary
      .shrink(value, context)
      .filter((shrunk) => this.predicate(shrunk.value));
  }
}
