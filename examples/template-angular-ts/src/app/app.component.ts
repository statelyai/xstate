import { Component, OnInit } from '@angular/core';
import { toggleMachine } from 'src/toggle.machine';
import { interpret } from 'xstate';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  actor = interpret(toggleMachine);

  ngOnInit(): void {
    this.actor.start();
  }
}
