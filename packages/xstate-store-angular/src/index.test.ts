import { describe, expect, it } from 'vitest';
import { Component, effect } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { createStore, createAtom, injectStore } from './index';

describe('@xstate/store-angular', () => {
  describe('injectStore', () => {
    it('should select state using a selector', () => {
      const store = createStore({
        context: { count: 0, ignored: 1 },
        on: {}
      });

      @Component({
        template: `<p>Count: {{ count() }}</p>`,
        standalone: true
      })
      class TestComponent {
        count = injectStore(store, (state) => state.context.count);
      }

      const fixture = TestBed.createComponent(TestComponent);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Count: 0');
    });

    it('should update when store changes', () => {
      const store = createStore({
        context: { count: 0 },
        on: {
          inc: (ctx) => ({ ...ctx, count: ctx.count + 1 })
        }
      });

      @Component({
        template: `
          <p id="count">{{ count() }}</p>
          <button id="increment" (click)="increment()">+</button>
        `,
        standalone: true
      })
      class TestComponent {
        count = injectStore(store, (state) => state.context.count);

        increment() {
          store.send({ type: 'inc' });
        }
      }

      const fixture = TestBed.createComponent(TestComponent);
      fixture.detectChanges();

      const debugElement = fixture.debugElement;

      expect(
        debugElement.query(By.css('#count')).nativeElement.textContent
      ).toBe('0');

      debugElement
        .query(By.css('#increment'))
        .triggerEventHandler('click', null);

      fixture.detectChanges();
      expect(
        debugElement.query(By.css('#count')).nativeElement.textContent
      ).toBe('1');
    });

    it('should only re-render when selected state changes', () => {
      const store = createStore({
        context: { selected: 0, ignored: 1 },
        on: {
          updateSelected: (ctx) => ({ ...ctx, selected: 10 }),
          updateIgnored: (ctx) => ({ ...ctx, ignored: 10 })
        }
      });

      let effectCount = 0;

      @Component({
        template: `
          <p id="value">{{ value() }}</p>
          <button id="updateSelected" (click)="updateSelected()">
            Update selected
          </button>
          <button id="updateIgnored" (click)="updateIgnored()">
            Update ignored
          </button>
        `,
        standalone: true
      })
      class TestComponent {
        value = injectStore(store, (state) => state.context.selected);

        constructor() {
          effect(() => {
            console.log(this.value());
            effectCount++;
          });
        }

        updateSelected() {
          store.send({ type: 'updateSelected' });
        }

        updateIgnored() {
          store.send({ type: 'updateIgnored' });
        }
      }

      const fixture = TestBed.createComponent(TestComponent);
      fixture.detectChanges();

      const debugElement = fixture.debugElement;

      expect(fixture.nativeElement.textContent).toContain('0');
      expect(effectCount).toBe(1);

      debugElement
        .query(By.css('#updateSelected'))
        .triggerEventHandler('click', null);

      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('10');
      expect(effectCount).toBe(2);

      debugElement
        .query(By.css('#updateIgnored'))
        .triggerEventHandler('click', null);

      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('10');
      expect(effectCount).toBe(2); // No re-render for ignored field
    });
  });

  describe('re-exports', () => {
    it('should re-export createStore from @xstate/store', () => {
      expect(createStore).toBeDefined();
      const store = createStore({
        context: { value: 'test' },
        on: {}
      });
      expect(store.get().context.value).toBe('test');
    });

    it('should re-export createAtom from @xstate/store', () => {
      expect(createAtom).toBeDefined();
      const atom = createAtom(123);
      expect(atom.get()).toBe(123);
    });
  });
});
