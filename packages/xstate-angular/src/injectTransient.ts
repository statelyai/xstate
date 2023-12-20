import {
  DestroyRef,
  Injector,
  Type,
  inject,
  runInInjectionContext
} from '@angular/core';

export function injectTransient<T>(t: Type<T>): T {
  const injector = inject(Injector);
  const destroyRef = inject(DestroyRef);
  return runInInjectionContext(injector, () => {
    const instance = new t();
    destroyRef.onDestroy(() => (instance as any)['ngOnDestroy']?.());
    return instance;
  });
}
