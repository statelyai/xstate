import 'jest';

declare global {
  namespace jest {
    interface Matchers<R, T> {
      toMatchMockCallsInlineSnapshot(snapshot?: string): R;
    }
  }
}
