import { Component, inject, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { PendingChangesAware } from '../../../../core/guards/pending-changes.guard';
import { DemoUser } from '../../../../core/models/demo';
import { ProfilePanelComponent } from '../../components/profile-panel.component';

@Component({
  selector: 'app-profile',
  imports: [ProfilePanelComponent],
  template: `
    <main class="profile-route">
      @if (auth.session.user(); as user) {
        <header class="profile-intro">
          <span>PERFIL + CREACIÓN</span>
          <h1>Tu identidad.<br /><em>Tu momento en vivo.</em></h1>
          <p>
            Un perfil para conectar. Un estudio para compartir lo que te mueve, con tu comunidad y a
            tu ritmo.
          </p>
        </header>
        <nexo-profile-panel
          [user]="user"
          [sessionKind]="auth.session.kind()"
          variant="page"
          (userChange)="updateUser($event)"
          (closed)="goHome()"
          (signOut)="logout()"
        />
      } @else {
        <p role="status">Cargando tu perfil…</p>
      }
    </main>
  `,
  styles: `
    .profile-route {
      display: grid;
      grid-template-columns: minmax(260px, 0.75fr) minmax(360px, 780px);
      gap: clamp(24px, 5vw, 72px);
      align-items: center;
      justify-content: center;
      min-height: 100dvh;
      box-sizing: border-box;
      padding: clamp(24px, 6vw, 88px);
      color: var(--theme-text, #edf0fa);
      background:
        radial-gradient(circle at 12% 8%, color-mix(in srgb, var(--theme-accent, #6958d8) 13%, transparent), transparent 36rem),
        var(--theme-bg, #090c13);
    }
    .profile-route > p {
      color: #9da7ba;
    }
    .profile-intro {
      max-width: 560px;
    }
    .profile-intro > span {
      color: var(--theme-accent, #5ee4b7);
      font-size: 11px;
      letter-spacing: 0.16em;
      font-weight: 700;
    }
    .profile-intro h1 {
      font-size: clamp(32px, 4vw, 60px);
      line-height: 1.1;
      letter-spacing: -0.04em;
      margin: 22px 0;
    }
    .profile-intro em {
      font-style: normal;
      background: linear-gradient(100deg, var(--theme-accent, #b098ff), #50ccd7);
      background-clip: text;
      color: transparent;
    }
    .profile-intro p {
      color: var(--theme-muted, #a4b5c9);
      line-height: 1.8;
      font-size: 14px;
    }
    @media (max-width: 1000px) {
      .profile-route {
        grid-template-columns: minmax(0, 1fr);
        gap: 24px;
      }
      .profile-intro {
        width: 100%;
        max-width: 780px;
      }
    }
    @media (max-width: 760px) {
      .profile-route {
        min-height: 100dvh;
        align-content: start;
        gap: 18px;
        padding: max(22px, env(safe-area-inset-top)) 14px max(22px, env(safe-area-inset-bottom));
      }
      .profile-intro h1 {
        margin: 12px 0;
        font-size: clamp(32px, 9vw, 48px);
      }
      .profile-intro p {
        margin-bottom: 0;
        font-size: 13px;
      }
    }
    @media (max-width: 600px) {
      .profile-route {
        padding: 20px 12px;
      }
    }
  `,
})
export class ProfileComponent implements PendingChangesAware {
  readonly auth = inject(AuthService);
  readonly panel = viewChild(ProfilePanelComponent);
  private readonly router = inject(Router);

  canDeactivate(): boolean {
    return this.panel()?.confirmNavigation() ?? true;
  }

  updateUser(user: DemoUser): void {
    this.auth.session.user.set(user);
  }

  async goHome(): Promise<void> {
    await this.router.navigate(['/home']);
  }

  async logout(): Promise<void> {
    if (!this.canDeactivate()) return;
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
