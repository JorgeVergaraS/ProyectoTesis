import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';

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
          <div class="avatar">{{ user.displayName.charAt(0) }}<b>✓</b></div>
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
  private readonly router = inject(Router);

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
