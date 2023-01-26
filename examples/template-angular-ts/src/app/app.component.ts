import { Component } from '@angular/core';
import { from } from 'rxjs';
import { toggleMachine } from 'src/toggle.machine';
import { interpret } from 'xstate';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  actor = interpret(toggleMachine).start();
  state$ = from(this.actor);
}
