import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { ProfileService } from '../../../../core/services/profile.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-profile',
  imports: [RouterLink],
  template: `
    <main class="profile-page">
      <header>
        <a routerLink="/home" class="brand"><span>N</span>Nexo<b>.</b></a>
        <a routerLink="/home" class="back">← Volver al inicio</a>
      </header>
      @if (auth.session.user(); as user) {
        <section class="card">
          <p class="label"><i></i> PERFIL AUTENTICADO</p>
          @if (user.avatarUrl; as avatarUrl) {
            <img
              class="avatar avatar-image"
              [src]="avatarUrl"
              [alt]="'Foto de ' + user.displayName"
            />
          } @else {
            <div class="avatar">{{ user.displayName.charAt(0) }}<b>✓</b></div>
          }
          <h1>{{ user.displayName }}</h1>
          <p class="username">{{ user.email || user.username }}</p>
          <p class="active"><i></i> Cuenta activa y sincronizada</p>
          <dl>
            <div>
              <dt>Nombre</dt>
              <dd>{{ user.displayName }}</dd>
            </div>
            <div>
              <dt>Usuario</dt>
              <dd>{{ user.username }}</dd>
            </div>
            <div>
              <dt>Proveedor de identidad</dt>
              <dd>
                {{ auth.session.kind() === 'local' ? 'Cuenta local Nexo' : 'Microsoft Entra ID' }}
              </dd>
            </div>
          </dl>
          @if (auth.session.kind() === 'demo') {
            <label class="avatar-upload">
              <span>{{ uploading() ? 'Guardando foto…' : 'Cambiar foto de perfil' }}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                [disabled]="uploading()"
                (change)="uploadAvatar($event)"
              />
            </label>
            @if (profileError()) {
              <p class="profile-error" role="alert">{{ profileError() }}</p>
            }
          } @else {
            <p class="profile-help">
              La identidad y los datos de Microsoft se administran de forma segura por Entra ID.
            </p>
          }
          <button type="button" (click)="logout()">Cerrar sesión <span>↗</span></button>
        </section>
      } @else {
        <p role="status">Cargando tu perfil…</p>
      }
    </main>
  `,
  styles: `
    .profile-page {
      max-width: 850px;
      min-height: 100dvh;
      margin: auto;
      padding: 30px 24px 60px;
    }
    .profile-page header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 34px;
      border-bottom: 1px solid #202940;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 9px;
      color: #eef2ff;
      font-size: 24px;
      font-weight: 750;
      text-decoration: none;
    }
    .brand > span {
      display: grid;
      place-items: center;
      width: 33px;
      height: 35px;
      border-radius: 10px;
      background: linear-gradient(140deg, #9c5df5, #576fea);
      font-size: 20px;
    }
    .brand > b {
      color: #a78bfa;
    }
    .back {
      color: #9daac3;
      text-decoration: none;
      font-size: 12px;
    }
    .back:hover {
      color: #fff;
    }
    .card {
      max-width: 650px;
      margin: 62px auto 0;
      padding: 38px clamp(22px, 6vw, 60px);
      background: linear-gradient(145deg, #151e34, #0e1728);
      border: 1px solid #2c3853;
      border-radius: 24px;
      text-align: center;
      box-shadow: 0 25px 60px #00000024;
    }
    .label {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      color: #b99eff;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2px;
    }
    .label i,
    .active i {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #63e2a5;
      box-shadow: 0 0 10px #63e2a5;
    }
    .avatar {
      position: relative;
      width: 95px;
      height: 95px;
      margin: 28px auto 17px;
      display: grid;
      place-items: center;
      border: 3px solid #8c63ec;
      border-radius: 28px;
      background: linear-gradient(145deg, #6840cf, #2a4f9e);
      font-size: 43px;
      font-weight: 800;
      box-shadow: 0 0 0 8px #8255d21c;
    }
    .avatar > b {
      position: absolute;
      right: -7px;
      bottom: -5px;
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      border: 3px solid #111a2c;
      border-radius: 50%;
      background: #49cd91;
      color: #0b271c;
      font-size: 11px;
    }
    .avatar-image {
      object-fit: cover;
    }
    .avatar-upload {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 18px;
      padding: 10px 14px;
      color: #d7c7ff;
      border: 1px solid #55407d;
      border-radius: 9px;
      background: #241942;
      font-size: 11px;
      cursor: pointer;
    }
    .avatar-upload input {
      width: 1px;
      height: 1px;
      opacity: 0;
      position: absolute;
    }
    .profile-error {
      margin: 0 0 16px;
      color: #ff9caa;
      font-size: 11px;
    }
    .profile-help {
      margin: 0 0 20px;
      color: #8f9bb2;
      font-size: 11px;
      line-height: 1.6;
    }
    .card h1 {
      margin: 0;
      font-size: 32px;
      letter-spacing: -0.8px;
    }
    .username {
      color: #a78bfa;
      font-size: 13px;
    }
    .active {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 7px;
      color: #8de0b7;
      font-size: 10px;
    }
    .card dl {
      margin: 32px 0 28px;
      text-align: left;
    }
    .card dl > div {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 0;
      border-top: 1px solid #283047;
      font-size: 12px;
    }
    .card dt {
      color: #8492ae;
    }
    .card dd {
      margin: 0;
      color: #e0e7f6;
      text-align: right;
    }
    .card button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid #35405a;
      border-radius: 8px;
      padding: 10px 15px;
      background: #1a2337;
      color: #c9d3e8;
      font-size: 12px;
    }
    .card button:hover {
      background: #242d45;
    }
    .card button span {
      color: #b99eff;
    }
    @media (max-width: 500px) {
      .profile-page {
        padding: 22px 18px 45px;
      }
      .profile-page header {
        padding-bottom: 23px;
      }
      .card {
        margin-top: 40px;
        padding: 30px 18px;
      }
      .card dl > div {
        flex-direction: column;
        gap: 5px;
      }
      .card dd {
        text-align: left;
      }
    }
  `,
})
export class ProfileComponent {
  readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileService);
  private readonly router = inject(Router);
  readonly uploading = signal(false);
  readonly profileError = signal('');

  async uploadAvatar(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      this.profileError.set('Usa una imagen PNG, JPG o WEBP de máximo 2 MB.');
      input.value = '';
      return;
    }
    this.uploading.set(true);
    this.profileError.set('');
    try {
      const user = await firstValueFrom(this.profile.upload(file));
      this.auth.session.user.set(user);
    } catch {
      this.profileError.set('No se pudo guardar la foto. Inténtalo nuevamente.');
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
