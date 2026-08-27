import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DemoSessionStore } from './core/auth/demo-session.store';
import { VoiceCallPanelComponent } from './shared/components/voice-call-panel.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, VoiceCallPanelComponent],
  templateUrl: './app.component.html',
})
export class App {
  readonly session = inject(DemoSessionStore);
}
