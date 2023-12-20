import {
  Component,
  ViewChild,
  ElementRef,
  Injector,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { toggleMachine } from './toggleMachine';
import { injectActor } from '@xstate/angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div>
      <div class="card">
        <output id="output" #output>{{ stateLabel }}</output>
        <button id="toggle" type="button" (click)="handleToggleClick()">
          Toggle
        </button>
      </div>
    </div>
  `,
  styleUrl: './app.component.css'
})
export class AppComponent {
  @ViewChild('output') outputEl!: ElementRef<HTMLDivElement>;
  protected stateLabel: string = '';

  #injector = inject(Injector);
  // toggleActor!: ReturnType<typeof injectActor>// = injectActor(toggleMachine, undefined, { injector: this.#injector });
  toggleActor = injectActor(toggleMachine, undefined, {
    injector: this.#injector
  });

  ngAfterViewInit() {
    // this.toggleActor = injectActor(toggleMachine, undefined, { injector: this.#injector });
    this.toggleActor.ref.subscribe((snapshot) => {
      this.outputEl.nativeElement.innerHTML =
        snapshot.value === 'active' ? 'Active' : 'Inactive';
    });
    // setTimeout(() => {
    this.toggleActor.ref.start();
    this.stateLabel = this.toggleActor.ref.getSnapshot().value as string;
    // }, 0);
  }

  handleToggleClick() {
    this.toggleActor.send({ type: 'toggle' });
  }
}
