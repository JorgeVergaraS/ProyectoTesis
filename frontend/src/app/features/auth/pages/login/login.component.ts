import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  readonly configured = this.auth.isConfigured;
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice =
    this.route.snapshot.queryParamMap.get('reason') === 'expired'
      ? 'Tu sesión venció. Vuelve a iniciar sesión con Microsoft.'
      : '';
  readonly mode = signal<'login' | 'register'>('login');
  readonly localBusy = signal(false);
  readonly localError = signal('');
  readonly localForm = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

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

  toggleMode(): void { this.mode.update((value) => value === 'login' ? 'register' : 'login'); this.localError.set(''); }

  async submitLocal(): Promise<void> {
    if (this.localForm.invalid || this.localBusy()) { this.localForm.markAllAsTouched(); return; }
    this.localBusy.set(true); this.localError.set('');
    const value = this.localForm.getRawValue();
    try {
      if (this.mode() === 'register') await this.auth.registerLocal(value);
      else await this.auth.loginLocal({ email: value.email, password: value.password });
      window.location.assign('/home');
    } catch (error: unknown) {
      const status = (error as { status?: number })?.status;
      this.localError.set(status === 409 ? 'Ese correo ya está registrado.' : status === 401 ? 'Correo o contraseña incorrectos.' : 'No pudimos completar la operación.');
      this.localBusy.set(false);
    }
  }
}
