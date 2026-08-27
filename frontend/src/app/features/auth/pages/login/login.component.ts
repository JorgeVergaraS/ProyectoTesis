import { Component, inject, signal, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DemoAuthService } from '../../../../core/auth/demo-auth.service';
import { DemoUser } from '../../../../core/models/demo';
import { AvatarComponent } from '../../../../shared/components/avatar.component';
import { IconComponent } from '../../../../shared/components/icon.component';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, AvatarComponent, IconComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(DemoAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly people = signal<DemoUser[]>([]);
  readonly selected = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly form = new FormGroup({ userId: this.selected });
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice =
    this.route.snapshot.queryParamMap.get('reason') === 'expired'
      ? 'Tu sesión venció. Elige un usuario para volver a entrar.'
      : this.route.snapshot.queryParamMap.get('reason') === 'local-only'
        ? 'Cerraste esta pestaña, pero no pudimos revocar la sesión en el servidor. Vence en un máximo de 8 horas.'
        : '';
  ngOnInit(): void {
    void this.load();
  }
  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const users = await firstValueFrom(this.auth.choices());
      this.people.set(users);
      this.selected.setValue(users.find((u) => u.username === 'jorge')?.id ?? users[0]?.id ?? '');
    } catch {
      this.error.set(
        'No pudimos cargar la demo. Comprueba que el backend esté iniciado con el perfil local-demo.',
      );
    } finally {
      this.loading.set(false);
    }
  }
  name(): string {
    return this.people().find((u) => u.id === this.selected.value)?.displayName ?? 'tu usuario';
  }
  async enter(): Promise<void> {
    if (this.busy() || this.selected.invalid) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.selected.value);
      await this.router.navigate(['/home']);
    } catch {
      this.error.set('No pudimos iniciar la sesión. Inténtalo de nuevo.');
    } finally {
      this.busy.set(false);
    }
  }
}
