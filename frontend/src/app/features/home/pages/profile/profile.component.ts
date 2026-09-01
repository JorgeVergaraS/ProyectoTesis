import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-profile',
  imports: [RouterLink],
  template: `
    <main class="profile-page">
      <a routerLink="/home" class="back-link">← Volver al inicio</a>
      @if (auth.session.user(); as user) {
        <section class="profile-card">
          <p class="eyebrow">PERFIL AUTENTICADO</p>
          <div class="avatar">{{ user.displayName.charAt(0) }}</div>
          <h1>{{ user.displayName }}</h1>
          <p class="username">{{ user.username }}</p>
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
              <dd>Microsoft Entra ID</dd>
            </div>
          </dl>
          <button type="button" class="secondary-button" (click)="logout()">Cerrar sesión</button>
        </section>
      } @else {
        <p role="status">Cargando tu perfil…</p>
      }
    </main>
  `,
  styles: `
    .profile-page {
      max-width: 700px;
      margin: auto;
      padding: 45px 24px;
    }
    .back-link {
      color: #abb7d0;
      text-decoration: none;
      font-size: 13px;
    }
    .profile-card {
      margin-top: 36px;
      padding: 48px;
      background: #101726;
      border: 1px solid #263047;
      border-radius: 20px;
      text-align: center;
    }
    .avatar {
      width: 88px;
      height: 88px;
      margin: 28px auto 16px;
      display: grid;
      place-items: center;
      border-radius: 24px;
      background: linear-gradient(150deg, #7c3aed, #4c49b3);
      font-size: 42px;
      font-weight: 800;
    }
    h1 {
      margin: 0;
      font-size: 36px;
    }
    .username {
      color: #a78bfa;
    }
    dl {
      margin: 32px 0;
      text-align: left;
    }
    dl > div {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 0;
      border-top: 1px solid #283047;
      font-size: 13px;
    }
    dt {
      color: #8c99b4;
    }
    dd {
      margin: 0;
      text-align: right;
    }
    @media (max-width: 500px) {
      .profile-card {
        padding: 30px 18px;
      }
      dl > div {
        flex-direction: column;
        gap: 5px;
      }
      dd {
        text-align: left;
      }
    }
  `,
})
export class ProfileComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
