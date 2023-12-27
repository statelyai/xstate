import {
  Component,
  ViewChild,
  ElementRef,
  Injector,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { toggleMachine } from './toggleMachine';
// import { injectActor } from './injectActor';
import { injectActor } from '@xstate/angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div>
      <div class="card">
        <!-- <output>{{ stateLabel }}</output> -->
        <output>{{ toggleActor.snapshot().value }}</output>
        <button type="button" (click)="handleToggleClick()">Toggle</button>
      </div>
    </div>
  `,
  styleUrl: './app.component.css'
})
export class AppComponent {
  @ViewChild('output') outputEl!: ElementRef<HTMLDivElement>;
  // protected stateLabel: string = '';

  #injector = inject(Injector);
  toggleActor = injectActor(toggleMachine, undefined, {
    injector: this.#injector
  });

  constructor() {
    this.toggleActor.ref.start();
    // this.toggleActor.ref.subscribe((snapshot) => {
    //   this.stateLabel = snapshot.value as string
    // });
    // this.stateLabel = this.toggleActor.ref.getSnapshot().value as string;
  }

  handleToggleClick() {
    this.toggleActor.send({ type: 'toggle' });
  }
}
