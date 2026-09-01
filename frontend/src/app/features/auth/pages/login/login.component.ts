import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { IconComponent } from '../../../../shared/components/icon.component';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, IconComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  readonly configured = this.auth.isConfigured;
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice =
    this.route.snapshot.queryParamMap.get('reason') === 'expired'
      ? 'Tu sesión venció. Vuelve a iniciar sesión con Microsoft.'
      : '';

  async enter(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.login();
    } catch {
      this.error.set('No pudimos iniciar sesión con Microsoft. Inténtalo nuevamente.');
      this.busy.set(false);
    }
  }
}
