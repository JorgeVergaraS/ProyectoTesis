import { Component, DestroyRef, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProfileService } from '../../../../core/services/profile.service';
import { VoiceCallService } from '../../../../core/realtime/voice-call.service';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { AvatarComponent } from '../../../../shared/components/avatar.component';
import { IconComponent } from '../../../../shared/components/icon.component';

@Component({
  selector: 'app-profile',
  imports: [RouterLink, AvatarComponent, IconComponent],
  template: `<main class="profile-page">
    <a routerLink="/home" class="back-link"><nexo-icon name="back" />Volver a la comunidad</a>
    <section class="profile-card">
      <span class="demo-pill">PERFIL DEMO LOCAL</span>
      @if (auth.session.user(); as user) {
        <nexo-avatar
          [src]="user.avatarUrl"
          [name]="user.displayName"
          [color]="user.color"
          [large]="true"
        />
        <h1>{{ user.displayName }}</h1>
        <span class="handle">@{{ user.username }}</span>
        <section class="photo-settings" aria-label="Foto de perfil">
          <h2>Tu foto de perfil</h2>
          <p>Opcional · JPG o PNG, hasta 2 MB. Se recorta al centro.</p>
          <label for="avatar-file">Elegir una imagen</label>
          <input
            id="avatar-file"
            type="file"
            accept="image/jpeg,image/png"
            [disabled]="busy()"
            (change)="choosePhoto($event)"
          />
          @if (preview()) {
            <img class="photo-preview" [src]="preview()" alt="Vista previa de tu nueva foto" />
            <div class="photo-actions">
              <button class="primary-button" [disabled]="busy()" (click)="savePhoto()">
                {{ busy() ? 'Guardando…' : 'Guardar foto' }}
              </button>
              <button class="secondary-button" [disabled]="busy()" (click)="clearPhoto()">
                Cancelar
              </button>
            </div>
          }
          @if (user.avatarUrl) {
            <button class="secondary-button" [disabled]="busy()" (click)="removePhoto()">
              Quitar foto
            </button>
          }
          @if (photoError()) {
            <p class="error-note" role="alert">{{ photoError() }}</p>
          }
          @if (photoNotice()) {
            <p role="status">{{ photoNotice() }}</p>
          }
          <small
            >La foto será visible para los demás perfiles y en el selector de usuarios de esta
            demo.</small
          >
        </section>
        <p>{{ user.bio }}</p>
        <dl>
          <div>
            <dt>Tipo de identidad</dt>
            <dd>Usuario de demostración</dd>
          </div>
          <div>
            <dt>Sesión</dt>
            <dd>Independiente por pestaña</dd>
          </div>
          <div>
            <dt>Correo Microsoft</dt>
            <dd>No conectado</dd>
          </div>
        </dl>
      }
      <p class="profile-note">
        Este perfil no tiene contraseña ni está vinculado a Microsoft. Puedes probar otro usuario
        cerrando esta sesión o abriendo una pestaña nueva.
      </p>
      <button class="secondary-button" [disabled]="busy()" (click)="logout()">
        <nexo-icon name="logout" />Cerrar sesión
      </button>
    </section>
  </main>`,
  styles: [
    `
      .profile-page {
        max-width: 700px;
        margin: auto;
        padding: 45px 24px;
      }
      .back-link {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #abb7d0;
        text-decoration: none;
        font-size: 13px;
      }
      .profile-card {
        margin-top: 36px;
        padding: 40px;
        background: #101726;
        border: 1px solid #263047;
        border-radius: 20px;
        display: flex;
        align-items: center;
        flex-direction: column;
      }
      .profile-card > nexo-avatar {
        margin-top: 30px;
      }
      h1 {
        font-size: 32px;
        font-weight: 650;
        margin: 15px 0 0;
      }
      .handle {
        font-size: 13px;
        color: #a78bfa;
      }
      .profile-card > p {
        color: #a0acc3;
        line-height: 1.8;
        text-align: center;
        font-size: 14px;
      }
      dl {
        width: 100%;
        margin: 25px 0;
      }
      dl > div {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 16px 0;
        border-top: 1px solid #283047;
        font-size: 12px;
      }
      dt {
        color: #8c99b4;
      }
      dd {
        margin: 0;
        text-align: right;
      }
      .profile-note {
        font-size: 12px !important;
      }
      .secondary-button {
        margin-top: 16px;
      }
      .photo-settings {
        width: 100%;
        margin: 22px 0 0;
        padding: 20px;
        border: 1px solid #363047;
        border-radius: 14px;
      }
      .photo-settings h2 {
        font-size: 17px;
        margin: 0 0 8px;
      }
      .photo-settings p,
      .photo-settings small {
        font-size: 11px;
        line-height: 1.8;
        color: #a9b3c7;
      }
      .photo-settings small {
        display: block;
        margin-top: 14px;
      }
      .photo-settings label {
        display: block;
        font-size: 12px;
        margin: 14px 0 8px;
      }
      .photo-settings input {
        max-width: 100%;
        font-size: 12px;
      }
      .photo-preview {
        width: 96px;
        height: 96px;
        object-fit: cover;
        border-radius: 50%;
        margin: 18px auto;
      }
      .photo-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .photo-actions .secondary-button {
        margin: 0;
      }
      @media (max-width: 500px) {
        .profile-card {
          padding: 24px 16px;
        }
        .photo-settings {
          padding: 14px;
        }
      }
    `,
  ],
})
export class ProfileComponent {
  readonly auth = inject(AuthService);
  private readonly calls = inject(VoiceCallService);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  private readonly profiles = inject(ProfileService);
  readonly preview = signal('');
  readonly photoError = signal('');
  readonly photoNotice = signal('');
  private selectedPhoto: File | null = null;
  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearPhoto());
  }
  clearPhoto(): void {
    if (this.preview()) URL.revokeObjectURL(this.preview());
    this.preview.set('');
    this.selectedPhoto = null;
  }
  choosePhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.clearPhoto();
    this.photoNotice.set('');
    this.photoError.set('');
    if (
      !['image/jpeg', 'image/png'].includes(file.type) ||
      file.size > 2 * 1024 * 1024 ||
      !file.size
    ) {
      this.photoError.set('Elige una imagen JPG o PNG de hasta 2 MB.');
      return;
    }
    this.selectedPhoto = file;
    this.preview.set(URL.createObjectURL(file));
  }
  async savePhoto(): Promise<void> {
    if (!this.selectedPhoto || this.busy()) return;
    this.busy.set(true);
    this.photoError.set('');
    try {
      this.auth.session.user.set(await firstValueFrom(this.profiles.upload(this.selectedPhoto)));
      this.clearPhoto();
      this.photoNotice.set('Tu foto se actualizó.');
    } catch {
      this.photoError.set(
        'No se pudo guardar. Usa un JPG o PNG válido de hasta 2 MB y 4096 × 4096 píxeles.',
      );
    } finally {
      this.busy.set(false);
    }
  }
  async removePhoto(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.photoError.set('');
    try {
      this.auth.session.user.set(await firstValueFrom(this.profiles.removeAvatar()));
      this.clearPhoto();
      this.photoNotice.set('Foto eliminada. Se mostrarán tus iniciales.');
    } catch {
      this.photoError.set('No pudimos quitar tu foto. Inténtalo de nuevo.');
    } finally {
      this.busy.set(false);
    }
  }
  async logout(): Promise<void> {
    this.busy.set(true);
    if (this.calls.occupied()) await this.calls.hangUp();
    const revoked = await this.auth.logout();
    await this.router.navigate(['/login'], {
      queryParams: revoked ? {} : { reason: 'local-only' },
    });
  }
}
