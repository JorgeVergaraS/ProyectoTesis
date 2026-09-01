import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { DemoSessionStore } from './core/auth/demo-session.store';
import { AuthService } from './core/auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
})
export class App {
  readonly session = inject(DemoSessionStore);
  private readonly msal = inject(MsalService);
  private readonly auth = inject(AuthService);

  constructor() {
    this.msal.handleRedirectObservable().subscribe({
      next: (result) => void this.auth.completeRedirect(result),
    });
  }
}
