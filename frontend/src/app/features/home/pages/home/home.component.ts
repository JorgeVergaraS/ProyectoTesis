import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <main class="home-page">
      <header class="home-header">
        <a routerLink="/home" class="brand">Nexo</a>
        <button type="button" class="secondary-button" (click)="logout()">Cerrar sesión</button>
      </header>
      @if (auth.session.user(); as user) {
        <section class="welcome-card">
          <p class="eyebrow">TU COMUNIDAD UNIVERSITARIA</p>
          <h1>Hola, {{ user.displayName }}.</h1>
          <p>Tu identidad está verificada con Microsoft Entra ID.</p>
          <div class="user-summary">
            <strong>{{ user.displayName }}</strong>
            <span>{{ user.username }}</span>
          </div>
          <a routerLink="/profile" class="primary-button">Ver mi perfil</a>
        </section>
      } @else {
        <p role="status">Cargando tu perfil…</p>
      }
    </main>
  `,
  styles: `
    .home-page {
      min-height: 100dvh;
      max-width: 1100px;
      margin: auto;
      padding: 36px 60px;
    }
    .home-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand {
      color: #eef2ff;
      font-size: 28px;
      font-weight: 750;
      text-decoration: none;
    }
    .welcome-card {
      max-width: 680px;
      margin: 15vh auto;
      padding: 56px;
      background: linear-gradient(145deg, #11182a, #0d1423);
      border: 1px solid #252d44;
      border-radius: 24px;
    }
    h1 {
      font-size: clamp(42px, 6vw, 72px);
      line-height: 1.05;
      letter-spacing: -3px;
      margin: 18px 0;
    }
    .welcome-card > p:not(.eyebrow) {
      color: #a7b2ca;
      line-height: 1.8;
    }
    .user-summary {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 32px 0;
      padding: 18px;
      border: 1px solid #2a3550;
      border-radius: 14px;
    }
    .user-summary span {
      color: #a78bfa;
      font-size: 13px;
    }
    @media (max-width: 600px) {
      .home-page {
        padding: 24px 18px;
      }
      .welcome-card {
        padding: 30px 22px;
        margin-top: 12vh;
      }
    }
  `,
})
export class HomeComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
