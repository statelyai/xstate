import type { Page } from '@playwright/test';
import { expectTypeOf, it } from 'vitest';
import type { PlaywrightMock, PlaywrightPage } from '../src/index.ts';

it('accepts a real Playwright page', () => {
  expectTypeOf<
    Page extends PlaywrightPage ? true : false
  >().toEqualTypeOf<true>();
});

it('accepts route registrations returned from mocks', () => {
  expectTypeOf<(page: Page) => ReturnType<Page['route']>>().toExtend<
    PlaywrightMock<Page>
  >();
});
