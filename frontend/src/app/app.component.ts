import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { DemoSessionStore } from './core/auth/demo-session.store';
import { AuthService } from './core/auth/auth.service';
import { ThemeService } from './core/services/theme.service';
import { VoiceCallPanelComponent } from './shared/components/voice-call-panel.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, VoiceCallPanelComponent],
  templateUrl: './app.component.html',
})
export class App {
  readonly session = inject(DemoSessionStore);
  private readonly msal = inject(MsalService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    inject(ThemeService);
    this.msal.handleRedirectObservable().subscribe({
      next: (result) => {
        void this.auth.completeRedirect(result).then((authenticated) => {
          if (result && authenticated) void this.router.navigate(['/home'], { replaceUrl: true });
        });
      },
      error: (error: unknown) => {
        const details = error as { errorCode?: string; message?: string };
        console.error('MSAL redirect failed', {
          errorCode: details?.errorCode,
          message: details?.message,
        });
        void this.router.navigate(['/login'], {
          replaceUrl: true,
          queryParams: { reason: 'microsoft-error' },
        });
      },
    });
  }
}
